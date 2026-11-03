import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAllReminders, saveReminder, deleteReminder, getHolidayDate, getDataDir } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = getDataDir();
const settingsPath = path.join(dataDir, 'settings.json');
let currentSettings = {}; // In-memory cache for settings

let dailyReminderJobInstance = null;

const TAMIL_MONTH_DATA = [
  { name: 'Chithirai', gregorianMonth: 3, gregorianDay: 14, days: 31 },
  { name: 'Vaikasi', gregorianMonth: 4, gregorianDay: 14, days: 31 },
  { name: 'Aani', gregorianMonth: 5, gregorianDay: 15, days: 32 },
  { name: 'Aadi', gregorianMonth: 6, gregorianDay: 16, days: 31 },
  { name: 'Avani', gregorianMonth: 7, gregorianDay: 17, days: 31 },
  { name: 'Purattasi', gregorianMonth: 8, gregorianDay: 17, days: 31 },
  { name: 'Aippasi', gregorianMonth: 9, gregorianDay: 17, days: 30 },
  { name: 'Karthigai', gregorianMonth: 10, gregorianDay: 16, days: 29 },
  { name: 'Margazhi', gregorianMonth: 11, gregorianDay: 16, days: 29 },
  { name: 'Thai', gregorianMonth: 0, gregorianDay: 14, days: 30 },
  { name: 'Maasi', gregorianMonth: 1, gregorianDay: 13, days: 30 },
  { name: 'Panguni', gregorianMonth: 2, gregorianDay: 14, days: 30 }
];

const reminderSystemPrompt = `
You are an intelligent assistant for OmniReminders that processes natural language text into structured reminder data.
Analyze the user's input and extract details to create a reminder.
Respond ONLY with a single, valid JSON object (no markdown, no backticks, no conversational fluff).

The JSON object MUST follow this schema:
{
  "Name": "string", // The title/subject of the reminder
  "Next Payment": "YYYY-MM-DD", // The upcoming date for the reminder
  "Time": "HH:MM", // 24-hour time format, default to "09:00" if unspecified
  "Repeat": "One-Time" | "Daily" | "Weekly" | "Monthly" | "Yearly",
  "remindBefore": 1, // Number of days before due date to alert (default 1)
  "Category": "General" | "Work" | "Personal" | "Health" | "Finance" | "Appointments" | "Study" | "Travel" | "Shopping" | "Culture" | "Other",
  "HolidayType": "string", // Optional: holiday name like "Diwali", "Pongal", "Christmas", "New Year" if relevant
  "Notes": "string", // Optional notes or context
  "question": "string" // Optional: ONLY include if critical information is missing to create the reminder
}

RULES:
1. Today's date is ${new Date().toISOString().split('T')[0]}. Calculate upcoming dates accurately.
2. For holidays like Diwali, Pongal, Christmas, identify HolidayType so exact dates can be synced.
3. For recurrence:
   - "every day" / "daily" -> "Daily"
   - "every week" / "weekly" -> "Weekly"
   - "every month" / "monthly" / "on the 25th of every month" -> "Monthly"
   - "every year" / "annually" / "every Diwali" -> "Yearly"
   - Otherwise -> "One-Time"
4. If the user only says something too ambiguous like "remind me later", populate "question" with a clarifying question.
`;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend assets
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
} else {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
}

async function ensureSettingsFile() {
  try {
    const data = await fs.readFile(settingsPath, 'utf-8');
    JSON.parse(data);
  } catch (e) {
    const defaultSettings = {
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      geminiModel: 'gemini-3.8-flash',
      calendarificApiKey: '',
      gotifyUrl: '',
      gotifyToken: '',
      smtpHost: '',
      smtpPort: '587',
      smtpUser: '',
      smtpPass: '',
      smtpFrom: '',
      testRecipient: '',
      notificationsEnabled: true,
      dailyCheckTime: '09:00',
      lastDailyCheck: null
    };
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
    currentSettings = defaultSettings;
  }
}

// ----------------------------------------------------
// Notification Helpers: Gotify & Nodemailer
// ----------------------------------------------------

function formatGotifyUrl(url) {
  if (!url) return '';
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'http://' + clean;
  }
  return clean;
}

