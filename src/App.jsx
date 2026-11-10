import { lazy, memo, startTransition, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './hooks/useStore';
import { getReminders } from './utils/notifications';
import { fmtDate, toMin } from './utils/dates';
import { AuthContext } from './context/AuthContext';
import { apiRequest } from './utils/api';
import { defaultData } from './utils/defaults';

const lazyPage = (load) => lazy(() => load().then(({ default: Page }) => ({ default: memo(Page) })));
const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const Subjects = lazyPage(() => import('./pages/Subjects'));
const Timetable = lazyPage(() => import('./pages/Timetable'));
const Exams = lazyPage(() => import('./pages/Exams'));
const DailyProgress = lazyPage(() => import('./pages/DailyProgress'));
const Tasks = lazyPage(() => import('./pages/Tasks'));
const CalendarPage = lazyPage(() => import('./pages/CalendarPage'));
const Reports = lazyPage(() => import('./pages/Reports'));
const Settings = lazyPage(() => import('./pages/Settings'));
const Account = lazyPage(() => import('./pages/Account'));
const AdminDashboard = lazyPage(() => import('./pages/AdminDashboard'));
const MentorDashboard = lazyPage(() => import('./pages/MentorDashboard'));
const AdminAssignments = lazyPage(() => import('./pages/AdminAssignments'));
const Backlogs = lazyPage(() => import('./pages/Backlogs'));
const Messages = lazyPage(() => import('./pages/Messages'));
const Notifications = lazyPage(() => import('./pages/Notifications'));
const MenteeProgress = lazyPage(() => import('./pages/MenteeProgress'));

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: 'speedometer2', C: Dashboard },
  { id: 'subjects', label: 'My Subjects', icon: 'journal-bookmark', C: Subjects },
  { id: 'timetable', label: 'My Timetable', icon: 'calendar2-week', C: Timetable },
  { id: 'calendar', label: 'Calendar', icon: 'calendar3', C: CalendarPage },
  { id: 'backlogs', label: 'My Backlogs', icon: 'journal-x', C: Backlogs },
  { id: 'tasks', label: 'Assignments & Tasks', icon: 'check2-square', C: Tasks },
  { id: 'exams', label: 'Exams', icon: 'mortarboard', C: Exams },
  { id: 'progress', label: 'Daily Progress', icon: 'graph-up-arrow', C: DailyProgress },
  { id: 'reports', label: 'Progress Reports', icon: 'bar-chart-line', C: Reports },
  { id: 'messages', label: 'Messages', icon: 'chat-dots', C: Messages },
  { id: 'notifications', label: 'Notifications', icon: 'bell', C: Notifications },
  { id: 'settings', label: 'Settings', icon: 'gear', C: Settings },
];

