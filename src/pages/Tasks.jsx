import { useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { Modal, ConfirmModal, PageHeader, ProgressBar, Empty, Field, PRIORITY_TONE, SubjectColorBadge } from '../components/common';
import { daysBetween, shortDate, niceDate, todayStr, uid } from '../utils/dates';
import { getSubjectColor } from '../utils/defaults';

const ASSIGNMENT_TYPES = [
  'Written',
  'Laboratory',
  'Programming',
  'Seminar',
  'Presentation',
  'Other',
];

const blank = (kind = 'study', parentId = '') => ({
  id: uid(),
  title: '',
  kind, // 'study' | 'assignment' | 'project' | 'milestone'
  subjectId: '',
  parentId,
  priority: 'Medium',
  assignedDate: todayStr(),
  deadline: '',
  estimate: 2,
  status: 'Not Started', // 'Not Started' | 'In Progress' | 'Completed' | 'Submitted'
  assignmentType: 'Written',
  team: '',
  done: false,
  notes: '',
});

export default function Tasks() {
  const { data, upsert, setData } = useStore();
  const [kindFilter, setKindFilter] = useState('all'); // 'all' | 'study' | 'assignment' | 'project'
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'completed' | 'overdue' | 'all'
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const today = todayStr();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const projects = (data.tasks || []).filter((t) => t.kind === 'project');

  const subjectMap = useMemo(() => {
    const map = {};
    (data.subjects || []).forEach((s, idx) => {
      map[s.id] = { ...s, color: getSubjectColor(s, idx) };
    });
    return map;
  }, [data.subjects]);

  const isCompleted = (t) => t.done || t.status === 'Completed' || t.status === 'Submitted';
  const isOverdue = (t) => !isCompleted(t) && t.deadline && t.deadline < today;

  const rows = useMemo(() => {
    return (data.tasks || [])
      .filter((t) => {
        if (kindFilter === 'all') return true;
        if (kindFilter === 'project') return t.kind === 'project' || t.kind === 'milestone';
        return t.kind === kindFilter;
      })
      .filter((t) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'completed') return isCompleted(t);
        if (statusFilter === 'overdue') return isOverdue(t);
        return !isCompleted(t);
      })
      .filter((t) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const sub = subjectMap[t.subjectId];
        return (
          t.title.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          (sub && sub.name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // Overdue first, then by deadline
        const aOver = isOverdue(a);
        const bOver = isOverdue(b);
        if (aOver && !bOver) return -1;
        if (!aOver && bOver) return 1;
        return (a.deadline || '9999').localeCompare(b.deadline || '9999');
      });
  }, [data.tasks, kindFilter, statusFilter, search, today, subjectMap]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const t = deleteTarget;
    setData((d) => {
      const ids = new Set([
        t.id,
        ...(t.kind === 'project' ? (d.tasks || []).filter((x) => x.parentId === t.id).map((x) => x.id) : []),
      ]);
      return {
        ...d,
        tasks: (d.tasks || []).filter((x) => !ids.has(x.id)),
        sessions: (d.sessions || []).filter((s) => !ids.has(s.taskId)),
      };
    });
    setDeleteTarget(null);
  };

  const save = () => {
    if (!form.title.trim()) return;
    const isDone = form.status === 'Completed' || form.status === 'Submitted' || form.done;
    upsert('tasks', {
      ...form,
      title: form.title.trim(),
      estimate: Number(form.estimate) || 1,
      parentId: form.kind === 'milestone' ? form.parentId : '',
      done: isDone,
    });
    setForm(null);
  };

  const toggle = (t) => {
    const nextDone = !isCompleted(t);
    const nextStatus = nextDone
      ? t.kind === 'assignment'
        ? 'Submitted'
        : 'Completed'
      : 'In Progress';
    upsert('tasks', { ...t, done: nextDone, status: nextStatus });
  };

  const getDeadlineIndicator = (t) => {
    if (isCompleted(t)) {
      return { label: t.status || 'Completed', cls: 'text-bg-success' };
    }
    if (!t.deadline) return null;
    const left = daysBetween(today, t.deadline);
    if (left < 0) {
      return { label: `${-left}d Overdue`, cls: 'text-bg-danger' };
    }
    if (left === 0) {
      return { label: 'Due Today', cls: 'text-bg-warning text-dark' };
    }
    if (left <= 3) {
      return { label: `Due in ${left}d`, cls: 'text-bg-warning text-dark' };
    }
    if (left <= 7) {
      return { label: `Due in ${left}d`, cls: 'text-bg-warning text-dark' };
    }
    return { label: `Due: ${shortDate(t.deadline)}`, cls: 'text-bg-secondary' };
  };

  return (
    <>
      <PageHeader
        title="Unified Task & Project Management"
        subtitle="Manage daily study tasks, college assignments with deadline tracking, and multi-milestone academic projects."
      >
        <div className="btn-group">
          <button className="btn btn-primary dropdown-toggle" data-bs-toggle="dropdown" onClick={() => setForm(blank('study'))}>
            <i className="bi bi-plus-lg me-1" /> Add Task
          </button>
          <ul className="dropdown-menu dropdown-menu-end shadow">
            <li>
              <button className="dropdown-item" onClick={() => setForm(blank('study'))}>
                <i className="bi bi-check2-square text-primary me-2" /> Study Task
              </button>
            </li>
            <li>
              <button className="dropdown-item" onClick={() => setForm(blank('assignment'))}>
                <i className="bi bi-file-earmark-text text-warning me-2" /> College Assignment
              </button>
            </li>
            <li>
              <button className="dropdown-item" onClick={() => setForm(blank('project'))}>
                <i className="bi bi-kanban text-info me-2" /> Project
              </button>
            </li>
          </ul>
        </div>
      </PageHeader>

      {/* Filter and Search Controls */}
      <div className="card mb-4 border-0 shadow-sm bg-body-tertiary">
        <div className="card-body py-3">
          <div className="row g-2 align-items-center">
            {/* Kind filter pills */}
            <div className="col-12 col-md-4">
              <div className="btn-group w-100" role="group">
                {[
                  ['all', 'All'],
                  ['study', 'Study'],
                  ['assignment', 'Assignments'],
                  ['project', 'Projects'],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    className={`btn btn-sm ${kindFilter === k ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setKindFilter(k)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="col-6 col-md-4">
              <div className="btn-group w-100" role="group">
                {[
                  ['pending', 'Pending'],
                  ['completed', 'Completed'],
                  ['overdue', 'Overdue'],
                  ['all', 'All Status'],
                ].map(([s, l]) => (
                  <button
                    key={s}
                    className={`btn btn-sm text-capitalize ${statusFilter === s ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Box */}
            <div className="col-6 col-md-4">
              <div className="input-group">
                <span className="input-group-text bg-transparent border-end-0">
                  <i className="bi bi-search text-secondary" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <Empty icon="check2-all">
              {data.tasks.length === 0
                ? 'No tasks or projects found. Click "Add Task" to create one!'
                : 'No tasks match the active filters.'}
            </Empty>
          </div>
        </div>
      )}

      {/* Task List Cards */}
      <div className="card border-0 shadow-sm">
        <div className="list-group list-group-flush">
          {rows.map((t) => {
            const sub = subjectMap[t.subjectId];
            const parent = projects.find((p) => p.id === t.parentId);
            const ms = t.kind === 'project' ? (data.tasks || []).filter((m) => m.parentId === t.id) : [];
            const completedMs = ms.filter((m) => isCompleted(m)).length;
            const pct = ms.length ? Math.round((completedMs / ms.length) * 100) : isCompleted(t) ? 100 : 0;
            const indicator = getDeadlineIndicator(t);
            const done = isCompleted(t);

            return (
              <div
                key={t.id}
                className={`list-group-item p-3 transition-all ${done ? 'bg-body-tertiary opacity-75' : ''}`}
                style={{
                  borderLeft: sub?.color ? `5px solid ${sub.color}` : '5px solid var(--bs-border-color)',
                }}
              >
                <div className="d-flex gap-3 align-items-start">
                  {/* Completion Checkbox */}
                  <input
                    className="form-check-input mt-1 flex-shrink-0"
                    type="checkbox"
                    checked={done}
                    onChange={() => toggle(t)}
                    style={{ width: 20, height: 20, cursor: 'pointer' }}
                    aria-label={`Mark ${t.title} done`}
                  />

                  {/* Task Content */}
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                      <span className={`badge text-bg-${t.kind === 'assignment' ? 'warning' : t.kind === 'project' ? 'info' : 'primary'} text-capitalize`}>
                        {t.kind === 'assignment' && t.assignmentType ? `${t.assignmentType} Assignment` : t.kind}
                      </span>
                      <span className={`badge text-bg-${PRIORITY_TONE[t.priority] || 'secondary'}`}>
                        {t.priority} Priority
                      </span>
                      {sub && (
                        <SubjectColorBadge color={sub.color} name={sub.name} code={sub.code} />
                      )}
                      {parent && (
                        <span className="badge text-bg-light border text-truncate" style={{ maxWidth: 200 }}>
                          <i className="bi bi-arrow-return-right me-1" />
                          Project: {parent.title}
                        </span>
                      )}
                      {indicator && <span className={`badge ${indicator.cls}`}>{indicator.label}</span>}
                    </div>

                    <h6 className={`fw-bold mb-1 ${done ? 'text-decoration-line-through text-secondary' : 'text-body'}`}>
                      {t.title}
                    </h6>

                    {/* Metadata line */}
                    <div className="small text-secondary d-flex flex-wrap gap-3 align-items-center mt-1">
                      {t.deadline && (
                        <span>
                          <i className="bi bi-calendar-event me-1 text-primary" />
                          Deadline: <strong>{niceDate(t.deadline)}</strong>
                        </span>
                      )}
                      {t.estimate && (
                        <span>
                          <i className="bi bi-clock me-1" />
                          Est: <strong>{t.estimate}h</strong>
                        </span>
                      )}
                      {t.team && (
                        <span>
                          <i className="bi bi-people me-1" />
                          Team: {t.team}
                        </span>
                      )}
                      {t.status && (
                        <span>
                          Status: <strong>{t.status}</strong>
                        </span>
                      )}
                    </div>

                    {/* Project Milestones Progress */}
                    {t.kind === 'project' && (
                      <div className="mt-2 pt-2 border-top" style={{ maxWidth: 450 }}>
                        <div className="d-flex justify-content-between small text-secondary mb-1">
                          <span>
                            Milestones: <strong>{completedMs}</strong> / {ms.length} completed
                          </span>
                          <span><strong>{pct}%</strong></span>
                        </div>
                        <ProgressBar value={pct} variant={pct === 100 ? 'success' : 'primary'} height={8} />

                        {/* List milestones */}
                        {ms.length > 0 && (
                          <div className="mt-2 ps-2 border-start">
                            {ms.map((m) => (
                              <div key={m.id} className="small d-flex align-items-center gap-2 py-1">
                                <input
                                  className="form-check-input mt-0"
                                  type="checkbox"
                                  checked={isCompleted(m)}
                                  onChange={() => toggle(m)}
                                  style={{ width: 14, height: 14 }}
                                />
                                <span className={isCompleted(m) ? 'text-decoration-line-through text-secondary' : ''}>
                                  {m.title}
                                </span>
                                {m.deadline && <span className="text-secondary opacity-75">({shortDate(m.deadline)})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {t.notes && <div className="small text-secondary fst-italic mt-1">{t.notes}</div>}
                  </div>

                  {/* Action Buttons */}
                  <div className="btn-group btn-group-sm flex-shrink-0">
                    {t.kind === 'project' && (
                      <button
                        className="btn btn-outline-primary"
                        title="Add milestone to project"
                        onClick={() => setForm(blank('milestone', t.id))}
                      >
                        <i className="bi bi-flag me-1" /> Add Milestone
                      </button>
                    )}
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => setForm({ ...t })}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <i className="bi bi-pencil" />
                    </button>
                    <button
                      className="btn btn-outline-danger"
                      onClick={() => setDeleteTarget(t)}
                      title="Delete"
                      aria-label="Delete"
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Task Modal */}
      {form && (
        <Modal
          title={data.tasks.some((x) => x.id === form.id) ? 'Edit Item' : `Add ${form.kind === 'milestone' ? 'Milestone' : form.kind === 'project' ? 'Project' : form.kind === 'assignment' ? 'Assignment' : 'Study Task'}`}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={!form.title.trim()}>
                Save Item
              </button>
            </>
          }
        >
          <div className="row g-3">
            <Field label="Title / Name" className="col-12">
              <input
                className="form-control"
                autoFocus
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Graph BFS problems, DBMS Schema Assignment"
              />
            </Field>

            <Field label="Task Type" className="col-6">
              <select
                className="form-select"
                value={form.kind}
                onChange={(e) => set('kind', e.target.value)}
              >
                <option value="study">Study Task</option>
                <option value="assignment">Assignment</option>
                <option value="project">Project</option>
                <option value="milestone">Project Milestone</option>
              </select>
            </Field>

            <Field label="Priority" className="col-6">
              <select
                className="form-select"
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High (Prioritised in timetable)</option>
              </select>
            </Field>

            {form.kind === 'assignment' && (
              <Field label="Assignment Type" className="col-6">
                <select
                  className="form-select"
                  value={form.assignmentType || 'Written'}
                  onChange={(e) => set('assignmentType', e.target.value)}
                >
                  {ASSIGNMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {form.kind === 'milestone' && (
              <Field label="Parent Project" className="col-12">
                <select
                  className="form-select"
                  value={form.parentId}
                  onChange={(e) => set('parentId', e.target.value)}
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Associated Subject (Optional)" className="col-6">
              <select
                className="form-select"
                value={form.subjectId}
                onChange={(e) => set('subjectId', e.target.value)}
              >
                <option value="">None / General</option>
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `[${s.code}] ` : ''}{s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status" className="col-6">
              <select
                className="form-select"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                {form.kind === 'assignment' && <option value="Submitted">Submitted</option>}
              </select>
            </Field>

            <Field label="Due Date / Deadline" className="col-6" help="Used in smart timetable scheduling and countdowns.">
              <input
                type="date"
                className="form-control"
                value={form.deadline}
                onChange={(e) => set('deadline', e.target.value)}
              />
            </Field>

            <Field label="Estimated Effort (Hours)" className="col-6">
              <input
                type="number"
                min="0.5"
                step="0.5"
                className="form-control"
                value={form.estimate}
                onChange={(e) => set('estimate', e.target.value)}
              />
            </Field>

            {form.kind === 'project' && (
              <Field label="Team Members (Optional)" className="col-12">
                <input
                  className="form-control"
                  value={form.team || ''}
                  onChange={(e) => set('team', e.target.value)}
                  placeholder="Names of team members"
                />
              </Field>
            )}

            <Field label="Notes / Description" className="col-12">
              <textarea
                className="form-control"
                rows="2"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Submission guidelines, repository link, rubric details..."
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={!!deleteTarget}
        title="Delete Item"
        message={`Are you sure you want to delete "${deleteTarget?.title}"?${
          deleteTarget?.kind === 'project' ? ' All nested milestones will also be removed.' : ''
        }`}
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
