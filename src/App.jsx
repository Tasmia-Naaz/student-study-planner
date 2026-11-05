import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './hooks/useStore';
import { getReminders } from './utils/notifications';
import { applyChartTheme } from './utils/chartSetup';
import { fmtDate, toMin } from './utils/dates';
import Dashboard from './pages/Dashboard';
import Subjects from './pages/Subjects';
import Timetable from './pages/Timetable';
import Exams from './pages/Exams';
import DailyProgress from './pages/DailyProgress';
import Tasks from './pages/Tasks';
import CalendarPage from './pages/CalendarPage';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: 'speedometer2', C: Dashboard },
  { id: 'subjects', label: 'My Subjects', icon: 'journal-bookmark', C: Subjects },
  { id: 'timetable', label: 'Study Timetable', icon: 'calendar2-week', C: Timetable },
  { id: 'exams', label: 'Exam Countdown', icon: 'mortarboard', C: Exams },
  { id: 'progress', label: 'Daily Progress', icon: 'graph-up-arrow', C: DailyProgress },
  { id: 'tasks', label: 'Task Management', icon: 'check2-square', C: Tasks },
  { id: 'calendar', label: 'Calendar', icon: 'calendar3', C: CalendarPage },
  { id: 'reports', label: 'Progress Reports', icon: 'bar-chart-line', C: Reports },
  { id: 'settings', label: 'Settings', icon: 'gear', C: Settings },
];

export default function App() {
  const { data, saveError, setSetting } = useStore();
  const [page, setPage] = useState(() => localStorage.getItem('studyPlanner.page') || 'dashboard');
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [now, setNow] = useState(new Date());
  const fired = useRef(new Set());
  const theme = data.settings?.theme || 'light';

  useEffect(() => {
    try {
      localStorage.setItem('studyPlanner.page', page);
    } catch {
      /* ignore */
    }
  }, [page]);

  useEffect(() => {
    applyChartTheme(theme);
  }, [theme]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const reminders = useMemo(() => getReminders(data, now), [data, now]);
  const alertCount = reminders.filter((r) => r.level !== 'info').length;

  // Optional browser notifications (session starting + daily summary)
  useEffect(() => {
    if (!data.settings?.browserNotifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    const check = () => {
      const n = new Date();
      const date = fmtDate(n);
      const mins = n.getHours() * 60 + n.getMinutes();

      (data.sessions || []).forEach((s) => {
        if (s.date !== date || s.kind !== 'study' || s.done) return;
        const diff = toMin(s.start) - mins;
        if (diff >= 0 && diff <= 5 && !fired.current.has(s.id)) {
          fired.current.add(s.id);
          new Notification('Study session starting', { body: `${s.title} starting at ${s.start}` });
        }
      });

      try {
        if (localStorage.getItem('studyPlanner.lastSummary') !== date) {
          const r = getReminders(data, n).filter((x) => x.level !== 'info');
          if (r.length) {
            new Notification('Study Planner Reminders', {
              body: r.slice(0, 3).map((x) => x.text).join('\n'),
            });
          }
          localStorage.setItem('studyPlanner.lastSummary', date);
        }
      } catch {
        /* ignore */
      }
    };

    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [data]);

  const Current = (PAGES.find((p) => p.id === page) || PAGES[0]).C;
  const go = (id) => {
    setPage(id);
    setMenu(false);
    setBell(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${menu ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand" onClick={() => go('dashboard')} style={{ cursor: 'pointer' }}>
          <span className="brand-mark">
            <i className="bi bi-journal-check" />
          </span>
          <div className="d-flex flex-column">
            <span className="brand-title">Study Planner</span>
            <span className="brand-subtitle">Academic Assistant</span>
          </div>
        </div>

        <nav className="mt-2">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={`nav-item-btn ${page === p.id ? 'active' : ''}`}
              onClick={() => go(p.id)}
              aria-current={page === p.id ? 'page' : undefined}
            >
              <i className={`bi bi-${p.icon}`} /> {p.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer mt-auto pt-3 border-top border-secondary border-opacity-25 small text-secondary">
          <div className="fw-semibold text-light text-truncate">
            {data.profile?.name || 'College Student'}
          </div>
          <div className="text-truncate" style={{ fontSize: '0.75rem' }}>
            {data.profile?.college || 'Study Planner v1.0'}
          </div>
        </div>
      </aside>

      {/* Mobile Scrim */}
      <div className={`scrim ${menu ? 'open' : ''}`} onClick={() => setMenu(false)} />

      {/* Main Container */}
      <div className="main">
        {/* Top Navbar */}
        <header className="topbar d-flex align-items-center gap-2 no-print">
          <button
            className="btn btn-outline-secondary btn-sm menu-btn"
            onClick={() => setMenu(true)}
            aria-label="Open menu"
          >
            <i className="bi bi-list fs-5" />
          </button>

          <div className="me-auto small text-secondary d-flex align-items-center gap-2">
            <span className="fw-bold text-body">
              {data.profile?.name ? `Hi, ${data.profile.name}` : 'Student Study Planner'}
            </span>
            <span className="d-none d-sm-inline">·</span>
            <span className="d-none d-sm-inline">
              {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* Notifications Dropdown */}
          <div className="position-relative">
            <button
              className="btn btn-outline-secondary btn-sm position-relative"
              onClick={() => setBell(!bell)}
              aria-label="Notifications"
            >
              <i className="bi bi-bell" />
              {alertCount > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger">
                  {alertCount}
                </span>
              )}
            </button>

            {bell && (
              <div
                className="card position-absolute end-0 mt-2 shadow border-0"
                style={{ width: 340, maxWidth: '92vw', zIndex: 1060 }}
              >
                <div className="card-header bg-transparent py-2 d-flex justify-content-between align-items-center border-bottom">
                  <span className="fw-bold small">Notifications & Reminders</span>
                  <button className="btn-close btn-sm" onClick={() => setBell(false)} aria-label="Close" />
                </div>
                <div className="list-group list-group-flush" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {reminders.length === 0 ? (
                    <div className="list-group-item text-secondary small py-3 text-center">
                      <i className="bi bi-check2-circle fs-4 d-block mb-1 text-success" />
                      You are all caught up! No urgent reminders.
                    </div>
                  ) : (
                    reminders.map((r) => (
                      <div key={r.id} className="list-group-item small d-flex gap-2 align-items-start py-2">
                        <i
                          className={`bi bi-${r.icon} text-${
                            r.level === 'info' ? 'primary' : r.level
                          } mt-1 flex-shrink-0`}
                        />
                        <span className="text-body flex-grow-1">{r.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setSetting('theme', theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
            aria-label="Toggle theme"
          >
            <i className={`bi bi-${theme === 'dark' ? 'sun' : 'moon-stars'}`} />
          </button>
        </header>

        {/* Content View */}
        <main className="content" key={theme}>
          {saveError && (
            <div className="alert alert-danger shadow-sm py-2 mb-3">
              <i className="bi bi-exclamation-triangle-fill me-2" />
              Your browser could not save new data (storage might be full or private browsing blocked storage). Please export a JSON backup from Settings.
            </div>
          )}
          <Current go={go} />
        </main>
      </div>
    </div>
  );
}
