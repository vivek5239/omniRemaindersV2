# Technical Documentation for OmniRemindersV2

## 1. Project Overview

OmniRemindersV2 is a web-based application designed to help users manage their reminders, bill due dates, and recurring obligations efficiently. The application provides a modern user interface to create, view, edit, duplicate, and complete reminders. It features an interactive dashboard with real-time statistics, a versatile list and grid view for all reminders, an interactive calendar view, and deep settings management.

The application is built with a modern tech stack featuring a React 19 frontend and a Node.js (Express 5) backend, containerized via Docker for local and UDMS / homelab server deployment. Key features include Google Gemini AI powered reminder creation from natural language, reminder analysis, push notifications via Gotify, email alerts via SMTP (Nodemailer), automated background scheduling, and a dedicated HomeServer Pulse App REST API.

## 2. Tech Stack

### Frontend
- **Framework:** React (v19) with Vite 7
- **Language:** TypeScript
- **Styling & UI:**
  - Modern Glassmorphism Design System (`client/src/index.css`)
  - Bootstrap 5 & React-Bootstrap
  - `lucide-react`: High quality SVG icons
- **Routing:** React Router DOM (v7)
- **HTTP Client:** Axios
- **State Management:** React Context API (for theme mode and accent colors)
- **Calendar/Date:** `react-calendar` and `date-fns` (v4)

### Backend
- **Framework:** Express.js (v5) on Node.js (ES Modules)
- **API Architecture:** RESTful API with unified JSON error handling
- **Database:** Resilient file-based JSON storage located dynamically via `getDataDir()`:
  - `reminders.json`: Stores all reminder data.
  - `settings.json`: Stores application, AI, and notification credentials.
- **AI Integration:**
  - Google Gemini AI (`@google/generative-ai` v0.24.1): Uses `gemini-2.5-pro` (default) or `gemini-2.5-flash` for natural language parsing and intelligent analysis.
- **Notifications:**
  - Nodemailer: For sending rich HTML and text reminder emails via SMTP.
  - Gotify: For dispatching priority push alerts via HTTP REST API.
- **Scheduling:** `node-cron`: Periodic daily checks for due reminders and automatic updating of passing holiday dates.

## 3. Project Structure

```
/
├── client/              # React frontend application
│   ├── src/
│   │   ├── components/  # Reusable UI components (ReminderModal.tsx, Logo.tsx)
│   │   ├── context/     # React context providers (ThemeContext.tsx)
│   │   ├── pages/       # Top-level pages (Dashboard, Reminders, CalendarView, SettingsView)
│   │   ├── types/       # TypeScript type definitions (index.ts)
│   │   ├── App.tsx      # Main app component with routing and modern navigation
│   │   └── index.css    # Modern glassmorphism design system & dark/light styles
│   ├── package.json
│   └── vite.config.ts
├── server/              # Node.js Express backend
│   ├── index.js         # Server entry point with all API endpoints & schedulers
│   ├── db.js            # JSON database layer with robust data directory resolution
│   ├── public/          # Static built client assets for production serving
│   └── package.json
├── data/                # Persisted data (JSON files)
│   ├── reminders.json
│   └── settings.json
├── Dockerfile           # Multi-stage Dockerfile (builds client, runs production server)
├── docker-compose.yml   # Docker Compose for local development & testing
├── docker-compose.deploy.yml # Docker Compose for server deployment (UDMS / homelab)
├── session_history.md   # Chronological development and maintenance log
└── TECHNICAL_DOCS.md    # This technical documentation file
```

## 4. Getting Started

### Local Development
```bash
# 1. Install dependencies
cd client && npm install
cd ../server && npm install

# 2. Build frontend and run
npm run build
node index.js
```

### Docker Local Compose
```bash
docker-compose up -d --build
```
Available at `http://localhost:5006`.

### Homelab Deployment (UDMS Server)
Following homelab standards, deploy via `docker-compose.deploy.yml`:
- Image: `vivek5239/reminders-app:latest`
- Persistent Volume Mount: `$DOCKERDIR/appdata/reminders:/data`
- Networks: `t3_proxy`, `socket_proxy`

