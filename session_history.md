# OmniRemindersV2 — Session History & Conversation Audit

This document maintains a persistent chronological record of all agent development sessions, architectural decisions, user requests, and conversation IDs for the OmniRemindersV2 workspace.

---

## Workspace Conversation Index

| Session | Date | Conversation ID | Focus & Key Deliverables | Status |
|---|---|---|---|---|
| **Early / Foundation** | Oct 2026 | Historical | AI reminder generation (Groq), Calendarific recurring holiday date engine, usability enhancements | Completed |
| **Session 1** | 2026-11-03 | [`98506257-bdd6-483f-b8ac-51891daae792`](conversation://98506257-bdd6-483f-b8ac-51891daae792) | Glassmorphic UI overhaul, Groq -> Gemini AI migration, Gotify/SMTP fixes, HomeServer Pulse REST API, Git repo migration to `omniRemaindersV2` | Completed |
| **Session 2** | 2026-11-03 | [`9e01b5c7-e744-4d17-9539-dc28aa63973b`](conversation://9e01b5c7-e744-4d17-9539-dc28aa63973b) | Gemini 429 quota exhaustion diagnosis (20 req/day cap on `gemini-3.8-flash`), migration to `gemini-flash-lite-latest`, failover cascade, Playwright verification, Docker Hub push | Completed |
| **Session 3** | 2026-11-04 | [`b140c059-3964-4006-a5eb-57f2d8da75c1`](conversation://b140c059-3964-4006-a5eb-57f2d8da75c1) | Complete workspace chat history audit, transcript indexing, conversation ID linking, production build sync | Completed |

---

### Early Session: Comprehensive Feature Implementation and Bug Fixing for OmniRemindersV2
* **Conversation Context**: Initial foundation & [`54f5726a-5dd0-4e8c-abd4-2d308bfac877`](conversation://54f5726a-5dd0-4e8c-abd4-2d308bfac877)

This session established the core reminder management system and integrated external calendar and LLM services:

1. **AI Reminder Generation & Model Management:**
   * **Missing Endpoints:** Implemented `/api/convert-tamil-date` and `/api/ai/create-reminder` backend endpoints.
   * **AI Model Selection:** Added `groqModel` setting and UI configuration in `SettingsView.tsx`.
   * **Improved AI Error Messages:** Enhanced backend error handling for LLM API calls to return actionable feedback.
   * **Decommissioned Models Handling:** Resolved deprecations across Groq models (`llama3-8b-8192` -> `gemma-7b-it` -> `llama-3.3-70b-versatile`).
   * **Centralized Settings:** Unified API key configuration inside SQLite settings database.

2. **Holiday Date Correction & Management:**
   * **Holiday Type Field:** Added `HolidayType` field to `Reminder` interface and AI prompt extraction.
   * **Calendarific API Integration:** Implemented `getHolidayDate` function in `server/db.js` using Calendarific API.
   * **Pongal Date Correction:** Removed invalid `type: 'national'` restriction that prevented regional holiday discovery.
   * **Automated Next Payment:** Enhanced `saveReminder` in `server/db.js` to compute and advance passed yearly holiday dates.
   * **Scheduler Job:** Added `node-cron` job (`scheduleDailyReminder`) to evaluate upcoming and overdue dates daily.
   * **"Fetch Next Year" Button:** Added manual holiday date lookup in `ReminderModal.tsx`.

3. **Usability Enhancements & Technical Debt:**
   * Added "Clone" action button in `Reminders.tsx`.
   * Added `Source` field (`API`/`AI`/`Manual`) to trace reminder origins.
   * Fixed `new Date(undefined)` type crash in `ReminderModal.tsx`.

---

### Session 1: Modern UI Overhaul, Gemini AI Migration, Notification Fixes & HomeServer Pulse API Integration
* **Date**: 2026-11-03 11:37 - 14:00 UTC
* **Conversation ID**: [`98506257-bdd6-483f-b8ac-51891daae792`](conversation://98506257-bdd6-483f-b8ac-51891daae792)

**User Prompts & Objectives:**
* Modernize application UI with a fresh look and responsive layout.
* Switch AI backend from Groq to Google Gemini AI.
* Fix non-functional Gotify push notifications and test email delivery.
* Create a dedicated REST API for the HomeServer Pulse companion application.
* Push source code to GitHub and update Docker image on Docker Hub.
* Resolve Google Generative AI model 404 error (`models/gemini-3.5-pro is not found`).

**Key Deliverables:**

1. **Modern UI Overhaul:**
   * Built modern glassmorphism design system in `client/src/index.css` supporting light and dark themes with blur backdrops and pill badges.
   * Sticky top navbar with theme switcher, version badge, active AI indicator, and mobile offcanvas menu.
   * **Dashboard (`Dashboard.tsx`):**
     * 4 metric cards: Active Reminders, Overdue (animated pulse badge), Due Today, Next 7 Days.
     * Gemini AI natural language input bar with multi-turn clarification questions and quick example chips.
     * "AI Insights" modal powered by `POST /api/ai/analyze` summarizing obligations and recommendations.
     * Split view for Upcoming vs Past/Overdue reminders with quick completion buttons.
   * **Reminders View (`Reminders.tsx`):**
     * Real-time search filter across titles, notes, and holiday metadata.
     * Category filter pills, recurrence dropdown, status toggles (Active, Overdue, Inactive).
     * View switcher: Modern Table View vs Card Grid View.
     * Bulk selection, bulk delete, and row actions (Mark Done, Clone, Edit, Delete).
   * **Calendar View (`CalendarView.tsx`):**
     * Interactive month grid with reminder dots.
     * Selected date inspection sidebar with one-click creation.
   * **Settings View (`SettingsView.tsx`):**
     * Tabbed configuration: Gemini AI, Gotify Push, Email (SMTP), Daily Scheduler, HomeServer Pulse API, Holiday API, Appearance.

2. **Google Gemini AI Migration:**
   * Swapped Groq SDK for `@google/generative-ai` (v0.24.1).
   * Implemented `GET /api/gemini/models` with live Google ModelService API discovery (`https://generativelanguage.googleapis.com/v1beta/models`).
   * Curated verified fallback models: `gemini-3.8-flash`, `gemini-flash-latest`, `gemini-pro-latest`, `gemini-3.6-flash`, `gemini-2.5-pro`.
   * Implemented automatic sanitization/migration in `server/index.js` and `client/src/pages/SettingsView.tsx` so outdated models auto-migrate to supported versions.
   * Added exponential retry with multi-candidate failover to handle transient Google 503 high demand traffic spikes.

3. **Notification System Fixes (Gotify & SMTP Email):**
   * Implemented missing test endpoints `POST /api/test/gotify` and `POST /api/test/email` (resolving 404 errors).
   * Normalized Gotify endpoint URLs and verified live push dispatch against `https://gotify.rvitservices.uk/`.
   * Automated credential whitespace trimming for Gmail SMTP App Passwords.
   * Added dispatch loop in `scheduleDailyReminder` and `POST /api/test/reminders`.

4. **HomeServer Pulse REST API Integration:**
   * `GET /api/pulse/reminders`: Summary counters (`total`, `active`, `overdue`, `dueToday`, `dueTomorrow`, `upcomingWithinWindow`), `nextUpcoming` object, and filtered reminder collections.
   * `GET /api/pulse/health`: Health monitoring endpoint with uptime, reminder counts, and notification flags.
   * Embedded interactive API documentation tab in `SettingsView.tsx` with copyable cURL snippets and live JSON preview.

5. **Deployment & Repository Setup:**
   * Corrected git origin remote from `Subscriptions.git` to [`https://github.com/vivek5239/omniRemaindersV2.git`](https://github.com/vivek5239/omniRemaindersV2.git).
   * Redacted Gotify app token from repository documentation.
   * Built and published Docker image `vivek5239/reminders-app:latest` to Docker Hub.

---

### Session 2: Gemini AI Rate Limit & Free Tier Quota Optimization
* **Date**: 2026-11-03 17:02 - 18:54 UTC
* **Conversation ID**: [`9e01b5c7-e744-4d17-9539-dc28aa63973b`](conversation://9e01b5c7-e744-4d17-9539-dc28aa63973b)

**User Prompts & Objectives:**
* Inspect why Gemini AI natural language reminder creation was failing on `http://172.23.177.144:3050/` using Playwright MCP tools.
* Update Docker container and push to Docker Hub.
* Update the Conversation ID in `session_history.md`.

**Root Cause Diagnosis & Implementations:**
1. **Google Free Tier Quota Exhaustion (429 Rate Limit):**
   * Live diagnostics against `generativelanguage.googleapis.com` revealed `gemini-3.8-flash` has a strict quota cap of **20 requests per day** on Google's Free Tier (`[429 Too Many Requests] Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash`). Once hit, requests were rejected for up to 18 hours.
   * Flagship models also intermittently threw `503 Service Unavailable` under heavy peak load.
   * In contrast, **`gemini-flash-lite-latest`** and **`gemini-3.1-flash-lite`** provide generous free tier limits with no daily 20-request lockouts and sub-2-second response latency.

2. **Default Model & Cascading Failover Updates:**
   * Configured `gemini-flash-lite-latest` as the primary recommended default in `client/src/pages/Dashboard.tsx`, `client/src/pages/SettingsView.tsx`, and `server/index.js`.
   * Enhanced `generateContentWithRetry` in `server/index.js`: upon detecting a 429 quota exhaustion or 503 high demand spike, the backend immediately cascades through:
     `[primaryModel, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']`.
   * Added `dns.setDefaultResultOrder('ipv4first')` to prevent dual-stack IPv6 DNS latency delays in Docker environments.
   * Added UI loading feedback spinner in `Dashboard.tsx` during natural language reminder parsing.

3. **Live Playwright MCP Verification:**
   * Verified Settings configured with `gemini-flash-lite-latest`.
   * Tested natural language reminder creation ("Pay electricity bill on 25th of every month at 10am") -> Successfully parsed and stored in database.
   * Tested "AI Insights" modal -> Successfully returned full workload digest and actionable advice.

---

### Session 3: Workspace Chat History Audit & Session History Linking
* **Date**: 2026-11-04 11:40 UTC
* **Conversation ID**: [`b140c059-3964-4006-a5eb-57f2d8da75c1`](conversation://b140c059-3964-4006-a5eb-57f2d8da75c1)

**User Prompts & Objectives:**
* Verify complete workspace chat history across all past sessions.
* Update `session_history.md` with explicit Conversation IDs and clickable links.
* Load and summarize all historical conversation contexts directly in the conversation.

**Key Deliverables:**
* Audited all brain conversation logs in `C:\Users\Vivek\.gemini\antigravity-cli\brain`.
* Indexed and mapped each session to its exact `Conversation ID` and user interaction transcript.
* Synchronized updated client build files into `server/public/`.
* Updated `session_history.md` with structured conversation audit log and deep links.
