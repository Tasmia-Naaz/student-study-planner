import { useState, useRef, useContext } from 'react';
import { useStore, normalize } from '../hooks/useStore';
import { PageHeader, Field, ConfirmModal } from '../components/common';
import { DAY_LONG, DAY_NAMES, fmtDate, fmtTime, uid } from '../utils/dates';
import { defaultData, defaultAvailability, getSampleData } from '../utils/defaults';
import { AuthContext } from '../context/AuthContext';
import AccountSettings from './AccountSettings';

function Num({ label, k, min = 1, max, className = 'col-6 col-md-4', suffix, s, setSetting }) {
  return (
    <Field label={label} className={className}>
      <div className="input-group">
        <input
          type="number"
          className="form-control"
          min={min}
          max={max}
          value={s[k] ?? ''}
          onChange={(e) => setSetting(k, e.target.value === '' ? '' : Number(e.target.value))}
        />
        {suffix && <span className="input-group-text">{suffix}</span>}
      </div>
    </Field>
  );
}

export default function Settings() {
  const { data, patch, setData, setSetting, upsert, remove } = useStore();
  const { user } = useContext(AuthContext);
  const s = data.settings || {};

  const [note, setNote] = useState(null);

  const [confirmLoadSample, setConfirmLoadSample] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [c, setC] = useState({ title: '', day: 'all', start: '17:00', end: '18:00' });
  const fileRef = useRef(null);

  const setProfile = (key, value) => patch('profile', (profile) => ({ ...profile, [key]: value }));

  const setWindow = (day, type, i, key, val) =>
    patch('availability', (a) => {
      const cur = (a && a[day]) || { college: [], holiday: [] };
      const list = (cur[type] || []).map((w, idx) => (idx === i ? { ...w, [key]: val } : w));
      return { ...a, [day]: { ...cur, [type]: list } };
    });

  const addWindow = (day, type) =>
    patch('availability', (a) => {
      const cur = (a && a[day]) || { college: [], holiday: [] };
      return {
        ...a,
        [day]: { ...cur, [type]: [...(cur[type] || []), { start: '18:00', end: '20:00' }] },
      };
    });

  const delWindow = (day, type, i) =>
    patch('availability', (a) => {
      const cur = a && a[day];
      if (!cur) return a;
      return {
        ...a,
        [day]: { ...cur, [type]: (cur[type] || []).filter((_, idx) => idx !== i) },
      };
    });

  const toggleCollegeDay = (d) => {
    const list = Array.isArray(s.collegeDays) ? s.collegeDays : [1, 2, 3, 4, 5];
    setSetting('collegeDays', list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort());
  };

  const requestNotif = async () => {
    if (!('Notification' in window)) {
      return setNote({ type: 'warning', text: 'This browser does not support browser notifications.' });
    }
    if (!s.browserNotifications) {
      const p = await Notification.requestPermission();
      if (p !== 'granted') {
        return setNote({
          type: 'warning',
          text: 'Notification permission was denied. Please allow notifications in your browser site permissions.',
        });
      }
      setSetting('browserNotifications', true);
      setNote({ type: 'success', text: 'Browser notifications have been enabled.' });
    } else {
      setSetting('browserNotifications', false);
      setNote({ type: 'info', text: 'Browser notifications disabled.' });
    }
  };

  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            app: 'student-study-planner',
            version: 1,
            exportedAt: new Date().toISOString(),
            data,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `student-study-planner-backup-${fmtDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNote({ type: 'success', text: 'Planner data exported successfully.' });
  };

  const importData = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const payload = parsed.data || parsed;
        if (!payload || typeof payload !== 'object' || !Array.isArray(payload.subjects)) {
          throw new Error('Invalid schema');
        }
        setData(normalize(payload));
        setNote({ type: 'success', text: 'Data backup successfully restored!' });
      } catch {
        setNote({
          type: 'danger',
          text: 'The selected file is not a valid Student Study Planner backup file.',
        });
      }
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    setData(defaultData());
    setConfirmClear(false);
    setNote({ type: 'success', text: 'All application data has been cleared.' });
  };

  const loadSample = () => {
    setData(getSampleData());
    setConfirmLoadSample(false);
    setNote({
      type: 'success',
      text: 'Realistic demo data successfully loaded with subjects, exams, assignments, timetable sessions, and progress logs!',
    });
  };

  return (
    <>
      <PageHeader
        title="Settings & System Preferences"
        subtitle="Manage your account and preferences."
      >
        {user?.role === 'student' && (
          <button className="btn btn-outline-success" onClick={() => setConfirmLoadSample(true)}>
            <i className="bi bi-box-arrow-in-down me-1" /> Load Sample Demo Data
          </button>
        )}
      </PageHeader>

      {note && (
        <div className={`alert alert-${note.type} alert-dismissible shadow-sm fade show`}>
          {note.text}
          <button className="btn-close" onClick={() => setNote(null)} aria-label="Dismiss" />
        </div>
      )}

      <AccountSettings />

      {user?.role === 'student' && <>
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-transparent fw-bold border-bottom">
          <i className="bi bi-building text-primary me-2" />
          Planner Profile Details
        </div>
        <div className="card-body">
          <div className="row g-3">
            <Field label="College / University Name" className="col-12 col-md-6">
              <input
                className="form-control"
                value={data.profile.college || ''}
                onChange={(e) => setProfile('college', e.target.value)}
                placeholder="e.g. National Institute of Technology"
              />
            </Field>
            <Field label="Course / Program" className="col-12 col-md-6">
              <input
                className="form-control"
                value={data.profile.course || ''}
                onChange={(e) => setProfile('course', e.target.value)}
                placeholder="e.g. B.Tech"
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-transparent fw-bold border-bottom">
          <i className="bi bi-sliders text-primary me-2" />
          Planner Preferences
        </div>
        <div className="card-body">
          <div className="row g-3">
            <Num
              s={s}
              setSetting={setSetting}
              label="Daily Study Goal Target"
              k="dailyGoal"
              min={0.5}
              max={16}
              suffix="hours"
            />

            <Num
              s={s}
              setSetting={setSetting}
              label="Max Daily Study Limit"
              k="maxDailyHours"
              min={1}
              max={18}
              suffix="hours"
            />

            <Field label="Appearance Theme" className="col-12 col-md-4">
              <select
                className="form-select"
                value={s.theme || 'light'}
                onChange={(e) => setSetting('theme', e.target.value)}
              >
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
              </select>
            </Field>

            <Field label="Time Display Format" className="col-12 col-md-4">
              <select
                className="form-select"
                value={s.timeFormat || '12h'}
                onChange={(e) => setSetting('timeFormat', e.target.value)}
              >
                <option value="12h">12-Hour (e.g. 1:30 PM)</option>
                <option value="24h">24-Hour (e.g. 13:30)</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* Timetable Generator Preferences */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-transparent fw-bold border-bottom">
          <i className="bi bi-sliders text-primary me-2" />
          Timetable Generator & Break Rules
        </div>
        <div className="card-body">
          <div className="row g-3">
            <Num
              s={s}
              setSetting={setSetting}
              label="Study Session Duration"
              k="sessionMinutes"
              min={15}
              max={180}
              suffix="min"
            />

            <Num
              s={s}
              setSetting={setSetting}
              label="Short Break Duration"
              k="shortBreak"
              min={0}
              max={60}
              suffix="min"
            />

            <Num
              s={s}
              setSetting={setSetting}
              label="Long Break Duration"
              k="longBreak"
              min={0}
              max={120}
              suffix="min"
            />

            <Num
              s={s}
              setSetting={setSetting}
              label="Long Break Interval"
              k="longAfter"
              min={1}
              max={10}
              suffix="sessions"
            />

            <Num
              s={s}
              setSetting={setSetting}
              label="Exam Prep Study Time Allocation"
              k="examShare"
              min={0}
              max={100}
              suffix="%"
            />

            <Field label="Sleep Hours (Blocked)" className="col-12 col-md-4">
              <div className="input-group">
                <input
                  type="time"
                  className="form-control"
                  value={s.sleepStart || '23:00'}
                  onChange={(e) => setSetting('sleepStart', e.target.value)}
                />
                <span className="input-group-text">to</span>
                <input
                  type="time"
                  className="form-control"
                  value={s.sleepEnd || '06:30'}
                  onChange={(e) => setSetting('sleepEnd', e.target.value)}
                />
              </div>
            </Field>

            <Field label="College Working Hours" className="col-12 col-md-4">
              <div className="input-group">
                <input
                  type="time"
                  className="form-control"
                  value={s.collegeStart || '09:00'}
                  onChange={(e) => setSetting('collegeStart', e.target.value)}
                />
                <span className="input-group-text">to</span>
                <input
                  type="time"
                  className="form-control"
                  value={s.collegeEnd || '16:00'}
                  onChange={(e) => setSetting('collegeEnd', e.target.value)}
                />
              </div>
            </Field>

            <Field label="College Working Days" className="col-12 col-md-8">
              <div className="d-flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`btn btn-sm ${(s.collegeDays || [1, 2, 3, 4, 5]).includes(d) ? 'btn-primary' : 'btn-outline-secondary'
                      }`}
                    onClick={() => toggleCollegeDay(d)}
                  >
                    {DAY_NAMES[d]}
                  </button>
                ))}
              </div>
            </Field>

            {/* Meal Breaks Configuration */}
            <div className="col-12 pt-2 border-top">
              <div className="form-check form-switch mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="mealBreaksSwitch"
                  checked={!!s.mealBreaks}
                  onChange={(e) => setSetting('mealBreaks', e.target.checked)}
                />
                <label className="form-check-label fw-bold" htmlFor="mealBreaksSwitch">
                  Automatically Schedule Meal Breaks (Lunch & Dinner)
                </label>
              </div>
            </div>

            {s.mealBreaks && (
              <>
                <Field label="Lunch Start Time" className="col-6 col-md-3">
                  <input
                    type="time"
                    className="form-control"
                    value={s.lunchStart || '13:00'}
                    onChange={(e) => setSetting('lunchStart', e.target.value)}
                  />
                </Field>

                <Num
                  s={s}
                  setSetting={setSetting}
                  label="Lunch Duration"
                  k="lunchDuration"
                  className="col-6 col-md-3"
                  suffix="min"
                />

                <Field label="Dinner Start Time" className="col-6 col-md-3">
                  <input
                    type="time"
                    className="form-control"
                    value={s.dinnerStart || '20:00'}
                    onChange={(e) => setSetting('dinnerStart', e.target.value)}
                  />
                </Field>

                <Num
                  s={s}
                  setSetting={setSetting}
                  label="Dinner Duration"
                  k="dinnerDuration"
                  className="col-6 col-md-3"
                  suffix="min"
                />
              </>
            )}

            <div className="col-12 form-text text-secondary">
              Note: Breaks are distinct non-overlapping schedule blocks and are <strong>never counted</strong> toward your study hours or daily study goals.
            </div>
          </div>
        </div>
      </div>

      {/* Daily Availability Windows per Day of the Week */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-transparent fw-bold border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <i className="bi bi-calendar-range text-primary me-2" />
            Configured Daily Availability Windows
          </div>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              if (window.confirm('Reset all availability windows based on your current sleep and college hours?')) {
                patch('availability', defaultAvailability(s));
              }
            }}
          >
            Reset from College & Sleep Hours
          </button>
        </div>
        <div className="card-body">
          <p className="small text-secondary mb-3">
            Set your realistic available study periods for each day of the week. College days apply when college runs; holiday windows apply on off-days, Sundays, and holidays.
          </p>

          <div className="row g-3">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <div className="col-12 col-md-6 col-xl-4" key={d}>
                <div className="border rounded p-3 h-100 bg-body-tertiary">
                  <div className="fw-bold mb-2 text-body">{DAY_LONG[d]}</div>
                  {['college', 'holiday'].map((type) => (
                    <div key={type} className="mb-3">
                      <div className="small fw-semibold text-secondary mb-1">
                        {type === 'college' ? 'College Day Windows' : 'Holiday / Off-Day Windows'}
                      </div>
                      {(((data.availability || {})[d] || {})[type] || []).map((w, i) => (
                        <div key={i} className="avail-row mb-1">
                          <input
                            type="time"
                            className="form-control form-control-sm"
                            value={w.start}
                            onChange={(e) => setWindow(d, type, i, 'start', e.target.value)}
                          />
                          <span>–</span>
                          <input
                            type="time"
                            className="form-control form-control-sm"
                            value={w.end}
                            onChange={(e) => setWindow(d, type, i, 'end', e.target.value)}
                          />
                          <button
                            className="btn btn-sm text-danger p-0"
                            onClick={() => delWindow(d, type, i)}
                            title="Remove window"
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn btn-sm btn-link p-0 text-decoration-none"
                        onClick={() => addWindow(d, type)}
                      >
                        + Add Time Slot
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Commitments & Coaching Section */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-transparent fw-bold border-bottom">
          <i className="bi bi-clock-history text-primary me-2" />
          Coaching, Tuition, Gym & Personal Commitments
        </div>
        <div className="card-body">
          <p className="small text-secondary mb-3">
            Add recurring commitments like GATE coaching, sports, gym, or family commitments. The timetable generator will never schedule study sessions during these hours.
          </p>

          <div className="row g-2 align-items-end mb-3">
            <Field label="Commitment Title" className="col-12 col-md-4">
              <input
                className="form-control"
                value={c.title}
                onChange={(e) => setC({ ...c, title: e.target.value })}
                placeholder="e.g. GATE Online Coaching, Gym"
              />
            </Field>

            <Field label="Day of Week" className="col-6 col-md-3">
              <select
                className="form-select"
                value={c.day}
                onChange={(e) => setC({ ...c, day: e.target.value })}
              >
                <option value="all">Every Day</option>
                {DAY_LONG.map((n, i) => (
                  <option key={i} value={String(i)}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="From" className="col-3 col-md-2">
              <input
                type="time"
                className="form-control"
                value={c.start}
                onChange={(e) => setC({ ...c, start: e.target.value })}
              />
            </Field>

            <Field label="To" className="col-3 col-md-2">
              <input
                type="time"
                className="form-control"
                value={c.end}
                onChange={(e) => setC({ ...c, end: e.target.value })}
              />
            </Field>

            <div className="col-12 col-md-1">
              <button
                className="btn btn-primary w-100"
                disabled={!c.title.trim() || c.end <= c.start}
                onClick={() => {
                  upsert('commitments', { id: uid(), ...c, title: c.title.trim() });
                  setC({ ...c, title: '' });
                }}
              >
                Add
              </button>
            </div>
          </div>

          {(data.commitments || []).length === 0 ? (
            <div className="small text-secondary fst-italic">No recurring commitments added.</div>
          ) : (
            <div className="list-group list-group-flush">
              {data.commitments.map((x) => (
                <div key={x.id} className="list-group-item d-flex justify-content-between align-items-center py-2">
                  <div>
                    <strong>{x.title}</strong> ·{' '}
                    <span className="text-secondary">
                      {x.day === 'all' ? 'Every day' : DAY_LONG[Number(x.day)]} from {fmtTime(x.start, s.timeFormat || '12h')} to {fmtTime(x.end, s.timeFormat || '12h')}
                    </span>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => remove('commitments', x.id)}
                    aria-label="Remove commitment"
                  >
                    <i className="bi bi-trash" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Browser Notifications Preference */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-transparent fw-bold border-bottom">
          <i className="bi bi-bell text-primary me-2" />
          Notification Preferences
        </div>
        <div className="card-body">
          <p className="small text-secondary mb-3">
            In-app notification reminders are always active and shown under the bell icon. You can also optionally enable browser-level system notifications for sessions starting and approaching deadlines.
          </p>
          <button
            className={`btn ${s.browserNotifications ? 'btn-outline-danger' : 'btn-outline-primary'}`}
            onClick={requestNotif}
          >
            <i className={`bi bi-${s.browserNotifications ? 'bell-slash' : 'bell'} me-1`} />
            {s.browserNotifications ? 'Disable Browser Notifications' : 'Enable Browser Notifications'}
          </button>
        </div>
      </div>

      {// Removed LocalStorage Data Management & Backup section as per request
      }
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-transparent fw-bold border-bottom">
          <i className="bi bi-database text-primary me-2" />
          LocalStorage Data Management & Backups
        </div>
        <div className="card-body">
          <p className="small text-secondary mb-3">
            All your timetable data, subjects, exams, progress logs and settings are stored locally in this browser. Export a JSON backup file to preserve or move your planner to another device.
          </p>

          <div className="d-flex flex-wrap gap-2 align-items-center">
            <button className="btn btn-outline-primary" onClick={exportData}>
              <i className="bi bi-download me-1" /> Export JSON Backup
            </button>
            <button className="btn btn-outline-primary" onClick={() => fileRef.current.click()}>
              <i className="bi bi-upload me-1" /> Import JSON Backup
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importData} />

            <button className="btn btn-outline-success ms-auto" onClick={() => setConfirmLoadSample(true)}>
              <i className="bi bi-box-arrow-in-down me-1" /> Load Sample Demo Data
            </button>

            <button className="btn btn-outline-danger" onClick={() => setConfirmClear(true)}>
              <i className="bi bi-trash me-1" /> Clear All Data
            </button>
          </div>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      <ConfirmModal
        show={confirmClear}
        title="Clear All Application Data"
        message="This will permanently delete all your subjects, timetables, study progress logs, examinations and settings from this browser. Export a backup first if you want to keep them. Are you sure?"
        confirmText="Clear Everything"
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />

      {/* Load Sample Demo Confirmation Modal */}
      <ConfirmModal
        show={confirmLoadSample}
        title="Load Realistic Sample Data"
        message="This will populate your planner with comprehensive college demo data: subjects with codes and distinctive colors (Data Structures, DBMS, OS, Networks, GATE Math, GATE TOC), exams, assignments, projects with milestones, timetable schedules, and 7 days of study logs. Any existing data will be replaced. Continue?"
        confirmText="Load Demo Data"
        confirmVariant="success"
        onConfirm={loadSample}
        onCancel={() => setConfirmLoadSample(false)}
      />
      </>}
    </>
  );
}
