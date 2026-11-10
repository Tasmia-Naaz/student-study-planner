import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../hooks/useStore';
import { apiRequest } from '../utils/api';
import { Modal, PageHeader, Empty, Field, ColorSwatchSelector } from '../components/common';
import {
  addDays,
  DAY_LONG,
  DAY_NAMES,
  dayOfWeek,
  durMin,
  fmtHours,
  fmtTime,
  fmtTimeRange,
  niceDate,
  parseDate,
  shortDate,
  startOfWeek,
  todayStr,
  uid,
} from '../utils/dates';
import { dayKind, generateTimetable, isHoliday, overlaps, studyMinutes } from '../utils/scheduler';
import { getSubjectColor, SUBJECT_COLORS } from '../utils/defaults';

const KIND_LABEL = {
  college: 'College Working Day',
  holiday: 'Holiday / Free Day',
  unavailable: 'Unavailable Day',
};

const BREAK_ICON = {
  short: 'cup-hot',
  long: 'cup-hot-fill',
  meal: 'egg-fried',
};

function hexToRgba(hex, alpha = 0.06) {
  if (!hex || typeof hex !== 'string') return `rgba(15, 118, 110, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length !== 6) return `rgba(15, 118, 110, ${alpha})`;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getSessionBadgeClass(label) {
  if (!label) return 'badge-tag-default';
  if (label.includes('Revision') || label.includes('Exam')) return 'badge-tag-warning';
  if (label.includes('PYQ') || label.includes('Mock')) return 'badge-tag-danger';
  if (label.includes('Assignment')) return 'badge-tag-assignment';
  if (label.includes('Project') || label.includes('Lab')) return 'badge-tag-project';
  return 'badge-tag-default';
}

export default function Timetable({ go }) {
  const { data, patch, upsert, remove, toggleSession } = useStore();
  const today = todayStr();
  const [backlogs, setBacklogs] = useState([]);
  const [backlogError, setBacklogError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/students/me/backlogs')
      .then((items) => {
        if (active) {
          setBacklogs(items.filter((item) => item.status !== 'Cleared'));
          setBacklogError('');
        }
      })
      .catch((error) => {
        if (active) setBacklogError(`Backlog subjects could not be loaded: ${error.message}`);
      });
    return () => { active = false; };
  }, []);

  const timetableSubjects = useMemo(() => [
    ...(data.subjects || []),
    ...backlogs.map((backlog) => ({
      id: `backlog-${backlog.id}`,
      name: backlog.subject_name,
      code: backlog.subject_code,
      semester: backlog.semester,
      priority: backlog.priority,
      progress: backlog.progress,
      status: backlog.status,
      deadline: backlog.exam_date,
      category: 'college',
      difficulty: backlog.priority === 'High' ? 'Hard' : backlog.priority === 'Low' ? 'Easy' : 'Medium',
      topics: [],
      examId: backlog.exam_date ? `backlog-exam-${backlog.id}` : '',
      isBacklog: true,
    })),
  ], [data.subjects, backlogs]);
  const timetableData = useMemo(() => ({
    ...data,
    subjects: timetableSubjects,
    exams: [
      ...(data.exams || []),
      ...backlogs.filter((backlog) => backlog.exam_date).map((backlog) => ({
        id: `backlog-exam-${backlog.id}`,
        date: backlog.exam_date,
        type: 'Backlog',
      })),
    ],
  }), [data, timetableSubjects, backlogs]);

  // State: selected date view
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewScope, setViewScope] = useState('combined'); // 'combined' | 'college' | 'exam'
  const [showGenPanel, setShowGenPanel] = useState(false);

  // Generator parameters
  const [gen, setGen] = useState({ track: 'both', startDate: today, days: 7 });
  const [msg, setMsg] = useState(null);

  // Edit / Add modal form
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const timeFormat = data.settings?.timeFormat || '12h';
  const goalMin = (Number(data.settings?.dailyGoal) || 0) * 60;
  const isDark = data.settings?.theme === 'dark';

  // Build subject lookup map for colors, codes, and names
  const subjectMap = useMemo(() => {
    const map = {};
    timetableSubjects.forEach((s, idx) => {
      map[s.id] = {
        ...s,
        color: getSubjectColor(s, idx),
      };
    });
    return map;
  }, [timetableSubjects]);

  // Filter visible sessions according to scope (Combined, College, or Outside Exam)
  const isVisibleInScope = (s) => {
    if (viewScope === 'combined') return true;
    if (s.kind === 'break') return true;
    return s.track === viewScope;
  };

  // Group all sessions by date
  const sessionsByDate = useMemo(() => {
    const map = {};
    (data.sessions || [])
      .filter(isVisibleInScope)
      .forEach((s) => {
        (map[s.date] = map[s.date] || []).push(s);
      });
    Object.values(map).forEach((list) => list.sort((a, b) => a.start.localeCompare(b.start)));
    return map;
  }, [data.sessions, viewScope]);

  // Current week strip containing selectedDate (7 days: Monday to Sunday)
  const currentWeekStart = startOfWeek(selectedDate);
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Sessions on the currently selected day
  const daySessions = sessionsByDate[selectedDate] || [];
  const dayStudySessions = daySessions.filter((s) => s.kind === 'study');
  const dayCompletedSessions = dayStudySessions.filter((s) => s.done);
  const dayPlannedMin = studyMinutes(daySessions);
  const dayStudiedMin = studyMinutes(daySessions, (s) => s.done);
  const currentDayKind = dayKind(data, selectedDate);
  const currentHoliday = isHoliday(data, selectedDate);
  const isSelectedToday = selectedDate === today;

  // Timetable Generator execution
  const handleGenerate = () => {
    const res = generateTimetable(timetableData, {
      startDate: gen.startDate,
      days: Number(gen.days),
      track: gen.track,
    });
    if (res.created > 0 || res.sessions !== data.sessions) {
      patch('sessions', res.sessions);
    }
    setMsg({
      ok: res.created > 0,
      created: res.created,
      warnings: res.warnings,
    });
    setSelectedDate(gen.startDate);
    if (gen.track === 'college') setViewScope('college');
    else if (gen.track === 'exam') setViewScope('exam');
    else setViewScope('combined');
  };

  const handleClearRange = () => {
    if (
      !window.confirm(
        `Clear all generated timetable sessions from ${gen.startDate} for ${gen.days} days? Manually added and completed sessions will be preserved.`
      )
    )
      return;
    const end = addDays(gen.startDate, Number(gen.days) - 1);
    patch('sessions', (list) => list.filter((s) => s.date < gen.startDate || s.date > end || s.done || s.locked));
    setMsg(null);
  };

  const openNewSession = (date) => {
    const defaultSub = timetableSubjects[0];
    setForm({
      id: uid(),
      date: date || selectedDate,
      start: '18:00',
      end: '18:50',
      kind: 'study',
      breakKind: 'short',
      subjectId: defaultSub ? defaultSub.id : '',
      taskId: '',
      title: defaultSub ? defaultSub.name : '',
      topic: '',
      label: 'Topic Study',
      track: defaultSub ? defaultSub.category : 'college',
      done: false,
      locked: true,
      isNew: true,
    });
    setError('');
  };

  const saveFormSession = () => {
    const subj = subjectMap[form.subjectId];
    const isBreak = form.kind === 'break';
    const title = isBreak
      ? form.title || (form.breakKind === 'meal' ? 'Meal break' : form.breakKind === 'long' ? 'Long break' : 'Short break')
      : form.title || subj?.name || 'Study session';

    const color = isBreak ? '' : subj?.color || form.color || SUBJECT_COLORS[0].hex;

    const item = {
      ...form,
      title,
      track: isBreak ? '' : subj ? subj.category : form.track || 'college',
      color,
      locked: true,
    };
    delete item.isNew;

    if (item.end <= item.start) {
      return setError('End time must be later than start time.');
    }
    if (overlaps(data.sessions, item)) {
      return setError('This session overlaps with another scheduled session or break on the same day. Please adjust the times.');
    }

    upsert('sessions', item);
    setForm(null);
    setError('');
  };

  return (
    <div className="timetable-container">
      {/* Page Header */}
      <PageHeader
        title="Study Timetable"
        subtitle="Clean selected-day schedule with automatic breaks, subject color themes, and rule-based timetable generation."
      >
        <button className="btn btn-outline-secondary" onClick={() => setShowGenPanel(!showGenPanel)}>
          <i className="bi bi-sliders2 me-1" /> {showGenPanel ? 'Hide Generator' : 'Generator Options'}
        </button>
        <button className="btn btn-primary" onClick={() => openNewSession(selectedDate)}>
          <i className="bi bi-plus-lg me-1" /> Add Session
        </button>
      </PageHeader>
      {backlogError && <div className="alert alert-warning" role="alert">{backlogError}</div>}

      {/* Generator Control Panel (Expandable / Clean) */}
      {showGenPanel && (
        <div className="card mb-4 border-0 shadow-sm bg-body-tertiary no-print">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
              <span className="fw-bold small text-uppercase text-secondary">
                <i className="bi bi-magic text-primary me-1" /> Smart Rule-Based Timetable Generator
              </span>
              <button
                className="btn-close btn-sm"
                onClick={() => setShowGenPanel(false)}
                aria-label="Close generator panel"
              />
            </div>
            <div className="row g-2 align-items-end">
              <Field label="Schedule Scope" className="col-12 col-sm-6 col-lg-3">
                <select
                  className="form-select"
                  value={gen.track}
                  onChange={(e) => setGen({ ...gen, track: e.target.value })}
                >
                  <option value="both">College + Outside Exam Prep (Combined)</option>
                  <option value="college">Regular College Subjects Only</option>
                  <option value="exam">Outside Exam Preparation Only</option>
                </select>
              </Field>

              <Field label="Start Date" className="col-6 col-sm-6 col-lg-3">
                <input
                  type="date"
                  className="form-control"
                  value={gen.startDate}
                  onChange={(e) => setGen({ ...gen, startDate: e.target.value })}
                />
              </Field>

              <Field label="Generation Range" className="col-6 col-sm-6 col-lg-2">
                <select
                  className="form-select"
                  value={gen.days}
                  onChange={(e) => setGen({ ...gen, days: e.target.value })}
                >
                  <option value={1}>1 Day (Daily)</option>
                  <option value={3}>3 Days</option>
                  <option value={7}>7 Days (1 Week)</option>
                  <option value={14}>14 Days (2 Weeks)</option>
                  <option value={30}>30 Days (1 Month)</option>
                </select>
              </Field>

              <div className="col-12 col-sm-6 col-lg-4 d-flex gap-2">
                <button className="btn btn-primary flex-grow-1" onClick={handleGenerate}>
                  <i className="bi bi-play-circle-fill me-1" /> Generate Timetable
                </button>
                <button
                  className="btn btn-outline-danger"
                  onClick={handleClearRange}
                  title="Clear generated sessions"
                  aria-label="Clear generated sessions"
                >
                  <i className="bi bi-eraser" /> Clear
                </button>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3 pt-2 border-top small text-secondary">
              <span>
                <i className="bi bi-info-circle me-1" />
                Preserves manually edited, locked, and completed study sessions.
              </span>
              <span>
                Daily Target Goal: <strong>{data.settings?.dailyGoal || 4}h</strong> · Session: <strong>{data.settings?.sessionMinutes || 50}m</strong> · Break: <strong>{data.settings?.shortBreak || 10}m</strong>
              </span>
            </div>

            {msg && (
              <div className={`alert alert-${msg.ok ? 'success' : 'warning'} mt-3 mb-0 py-2 shadow-sm`}>
                <div className="fw-semibold">
                  {msg.created > 0
                    ? `Successfully scheduled ${msg.created} study session${msg.created === 1 ? '' : 's'}.`
                    : 'No sessions could be scheduled based on current availability windows.'}
                </div>
                {msg.warnings.length > 0 && (
                  <div className="mt-1 small">
                    <strong>Availability notes:</strong>
                    <ul className="mb-0 ps-3">
                      {msg.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scope Navigation Tabs (Combined, College, Outside Exam) */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="btn-group" role="group" aria-label="Timetable Category Scope">
          <button
            className={`btn btn-sm ${viewScope === 'combined' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setViewScope('combined')}
          >
            <i className="bi bi-layers me-1" /> Combined Timetable
          </button>
          <button
            className={`btn btn-sm ${viewScope === 'college' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setViewScope('college')}
          >
            <i className="bi bi-building me-1" /> College Study Only
          </button>
          <button
            className={`btn btn-sm ${viewScope === 'exam' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setViewScope('exam')}
          >
            <i className="bi bi-mortarboard me-1" /> Outside Exam Prep
          </button>
        </div>

        {/* Quick jump to today */}
        <div className="d-flex align-items-center gap-2">
          {!isSelectedToday && (
            <button className="btn btn-sm btn-outline-primary" onClick={() => setSelectedDate(today)}>
              <i className="bi bi-calendar-check me-1" /> Jump to Today
            </button>
          )}
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ width: 'auto' }}
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            title="Pick a specific date"
            aria-label="Pick date"
          />
        </div>
      </div>

      {/* Clean Selected-Day Navigation Bar & Day Tabs */}
      <div className="day-selector-wrapper mb-3 shadow-sm">
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          {/* Previous Day & Week Navigation */}
          <div className="d-flex align-items-center gap-1">
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              title="Previous Day"
            >
              <i className="bi bi-chevron-left" />
              <span className="d-none d-sm-inline">Prev Day</span>
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              title="Previous Week"
            >
              <i className="bi bi-chevron-double-left" />
            </button>
          </div>

          <div className="fw-bold text-body text-center small text-uppercase tracking-wider">
            Week of {shortDate(currentWeekStart)} – {shortDate(addDays(currentWeekStart, 6))}
          </div>

          {/* Next Day & Week Navigation */}
          <div className="d-flex align-items-center gap-1">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              title="Next Week"
            >
              <i className="bi bi-chevron-double-right" />
            </button>
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              title="Next Day"
            >
              <span className="d-none d-sm-inline">Next Day</span>
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>

        {/* 7-Day Interactive Day Switcher Strip */}
        <div className="day-pills-scroll">
          {weekDays.map((d) => {
            const isDaySelected = d === selectedDate;
            const isDayToday = d === today;
            const dayList = sessionsByDate[d] || [];
            const dayStudyList = dayList.filter((s) => s.kind === 'study');
            const dDow = dayOfWeek(d);
            const dayNum = parseDate(d).getDate();

            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                className={`day-pill-btn ${isDaySelected ? 'active' : ''} ${isDayToday ? 'is-today' : ''}`}
                onClick={() => setSelectedDate(d)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedDate(d);
                }}
              >
                <span className="day-pill-dow">{DAY_NAMES[dDow]}</span>
                <span className="day-pill-num">{dayNum}</span>
                <span className="day-pill-sub text-truncate" style={{ maxWidth: '100%' }}>
                  {dayStudyList.length > 0 ? `${dayStudyList.length} sess` : 'No study'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Spacious Header Banner */}
      <div className="selected-day-banner shadow-sm mb-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
              {isSelectedToday && <span className="badge text-bg-warning text-dark px-2">Today</span>}
              <span className={`badge ${currentDayKind === 'college' ? 'badge-track-college' : 'badge-diff-easy'}`}>
                {currentHoliday ? (
                  <span>
                    <i className="bi bi-calendar-heart me-1 text-success" />
                    {currentHoliday.title}
                  </span>
                ) : (
                  <span>
                    {KIND_LABEL[currentDayKind]}
                    {currentDayKind === 'college'
                      ? ` (${fmtTime(data.settings?.collegeStart || '09:00', timeFormat)} – ${fmtTime(data.settings?.collegeEnd || '16:00', timeFormat)})`
                      : ''}
                  </span>
                )}
              </span>
            </div>
            <h3 className="banner-date-heading mb-0">{niceDate(selectedDate)}</h3>
          </div>

          <div className="d-flex flex-wrap gap-2 text-md-end">
            <div className="bg-body p-2 rounded border px-3">
              <div className="small text-secondary">Scheduled Study</div>
              <div className="fw-bold text-body">{fmtHours(dayPlannedMin)}</div>
            </div>
            <div className="bg-body p-2 rounded border px-3">
              <div className="small text-secondary">Completed</div>
              <div className="fw-bold text-success">{fmtHours(dayStudiedMin)}</div>
            </div>
            <div className="bg-body p-2 rounded border px-3">
              <div className="small text-secondary">Sessions Done</div>
              <div className="fw-bold text-primary">
                {dayCompletedSessions.length} / {dayStudySessions.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Single-Day Schedule Cards Timeline */}
      {daySessions.length === 0 ? (
        <div className="card border-0 shadow-sm p-4 text-center my-4 bg-body-tertiary">
          <Empty icon={currentDayKind === 'unavailable' ? 'slash-circle' : 'calendar2-x'}>
            <h5 className="fw-bold text-body mb-2">
              {currentDayKind === 'unavailable' ? 'Marked as Unavailable' : 'No Study Sessions Scheduled for this Day'}
            </h5>
            <p className="small text-secondary mb-3" style={{ maxWidth: 480, margin: '0 auto' }}>
              {currentDayKind === 'unavailable'
                ? 'This date is marked as completely unavailable in your calendar.'
                : 'You have no study sessions or breaks scheduled for this date. You can generate a schedule automatically or add a manual study block.'}
            </p>
            <div className="d-flex justify-content-center gap-2">
              <button className="btn btn-primary" onClick={handleGenerate}>
                <i className="bi bi-magic me-1" /> Generate Timetable
              </button>
              <button className="btn btn-outline-secondary" onClick={() => openNewSession(selectedDate)}>
                <i className="bi bi-plus-lg me-1" /> Add Manual Session
              </button>
            </div>
          </Empty>
        </div>
      ) : (
        <div className="schedule-timeline">
          {daySessions.map((s) => {
            const isStudy = s.kind === 'study';
            const subj = subjectMap[s.subjectId];
            const subjectColor = isStudy ? subj?.color || s.color || getSubjectColor(subj) : '#0f766e';
            const isBreak = !isStudy;
            const breakKind = s.breakKind || 'short';

            // Distinct rendering for breaks vs study sessions
            if (isBreak) {
              const breakClass =
                breakKind === 'meal' ? 'break-meal' : breakKind === 'long' ? 'break-long' : 'break-short';
              const iconClass =
                breakKind === 'meal' ? 'meal' : breakKind === 'long' ? 'long' : 'short';
              const durationPillClass =
                breakKind === 'meal'
                  ? 'break-pill-emerald'
                  : breakKind === 'long'
                  ? 'break-pill-warm'
                  : 'session-duration-pill';

              return (
                <div key={s.id} className={`timetable-item break-item ${breakClass} shadow-sm`}>
                  <div className="timetable-item-grid">
                    {/* Time & Duration Box */}
                    <div className="time-duration-box">
                      <div className="session-time-text">
                        {fmtTimeRange(s.start, s.end, timeFormat)}
                      </div>
                      <span className={`session-duration-pill ${durationPillClass}`}>
                        <i className={`bi bi-${BREAK_ICON[breakKind]} me-1`} />
                        {durMin(s)} min {breakKind === 'meal' ? 'meal' : breakKind === 'long' ? 'long break' : 'break'}
                      </span>
                    </div>

                    {/* Content Box */}
                    <div className="session-main-content">
                      <div className="d-flex align-items-center gap-2">
                        <span className={`break-icon-circle ${iconClass}`}>
                          <i className={`bi bi-${BREAK_ICON[breakKind]}`} />
                        </span>
                        <div>
                          <h6 className="break-title text-body mb-0">{s.title}</h6>
                          <span className="small text-secondary">
                            {breakKind === 'meal'
                              ? 'Scheduled meal time & rest (excluded from study hours)'
                              : breakKind === 'long'
                              ? 'Extended rest break — walk, stretch & recharge'
                              : 'Quick rest, eye break & hydration'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Box */}
                    <div className="session-actions-box">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => {
                            setError('');
                            setForm({ ...s });
                          }}
                          title="Edit Break"
                          aria-label="Edit Break"
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => remove('sessions', s.id)}
                          title="Delete Break"
                          aria-label="Delete Break"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Study Session Card
            return (
              <div
                key={s.id}
                className={`timetable-item study-item ${s.done ? 'is-done' : ''} shadow-sm`}
                style={{
                  borderLeftColor: subjectColor,
                  backgroundColor: hexToRgba(subjectColor, isDark ? 0.12 : 0.05),
                }}
              >
                <div className="timetable-item-grid">
                  {/* Left Column: Time & Duration */}
                  <div className="time-duration-box">
                    <div className="session-time-text">
                      {fmtTimeRange(s.start, s.end, timeFormat)}
                    </div>
                    <span className="session-duration-pill">
                      <i className="bi bi-clock me-1 text-primary" />
                      {fmtHours(durMin(s))}
                    </span>
                  </div>

                  {/* Center Column: Subject Title, Code, Topic, Badges */}
                  <div className="session-main-content">
                    <div className="session-header-row">
                      {subj?.code && (
                        <span
                          className="subject-code-tag"
                          style={{
                            backgroundColor: subjectColor,
                            color: '#ffffff',
                          }}
                        >
                          {subj.code}
                        </span>
                      )}
                      <h5 className="session-subject-title">{s.title}</h5>
                    </div>

                    {/* Topic Box with clear wrapping */}
                    {s.topic && (
                      <div className="session-topic-box">
                        <i className="bi bi-journal-text me-1 text-secondary" />
                        <span className="topic-text">
                          <strong>Topic:</strong> {s.topic}
                        </span>
                      </div>
                    )}

                    {/* Tags row */}
                    <div className="session-tags-row">
                      {s.label && (
                        <span className={`badge ${getSessionBadgeClass(s.label)}`}>
                          {s.label}
                        </span>
                      )}
                      <span className={`badge ${s.track === 'exam' ? 'badge-track-exam' : 'badge-track-college'}`}>
                        {s.track === 'exam' ? 'Outside Exam Prep' : 'College Study'}
                      </span>
                      {subj?.difficulty && (
                        <span className={`badge badge-diff-${subj.difficulty.toLowerCase()}`}>
                          {subj.difficulty}
                        </span>
                      )}
                      {s.done && (
                        <span className="badge text-bg-success">
                          <i className="bi bi-check-circle-fill me-1" /> Completed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Completion Checkbox & Actions */}
                  <div className="session-actions-box">
                    <label
                      className="completion-check-label"
                      title={s.done ? 'Mark incomplete' : 'Mark completed and log progress'}
                    >
                      <input
                        type="checkbox"
                        className="form-check-input session-checkbox"
                        checked={s.done}
                        onChange={() => toggleSession(s.id)}
                      />
                      <span className="check-text-label d-none d-sm-inline">
                        {s.done ? 'Done' : 'Mark Done'}
                      </span>
                    </label>

                    <div className="btn-group btn-group-sm">
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => {
                          setError('');
                          setForm({ ...s });
                        }}
                        title="Edit / Reschedule"
                        aria-label="Edit session"
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        className="btn btn-outline-danger"
                        onClick={() => remove('sessions', s.id)}
                        title="Delete Session"
                        aria-label="Delete session"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Session Modal */}
      {form && (
        <Modal
          title={form.isNew ? 'Add Timetable Session' : 'Edit / Reschedule Session'}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          footer={
            <>
              {!form.isNew && (
                <button
                  className="btn btn-outline-danger me-auto"
                  onClick={() => {
                    remove('sessions', form.id);
                    setForm(null);
                  }}
                >
                  <i className="bi bi-trash me-1" /> Delete
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setForm(null);
                  setError('');
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveFormSession}>
                Save Changes
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger py-2">{error}</div>}

          <div className="row g-3">
            <Field label="Session Category" className="col-6">
              <select
                className="form-select"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                <option value="study">Study Session</option>
                <option value="break">Break Block</option>
              </select>
            </Field>

            <Field label="Date" className="col-6">
              <input
                type="date"
                className="form-control"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>

            <Field label="Start Time" className="col-6">
              <input
                type="time"
                className="form-control"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </Field>

            <Field label="End Time" className="col-6">
              <input
                type="time"
                className="form-control"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </Field>

            {form.kind === 'study' ? (
              <>
                <Field label="Subject" className="col-12">
                  <select
                    className="form-select"
                    value={form.subjectId}
                    onChange={(e) => {
                      const sub = subjectMap[e.target.value];
                      setForm({
                        ...form,
                        subjectId: e.target.value,
                        title: sub ? sub.name : form.title,
                        track: sub ? sub.category : form.track,
                        color: sub ? sub.color : form.color,
                      });
                    }}
                  >
                    <option value="">None / Custom Study</option>
                    {timetableSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.isBacklog ? '[Backlog] ' : ''}{s.code ? `[${s.code}] ` : ''}{s.name}{s.isBacklog ? ` (Semester ${s.semester})` : ` (${s.category === 'exam' ? 'Outside Exam' : 'College'})`}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Session Title" className="col-12">
                  <input
                    className="form-control"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Data Structures & Algorithms"
                  />
                </Field>

                <Field label="Topic or Chapter" className="col-12">
                  <input
                    className="form-control"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    placeholder="e.g. Binary Search Trees & AVL rotations"
                  />
                </Field>

                <Field label="Session Type / Tag" className="col-6">
                  <select
                    className="form-select"
                    value={form.label || 'Topic Study'}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                  >
                    <option value="Topic Study">Topic Study</option>
                    <option value="Revision">Revision</option>
                    <option value="Exam Prep">Exam Preparation</option>
                    <option value="Practice Questions">Practice Questions</option>
                    <option value="Mock Test">Mock Test</option>
                    <option value="PYQ Practice">PYQ Practice</option>
                    <option value="Assignment Work">Assignment Work</option>
                    <option value="Project Work">Project Work</option>
                  </select>
                </Field>

                <Field label="Track / Scope" className="col-6">
                  <select
                    className="form-select"
                    value={form.track}
                    onChange={(e) => setForm({ ...form, track: e.target.value })}
                  >
                    <option value="college">College Study</option>
                    <option value="exam">Outside Exam Preparation</option>
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field label="Break Kind" className="col-6">
                  <select
                    className="form-select"
                    value={form.breakKind}
                    onChange={(e) => {
                      const bk = e.target.value;
                      const title = bk === 'meal' ? 'Meal break' : bk === 'long' ? 'Long break' : 'Short break';
                      setForm({ ...form, breakKind: bk, title });
                    }}
                  >
                    <option value="short">Short Break (10m)</option>
                    <option value="long">Long Break (30m)</option>
                    <option value="meal">Meal Break (Lunch / Dinner)</option>
                  </select>
                </Field>

                <Field label="Break Label / Notes" className="col-6">
                  <input
                    className="form-control"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Refreshment & walk"
                  />
                </Field>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
