import { useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { Modal, ConfirmModal, PageHeader, ProgressBar, Empty, Field, SubjectColorBadge } from '../components/common';
import { addDays, fmtHours, monthStart, niceDate, shortDate, startOfWeek, todayStr, uid } from '../utils/dates';
import { getSubjectColor } from '../utils/defaults';

export default function DailyProgress() {
  const { data, setData, upsert, remove } = useStore();
  const today = todayStr();
  const [viewTab, setViewTab] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [f, setF] = useState({
    date: today,
    subjectId: '',
    hours: 1,
    minutes: 0,
    topics: '',
    notes: '',
    picked: [],
  });
  const [editLog, setEditLog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const goalMin = (Number(data.settings.dailyGoal) || 0) * 60;
  const sum = (arr) => arr.reduce((t, l) => t + l.minutes, 0);

  const subjectMap = useMemo(() => {
    const map = {};
    (data.subjects || []).forEach((s, idx) => {
      map[s.id] = { ...s, color: getSubjectColor(s, idx) };
    });
    return map;
  }, [data.subjects]);

  const subj = subjectMap[f.subjectId];
  const pending = subj ? (subj.topics || []).filter((t) => !t.done) : [];

  // Summary Metrics
  const todayMin = sum((data.logs || []).filter((l) => l.date === today));
  const wk = startOfWeek(today);
  const weekMin = sum((data.logs || []).filter((l) => l.date >= wk && l.date <= addDays(wk, 6)));
  const monthStartStr = monthStart(today);
  const monthLogs = (data.logs || []).filter((l) => l.date >= monthStartStr && l.date.slice(0, 7) === today.slice(0, 7));
  const monthMin = sum(monthLogs);

  // Average daily study hours
  const past30Days = Array.from({ length: 30 }, (_, i) => addDays(today, -i));
  const past30Logs = (data.logs || []).filter((l) => past30Days.includes(l.date));
  const past30Min = sum(past30Logs);
  const avgDailyHours = (past30Min / 30 / 60).toFixed(1);

  // Subject-wise study time
  const bySubject = (data.subjects || [])
    .map((s) => ({
      s,
      m: sum((data.logs || []).filter((l) => l.subjectId === s.id)),
      color: subjectMap[s.id]?.color || '#0f766e',
    }))
    .filter((x) => x.m > 0)
    .sort((a, b) => b.m - a.m);

  const maxSub = Math.max(1, ...bySubject.map((x) => x.m));

  // Filtered log entries based on view tab
  const filteredLogs = useMemo(() => {
    let list = [...(data.logs || [])];
    if (viewTab === 'daily') {
      list = list.filter((l) => l.date === today);
    } else if (viewTab === 'weekly') {
      list = list.filter((l) => l.date >= wk && l.date <= addDays(wk, 6));
    } else if (viewTab === 'monthly') {
      list = list.filter((l) => l.date.slice(0, 7) === today.slice(0, 7));
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.logs, viewTab, today, wk]);

  const add = () => {
    const totalMinutes = Math.round(Number(f.hours) * 60 + Number(f.minutes));
    if (!totalMinutes || totalMinutes <= 0) return;

    const names = pending.filter((t) => f.picked.includes(t.id)).map((t) => t.name);
    const topics = [f.topics.trim(), ...names].filter(Boolean).join(', ');

    setData((d) => ({
      ...d,
      logs: [
        ...(d.logs || []),
        {
          id: uid(),
          date: f.date,
          subjectId: f.subjectId,
          minutes: totalMinutes,
          topics,
          notes: f.notes.trim(),
        },
      ],
      subjects: (d.subjects || []).map((s) =>
        s.id === f.subjectId
          ? {
              ...s,
              topics: (s.topics || []).map((t) => (f.picked.includes(t.id) ? { ...t, done: true } : t)),
            }
          : s
      ),
    }));

    setF({
      date: today,
      subjectId: '',
      hours: 1,
      minutes: 0,
      topics: '',
      notes: '',
      picked: [],
    });
  };

  const saveEdit = () => {
    if (!editLog) return;
    const totalMinutes = Math.round(Number(editLog.hours) * 60 + Number(editLog.minutes));
    if (totalMinutes <= 0) return;

    upsert('logs', {
      ...editLog,
      minutes: totalMinutes,
      topics: (editLog.topics || '').trim(),
      notes: (editLog.notes || '').trim(),
    });
    setEditLog(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove('logs', deleteTarget.id);
    setDeleteTarget(null);
  };

  const todayGoalPct = goalMin > 0 ? Math.round((todayMin / goalMin) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Daily Study Progress Tracker"
        subtitle="Record your actual study hours and topic completions. Completed sessions from the smart timetable are recorded automatically."
      />

      {/* Top Statistic Cards */}
      <div className="row g-3 mb-4">
        {/* Today's Stats */}
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-secondary small fw-semibold text-uppercase">Today's Study Time</span>
                <span className={`badge ${todayMin >= goalMin && goalMin > 0 ? 'text-bg-success' : 'text-bg-primary'}`}>
                  {todayGoalPct}% of Goal
                </span>
              </div>
              <div className="countdown text-primary">{fmtHours(todayMin)}</div>
              <div className="my-2">
                <ProgressBar
                  value={todayGoalPct}
                  variant={todayMin >= goalMin && goalMin > 0 ? 'success' : 'primary'}
                  height={10}
                />
              </div>
              <div className="small text-secondary d-flex justify-content-between">
                <span>Daily Target: <strong>{fmtHours(goalMin)}</strong></span>
                <span>{todayMin >= goalMin && goalMin > 0 ? 'Goal Reached!' : `${fmtHours(Math.max(0, goalMin - todayMin))} left`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* This Week Stats */}
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-secondary small fw-semibold text-uppercase">This Week Total</span>
                <span className="badge text-bg-info text-dark">7 Days</span>
              </div>
              <div className="countdown text-body">{fmtHours(weekMin)}</div>
              <div className="my-2">
                <ProgressBar value={goalMin > 0 ? (weekMin / (goalMin * 7)) * 100 : 0} variant="info" height={10} />
              </div>
              <div className="small text-secondary d-flex justify-content-between">
                <span>Target: <strong>{fmtHours(goalMin * 7)}</strong></span>
                <span>Avg: <strong>{(weekMin / 7 / 60).toFixed(1)}h/day</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* This Month Stats */}
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-secondary small fw-semibold text-uppercase">This Month Total</span>
                <span className="badge text-bg-secondary">Month to Date</span>
              </div>
              <div className="countdown text-body">{fmtHours(monthMin)}</div>
              <div className="small text-secondary mt-3">
                Daily 30-Day Rolling Average: <strong>{avgDailyHours} hours/day</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {/* Form: Record Study Time */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-transparent fw-bold border-bottom">
              <i className="bi bi-pencil-square text-primary me-2" />
              Record Actual Study Session
            </div>
            <div className="card-body">
              <div className="row g-3">
                <Field label="Date" className="col-12 col-sm-6">
                  <input
                    type="date"
                    className="form-control"
                    value={f.date}
                    max={today}
                    onChange={(e) => setF({ ...f, date: e.target.value })}
                  />
                </Field>

                <Field label="Subject" className="col-12 col-sm-6">
                  <select
                    className="form-select"
                    value={f.subjectId}
                    onChange={(e) => setF({ ...f, subjectId: e.target.value, picked: [] })}
                  >
                    <option value="">General Study / Other</option>
                    {data.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code ? `[${s.code}] ` : ''}{s.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Duration" className="col-12">
                  <div className="row g-2">
                    <div className="col-6">
                      <div className="input-group">
                        <input
                          type="number"
                          min="0"
                          max="24"
                          className="form-control"
                          value={f.hours}
                          onChange={(e) => setF({ ...f, hours: e.target.value })}
                        />
                        <span className="input-group-text">hours</span>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="input-group">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          step="5"
                          className="form-control"
                          value={f.minutes}
                          onChange={(e) => setF({ ...f, minutes: e.target.value })}
                        />
                        <span className="input-group-text">mins</span>
                      </div>
                    </div>
                  </div>
                </Field>

                {pending.length > 0 && (
                  <Field label="Mark Topics Completed in this Session:" className="col-12">
                    <div className="border rounded p-2 bg-body-tertiary" style={{ maxHeight: 130, overflowY: 'auto' }}>
                      {pending.map((t) => (
                        <div className="form-check py-1" key={t.id}>
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={'topic-' + t.id}
                            checked={f.picked.includes(t.id)}
                            onChange={(e) =>
                              setF({
                                ...f,
                                picked: e.target.checked
                                  ? [...f.picked, t.id]
                                  : f.picked.filter((x) => x !== t.id),
                              })
                            }
                          />
                          <label className="form-check-label small" htmlFor={'topic-' + t.id}>
                            {t.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </Field>
                )}

                <Field label="Topics Studied" className="col-12">
                  <input
                    className="form-control"
                    value={f.topics}
                    onChange={(e) => setF({ ...f, topics: e.target.value })}
                    placeholder="e.g. Graph BFS, Revision, Exercise Problems"
                  />
                </Field>

                <Field label="Notes & Takeaways (Optional)" className="col-12">
                  <textarea
                    className="form-control"
                    rows="2"
                    value={f.notes}
                    onChange={(e) => setF({ ...f, notes: e.target.value })}
                    placeholder="Key concepts grasped, doubts to ask professor, formulas to review..."
                  />
                </Field>

                <div className="col-12">
                  <button className="btn btn-primary w-100" onClick={add}>
                    <i className="bi bi-plus-lg me-1" /> Save Study Entry
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Subject Distribution + Study Log Entries */}
        <div className="col-12 col-lg-7">
          {/* Subject-wise Study Time Bars */}
          <div className="card mb-4 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold border-bottom">
              <i className="bi bi-pie-chart text-primary me-2" />
              Cumulative Study Time by Subject
            </div>
            <div className="card-body">
              {bySubject.length === 0 ? (
                <Empty icon="hourglass">No study time recorded yet.</Empty>
              ) : (
                bySubject.map(({ s, m, color }) => (
                  <div key={s.id} className="mb-2">
                    <div className="d-flex justify-content-between small mb-1">
                      <span className="fw-semibold d-flex align-items-center gap-1">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </span>
                      <span>
                        <strong>{fmtHours(m)}</strong> ({((m / maxSub) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <ProgressBar value={(m / maxSub) * 100} customColor={color} height={8} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Entries with Daily, Weekly, Monthly Filter */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent d-flex justify-content-between align-items-center border-bottom py-2">
              <div className="fw-bold">Study Log History</div>
              <div className="btn-group btn-group-sm" role="group">
                <button
                  className={`btn ${viewTab === 'daily' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setViewTab('daily')}
                >
                  Today
                </button>
                <button
                  className={`btn ${viewTab === 'weekly' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setViewTab('weekly')}
                >
                  This Week
                </button>
                <button
                  className={`btn ${viewTab === 'monthly' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setViewTab('monthly')}
                >
                  This Month
                </button>
              </div>
            </div>

            <div className="list-group list-group-flush" style={{ maxHeight: 380, overflowY: 'auto' }}>
              {filteredLogs.length === 0 ? (
                <div className="list-group-item">
                  <Empty icon="journal-text">No study entries found for this view range.</Empty>
                </div>
              ) : (
                filteredLogs.map((l) => {
                  const s = subjectMap[l.subjectId];
                  const color = s?.color || '#0f766e';
                  return (
                    <div
                      key={l.id}
                      className="list-group-item d-flex justify-content-between align-items-start gap-2 py-2"
                      style={{ borderLeft: `4px solid ${color}` }}
                    >
                      <div className="min-w-0">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <span className="fw-bold text-body">{s ? s.name : 'General Study'}</span>
                          {s?.code && <span className="badge text-bg-light border small">{s.code}</span>}
                          <span className="badge text-bg-primary">{fmtHours(l.minutes)}</span>
                          {l.sessionId && <span className="badge text-bg-light border small text-muted">From Timetable</span>}
                        </div>
                        <div className="small text-secondary mt-1">
                          <i className="bi bi-calendar3 me-1" />
                          {niceDate(l.date)}
                          {l.topics && <span className="text-body fw-normal"> · Topics: {l.topics}</span>}
                        </div>
                        {l.notes && <div className="small fst-italic text-secondary mt-1">{l.notes}</div>}
                      </div>

                      <div className="btn-group btn-group-sm flex-shrink-0">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() =>
                            setEditLog({
                              ...l,
                              hours: Math.floor(l.minutes / 60),
                              minutes: l.minutes % 60,
                            })
                          }
                          title="Edit Log"
                          aria-label="Edit Log"
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => setDeleteTarget(l)}
                          title="Delete Log"
                          aria-label="Delete Log"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Log Modal */}
      {editLog && (
        <Modal
          title="Edit Study Log Entry"
          onClose={() => setEditLog(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditLog(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveEdit}>
                Save Changes
              </button>
            </>
          }
        >
          <div className="row g-3">
            <Field label="Date" className="col-12 col-sm-6">
              <input
                type="date"
                className="form-control"
                value={editLog.date}
                max={today}
                onChange={(e) => setEditLog({ ...editLog, date: e.target.value })}
              />
            </Field>

            <Field label="Subject" className="col-12 col-sm-6">
              <select
                className="form-select"
                value={editLog.subjectId}
                onChange={(e) => setEditLog({ ...editLog, subjectId: e.target.value })}
              >
                <option value="">General Study / Other</option>
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `[${s.code}] ` : ''}{s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Duration" className="col-12">
              <div className="row g-2">
                <div className="col-6">
                  <div className="input-group">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      className="form-control"
                      value={editLog.hours}
                      onChange={(e) => setEditLog({ ...editLog, hours: e.target.value })}
                    />
                    <span className="input-group-text">hours</span>
                  </div>
                </div>
                <div className="col-6">
                  <div className="input-group">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="5"
                      className="form-control"
                      value={editLog.minutes}
                      onChange={(e) => setEditLog({ ...editLog, minutes: e.target.value })}
                    />
                    <span className="input-group-text">mins</span>
                  </div>
                </div>
              </div>
            </Field>

            <Field label="Topics Studied" className="col-12">
              <input
                className="form-control"
                value={editLog.topics || ''}
                onChange={(e) => setEditLog({ ...editLog, topics: e.target.value })}
              />
            </Field>

            <Field label="Notes" className="col-12">
              <textarea
                className="form-control"
                rows="2"
                value={editLog.notes || ''}
                onChange={(e) => setEditLog({ ...editLog, notes: e.target.value })}
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={!!deleteTarget}
        title="Delete Study Entry"
        message="Are you sure you want to delete this study log entry? This will adjust your cumulative study hours."
        confirmText="Delete Entry"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
