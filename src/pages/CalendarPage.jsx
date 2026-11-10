import { useMemo, useState } from 'react';
import { useStore } from '../hooks/useStore';
import { Modal, PageHeader, Empty, Field, SubjectColorBadge } from '../components/common';
import {
  addDays,
  addMonths,
  DAY_NAMES,
  MONTH_NAMES,
  niceDate,
  parseDate,
  shortDate,
  startOfWeek,
  todayStr,
  uid,
  durMin,
  fmtHours,
  fmtTime,
  fmtTimeRange,
} from '../utils/dates';
import { isHoliday } from '../utils/scheduler';
import { getSubjectColor } from '../utils/defaults';

export default function CalendarPage({ go }) {
  const { data, upsert, remove, toggleSession } = useStore();
  const today = todayStr();
  const [view, setView] = useState('month'); // 'month' | 'week' | 'day'
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [form, setForm] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const timeFormat = data.settings?.timeFormat || '12h';

  const subjectMap = useMemo(() => {
    const map = {};
    (data.subjects || []).forEach((s, idx) => {
      map[s.id] = { ...s, color: getSubjectColor(s, idx) };
    });
    return map;
  }, [data.subjects]);

  const eventStyle = (color) => ({
    backgroundColor: `color-mix(in srgb, ${color} 15%, var(--bs-tertiary-bg))`,
    borderColor: `color-mix(in srgb, ${color} 25%, var(--bs-border-color))`,
    color: 'var(--bs-body-color)',
  });

  // Aggregate all calendar events with subject colors and types
  const eventsFor = useMemo(() => {
    const map = {};
    const push = (date, e) => {
      (map[date] = map[date] || []).push(e);
    };

    // Study sessions
    (data.sessions || [])
      .filter((s) => s.kind === 'study')
      .forEach((s) => {
        const sub = subjectMap[s.subjectId];
        const color = sub?.color || s.color || '#0f766e';
        push(s.date, {
          id: s.id,
          type: 'session',
          color,
          bgStyle: eventStyle(color),
          text: `${fmtTime(s.start, timeFormat)} ${s.title}`,
          detail: s,
          subject: sub,
          sort: '1' + s.start,
        });
      });

    // Examinations
    (data.exams || []).forEach((e) => {
      push(e.date, {
        id: e.id,
        type: 'exam',
        color: '#a64c50',
        bgStyle: eventStyle('#a64c50'),
        text: `Exam: ${e.name} (${e.type})`,
        detail: e,
        sort: '0a',
      });
    });

    // Deadlines (Assignments, Tasks, Projects, Milestones)
    (data.tasks || [])
      .filter((t) => t.deadline)
      .forEach((t) => {
        const sub = subjectMap[t.subjectId];
        const isAssignment = t.kind === 'assignment';
        const isMilestone = t.kind === 'milestone';
        const isProject = t.kind === 'project';
        const color = isAssignment ? '#9a6b22' : isMilestone ? '#657796' : isProject ? '#547a9f' : '#477a5e';

        push(t.deadline, {
          id: t.id,
          type: 'task',
          color,
          bgStyle: eventStyle(color),
          text: `${isAssignment ? 'Due' : isMilestone ? 'Milestone' : isProject ? 'Project' : 'Task'}: ${t.title}`,
          detail: t,
          subject: sub,
          sort: '0b' + (t.done ? 'z' : 'a'),
        });
      });

    return (date) => {
      const list = [...(map[date] || [])];
      const h = isHoliday(data, date);
      if (h) {
        list.unshift({
          id: h.id,
          type: 'holiday',
          color: h.type === 'unavailable' ? '#64748b' : '#477a5e',
          bgStyle: eventStyle(h.type === 'unavailable' ? '#64748b' : '#477a5e'),
          text: `${h.type === 'unavailable' ? 'Unavailable' : 'Holiday'}: ${h.title}`,
          detail: h,
          sort: '00',
        });
      }
      return list.sort((a, b) => a.sort.localeCompare(b.sort));
    };
  }, [data, subjectMap]);

  const nav = (n) =>
    setCursor(
      view === 'month' ? addMonths(cursor, n) : view === 'week' ? addDays(cursor, 7 * n) : addDays(cursor, n)
    );

  const cd = parseDate(cursor);
  const title =
    view === 'month'
      ? `${MONTH_NAMES[cd.getMonth()]} ${cd.getFullYear()}`
      : view === 'week'
      ? `Week of ${niceDate(startOfWeek(cursor))}`
      : niceDate(cursor);

  const monthCells = () => {
    const first = cursor.slice(0, 8) + '01';
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  };

  const cells =
    view === 'month'
      ? monthCells()
      : view === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))
      : [cursor];

  const detailSessions = (date) =>
    (data.sessions || []).filter((s) => s.date === date).sort((a, b) => a.start.localeCompare(b.start));

  const saveHoliday = () => {
    if (!form.title.trim() || !form.from) return;
    upsert('holidays', {
      ...form,
      title: form.title.trim(),
      to: form.to && form.to >= form.from ? form.to : form.from,
    });
    setForm(null);
  };

  return (
    <>
      <PageHeader
        title="Academic Calendar"
        subtitle="Comprehensive view of study sessions, college exams, competitive tests, assignment deadlines and holidays."
      >
        <button
          className="btn btn-outline-primary"
          onClick={() =>
            setForm({
              id: uid(),
              title: '',
              type: 'holiday',
              from: selected,
              to: selected,
            })
          }
        >
          <i className="bi bi-plus-lg me-1" /> Add Holiday / Off-Day
        </button>
      </PageHeader>

      {/* Navigation Toolbar */}
      <div className="card mb-3 border-0 shadow-sm bg-body-tertiary">
        <div className="card-body py-2 d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => nav(-1)} aria-label="Previous">
                <i className="bi bi-chevron-left" />
              </button>
              <button
                className="btn btn-sm btn-outline-secondary fw-semibold"
                onClick={() => {
                  setCursor(today);
                  setSelected(today);
                }}
              >
                Today
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => nav(1)} aria-label="Next">
                <i className="bi bi-chevron-right" />
              </button>
            </div>
            <h5 className="mb-0 fw-bold">{title}</h5>
          </div>

          <div className="btn-group" role="group">
            {['month', 'week', 'day'].map((v) => (
              <button
                key={v}
                className={`btn btn-sm text-capitalize ${view === v ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setView(v)}
              >
                {v} View
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="row g-3">
        {/* Calendar Grid Section */}
        <div className="col-12 col-lg-8">
          {view !== 'day' && (
            <div className="cal-grid mb-1">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <div key={d} className="cal-head fw-bold">
                  {DAY_NAMES[d]}
                </div>
              ))}
            </div>
          )}

          {view === 'day' ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h5 className="fw-bold mb-3">{niceDate(cursor)}</h5>
                {eventsFor(cursor).length === 0 ? (
                  <Empty icon="calendar2">No scheduled events on this day.</Empty>
                ) : (
                  <>
                    <div className="mb-3 d-flex flex-wrap gap-1">
                      {eventsFor(cursor)
                        .filter((e) => e.type !== 'session')
                        .map((e, i) => (
                          <span
                            key={i}
                            className="cal-chip px-2 py-1 fs-6 rounded"
                            style={e.bgStyle}
                            onClick={() => setActiveEvent(e)}
                          >
                            {e.text}
                          </span>
                        ))}
                    </div>

                    <h6 className="fw-bold mt-4 mb-2">Timetable Sessions:</h6>
                    <div className="mt-2">
                      {detailSessions(cursor).map((s) => {
                        const isStudy = s.kind === 'study';
                        const sub = subjectMap[s.subjectId];
                        const color = isStudy ? (sub?.color || s.color || '#0f766e') : null;

                        return (
                          <div
                            key={s.id}
                            className={`session-card mb-2 p-2 rounded ${s.done ? 'session-done' : ''}`}
                            style={{
                              borderLeft: isStudy ? `5px solid ${color}` : '3px dashed var(--bs-border-color)',
                              backgroundColor: isStudy ? 'var(--bs-tertiary-bg)' : 'transparent',
                            }}
                          >
                            <div className="d-flex align-items-center gap-2">
                              {isStudy && (
                                <input
                                  className="form-check-input mt-0"
                                  type="checkbox"
                                  checked={s.done}
                                  onChange={() => toggleSession(s.id)}
                                />
                              )}
                              <div className="small font-monospace text-secondary" style={{ minWidth: timeFormat === '12h' ? 122 : 90 }}>
                                {fmtTimeRange(s.start, s.end, timeFormat)}
                              </div>
                              <div className="fw-semibold flex-grow-1 text-truncate">
                                {s.title} {s.topic ? `· ${s.topic}` : ''}
                              </div>
                              {s.label && <span className="badge text-bg-light border small">{s.label}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="cal-grid">
              {(view === 'month'
                ? cells
                : [1, 2, 3, 4, 5, 6, 0].map((dow) => cells.find((c) => parseDate(c).getDay() === dow))
              ).map((date) => {
                const ev = eventsFor(date);
                const max = view === 'month' ? 3 : 10;
                const isSelected = date === selected;
                const isToday = date === today;

                return (
                  <div
                    key={date}
                    role="button"
                    tabIndex={0}
                    className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${
                      view === 'month' && date.slice(0, 7) !== cursor.slice(0, 7) ? 'other' : ''
                    }`}
                    onClick={() => setSelected(date)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelected(date);
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center px-1">
                      <span className={`small fw-bold ${isToday ? 'text-primary' : 'text-body'}`}>
                        {parseDate(date).getDate()}
                      </span>
                      {ev.length > 0 && <span className="small text-secondary" style={{ fontSize: '0.65rem' }}>{ev.length}</span>}
                    </div>

                    {ev.slice(0, max).map((e, i) => (
                      <span
                        key={i}
                        className="cal-chip"
                        style={e.bgStyle}
                        title={e.text}
                        onClick={(evv) => {
                          evv.stopPropagation();
                          setActiveEvent(e);
                        }}
                      >
                        {e.text}
                      </span>
                    ))}
                    {ev.length > max && (
                      <div className="small text-secondary px-1" style={{ fontSize: '0.65rem' }}>
                        +{ev.length - max} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Color Legend */}
          <div className="d-flex flex-wrap gap-2 small mt-3 p-2 bg-body-tertiary rounded">
            <span className="fw-semibold text-secondary me-1">Legend:</span>
            <span className="badge subject-color-badge" style={{ '--subject-color': '#536f91' }}>
              Study Sessions (Colored by Subject)
            </span>
            <span className="badge subject-color-badge" style={{ '--subject-color': '#a64c50' }}>
              Examinations
            </span>
            <span className="badge subject-color-badge" style={{ '--subject-color': '#9a6b22' }}>
              Assignment Deadlines
            </span>
            <span className="badge subject-color-badge" style={{ '--subject-color': '#657796' }}>
              Milestones
            </span>
            <span className="badge subject-color-badge" style={{ '--subject-color': '#477a5e' }}>
              Holidays
            </span>
            <span className="badge subject-color-badge" style={{ '--subject-color': '#64748b' }}>
              Unavailable Periods
            </span>
          </div>
        </div>

        {/* Selected Day Sidebar */}
        <div className="col-12 col-lg-4">
          <div className="card mb-3 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold border-bottom d-flex justify-content-between align-items-center">
              <span>{niceDate(selected)}</span>
              {selected === today && <span className="badge text-bg-warning">Today</span>}
            </div>
            <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {eventsFor(selected).length === 0 ? (
                <Empty icon="calendar2">No events on this day.</Empty>
              ) : (
                eventsFor(selected).map((e, i) => (
                  <div
                    key={i}
                    className="p-2 mb-2 rounded small text-white cursor-pointer shadow-sm"
                    style={{ ...e.bgStyle, cursor: 'pointer' }}
                    onClick={() => setActiveEvent(e)}
                  >
                    <div className="fw-bold">{e.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Holidays & Leaves Manager */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold border-bottom d-flex justify-content-between align-items-center">
              <span>Holidays & Off-Days</span>
              <button
                className="btn btn-sm btn-link p-0 text-decoration-none"
                onClick={() =>
                  setForm({
                    id: uid(),
                    title: '',
                    type: 'holiday',
                    from: today,
                    to: today,
                  })
                }
              >
                + Add
              </button>
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {(data.holidays || []).length === 0 ? (
                <div className="list-group-item small text-secondary">
                  No holidays added. Holidays use holiday availability; unavailable days get no study sessions.
                </div>
              ) : (
                [...data.holidays]
                  .sort((a, b) => a.from.localeCompare(b.from))
                  .map((h) => (
                    <div
                      key={h.id}
                      className="list-group-item d-flex justify-content-between align-items-center py-2"
                    >
                      <div className="min-w-0 me-2">
                        <div className="fw-semibold text-truncate">{h.title}</div>
                        <div className="small text-secondary">
                          {h.type === 'unavailable' ? 'Unavailable' : 'Holiday'} · {h.from}
                          {h.to !== h.from ? ` to ${h.to}` : ''}
                        </div>
                      </div>
                      <div className="btn-group btn-group-sm flex-shrink-0">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => setForm({ ...h })}
                          aria-label="Edit holiday"
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => remove('holidays', h.id)}
                          aria-label="Delete holiday"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Holiday / Unavailable Modal */}
      {form && (
        <Modal
          title="Holiday or Unavailable Period"
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveHoliday}
                disabled={!form.title.trim() || !form.from}
              >
                Save
              </button>
            </>
          }
        >
          <div className="row g-3">
            <Field label="Title / Reason" className="col-12">
              <input
                className="form-control"
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Diwali Break, Annual Tech Fest, Family Leave"
              />
            </Field>

            <Field label="Category" className="col-12">
              <select
                className="form-select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="holiday">Holiday (Free study day with holiday timetable)</option>
                <option value="unavailable">Unavailable (Completely blocked - no study scheduled)</option>
              </select>
            </Field>

            <Field label="Start Date" className="col-6">
              <input
                type="date"
                className="form-control"
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
              />
            </Field>

            <Field label="End Date" className="col-6">
              <input
                type="date"
                className="form-control"
                value={form.to}
                min={form.from}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Event Details Quick Modal */}
      {activeEvent && (
        <Modal
          title="Event Details"
          onClose={() => setActiveEvent(null)}
          footer={
            <>
              {activeEvent.type === 'session' && (
                <button
                  className="btn btn-primary me-auto"
                  onClick={() => {
                    setActiveEvent(null);
                    go('timetable');
                  }}
                >
                  Open in Timetable
                </button>
              )}
              {activeEvent.type === 'exam' && (
                <button
                  className="btn btn-primary me-auto"
                  onClick={() => {
                    setActiveEvent(null);
                    go('exams');
                  }}
                >
                  Open in Exams
                </button>
              )}
              {activeEvent.type === 'task' && (
                <button
                  className="btn btn-primary me-auto"
                  onClick={() => {
                    setActiveEvent(null);
                    go('tasks');
                  }}
                >
                  Open in Tasks
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setActiveEvent(null)}>
                Close
              </button>
            </>
          }
        >
          <div className="p-2 mb-3 rounded" style={activeEvent.bgStyle}>
            <div className="fw-bold">{activeEvent.text}</div>
          </div>

          {activeEvent.detail && (
            <div className="small">
              {activeEvent.detail.start && (
                <div className="mb-1">
                  <strong>Time:</strong> {fmtTimeRange(activeEvent.detail.start, activeEvent.detail.end, timeFormat)}
                </div>
              )}
              {activeEvent.detail.date && (
                <div className="mb-1">
                  <strong>Date:</strong> {niceDate(activeEvent.detail.date)}
                </div>
              )}
              {activeEvent.detail.deadline && (
                <div className="mb-1">
                  <strong>Deadline:</strong> {niceDate(activeEvent.detail.deadline)}
                </div>
              )}
              {activeEvent.subject && (
                <div className="mb-1">
                  <strong>Subject:</strong> {activeEvent.subject.name} ({activeEvent.subject.code || 'No code'})
                </div>
              )}
              {activeEvent.detail.topic && (
                <div className="mb-1">
                  <strong>Topic:</strong> {activeEvent.detail.topic}
                </div>
              )}
              {activeEvent.detail.notes && (
                <div className="mt-2 p-2 bg-body-tertiary rounded">
                  <strong>Notes:</strong> {activeEvent.detail.notes}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
