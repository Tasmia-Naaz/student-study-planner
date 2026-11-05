import { useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { Modal, ConfirmModal, PageHeader, ProgressBar, Empty, Field, DIFF_TONE, ColorSwatchSelector, SubjectColorBadge } from '../components/common';
import { uid } from '../utils/dates';
import { SUBJECT_COLORS, getSubjectColor } from '../utils/defaults';

const blank = (colorIndex = 0) => ({
  id: uid(),
  name: '',
  code: '',
  color: SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length].hex,
  description: '',
  notes: '',
  difficulty: 'Medium',
  category: 'college',
  examId: '',
  topics: [],
});

export default function Subjects() {
  const { data, upsert, setData } = useStore();
  const [form, setForm] = useState(null);
  const [detailSubject, setDetailSubject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openTopics, setOpenTopics] = useState({});
  const [topicText, setTopicText] = useState({});
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const filteredSubjects = useMemo(() => {
    return (data.subjects || []).filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.code && s.code.toLowerCase().includes(q));
      const matchCat = categoryFilter === 'all' || s.category === categoryFilter;
      const matchDiff = diffFilter === 'all' || s.difficulty === diffFilter;
      return matchSearch && matchCat && matchDiff;
    });
  }, [data.subjects, search, categoryFilter, diffFilter]);

  const save = () => {
    if (!form.name.trim()) return;
    upsert('subjects', {
      ...form,
      name: form.name.trim(),
      code: (form.code || '').trim().toUpperCase(),
      color: form.color || SUBJECT_COLORS[0].hex,
    });
    setForm(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const s = deleteTarget;
    setData((d) => ({
      ...d,
      subjects: (d.subjects || []).filter((x) => x.id !== s.id),
      sessions: (d.sessions || []).filter((x) => x.subjectId !== s.id),
      tasks: (d.tasks || []).map((t) => (t.subjectId === s.id ? { ...t, subjectId: '' } : t)),
      logs: (d.logs || []).map((l) => (l.subjectId === s.id ? { ...l, subjectId: '' } : l)),
    }));
    setDeleteTarget(null);
    if (detailSubject?.id === s.id) setDetailSubject(null);
  };

  const updateTopics = (s, fn) => {
    const updated = { ...s, topics: fn(s.topics || []) };
    upsert('subjects', updated);
    if (detailSubject?.id === s.id) setDetailSubject(updated);
  };

  const addTopic = (s) => {
    const name = (topicText[s.id] || '').trim();
    if (!name) return;
    updateTopics(s, (t) => [...t, { id: uid(), name, done: false }]);
    setTopicText({ ...topicText, [s.id]: '' });
  };

  return (
    <>
      <PageHeader
        title="My Subjects"
        subtitle="Manage regular college subjects, outside competitive exam preparation, difficulty levels, and topic tracking."
      >
        <button className="btn btn-primary" onClick={() => setForm(blank(data.subjects.length))}>
          <i className="bi bi-plus-lg me-1" /> Add Subject
        </button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="card mb-4 border-0 shadow-sm bg-body-tertiary">
        <div className="card-body py-3">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-5">
              <div className="input-group">
                <span className="input-group-text bg-transparent border-end-0">
                  <i className="bi bi-search text-secondary" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search subjects by name or code (e.g. CS201)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>
                    <i className="bi bi-x" />
                  </button>
                )}
              </div>
            </div>
            <div className="col-6 col-md-3">
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by Category"
              >
                <option value="all">All Categories</option>
                <option value="college">Regular College</option>
                <option value="exam">Outside Exam Prep</option>
                <option value="optional">Optional / Other</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <select
                className="form-select"
                value={diffFilter}
                onChange={(e) => setDiffFilter(e.target.value)}
                aria-label="Filter by Difficulty"
              >
                <option value="all">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div className="col-12 col-md-1 text-md-end text-secondary small">
              {filteredSubjects.length} of {data.subjects.length}
            </div>
          </div>
        </div>
      </div>

      {filteredSubjects.length === 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <Empty icon="journal-x">
              {data.subjects.length === 0
                ? 'No subjects added yet. Click "Add Subject" to create your first subject!'
                : 'No subjects matched your filter criteria.'}
            </Empty>
          </div>
        </div>
      )}

      {/* Subjects Grid */}
      <div className="row g-3">
        {filteredSubjects.map((s, idx) => {
          const color = getSubjectColor(s, idx);
          const topics = s.topics || [];
          const done = topics.filter((t) => t.done).length;
          const remaining = Math.max(0, topics.length - done);
          const pct = topics.length > 0 ? Math.round((done / topics.length) * 100) : 0;
          const exam = data.exams.find((e) => e.id === s.examId);
          const isOpen = !!openTopics[s.id];

          return (
            <div className="col-md-6 col-xl-4" key={s.id}>
              <div
                className="card h-100 border-0 shadow-sm transition-all"
                style={{
                  borderLeft: `5px solid ${color}`,
                  borderRadius: '10px',
                }}
              >
                <div className="card-body d-flex flex-column">
                  {/* Card Header Info */}
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                        {s.code && (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: color,
                              color: '#fff',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {s.code}
                          </span>
                        )}
                        <span className={`badge text-bg-${DIFF_TONE[s.difficulty] || 'secondary'}`}>
                          {s.difficulty}
                        </span>
                        <span className={`badge text-bg-${s.category === 'exam' ? 'primary' : 'secondary'}`}>
                          {s.category === 'exam' ? 'Outside Exam' : s.category === 'optional' ? 'Optional' : 'College'}
                        </span>
                      </div>
                      <h5 className="card-title fw-bold text-truncate mb-0" title={s.name}>
                        {s.name}
                      </h5>
                    </div>

                    <div className="btn-group btn-group-sm flex-shrink-0">
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => setDetailSubject(s)}
                        title="View Details"
                        aria-label="View Details"
                      >
                        <i className="bi bi-info-circle" />
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => setForm({ ...s })}
                        title="Edit Subject"
                        aria-label="Edit Subject"
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        className="btn btn-outline-danger"
                        onClick={() => setDeleteTarget(s)}
                        title="Delete Subject"
                        aria-label="Delete Subject"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>

                  {exam && (
                    <div className="small text-muted mb-2">
                      <i className="bi bi-mortarboard me-1 text-primary" />
                      Linked to: <strong>{exam.name}</strong>
                    </div>
                  )}

                  {s.description && (
                    <p className="small text-secondary mb-2 text-truncate-2" style={{ maxHeight: '2.6em', overflow: 'hidden' }}>
                      {s.description}
                    </p>
                  )}

                  {/* Topic Progress bar */}
                  <div className="mt-auto pt-2">
                    <div className="d-flex justify-content-between small text-secondary mb-1">
                      <span>Topic Progress ({pct}%)</span>
                      <span>
                        <strong className="text-body">{done}</strong> / {topics.length} done
                        {remaining > 0 && <span className="text-secondary ms-1">({remaining} left)</span>}
                      </span>
                    </div>
                    <ProgressBar value={pct} customColor={color} height={8} />

                    <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                      <button
                        className="btn btn-sm btn-link p-0 text-decoration-none fw-semibold"
                        onClick={() => setOpenTopics({ ...openTopics, [s.id]: !isOpen })}
                      >
                        <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'} me-1`} />
                        {isOpen ? 'Hide topics' : `Manage topics (${topics.length})`}
                      </button>
                      <span className="small text-secondary">
                        {s.difficulty === 'Hard' ? 'High scheduling weight' : s.difficulty === 'Easy' ? 'Low weight' : 'Normal weight'}
                      </span>
                    </div>

                    {/* Expandable Topic Checklist */}
                    {isOpen && (
                      <div className="mt-3 pt-2 border-top">
                        {topics.length === 0 ? (
                          <div className="small text-secondary fst-italic py-1">No topics added yet. Add one below!</div>
                        ) : (
                          <div className="topic-list" style={{ maxHeight: 200, overflowY: 'auto' }}>
                            {topics.map((t) => (
                              <div key={t.id} className="d-flex align-items-center gap-2 py-1 px-1 rounded hover-bg">
                                <input
                                  className="form-check-input mt-0"
                                  type="checkbox"
                                  checked={t.done}
                                  onChange={() =>
                                    updateTopics(s, (list) =>
                                      list.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x))
                                    )
                                  }
                                  aria-label={`Mark ${t.name} done`}
                                />
                                <span className={`flex-grow-1 small ${t.done ? 'text-decoration-line-through text-secondary' : 'text-body'}`}>
                                  {t.name}
                                </span>
                                <button
                                  className="btn btn-sm text-danger p-0 opacity-75"
                                  onClick={() => updateTopics(s, (list) => list.filter((x) => x.id !== t.id))}
                                  title="Delete topic"
                                  aria-label="Delete topic"
                                >
                                  <i className="bi bi-x-lg" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="input-group input-group-sm mt-2">
                          <input
                            className="form-control"
                            placeholder="Add new topic..."
                            value={topicText[s.id] || ''}
                            onChange={(e) => setTopicText({ ...topicText, [s.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addTopic(s);
                            }}
                          />
                          <button className="btn btn-primary" onClick={() => addTopic(s)}>
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Subject Modal */}
      {form && (
        <Modal
          title={data.subjects.some((s) => s.id === form.id) ? 'Edit Subject' : 'Add New Subject'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={!form.name.trim()}>
                Save Subject
              </button>
            </>
          }
        >
          <div className="row g-3">
            <Field label="Subject Name" className="col-12 col-md-8">
              <input
                className="form-control"
                autoFocus
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Data Structures & Algorithms"
              />
            </Field>

            <Field label="Subject Code" className="col-12 col-md-4">
              <input
                className="form-control"
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. CS201, GATE-CS"
              />
            </Field>

            <Field label="Category" className="col-6">
              <select className="form-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="college">Regular College Subject</option>
                <option value="exam">Outside Exam Preparation</option>
                <option value="optional">Other / Optional</option>
              </select>
            </Field>

            <Field label="Difficulty Level" className="col-6" help="Harder subjects receive higher allocation priority in the timetable.">
              <select className="form-select" value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
                <option value="Easy">Easy (Lower weight)</option>
                <option value="Medium">Medium (Standard weight)</option>
                <option value="Hard">Hard (Higher weight & priority)</option>
              </select>
            </Field>

            <Field label="Subject Color" className="col-12" help="Used to color timetable sessions and calendar chips.">
              <ColorSwatchSelector value={form.color} onChange={(hex) => set('color', hex)} />
            </Field>

            <Field label="Linked Examination (Optional)" className="col-12" help="Associates this subject with an upcoming exam for automated countdown boost.">
              <select className="form-select" value={form.examId} onChange={(e) => set('examId', e.target.value)}>
                <option value="">None</option>
                {data.exams.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.date}) [{x.type}]
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Description" className="col-12">
              <input
                className="form-control"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Syllabus overview or focus area"
              />
            </Field>

            <Field label="Study Notes & Tips" className="col-12">
              <textarea
                className="form-control"
                rows="2"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Important reference books, exam format, or key formulas"
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Subject Details Modal */}
      {detailSubject && (
        <Modal
          title={detailSubject.name}
          onClose={() => setDetailSubject(null)}
          footer={
            <>
              <button className="btn btn-outline-secondary me-auto" onClick={() => { setForm({ ...detailSubject }); setDetailSubject(null); }}>
                <i className="bi bi-pencil me-1" /> Edit
              </button>
              <button className="btn btn-secondary" onClick={() => setDetailSubject(null)}>
                Close
              </button>
            </>
          }
        >
          <div className="d-flex align-items-center gap-2 mb-3">
            <SubjectColorBadge color={detailSubject.color} name={detailSubject.name} code={detailSubject.code} />
            <span className={`badge text-bg-${DIFF_TONE[detailSubject.difficulty]}`}>{detailSubject.difficulty} Difficulty</span>
            <span className="badge text-bg-secondary text-capitalize">{detailSubject.category}</span>
          </div>

          {detailSubject.description && <p className="text-secondary">{detailSubject.description}</p>}

          <h6 className="fw-bold mt-3 mb-2">Topics ({(detailSubject.topics || []).filter((t) => t.done).length} / {(detailSubject.topics || []).length} Completed)</h6>
          <div className="list-group mb-3" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {(detailSubject.topics || []).length === 0 ? (
              <div className="list-group-item text-secondary small">No topics added.</div>
            ) : (
              detailSubject.topics.map((t) => (
                <div key={t.id} className="list-group-item d-flex align-items-center gap-2 py-2">
                  <input
                    className="form-check-input mt-0"
                    type="checkbox"
                    checked={t.done}
                    onChange={() =>
                      updateTopics(detailSubject, (list) =>
                        list.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x))
                      )
                    }
                  />
                  <span className={t.done ? 'text-decoration-line-through text-secondary' : ''}>{t.name}</span>
                </div>
              ))
            )}
          </div>

          {detailSubject.notes && (
            <div className="p-2 bg-body-tertiary rounded small border">
              <strong>Notes:</strong> {detailSubject.notes}
            </div>
          )}
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={!!deleteTarget}
        title="Delete Subject"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All associated timetable sessions will also be removed.`}
        confirmText="Delete Subject"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
