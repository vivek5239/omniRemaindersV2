# OmniReminders v2.1

A modern, web-based reminder and schedule management application to track obligations, recurring bills, variable holiday events, and deadlines with Google Gemini AI intelligence, multi-channel notifications (Gotify & SMTP), and seamless integration with your HomeServer Pulse App.

## Highlights & New Features

- **Modern Glassmorphism UI:** Complete redesign with responsive dark/light mode themes, animated pulse indicators, four real-time metric stat cards, and polished navigation.
- **Google Gemini AI Integration:** Natural language reminder creation and intelligent digest analysis powered by Google Gemini AI (default: `gemini-2.5-pro`).
- **HomeServer Pulse App REST API:** Dedicated lightweight endpoints (`/api/pulse/reminders` and `/api/pulse/health`) designed for homelab dashboards and Pulse App widgets.
- **Reliable Push & Email Notifications:** Verified Gotify push alerts and SMTP email dispatch with automated credential whitespace trimming and live test feedback.
- **Background Scheduler:** Automated daily check via `node-cron` with auto-updating of passing yearly holiday dates via Calendarific.
- **Calendar & Reminders Views:** Interactive monthly calendar view and dual Table / Grid views for reminder management.
- **Tamil Calendar Support:** Switch to Tamil calendar format (Month & Day) with automatic Gregorian conversion.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 7, Bootstrap 5, Lucide Icons, Date-fns
- **Backend:** Node.js, Express 5, Google Generative AI SDK, Nodemailer, Axios, node-cron
- **Storage:** File-based resilient JSON database in `/data`

## HomeServer Pulse App API

Integrate reminders into your HomeServer Pulse App:

```bash
# Get upcoming reminders and categorized counts (overdue, today, tomorrow, upcoming)
curl -s "http://<server-ip>:3050/api/pulse/reminders?days=7"

# Service health check
curl -s "http://<server-ip>:3050/api/pulse/health"
```

## Getting Started

### Local Development
```bash
# 1. Install & build client
cd client
npm install
npm run build

# 2. Install & run server
cd ../server
npm install
node index.js
```

### Docker Deployment

**Local Testing:**
```bash
docker-compose up -d --build
```

**Homelab Production Deployment:**
Deploy using `docker-compose.deploy.yml` on your server:
```bash
docker-compose -f docker-compose.deploy.yml up -d
```
