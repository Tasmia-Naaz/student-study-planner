# Student Study Planner

A responsive study-planning app built with React, Vite, Bootstrap, and a Flask API. Students can organize subjects, schedules, exams, tasks, and progress. The app also supports mentor and admin workspaces for assignments, student progress, messaging, and notifications.

## Features

- Student dashboard with study statistics, charts, deadlines, and schedule highlights.
- Subject and syllabus tracking with difficulty levels and subject colors.
- Rule-based timetable generation based on availability, with study sessions and breaks.
- Calendar, exams, assignments, study tasks, backlogs, and daily progress tracking.
- Progress reports, light/dark themes, reminders, and JSON backup/import.
- Role-based student, mentor, and admin areas, including mentor approval and assignments.
- Student/mentor messaging and persisted notifications.

Planner data is available locally in the browser. When signed in, student progress and portal data are synchronized with the Flask API. The backend uses SQLite by default; PostgreSQL can be configured for deployment.

## Requirements

- Node.js 18 or newer and npm.
- Python 3.10 or newer.
- PostgreSQL only if you choose it instead of the default local SQLite database.

## Local development

### 1. Configure and run the API

From the repository root, create a Python environment, install the backend requirements, and copy the example configuration:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

The local API works with SQLite by default. To use PostgreSQL, set `DATABASE_URL` in `backend\.env`. Set unique random values for `FLASK_SECRET_KEY` and `JWT_SECRET_KEY`; do not commit `backend\.env` or put backend secrets in frontend variables.

Apply database migrations, optionally create an administrator, then start the API:

```powershell
flask --app backend.wsgi db upgrade
flask --app backend.wsgi create-admin --email admin@example.edu
python -m backend.app
```

The administrator command prompts for a name and a password of at least 12 characters. Mentor accounts require admin approval before sign-in.

### 2. Run the frontend

In a second terminal, from the repository root:

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://127.0.0.1:5173`). Vite proxies `/api` requests to `http://127.0.0.1:5000`. Set `VITE_API_TARGET` if the API runs at a different address.

If you change database migrations after pulling updates, apply them with:

```powershell
flask --app backend.wsgi db upgrade
```

## Build

```bash
npm run build
npm run preview
```
The production bundle will be generated in the `dist/` directory.

---

## Deployment Instructions

