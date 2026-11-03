import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.platform !== 'win32' && fsSync.existsSync('/data')) return '/data';
  if (fsSync.existsSync('/app/data')) return '/app/data';
  return path.join(__dirname, '../data');
}

export function getDataPath() {
  const dir = getDataDir();
  if (!fsSync.existsSync(dir)) {
    try {
      fsSync.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error(`[DB] Failed to create data dir ${dir}:`, e.message);
    }
  }
  return path.join(dir, 'reminders.json');
}

const DATA_PATH = getDataPath();

// Ensure data exists and populate with samples if empty
async function ensureData() {
  const sampleReminders = [
    {
      id: crypto.randomUUID(),
      Name: 'Sample: Call Mom',
      'Next Payment': new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0],
      Category: 'Personal',
      Active: 'Yes',
      Notes: 'Wish her happy birthday!',
      Repeat: 'One-Time',
    },
    {
      id: crypto.randomUUID(),
      Name: 'Sample: Project Deadline',
      'Next Payment': new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0],
      Category: 'Work',
      Active: 'Yes',
      Notes: 'Submit the final report for Project X.',
      Repeat: 'One-Time',
    },
    {
      id: crypto.randomUUID(),
      Name: 'Sample: Buy Groceries',
      'Next Payment': new Date().toISOString().split('T')[0],
      Category: 'Shopping',
      Active: 'Yes',
      Notes: 'Milk, Eggs, Bread, Vegetables.',
      Repeat: 'One-Time',
    },
    {
      id: crypto.randomUUID(),
      Name: 'Sample: Doctor Appointment',
      'Next Payment': new Date(new Date().setDate(new Date().getDate() - 2)).toISOString().split('T')[0], // Past reminder
      Category: 'Health',
      Active: 'No', // Assuming past reminders might be inactive
      Notes: 'Annual check-up at Dr. Smith\'s office.',
      Repeat: 'One-Time',
    },
    {
      id: crypto.randomUUID(),
      Name: 'Sample: Tamil New Year',
      'Next Payment': '2026-04-14', // April 14, 2026 for demonstration
      Category: 'Culture',
      Active: 'Yes',
      Notes: 'Celebrate Puthandu!',
      Repeat: 'Yearly',
      tamilMonthIndex: 3, // Chithirai (0-indexed based on the server's mapping)
      tamilDay: 1 // 1st day of Chithirai
    }
  ];

  try {
    const data = await fs.readFile(DATA_PATH, 'utf-8');
    const parsedReminders = JSON.parse(data);
    
    if (parsedReminders.length === 0) {
      await fs.writeFile(DATA_PATH, JSON.stringify(sampleReminders, null, 2));
      return sampleReminders;
    }
    return parsedReminders;
  } catch (e) {
    await fs.writeFile(DATA_PATH, JSON.stringify(sampleReminders, null, 2));
    return sampleReminders;
  }
}

export async function getHolidayDate(holidayName, year, apiKey) {
  if (!apiKey) {
    console.warn('Calendarific API Key is not configured for holiday lookup.');
    return null;
  }
  try {
    const response = await axios.get('https://calendarific.com/api/v2/holidays', {
      params: {
        api_key: apiKey,
        country: 'IN', // India
        year: year,
        // type: 'national', // Removed filter to fetch all types of holidays
      },
    });

    const holidays = response.data.response.holidays;
    if (!Array.isArray(holidays)) {
      console.error(`[Holiday API] Calendarific response for ${year}/IN was not an array. Actual response:`, response.data);
      return null;
    }

    console.log(`[Holiday API] Calendarific holidays found:`, holidays.map(h => h.name));
    
    const targetHoliday = holidays.find(holiday => 
      holiday.name.toLowerCase().includes(holidayName.toLowerCase())
    );

    if (targetHoliday) {
      console.log(`[Holiday API] Found ${holidayName}: ${targetHoliday.date.iso}`);
      return targetHoliday; // Return full holiday object
    } else {
      console.log(`[Holiday API] ${holidayName} not found in Calendarific response for ${year}.`);
    }
  } catch (error) {
    console.error(`Error fetching ${holidayName} date from Calendarific API:`, error);
  }
  return null;
}