export default function App() {
  const { data, saveError, setSetting, setData } = useStore();
  const { user, setUser, authError, authLoading } = useContext(AuthContext);
  const [page, setPage] = useState(() => localStorage.getItem('studyPlanner.page') || 'dashboard');
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [now, setNow] = useState(new Date());
  const [logoutError, setLogoutError] = useState('');
  const [serverNotifications, setServerNotifications] = useState([]);
  const [notificationsForUser, setNotificationsForUser] = useState(null);
  const [notificationError, setNotificationError] = useState('');
  const [progressReadyFor, setProgressReadyFor] = useState(null);
  const [progressSyncError, setProgressSyncError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const fired = useRef(new Set());
  const progressReadyRef = useRef(null);
  const theme = data.settings?.theme || 'light';

  useEffect(() => {
    try {
      localStorage.setItem('studyPlanner.page', page);
    } catch {
      /* ignore */
    }
  }, [page]);

  useEffect(() => {
    if (user?.role !== 'student' || (page !== 'dashboard' && page !== 'reports')) return undefined;
    let active = true;
    import('./utils/chartSetup').then(({ applyChartTheme }) => {
      if (active) applyChartTheme(theme);
    });
    return () => { active = false; };
  }, [page, theme, user?.role]);

  useEffect(() => {
    if (!user) return;
    setData((current) => {
      if (
        current.profile.name === user.full_name &&
        current.profile.email === user.email &&
        current.profile.department === user.department
      ) return current;
      return {
        ...current,
        profile: {
          ...current.profile,
          name: user.full_name,
          email: user.email,
          department: user.department,
        },
      };
    });
  }, [user, setData]);

  useEffect(() => {
    let active = true;
    if (!user || user.role !== 'student') {
      progressReadyRef.current = null;
      setProgressReadyFor(null);
      return () => { active = false; };
    }
    progressReadyRef.current = null;
    setProgressReadyFor(null);
    const hydrateProgress = async () => {
      try {
        const ownerKey = 'studyPlanner.accountOwner';
        const owner = localStorage.getItem(ownerKey);
        if (owner && owner !== String(user.id)) setData(defaultData());
        const result = await apiRequest('/students/me/progress');
        if (!active) return;
        if (result.data) {
          setData((current) => ({ ...current, ...result.data, profile: current.profile, settings: { ...current.settings, ...(result.data.settings || {}) } }));
        }
        localStorage.setItem(ownerKey, String(user.id));
        progressReadyRef.current = user.id;
        setProgressReadyFor(user.id);
        setProgressSyncError('');
      } catch (error) {
        if (active) setProgressSyncError(error.message);
      }
    };
    hydrateProgress();
    return () => { active = false; };
  }, [user, setData]);

  useEffect(() => {
    if (!user || user.role !== 'student' || progressReadyFor !== user.id || progressReadyRef.current !== user.id) return;
    const timer = window.setTimeout(() => {
      const snapshot = {
        subjects: data.subjects || [],
        sessions: data.sessions || [],
        logs: data.logs || [],
        tasks: data.tasks || [],
        exams: data.exams || [],
        settings: { dailyGoal: data.settings?.dailyGoal },
      };
      apiRequest('/students/me/progress', { method: 'PUT', body: JSON.stringify({ data: snapshot }) })
        .then(() => setProgressSyncError(''))
        .catch((error) => setProgressSyncError(error.message));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [user, progressReadyFor, data]);

  useEffect(() => {
    if (!user || page === 'notifications') {
      if (!user) {
        setServerNotifications([]);
        setNotificationsForUser(null);
      }
      return undefined;
    }
    let active = true;
    setServerNotifications([]);
    setNotificationsForUser(null);
    const loadNotifications = async () => {
      try {
        const result = await apiRequest('/notifications');
        if (active) {
          setServerNotifications(result);
          setNotificationsForUser(user.id);
          setNotificationError('');
        }
      } catch (error) {
        if (active) setNotificationError(error.message);
      }
    };
    loadNotifications();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadNotifications();
    }, 20000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user, page]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const reminders = useMemo(
    () => user?.role === 'student' && progressReadyFor === user.id ? getReminders(data, now) : [],
    [data, now, user, progressReadyFor],
  );
  const visibleServerNotifications = notificationsForUser === user?.id ? serverNotifications : [];
  const alertCount = reminders.filter((r) => r.level !== 'info').length;

  // Optional browser notifications (session starting + daily summary)
  useEffect(() => {
    if (
      user?.role !== 'student' ||
      progressReadyFor !== user.id ||
      !data.settings?.browserNotifications ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) return;
    const check = () => {
      const n = new Date();
      const date = fmtDate(n);
      const mins = n.getHours() * 60 + n.getMinutes();

      (data.sessions || []).forEach((s) => {
        if (s.date !== date || s.kind !== 'study' || s.done) return;
        const diff = toMin(s.start) - mins;
        const sessionKey = `${user.id}:${s.id}`;
        if (diff >= 0 && diff <= 5 && !fired.current.has(sessionKey)) {
          fired.current.add(sessionKey);
          new Notification('Study session starting', { body: `${s.title} starting at ${s.start}` });
        }
      });

      try {
        const summaryKey = `studyPlanner.lastSummary:${user.id}`;
        if (localStorage.getItem(summaryKey) !== date) {
          const r = getReminders(data, n).filter((x) => x.level !== 'info');
          if (r.length) {
            new Notification('Study Planner Reminders', {
              body: r.slice(0, 3).map((x) => x.text).join('\n'),
            });
          }
          localStorage.setItem(summaryKey, date);
        }
      } catch {
        /* ignore */
      }
    };

    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [data, user, progressReadyFor]);

  const rolePage = useMemo(() => user?.role === 'admin'
    ? { id: 'admin', label: 'Admin Dashboard', icon: 'shield-check', C: AdminDashboard }
    : user?.role === 'mentor'
      ? { id: 'mentor', label: 'My Mentees', icon: 'people', C: MentorDashboard }
      : { id: 'dashboard', label: 'Dashboard', icon: 'speedometer2', C: Dashboard }, [user?.role]);
  const pages = useMemo(() => user?.role === 'student'
    ? PAGES
    : user?.role === 'mentor'
      ? [{ ...rolePage }, { id: 'messages', label: 'Messages', icon: 'chat-dots', C: Messages }, { id: 'notifications', label: 'Notifications', icon: 'bell', C: Notifications }, { id: 'settings', label: 'Settings', icon: 'gear', C: Settings }]
      : user?.role === 'admin'
        ? [{ ...rolePage }, { id: 'assignments', label: 'Mentor–Student Assignment', icon: 'person-lines-fill', C: AdminAssignments }, { id: 'notifications', label: 'Notifications', icon: 'bell', C: Notifications }, { id: 'settings', label: 'Settings', icon: 'gear', C: Settings }]
      : [], [user?.role, rolePage]);
  const Current = page === 'mentee-progress' && user?.role === 'mentor' && selectedStudentId
    ? MenteeProgress
    : (pages.find((p) => p.id === page) || rolePage).C;

  useEffect(() => {
    const viewingAssignedStudent = user?.role === 'mentor' && page === 'mentee-progress' && selectedStudentId;
    if (user && !pages.some((p) => p.id === page) && !viewingAssignedStudent) {
      startTransition(() => setPage(rolePage.id));
    }
  }, [user, page, pages, rolePage.id, selectedStudentId]);

  const go = useCallback((id) => {
    if (!pages.some((p) => p.id === id) && !(id === 'mentee-progress' && user?.role === 'mentor')) return;
    startTransition(() => setPage(id));
    setMenu(false);
    setBell(false);
    window.scrollTo(0, 0);
  }, [pages, user?.role]);

  const openStudent = useCallback((id) => {
    setSelectedStudentId(id);
    go('mentee-progress');
  }, [go]);
  const goBackToMentor = useCallback(() => go('mentor'), [go]);

  const markNotificationRead = async (item) => {
    try {
      await apiRequest(`/notifications/${item.id}/read`, { method: 'POST' });
      setServerNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, read: true } : notification));
      setNotificationError('');
    } catch (error) {
      setNotificationError(error.message);
    }
  };

  const logout = async () => {
    setLogoutError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error('The server could not end the session. Please try again.');
      setUser(null);
      startTransition(() => setPage('dashboard'));
    } catch (error) {
      setLogoutError(error.message);
    }
  };

  if (authLoading) {
    return <main className="min-vh-100 d-flex align-items-center justify-content-center text-secondary">Checking your session…</main>;
  }
  if (!user) {
    return (
      <Suspense fallback={<main className="p-4 text-secondary">Loading account…</main>}>
        <Account
          authError={authError}
          onAuthenticated={(profile) => startTransition(() => setPage(profile.role === 'student' ? 'dashboard' : profile.role))}
        />
      </Suspense>
    );
  }

  return (
    <div className="app">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${menu ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand" onClick={() => go(rolePage.id)} style={{ cursor: 'pointer' }}>
          <span className="brand-mark">
            <i className="bi bi-journal-check" />
          </span>
          <div className="d-flex flex-column">
            <span className="brand-title">Study Planner</span>
            <span className="brand-subtitle">Academic Assistant</span>
          </div>
        </div>

        <nav className="mt-2">
          {pages.map((p) => (
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
              {user.full_name ? `Hi, ${user.full_name}` : 'Student Study Planner'}
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
              {(visibleServerNotifications.filter((item) => !item.read).length + alertCount) > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger">
                  {visibleServerNotifications.filter((item) => !item.read).length + alertCount}
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
                  <button className="btn btn-link btn-sm ms-auto py-0" onClick={() => go('notifications')}>View all</button>
                  <button className="btn-close btn-sm" onClick={() => setBell(false)} aria-label="Close" />
                </div>
                <div className="list-group list-group-flush" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {notificationError && <div className="list-group-item small text-danger">{notificationError}</div>}
                  {visibleServerNotifications.slice(0, 8).map((item) => (
                    <button key={item.id} type="button" className={`list-group-item list-group-item-action small text-start ${item.read ? '' : 'fw-semibold'}`} onClick={() => markNotificationRead(item)}>
                      <span className="d-block">{item.title}</span><span className="text-secondary fw-normal">{item.body}</span><time className="d-block text-secondary fw-normal">{new Date(item.created_at).toLocaleString()}</time>
                    </button>
                  ))}
                  {reminders.length === 0 && visibleServerNotifications.length === 0 ? (
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
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={logout}>
            <i className="bi bi-box-arrow-right me-1" />Sign out
          </button>
        </header>

        {/* Content View */}
        <main className="content">
          {saveError && (
            <div className="alert alert-danger shadow-sm py-2 mb-3">
              <i className="bi bi-exclamation-triangle-fill me-2" />
              Your browser could not save new data (storage might be full or private browsing blocked storage). Please export a JSON backup from Settings.
            </div>
          )}
          {authError && (
            <div className="alert alert-warning shadow-sm py-2 mb-3" role="alert">
              Could not restore the account session: {authError}
            </div>
          )}
          {logoutError && <div className="alert alert-danger" role="alert">{logoutError}</div>}
          {progressSyncError && user.role === 'student' && <div className="alert alert-warning py-2" role="status">Progress sync: {progressSyncError}</div>}
          <Suspense fallback={<div className="text-secondary py-4" role="status">Loading page…</div>}>
            <Current key={`${user.id}:${page}`} go={go} openStudent={openStudent} studentId={selectedStudentId} onBack={goBackToMentor} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