## 5. Core Features & Logic

### Reminder Management
- **CRUD & Bulk Operations:** Full support for creating, editing, duplicating (cloning), deleting, and bulk-deleting reminders.
- **Recurrence Support:** One-Time, Daily, Weekly, Monthly, and Yearly patterns.
- **Tamil Calendar Support:** Switch to Tamil calendar format (Month and Day) with automatic Gregorian conversion via `/api/convert-tamil-date`.
- **Calendarific Holiday Sync:** Automatically queries Calendarific API for variable festivals (Diwali, Pongal, etc.) to set the next valid upcoming date and append holiday descriptions to notes.

### Gemini AI Integration
- **Reminder Creation (`POST /api/ai/create-reminder`):**
  - Parses natural language prompts (e.g. "Pay electricity bill on 25th of every month at 10am", "Send Diwali gift remind 3 days before").
  - Produces structured JSON validated against reminder schema.
  - Returns clarifying questions if the prompt is missing critical context.
- **Executive Analysis (`POST /api/ai/analyze`):**
  - Synthesizes all active obligations.
  - Produces an executive workload summary, immediate priorities, and actionable advice.

### Push & Email Notifications
- **Gotify Push Alerts:**
  - Normalizes server URL, attaches `X-Gotify-Key` header and token parameter.
  - Dispatches high-priority push messages for due and overdue reminders.
  - Dedicated live test endpoint `/api/test/gotify`.
- **SMTP Email Alerts:**
  - Automated credential whitespace trimming (handles Google App Passwords with trailing spaces).
  - Configures secure TLS transport.
  - Dedicated live test endpoint `/api/test/email`.
- **Scheduler & Auto-Check (`POST /api/test/reminders`):**
  - Executes daily at user's configured time (`dailyCheckTime`).
  - Scans for reminders due within `remindBefore` days or overdue by <= 3 days.
  - Auto-updates passed yearly holiday reminders via Calendarific.

### HomeServer Pulse App REST API
Dedicated endpoints designed specifically for homelab dashboards and Pulse App integrations:
- `GET /api/pulse/reminders`:
  - Query parameters:
    - `days` (integer, default 7): Number of upcoming days to inspect.
    - `status` (`active` | `all`, default `active`).
    - `limit` (integer, default 50).
  - Returns:
    - `counts`: `{ total, active, overdue, dueToday, dueTomorrow, upcomingWithinWindow, windowDays }`
    - `nextUpcoming`: Single next reminder object.
    - `dueToday`: Array of reminders due today.
    - `dueTomorrow`: Array of reminders due tomorrow.
    - `overdue`: Array of overdue reminders.
    - `upcoming`: Array of upcoming reminders within window.
- `GET /api/pulse/health`:
  - Returns system health status, version, uptime, total reminders count, last check time, and configuration flags.

## 6. API Reference Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reminders` | Retrieve all reminders |
| `POST` | `/api/reminders` | Create or update reminder |
| `DELETE` | `/api/reminders/:id` | Delete reminder by ID |
| `GET` | `/api/settings` | Get current settings |
| `POST` | `/api/settings` | Update settings & reschedule jobs |
| `POST` | `/api/convert-tamil-date` | Convert Tamil Month & Day to Gregorian date |
| `GET` | `/api/holiday-date` | Lookup holiday date via Calendarific |
| `GET` | `/api/gemini/models` | List available Gemini models |
| `POST` | `/api/ai/create-reminder` | Create reminder from natural language using Gemini |
| `POST` | `/api/ai/analyze` | AI summary and recommendations |
| `POST` | `/api/test/gotify` | Send test Gotify push alert |
| `POST` | `/api/test/email` | Send test SMTP email |
| `POST` | `/api/test/reminders` | Run daily check immediately and dispatch notifications |
| `GET` | `/api/pulse/reminders` | HomeServer Pulse App reminders summary |
| `GET` | `/api/pulse/health` | Service health status for homelab monitors |