async function sendGotifyNotification(config, title, message, priority = 5) {
  const url = formatGotifyUrl(config?.gotifyUrl || currentSettings.gotifyUrl);
  const token = (config?.gotifyToken || currentSettings.gotifyToken || '').trim();

  if (!url) throw new Error('Gotify Server URL is not configured.');
  if (!token) throw new Error('Gotify App Token is not configured.');

  const endpoint = `${url}/message`;
  console.log(`[Gotify] Sending push to ${endpoint}`);

  const res = await axios.post(
    endpoint,
    {
      title: title || 'OmniReminders',
      message: message || 'Reminder notification',
      priority: priority || 5
    },
    {
      headers: {
        'X-Gotify-Key': token,
        'Content-Type': 'application/json'
      },
      params: { token },
      timeout: 10000
    }
  );

  return res.data;
}

async function sendEmailNotification(config, to, subject, htmlContent, textContent) {
  const host = (config?.smtpHost || currentSettings.smtpHost || '').trim();
  const port = parseInt(config?.smtpPort || currentSettings.smtpPort || '587', 10);
  const user = (config?.smtpUser || currentSettings.smtpUser || '').trim();
  const pass = (config?.smtpPass || currentSettings.smtpPass || '').trim();
  const from = (config?.smtpFrom || currentSettings.smtpFrom || user || '').trim();

  if (!host) throw new Error('SMTP Host is not configured.');
  if (!user || !pass) throw new Error('SMTP Username and Password must be provided.');

  const targetEmail = (to || config?.testRecipient || currentSettings.testRecipient || user).trim();
  if (!targetEmail) throw new Error('Recipient email address is required.');

  const isSecure = port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Verify connection first
  await transporter.verify();

  const info = await transporter.sendMail({
    from: from || user,
    to: targetEmail,
    subject: subject || '🔔 OmniReminders Notification',
    text: textContent || htmlContent?.replace(/<[^>]+>/g, '') || 'Reminder alert',
    html: htmlContent || `<p>${textContent || 'Reminder alert'}</p>`
  });

  console.log(`[Email] Message sent: ${info.messageId} to ${targetEmail}`);
  return info;
}

// ----------------------------------------------------
// Daily Checks & Notification Dispatch
// ----------------------------------------------------