### 1. Vercel Deployment
1. Push your repository to GitHub.
2. Sign in to [Vercel](https://vercel.com) and click **Add New > Project**.
3. Select your repository.
4. Set the configuration:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Click **Deploy**. The included `vercel.json` ensures full SPA rewrite support.

### 2. Render Deployment (Static Site)
1. Push your repository to GitHub.
2. Sign in to [Render](https://render.com) and click **New > Static Site**.
3. Connect your repository.
4. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
5. Click **Create Static Site**.

---

## Timetable UI Redesign

The timetable view has been completely redesigned for a cleaner, modern experience:
- **Selected‑day view** showing one full day at a time.
- **Previous/Next day navigation** and a date picker for quick day switching.
- **Responsive layout** that works on desktop, tablet, and mobile without overflow.
- **Improved session cards** with wrapped subject names, duration, topic labels, and completion checkboxes.
- **Distinct break cards** for short, long, and meal breaks with subtle background colors.
- **Consistent visual design** using light backgrounds, rounded cards, shadows, and subject accent colors.

All existing functionality (timetable generation, editing, deleting, LocalStorage persistence, break handling, difficulty weighting, etc.) remains unchanged.

---

## Project Folder Structure

```text
student-study-planner/
│
├── .gitignore                # New gitignore added
├── public/
├── src/
│   ├── components/
│   │   └── ...
│   ├── pages/
│   │   ├── Timetable.jsx     # Updated UI redesign
│   │   └── ...
│   ├── styles/
│   │   └── app.css            # Updated styling for timetable
│   └── ...
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── README.md                 # Updated documentation
```

The timetable generator implements strict deterministic logic without machine learning:

1. **Scenario 1 — Regular College Day:**
   - Sleep hours (e.g. 23:00 to 06:30) and College hours (09:00 to 16:00) are completely blocked.
   - Sessions are placed only in morning (06:30–08:30) and evening (17:00–22:00) windows.
   - Configured short breaks (10m) and meal breaks (lunch and dinner) are inserted without overlapping.

2. **Scenario 2 — Holiday / Free Day:**
   - On days marked as holidays or weekend off-days, expanded holiday windows are used.
   - Additional sessions are scheduled for difficult subjects, mock tests, practice questions, and revision.

3. **Scenario 3 — Subject Difficulty:**
   - Subjects marked as **Hard** (e.g. Data Structures, TOC, Engineering Math) receive higher scheduling weights and priority over Medium/Easy subjects.

4. **Scenario 4 — Multiple Outside Examinations:**
   - College study and outside competitive examinations (e.g. GATE CSE) are scheduled side-by-side.
   - The *Combined Timetable* tab provides balanced subject coverage, while individual tabs let students focus on college or competitive prep.

5. **Scenario 5 — Upcoming Assignments & Deadlines:**
   - Urgent assignments and project milestones due within 3–7 days receive urgent score boosts and are prioritized in the schedule.

6. **Scenario 6 — Insufficient Availability Warning:**
   - If configured availability is shorter than the daily goal, the generator fills what fits and displays a clear advisory alert rather than creating unrealistic overlapping sessions.

7. **Scenario 7 — Automatic Break Management:**
   - 50-minute study sessions are followed by 10-minute short breaks.
   - After 3 consecutive study sessions, a 30-minute long break is automatically inserted.
   - Breaks are visually distinguished with dashed borders and are **never counted** toward study hours.

---

## Project Folder Structure

```text
student-study-planner/
│
├── public/
│
├── src/
│   ├── components/
│   │   └── common.jsx          # Modal, ConfirmModal, ProgressBar, StatCard, SubjectColorBadge, ColorSwatchSelector
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx        # Module 1: Dynamic statistics, 6 charts, upcoming deadlines & timetable
│   │   ├── Subjects.jsx         # Module 2: Subject management, color picker, codes, topic checklists
│   │   ├── Timetable.jsx        # Module 3: Rule-based generator, subject colors, college/exam/combined tabs
│   │   ├── Exams.jsx            # Module 4: Multi-type exam countdowns (Internal, Semester, Competitive)
│   │   ├── DailyProgress.jsx    # Module 5: Actual hours logged, topic completion, daily goal tracker
│   │   ├── Tasks.jsx            # Module 6: Unified Study Tasks, Assignments with deadlines, Projects & Milestones
│   │   ├── CalendarPage.jsx     # Module 7: Month, Week, Day views with subject-colored event chips
│   │   ├── Reports.jsx          # Module 8: Analytics, charts, subject tables, and custom date filters
│   │   └── Settings.jsx         # Module 9: Profile, themes, availability rules, JSON backup, sample data loader
│   │
│   ├── hooks/
│   │   └── useStore.jsx         # Centralized LocalStorage state and data persistence
│   │
│   ├── utils/
│   │   ├── chartSetup.js        # Chart.js initialization and theme palette
│   │   ├── dates.js             # Date calculations, formatting, and duration utilities
│   │   ├── defaults.js          # Default settings, color palettes, and rich sample demo data generator
│   │   ├── notifications.js     # Rule-based reminder and urgent deadline evaluator
│   │   └── scheduler.js         # Deterministic rule-based timetable generator algorithm
│   │
│   ├── styles/
│   │   └── app.css              # Custom styling for light/dark modes, subject colors, and print
│   │
│   ├── App.jsx                  # Main application shell, sidebar, navbar, notifications dropdown
│   └── main.jsx                 # React DOM mount point
│
├── index.html                   # HTML5 template
├── package.json                 # Project dependencies and build scripts
├── vite.config.js               # Vite build configuration with chunk optimization
├── vercel.json                  # Vercel SPA routing rules
└── README.md                    # Project documentation
```

---

## License & Attribution

Designed and developed as a complete college mini-project demonstration for academic study management and realistic timetable generation.
