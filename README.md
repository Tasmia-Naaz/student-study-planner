# Student Study Planner

A comprehensive, responsive, professional **Student Study Planner Web Application** built with React.js, Bootstrap 5, Chart.js, and Vite. Designed specifically for college students balancing regular college coursework, competitive exam preparations (such as GATE, TGPSC, UPSC, SSC, Banking, and Placement tests), assignments, multi-milestone projects, and personal commitments.

The application features a **smart rule-based timetable generator** that schedules study sessions into students' actual free availability windows, automatically manages breaks (short, long, and meals), color-codes timetable sessions by subject, and tracks daily progress with LocalStorage persistence.

---

## Key Features & Highlights

- **9 Main Navigation Pages:**
  1. **Dashboard:** Comprehensive dynamic academic overview with 8+ statistics cards, 6 interactive Chart.js graphs, today's schedule with subject colors, upcoming exams countdown, upcoming assignment deadlines, and quick action buttons.
  2. **My Subjects:** College & competitive exam subject management with subject codes, custom color picker palettes, difficulty levels (Easy, Medium, Hard), syllabus topic checklists, and completion percentage progress bars.
  3. **Study Timetable:** Rule-based scheduling with **distinct subject color accents**, three category tabs (*College Study*, *Outside Exam Preparation*, *Combined Timetable*), Day/Week views, automated breaks (short, long, meals), manual session add/edit/reschedule, and availability constraint warnings.
  4. **Exam Countdown:** Dynamic countdown timers for Semester, Internal, Practical, Viva, Competitive (GATE, TGPSC, UPSC), Entrance, and Placement examinations.
  5. **Daily Progress:** Actual study hours tracking (hours & minutes selector), topic completion recording, daily goal progress percentage, rolling 30-day average, and subject-wise study time distribution.
  6. **Task Management:** Unified tracker for Study Tasks, College Assignments (Written, Lab, Programming, Seminar) with color-coded deadline badges, and Academic Projects with nested Milestones and progress percentages.
  7. **Calendar:** Month, Week, and Day calendar views displaying color-coded study sessions, exams, deadlines, milestones, and custom holiday/unavailable periods.
  8. **Progress Reports:** Academic analytics across Weekly, Monthly, Previous Month, and Custom Date Ranges with daily study hours vs goal charts, doughnut subject breakdowns, task completion rates, and print-ready report layout.
  9. **Settings:** Profile customization, Light/Dark appearance theme, timetable generator preference configuration, daily availability windows per weekday, recurring commitments (coaching, gym), in-app and browser notifications, JSON backup export/import, and a **1-Click Realistic Demo Data Loader**.

---

## Technology Stack

- **Frontend:** React 18 (ES6+ JavaScript), HTML5, CSS3
- **UI & Layout:** Bootstrap 5.3, Bootstrap Icons, Custom Responsive CSS
- **Charts & Visualizations:** Chart.js 4.4, react-chartjs-2
- **Build System:** Vite 5
- **Storage:** Browser LocalStorage (with JSON export/import for cross-device migration)
- **Deployment:** Vercel, Render Static Site (zero backend or external API keys needed)

---

## Local Development & Setup

### Prerequisites
- Node.js LTS (v18 or newer)
- npm (v9 or newer)

Verify your Node.js installation:
```bash
node -v
npm -v
```

### Installation & Launch
```bash
# 1. Clone or navigate to the project directory
cd student-study-planner

# 2. Install all dependencies
npm install

# 3. Start the local development server
npm run dev
```

Open your browser and navigate to the local URL (typically `http://localhost:5173`).

---

## Production Build & Testing

```bash
# Create an optimized production build
npm run build

# Preview the production build locally
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