async function runReminderChecks(isManual = false) {
  console.log(`[Scheduler] ${isManual ? 'Manual' : 'Scheduled'} reminder check started...`);
  const allReminders = await getAllReminders();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const notificationsSent = [];
  const holidayUpdates = [];

  for (const rem of allReminders) {
    if (!rem['Next Payment']) continue;

    // 1. Check for passed yearly holiday reminders & auto-update
    if (rem.Repeat === 'Yearly' && rem.HolidayType) {
      const remDate = new Date(rem['Next Payment']);
      remDate.setHours(0, 0, 0, 0);

      if (remDate < today && currentSettings.calendarificApiKey) {
        const curYear = today.getFullYear();
        let nextHolidayObj = await getHolidayDate(rem.HolidayType, curYear, currentSettings.calendarificApiKey);

        if (!nextHolidayObj || new Date(nextHolidayObj.date.iso) < today) {
          nextHolidayObj = await getHolidayDate(rem.HolidayType, curYear + 1, currentSettings.calendarificApiKey);
        }

        if (nextHolidayObj && nextHolidayObj.date.iso !== rem['Next Payment']) {
          console.log(`[Scheduler] Holiday updated: ${rem.Name} (${rem.HolidayType}) -> ${nextHolidayObj.date.iso}`);
          rem['Next Payment'] = nextHolidayObj.date.iso;
          if (nextHolidayObj.description) {
            rem.Notes = rem.Notes ? `${rem.Notes}\n[Holiday] ${nextHolidayObj.description}` : `[Holiday] ${nextHolidayObj.description}`;
          }
          await saveReminder(rem, currentSettings);
          holidayUpdates.push({ id: rem.id, name: rem.Name, nextPayment: rem['Next Payment'] });
        }
      }
    }

    // 2. Determine due status
    if (rem.Active !== 'Yes') continue;

    const dueDate = new Date(rem['Next Payment']);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const remindBefore = typeof rem.remindBefore === 'number' ? rem.remindBefore : 3;

    // Trigger notification if due within `remindBefore` days or overdue by <= 3 days
    if (diffDays <= remindBefore && diffDays >= -3) {
      const urgencyText = diffDays === 0
        ? '⚠️ DUE TODAY'
        : diffDays < 0
          ? `🚨 OVERDUE by ${Math.abs(diffDays)} day(s)`
          : `📅 Due in ${diffDays} day(s)`;

      const title = `${urgencyText}: ${rem.Name}`;
      const msg = `Reminder: "${rem.Name}" is scheduled for ${rem['Next Payment']}${rem.Time ? ' at ' + rem.Time : ''}.\nCategory: ${rem.Category || 'General'}${rem.Notes ? '\nNotes: ' + rem.Notes : ''}`;

      let gotifyResult = null;
      let emailResult = null;

      // Gotify
      if (currentSettings.gotifyUrl && currentSettings.gotifyToken) {
        try {
          const priority = diffDays <= 0 ? 8 : 5;
          await sendGotifyNotification(currentSettings, title, msg, priority);
          gotifyResult = 'sent';
        } catch (err) {
          console.error(`[Gotify] Failed for ${rem.Name}:`, err.message);
          gotifyResult = `failed: ${err.message}`;
        }
      }

      // Email
      if (currentSettings.smtpHost && currentSettings.smtpUser) {
        try {
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
              <h2 style="color: ${diffDays <= 0 ? '#dc2626' : '#4f46e5'}; margin-top: 0;">${title}</h2>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; font-weight: bold; width: 120px; color: #475569;">Subject:</td><td style="padding: 8px; color: #1e293b;">${rem.Name}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold; color: #475569;">Due Date:</td><td style="padding: 8px; color: #1e293b;">${rem['Next Payment']} ${rem.Time || ''}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold; color: #475569;">Recurrence:</td><td style="padding: 8px; color: #1e293b;">${rem.Repeat || 'One-Time'}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold; color: #475569;">Category:</td><td style="padding: 8px; color: #1e293b;">${rem.Category || 'General'}</td></tr>
                ${rem.Notes ? `<tr><td style="padding: 8px; font-weight: bold; color: #475569;">Notes:</td><td style="padding: 8px; color: #1e293b;">${rem.Notes}</td></tr>` : ''}
              </table>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">Sent by OmniReminders Notification Scheduler.</p>
            </div>
          `;
          await sendEmailNotification(currentSettings, null, title, html, msg);
          emailResult = 'sent';
        } catch (err) {
          console.error(`[Email] Failed for ${rem.Name}:`, err.message);
          emailResult = `failed: ${err.message}`;
        }
      }

      notificationsSent.push({
        id: rem.id,
        name: rem.Name,
        diffDays,
        gotify: gotifyResult,
        email: emailResult
      });
    }
  }

  currentSettings.lastDailyCheck = new Date().toISOString();
  await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));

  return {
    checkedAt: currentSettings.lastDailyCheck,
    totalReminders: allReminders.length,
    notificationsSent,
    holidayUpdates
  };
}

function scheduleDailyReminder() {
  if (dailyReminderJobInstance) {
    dailyReminderJobInstance.stop();
    console.log('[Scheduler] Stopped existing daily reminder job.');
  }

  const { dailyCheckTime, notificationsEnabled } = currentSettings;
  if (!notificationsEnabled) {
    console.log('[Scheduler] Daily reminders are disabled in settings.');
    return;
  }

  const timeStr = dailyCheckTime || '09:00';
  const [hour, minute] = timeStr.split(':').map(Number);
  const cronTime = `0 ${minute || 0} ${hour || 9} * * *`;

  dailyReminderJobInstance = cron.schedule(
    cronTime,
    async () => {
      try {
        await runReminderChecks(false);
      } catch (err) {
        console.error('[Scheduler] Error during daily check:', err);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    }
  );

  console.log(`[Scheduler] Daily reminder job scheduled at ${timeStr} (cron: "${cronTime}").`);
}

// ----------------------------------------------------
// API Endpoints
// ----------------------------------------------------

// GET All Reminders
app.get('/api/reminders', async (req, res) => {
  try {
    const rems = await getAllReminders();
    res.json({ reminders: rems });
  } catch (error) {
    console.error('[GET /api/reminders] Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Save Reminder
app.post('/api/reminders', async (req, res) => {
  try {
    req.body.Source = req.body.Source || 'Manual';
    const rem = await saveReminder(req.body, currentSettings);
    res.json(rem);
  } catch (error) {
    console.error('[POST /api/reminders] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Reminder
app.delete('/api/reminders/:id', async (req, res) => {
  try {
    await deleteReminder(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/reminders/:id] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert Tamil Date to Gregorian
app.post('/api/convert-tamil-date', (req, res) => {
  try {
    const { tamilMonthIndex, tamilDay } = req.body;

    if (tamilMonthIndex === undefined || !Number.isInteger(tamilMonthIndex) || tamilDay === undefined) {
      return res.status(400).json({ error: 'Invalid or missing tamilMonthIndex or tamilDay' });
    }

    const monthData = TAMIL_MONTH_DATA[tamilMonthIndex];
    if (!monthData) {
      return res.status(400).json({ error: 'Invalid tamilMonthIndex' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();

    const startDate = new Date(year, monthData.gregorianMonth, monthData.gregorianDay);
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + (parseInt(tamilDay, 10) - 1));

    if (targetDate < today) {
      targetDate.setFullYear(year + 1);
    }

    res.json({ gregorianDate: targetDate.toISOString().split('T')[0] });
  } catch (error) {
    console.error('Error in /api/convert-tamil-date:', error);
    res.status(500).json({ error: 'Internal server error during date conversion.' });
  }
});

// Get Holiday Date
app.get('/api/holiday-date', async (req, res) => {
  const { holidayName, year } = req.query;
  if (!holidayName || !year) {
    return res.status(400).json({ error: 'holidayName and year are required.' });
  }
  try {
    const holidayObj = await getHolidayDate(holidayName, parseInt(year, 10), currentSettings.calendarificApiKey);
    if (holidayObj) {
      res.json({ date: holidayObj.date.iso, details: holidayObj });
    } else {
      res.status(404).json({ error: `Holiday '${holidayName}' not found for ${year}.` });
    }
  } catch (error) {
    console.error('Error fetching holiday date:', error);
    res.status(500).json({ error: 'Failed to fetch holiday date.' });
  }
});

// ----------------------------------------------------
// Gemini AI Endpoints
// ----------------------------------------------------

// List Available Gemini Models
app.get('/api/gemini/models', (req, res) => {
  res.json({
    models: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Latest & Recommended)', description: 'Ultra-fast, state-of-the-art model for text and reminder extraction' },
      { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro', description: 'Advanced reasoning and complex schedule deduction' },
      { id: 'gemini-3.8-pro', name: 'Gemini 3.8 Pro', description: 'Flagship reasoning model for heavy workloads' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', description: 'Fast, reliable general-purpose model' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', description: 'Ultra-fast, lightweight model' }
    ]
  });
});

// Backward compatibility for groq models route
app.get('/api/groq/models', (req, res) => {
  res.json({
    models: ['gemini-3.8-flash', 'gemini-3.5-pro', 'gemini-3.8-pro', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']
  });
});

// AI Reminder Creation via Google Gemini
app.post('/api/ai/create-reminder', async (req, res) => {
  const apiKey = (currentSettings.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(400).json({
      error: 'Gemini API Key is not configured. Please add your Gemini API Key in Settings.'
    });
  }

  const { text, model } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Reminder text is required.' });
  }

  const modelToUse = model || currentSettings.geminiModel || 'gemini-3.8-flash';
  console.log(`[Gemini AI] Processing reminder using model: ${modelToUse}`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const generativeModel = genAI.getGenerativeModel({
      model: modelToUse,
      systemInstruction: reminderSystemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const result = await generativeModel.generateContent(text);
    const responseText = result.response.text();
    console.log('[Gemini AI] Raw response:', responseText);

    const reminderData = JSON.parse(responseText);

    // If AI needs clarification
    if (reminderData.question) {
      return res.json({ question: reminderData.question });
    }

    // Default fallbacks
    reminderData.Source = 'AI';
    if (!reminderData.Name) {
      reminderData.Name = text.substring(0, 50);
    }
    if (!reminderData['Next Payment']) {
      reminderData['Next Payment'] = new Date().toISOString().split('T')[0];
    }
    if (!reminderData.Active) {
      reminderData.Active = 'Yes';
    }
    if (!reminderData.Repeat) {
      reminderData.Repeat = 'One-Time';
    }
    if (!reminderData.Category) {
      reminderData.Category = 'General';
    }

    // If it's a holiday reminder and Calendarific key is present, auto-lookup accurate date
    if (reminderData.HolidayType && currentSettings.calendarificApiKey) {
      const thisYear = new Date().getFullYear();
      const holidayObj = await getHolidayDate(reminderData.HolidayType, thisYear, currentSettings.calendarificApiKey);
      if (holidayObj?.date?.iso) {
        reminderData['Next Payment'] = holidayObj.date.iso;
        if (holidayObj.description) {
          reminderData.Notes = reminderData.Notes
            ? `${reminderData.Notes}\n[Holiday Info] ${holidayObj.description}`
            : `[Holiday Info] ${holidayObj.description}`;
        }
      }
    }

    const savedReminder = await saveReminder(reminderData, currentSettings);
    res.json(savedReminder);
  } catch (error) {
    console.error('[Gemini AI Error]:', error);
    const msg = error.message || 'Failed to generate reminder using Gemini AI.';
    res.status(500).json({ error: `Gemini AI Error: ${msg}` });
  }
});

// AI Reminder Analysis Endpoint
app.post('/api/ai/analyze', async (req, res) => {
  const apiKey = (currentSettings.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(400).json({
      error: 'Gemini API Key is not configured. Please add your Gemini API Key in Settings.'
    });
  }

  try {
    const reminders = await getAllReminders();
    const modelToUse = currentSettings.geminiModel || 'gemini-3.8-flash';

    const genAI = new GoogleGenerativeAI(apiKey);
    const generativeModel = genAI.getGenerativeModel({
      model: modelToUse,
      systemInstruction: `You are an executive personal assistant analyzing the user's reminders. Provide a concise, structured markdown report with:
1. 📊 Executive Summary (overall status, upcoming workload)
2. 🚨 Immediate Priorities (due today or within 3 days)
3. 💡 Optimization & Advice (e.g. grouped tasks, recurring patterns, suggestions)
Keep the tone helpful, professional, and clear.`
    });

    const prompt = `Here are the user's current reminders in JSON:\n${JSON.stringify(reminders, null, 2)}\nToday's date is ${new Date().toISOString().split('T')[0]}. Analyze these reminders and provide actionable insights.`;

    const result = await generativeModel.generateContent(prompt);
    res.json({ analysis: result.response.text() });
  } catch (error) {
    console.error('[Gemini AI Analyze Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze reminders with Gemini AI.' });
  }
});

// ----------------------------------------------------
// Testing Notification Endpoints
// ----------------------------------------------------

// Test Gotify
app.post('/api/test/gotify', async (req, res) => {
  try {
    const targetConfig = { ...currentSettings, ...req.body };
    const url = targetConfig.gotifyUrl;
    const token = targetConfig.gotifyToken;

    if (!url || !token) {
      return res.status(400).json({
        error: 'Gotify Server URL and App Token are required for testing.'
      });
    }

    console.log(`[Test Gotify] Testing connection to ${url}`);
    const result = await sendGotifyNotification(
      targetConfig,
      '🔔 OmniReminders Gotify Test',
      'Success! Your Gotify push notification connection from OmniReminders is working perfectly.',
      7
    );

    res.json({
      success: true,
      message: 'Test notification sent to Gotify successfully!',
      details: result
    });
  } catch (error) {
    console.error('[Test Gotify Error]:', error.message);
    const responseDetail = error.response ? ` (Status: ${error.response.status} - ${JSON.stringify(error.response.data)})` : '';
    res.status(500).json({
      error: `Gotify notification failed: ${error.message}${responseDetail}`
    });
  }
});

// Test Email
app.post('/api/test/email', async (req, res) => {
  try {
    const targetConfig = { ...currentSettings, ...req.body };
    const { smtpHost, smtpUser, smtpPass } = targetConfig;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return res.status(400).json({
        error: 'SMTP Host, Username, and Password are required for email testing.'
      });
    }

    const recipient = targetConfig.testRecipient || targetConfig.smtpUser;
    console.log(`[Test Email] Sending test email to ${recipient}`);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc;">
        <h2 style="color: #4f46e5; margin-top: 0;">🎉 OmniReminders Email Test Successful!</h2>
        <p style="color: #334155; line-height: 1.6;">
          Your SMTP email configuration in OmniReminders is working properly.
        </p>
        <div style="background-color: #ffffff; padding: 16px; border-radius: 6px; border: 1px solid #cbd5e1; margin: 16px 0;">
          <p style="margin: 4px 0; font-size: 14px;"><strong>SMTP Host:</strong> ${targetConfig.smtpHost}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>SMTP Port:</strong> ${targetConfig.smtpPort || '587'}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Sender:</strong> ${targetConfig.smtpFrom || targetConfig.smtpUser}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Recipient:</strong> ${recipient}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
          This is an automated test from your OmniReminders instance.
        </p>
      </div>
    `;

    const info = await sendEmailNotification(
      targetConfig,
      recipient,
      '🔔 OmniReminders Test Email',
      html,
      `OmniReminders test email was sent successfully to ${recipient} at ${new Date().toLocaleString()}`
    );

    res.json({
      success: true,
      message: `Test email sent successfully to ${recipient}!`,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('[Test Email Error]:', error.message);
    res.status(500).json({
      error: `Email notification failed: ${error.message}`
    });
  }
});

// Test/Run Reminder Check Now
app.post('/api/test/reminders', async (req, res) => {
  try {
    const report = await runReminderChecks(true);
    const count = report.notificationsSent.length;
    res.json({
      success: true,
      message: `Daily check completed! Checked ${report.totalReminders} reminders. Dispatched notifications for ${count} upcoming/due item(s).`,
      report
    });
  } catch (error) {
    console.error('[Run Daily Check Error]:', error);
    res.status(500).json({ error: error.message || 'Daily check failed.' });
  }
});

// ----------------------------------------------------
// HomeServer Pulse App Integration API
// ----------------------------------------------------

/**
 * Pulse API: /api/pulse/reminders
 * Specifically designed for integration into HomeServer Pulse App widgets and homelab dashboards.
 * Query parameters:
 *  - days: number of days ahead to look (default 7)
 *  - status: 'active' | 'all' (default 'active')
 *  - limit: max items in each list
 */
app.get('/api/pulse/reminders', async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days || '7', 10);
    const filterStatus = req.query.status || 'active';
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

    const allReminders = await getAllReminders();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + daysAhead);

    let filtered = allReminders;
    if (filterStatus === 'active') {
      filtered = filtered.filter(r => r.Active === 'Yes');
    }

    const dueToday = [];
    const dueTomorrow = [];
    const overdue = [];
    const upcoming = [];

    for (const rem of filtered) {
      if (!rem['Next Payment']) continue;
      const dueDate = new Date(rem['Next Payment']);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const item = {
        id: rem.id,
        name: rem.Name,
        dueDate: rem['Next Payment'],
        time: rem.Time || '09:00',
        category: rem.Category || 'General',
        repeat: rem.Repeat || 'One-Time',
        holidayType: rem.HolidayType || null,
        notes: rem.Notes || '',
        daysRemaining: diffDays,
        isOverdue: diffDays < 0,
        isToday: diffDays === 0
      };

      if (diffDays < 0) {
        overdue.push(item);
      } else if (diffDays === 0) {
        dueToday.push(item);
      } else if (diffDays === 1) {
        dueTomorrow.push(item);
        upcoming.push(item);
      } else if (diffDays <= daysAhead) {
        upcoming.push(item);
      }
    }

    // Sort overdue by most overdue first (smallest diffDays)
    overdue.sort((a, b) => a.daysRemaining - b.daysRemaining);
    // Sort upcoming by closest first
    upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const nextUpcoming = dueToday[0] || dueTomorrow[0] || upcoming[0] || null;

    res.json({
      status: 'ok',
      service: 'OmniReminders',
      timestamp: new Date().toISOString(),
      counts: {
        total: allReminders.length,
        active: allReminders.filter(r => r.Active === 'Yes').length,
        overdue: overdue.length,
        dueToday: dueToday.length,
        dueTomorrow: dueTomorrow.length,
        upcomingWithinWindow: upcoming.length,
        windowDays: daysAhead
      },
      nextUpcoming,
      dueToday: dueToday.slice(0, limit),
      dueTomorrow: dueTomorrow.slice(0, limit),
      overdue: overdue.slice(0, limit),
      upcoming: upcoming.slice(0, limit)
    });
  } catch (error) {
    console.error('[Pulse API Error]:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Pulse API Health endpoint
app.get('/api/pulse/health', async (req, res) => {
  try {
    const all = await getAllReminders();
    res.json({
      status: 'healthy',
      app: 'OmniReminders',
      version: '2.1.0',
      uptimeSeconds: Math.floor(process.uptime()),
      remindersTotal: all.length,
      lastDailyCheck: currentSettings.lastDailyCheck || null,
      notificationsEnabled: !!currentSettings.notificationsEnabled,
      hasGeminiConfigured: !!(currentSettings.geminiApiKey || process.env.GEMINI_API_KEY),
      hasGotifyConfigured: !!(currentSettings.gotifyUrl && currentSettings.gotifyToken),
      hasSmtpConfigured: !!(currentSettings.smtpHost && currentSettings.smtpUser)
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// ----------------------------------------------------
// Settings Endpoints
// ----------------------------------------------------

app.post('/api/settings', async (req, res) => {
  try {
    console.log('[Settings] Saving settings:', req.body);
    await ensureSettingsFile();
    const data = await fs.readFile(settingsPath, 'utf-8');
    const oldSettings = JSON.parse(data);

    // Merge and sanitize
    const newSettings = { ...oldSettings, ...req.body };
    if (newSettings.smtpPass) {
      newSettings.smtpPass = newSettings.smtpPass.trim();
    }
    if (newSettings.gotifyUrl) {
      newSettings.gotifyUrl = formatGotifyUrl(newSettings.gotifyUrl);
    }
    if (newSettings.gotifyToken) {
      newSettings.gotifyToken = newSettings.gotifyToken.trim();
    }
    if (newSettings.geminiApiKey) {
      newSettings.geminiApiKey = newSettings.geminiApiKey.trim();
    }

    await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2));
    currentSettings = newSettings;
    console.log('[Settings] Updated successfully in:', settingsPath);

    // Reschedule cron job
    scheduleDailyReminder();

    res.json({ success: true, settings: currentSettings });
  } catch (error) {
    console.error('Error in POST /api/settings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    await ensureSettingsFile();
    const data = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(data);
    res.json({
      ...settings,
      dailyCheckTime: settings.dailyCheckTime || '09:00',
      lastDailyCheck: settings.lastDailyCheck || null,
      geminiModel: settings.geminiModel || 'gemini-3.8-flash'
    });
  } catch (error) {
    console.error(`[Settings] Error reading settings: ${error.message}`);
    res.json({ dailyCheckTime: '09:00', lastDailyCheck: null, geminiModel: 'gemini-3.8-flash' });
  }
});

// ----------------------------------------------------
// Client SPA Routing Fallback
// ----------------------------------------------------

// Client SPA Routing Fallback (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api')) return next();

  const prodIndex = path.join(__dirname, 'public', 'index.html');
  const devIndex = path.join(__dirname, '..', 'client', 'dist', 'index.html');

  if (fsSync.existsSync(prodIndex)) {
    return res.sendFile(prodIndex);
  }
  if (fsSync.existsSync(devIndex)) {
    return res.sendFile(devIndex);
  }
  res.status(404).send('OmniReminders: Frontend build not found.');
});

// ----------------------------------------------------
// Start Server
// ----------------------------------------------------

app.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(` OmniReminders Server running on port ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Data Directory: ${dataDir}`);
  console.log(`===============================================`);
  await ensureSettingsFile();
  const data = await fs.readFile(settingsPath, 'utf-8');
  currentSettings = JSON.parse(data);
  scheduleDailyReminder();
});
