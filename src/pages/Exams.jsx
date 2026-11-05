import { useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { Modal, ConfirmModal, PageHeader, Empty, Field, SubjectColorBadge } from '../components/common';
import { daysBetween, fmtTime, niceDate, shortDate, todayStr, uid } from '../utils/dates';
import { getSubjectColor } from '../utils/defaults';

const EXAM_TYPES = [
  'Semester',
  'Internal',
  'Practical',
  'Viva',
  'Competitive',
  'Entrance',
  'Placement',
  'Other',
];

const blank = () => ({
  id: uid(),
  name: '',
  category: '',
  type: 'Semester',
  date: todayStr(),
  time: '09:30',
  targetHours: 20,
  notes: '',
});

export default function Exams() {
  const { data, upsert, setData } = useStore();
  const [tab, setTab] = useState('upcoming'); // 'upcoming' | 'past' | 'all'
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const today = todayStr();
  const timeFormat = data.settings?.timeFormat || '12h';

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const subjectMap = useMemo(() => {
    const map = {};
    (data.subjects || []).forEach((s, idx) => {
      map[s.id] = { ...s, color: getSubjectColor(s, idx) };
    });
    return map;
  }, [data.subjects]);

  const filteredExams = useMemo(() => {
    return (data.exams || [])
      .filter((e) => {
        if (tab === 'upcoming') return e.date >= today;
        if (tab === 'past') return e.date < today;
        return true;
      })
      .filter((e) => {
        if (typeFilter !== 'all' && e.type !== typeFilter) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          (e.category && e.category.toLowerCase().includes(q)) ||
          e.type.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (tab === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [data.exams, tab, typeFilter, search, today]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const e = deleteTarget;
    setData((d) => ({
      ...d,
      exams: (d.exams || []).filter((x) => x.id !== e.id),
      subjects: (d.subjects || []).map((s) => (s.examId === e.id ? { ...s, examId: '' } : s)),
    }));
    setDeleteTarget(null);
  };

  const save = () => {
    if (!form.name.trim() || !form.date) return;
    upsert('exams', {
      ...form,
      name: form.name.trim(),
      targetHours: Number(form.targetHours) || 10,
    });
    setForm(null);
  };

  const getUrgencyBadge = (left) => {
    if (left < 0) return { label: 'Past Examination', cls: 'text-bg-secondary' };
    if (left === 0) return { label: 'EXAMINATION TODAY', cls: 'text-bg-danger' };
    if (left === 1) return { label: 'Tomorrow', cls: 'text-bg-danger' };
    if (left <= 7) return { label: `${left} Days Left (Urgent)`, cls: 'text-bg-warning text-dark' };
    if (left <= 30) return { label: `${left} Days Left`, cls: 'text-bg-primary' };
    return { label: `${left} Days Remaining`, cls: 'text-bg-info text-dark' };
  };

  return (
    <>
      <PageHeader
        title="Exam Countdown & Management"
        subtitle="Internal, semester, practical, viva and competitive examinations (GATE, TGPSC, UPSC, placements and entrance tests)."
      >
        <button className="btn btn-primary" onClick={() => setForm(blank())}>
          <i className="bi bi-plus-lg me-1" /> Add Examination
        </button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="card mb-4 border-0 shadow-sm bg-body-tertiary">
        <div className="card-body py-3">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-4">
              <ul className="nav nav-pills">
                <li className="nav-item">
                  <button
                    className={`nav-link py-1 px-3 ${tab === 'upcoming' ? 'active' : ''}`}
                    onClick={() => setTab('upcoming')}
                  >
                    Upcoming ({data.exams.filter((e) => e.date >= today).length})
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link py-1 px-3 ${tab === 'past' ? 'active' : ''}`}
                    onClick={() => setTab('past')}
                  >
                    Past ({data.exams.filter((e) => e.date < today).length})
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link py-1 px-3 ${tab === 'all' ? 'active' : ''}`}
                    onClick={() => setTab('all')}
                  >
                    All
                  </button>
                </li>
              </ul>
            </div>

            <div className="col-6 col-md-4">
              <div className="input-group">
                <span className="input-group-text bg-transparent border-end-0">
                  <i className="bi bi-search text-secondary" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search examinations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="col-6 col-md-4">
              <select
                className="form-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter by Exam Type"
              >
                <option value="all">All Examination Types</option>
                {EXAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t} Exams
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {filteredExams.length === 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <Empty icon="mortarboard">
              {data.exams.length === 0
                ? 'No examinations recorded yet. Click "Add Examination" to create your first exam countdown!'
                : 'No examinations match your filter.'}
            </Empty>
          </div>
        </div>
      )}

      {/* Exam Cards Grid */}
      <div className="row g-3">
        {filteredExams.map((e) => {
          const left = daysBetween(today, e.date);
          const badge = getUrgencyBadge(left);
          const linked = (data.subjects || []).filter((s) => s.examId === e.id);
          const isUrgent = left >= 0 && left <= 7;

          return (
            <div className="col-md-6 col-xl-4" key={e.id}>
              <div
                className={`card h-100 border-0 shadow-sm transition-all ${
                  left === 0 ? 'border-danger border-2' : isUrgent ? 'border-warning border-2' : ''
                }`}
                style={{
                  borderRadius: '10px',
                  borderTop: isUrgent ? '4px solid #dc2626' : '3px solid var(--bs-primary)',
                }}
              >
                <div className="card-body d-flex flex-column">
                  {/* Header info */}
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="d-flex align-items-center gap-1 flex-wrap mb-1">
                        <span className="badge text-bg-secondary">{e.type}</span>
                        {e.category && <span className="badge text-bg-light border">{e.category}</span>}
                      </div>
                      <h5 className="card-title fw-bold text-truncate mb-0" title={e.name}>
                        {e.name}
                      </h5>
                    </div>

                    <div className="btn-group btn-group-sm flex-shrink-0">
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => setForm({ ...e })}
                        title="Edit Examination"
                        aria-label="Edit Examination"
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        className="btn btn-outline-danger"
                        onClick={() => setDeleteTarget(e)}
                        title="Delete Examination"
                        aria-label="Delete Examination"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>

                  {/* Countdown Big Display */}
                  <div className="my-3 p-3 bg-body-tertiary rounded text-center">
                    {left >= 0 ? (
                      <>
                        <div className={`countdown ${left <= 3 ? 'text-danger' : left <= 7 ? 'text-warning' : 'text-primary'}`}>
                          {left}
                        </div>
                        <div className="small fw-semibold text-secondary text-uppercase tracking-wider">
                          {left === 0 ? 'Examination is Today!' : left === 1 ? 'Day Remaining' : 'Days Remaining'}
                        </div>
                        <div className="mt-2">
                          <span className={`badge ${badge.cls} px-2 py-1`}>{badge.label}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="fs-3 fw-bold text-secondary">Completed</div>
                        <div className="small text-secondary">
                          Conducted {-left} day{-left === 1 ? '' : 's'} ago
                        </div>
                      </>
                    )}
                  </div>

                  {/* Date & Time Information */}
                  <div className="small mb-2 text-secondary d-flex align-items-center gap-2">
                    <i className="bi bi-calendar-event text-primary" />
                    <span className="fw-semibold text-body">{niceDate(e.date)}</span>
                    {e.time && <span>at {fmtTime(e.time, timeFormat)}</span>}
                  </div>

                  {/* Linked Subjects */}
                  <div className="mt-auto pt-2 border-top">
                    <div className="small text-secondary mb-1">
                      <i className="bi bi-journal-bookmark me-1" />
                      Linked Preparation Subjects ({linked.length}):
                    </div>
                    {linked.length === 0 ? (
                      <div className="small text-muted fst-italic">None linked yet. Link in My Subjects.</div>
                    ) : (
                      <div className="d-flex flex-wrap gap-1">
                        {linked.map((s) => (
                          <SubjectColorBadge
                            key={s.id}
                            color={subjectMap[s.id]?.color}
                            name={s.name}
                            code={s.code}
                          />
                        ))}
                      </div>
                    )}

                    {e.notes && (
                      <div className="small text-secondary fst-italic mt-2 p-1 bg-body-tertiary rounded">
                        {e.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Exam Modal */}
      {form && (
        <Modal
          title={data.exams.some((x) => x.id === form.id) ? 'Edit Examination' : 'Add Examination'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={!form.name.trim() || !form.date}
              >
                Save Examination
              </button>
            </>
          }
        >
          <div className="row g-3">
            <Field label="Examination Name" className="col-12 col-md-8">
              <input
                className="form-control"
                autoFocus
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. GATE CSE 2027, Semester 5 Finals"
              />
            </Field>

            <Field label="Examination Type" className="col-12 col-md-4">
              <select className="form-select" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {EXAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Category / Department" className="col-12 col-md-6">
              <input
                className="form-control"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                placeholder="e.g. Computer Science, Public Service"
              />
            </Field>

            <Field label="Target Study Hours" className="col-12 col-md-6">
              <input
                type="number"
                min="1"
                className="form-control"
                value={form.targetHours}
                onChange={(e) => set('targetHours', e.target.value)}
              />
            </Field>

            <Field label="Examination Date" className="col-6">
              <input
                type="date"
                className="form-control"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </Field>

            <Field label="Examination Time" className="col-6">
              <input
                type="time"
                className="form-control"
                value={form.time}
                onChange={(e) => set('time', e.target.value)}
              />
            </Field>

            <Field label="Notes & Syllabus Instructions" className="col-12">
              <textarea
                className="form-control"
                rows="2"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Hall ticket details, exam center, negative marking rules..."
              />
            </Field>
          </div>
          <div className="form-text mt-3">
            Tip: Link subjects to this examination from the <strong>My Subjects</strong> page so that the timetable generator gives them priority as the exam date approaches.
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={!!deleteTarget}
        title="Delete Examination"
        message={`Are you sure you want to delete the examination "${deleteTarget?.name}"? Linked subjects will be preserved.`}
        confirmText="Delete Examination"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