// --- Reminders ---

export async function getAllReminders() {
  let reminders = await ensureData();
  
  // Add IDs if missing
  let modified = false;
  reminders = reminders.map(rem => {
    if (!rem.id) {
      rem.id = crypto.randomUUID();
      modified = true;
    }
    return rem;
  });

  if (modified) {
    await fs.writeFile(DATA_PATH, JSON.stringify(reminders, null, 2));
  }

  return reminders;
}

export async function saveReminder(reminder, currentSettings) {
  await ensureData(); // Ensure file exists
  const data = await fs.readFile(DATA_PATH, 'utf-8');
  let rems = JSON.parse(data);

  // Logic for yearly holiday reminders
  if (reminder.Repeat === 'Yearly' && reminder.HolidayType && currentSettings.calendarificApiKey) {
    console.log(`[Save Reminder] Processing yearly holiday reminder: ${reminder.Name} (${reminder.HolidayType})`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log(`[Save Reminder] Today (normalized): ${today.toISOString().split('T')[0]}`);

    // Get the date for the current year
    let currentHolidayObj = await getHolidayDate(
      reminder.HolidayType, 
      today.getFullYear(), 
      currentSettings.calendarificApiKey
    );
    console.log(`[Save Reminder] ${reminder.HolidayType} object for ${today.getFullYear()}: ${currentHolidayObj?.date?.iso}`);
    
    // If current year's holiday date is in the past or not found, try next year
    if (!currentHolidayObj || new Date(currentHolidayObj.date.iso) < today) {
      console.log(`[Save Reminder] Current year's ${reminder.HolidayType} date is in the past or not found. Checking next year.`);
      currentHolidayObj = await getHolidayDate(
        reminder.HolidayType, 
        today.getFullYear() + 1,
        currentSettings.calendarificApiKey
      );
      console.log(`[Save Reminder] ${reminder.HolidayType} object for ${today.getFullYear() + 1}: ${currentHolidayObj?.date?.iso}`);
    }

    if (currentHolidayObj) {
      const oldNextPayment = reminder['Next Payment'];
      reminder['Next Payment'] = currentHolidayObj.date.iso; // Use iso date
      
      if (currentHolidayObj.description) {
        const existingNotes = reminder.Notes ? `${reminder.Notes}\n` : '';
        reminder.Notes = `${existingNotes}[Holiday Details] ${currentHolidayObj.description}`;
        console.log(`[Save Reminder] Added description for ${reminder.HolidayType} to notes.`);
      }

      console.log(`[Save Reminder] Updated Next Payment for ${reminder.HolidayType} from ${oldNextPayment} to ${currentHolidayObj.date.iso}`);
    } else {
      console.warn(`[Save Reminder] Could not find date for ${reminder.HolidayType}, keeping AI/user suggested date.`);
    }
  }

  if (reminder.id) {
    const index = rems.findIndex(s => s.id === reminder.id);
    if (index !== -1) {
      rems[index] = { ...rems[index], ...reminder };
    } else {
      rems.push(reminder);
    }
  } else {
    reminder.id = crypto.randomUUID();
    rems.push(reminder);
  }
  await fs.writeFile(DATA_PATH, JSON.stringify(rems, null, 2));
  return reminder;
}

export async function deleteReminder(id) {
  await ensureData();
  const data = await fs.readFile(DATA_PATH, 'utf-8');
  let rems = JSON.parse(data);

  const newSubs = rems.filter(s => s.id !== id);
  await fs.writeFile(DATA_PATH, JSON.stringify(newSubs, null, 2));
}
