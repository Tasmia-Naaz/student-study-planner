import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';

const EMPTY_FORM = {
  subject_name: '',
  subject_code: '',
  semester: '',
  exam_date: '',
  priority: 'Medium',
  notes: '',
  progress: 0,
  status: 'Not Started',
};
const STATUSES = ['Not Started', 'Preparing', 'Ready for Exam', 'Cleared'];

export default function Backlogs() {
  const [backlogs, setBacklogs] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setBacklogs(await apiRequest('/students/me/backlogs'));
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const active = useMemo(() => backlogs.filter((item) => item.status !== 'Cleared'), [backlogs]);
  const cleared = backlogs.length - active.length;
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const path = editing ? `/students/me/backlogs/${editing}` : '/students/me/backlogs';
      await apiRequest(path, { method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...form, progress: Number(form.progress) }) });
      setForm(EMPTY_FORM);
      setEditing(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (item) => {
    setEditing(item.id);
    setForm({
      subject_name: item.subject_name,
      subject_code: item.subject_code,
      semester: item.semester,
      exam_date: item.exam_date || '',
      priority: item.priority,
      notes: item.notes,
      progress: item.progress,
      status: item.status,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setStatus = async (item, status) => {
    try {
      await apiRequest(`/students/me/backlogs/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...item, status }),
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <>
      <header className="page-header mb-4">
        <div><h1 className="page-title">My Backlogs</h1><p className="text-secondary mb-0">Plan and track your backlog exam preparation.</p></div>
      </header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row g-3 mb-4">
        {[['Total backlogs', backlogs.length, 'journal-bookmark', 'pastel-blue'], ['Active backlogs', active.length, 'hourglass-split', 'pastel-peach'], ['Cleared backlogs', cleared, 'check-circle', 'pastel-mint']].map(([label, count, icon, tone]) => (
          <div className="col-12 col-sm-4" key={label}><div className={`card stat-card h-100 ${tone}`}><div className="card-body d-flex align-items-center gap-3"><span className="stat-icon"><i className={`bi bi-${icon}`} /></span><div><div className="text-secondary small">{label}</div><div className="stat-value">{count}</div></div></div></div></div>
        ))}
      </div>
      <section className="card mb-4">
        <div className="card-header bg-transparent">{editing ? 'Update backlog' : 'Add a backlog subject'}</div>
        <form onSubmit={save}>
          <div className="card-body row g-3">
            <div className="col-12 col-md-6"><label className="form-label" htmlFor="backlog-name">Subject name</label><input id="backlog-name" className="form-control" required maxLength={160} value={form.subject_name} onChange={(event) => updateForm('subject_name', event.target.value)} /></div>
            <div className="col-12 col-md-3"><label className="form-label" htmlFor="backlog-code">Subject code</label><input id="backlog-code" className="form-control" maxLength={40} value={form.subject_code} onChange={(event) => updateForm('subject_code', event.target.value)} /></div>
            <div className="col-12 col-md-3"><label className="form-label" htmlFor="backlog-semester">Semester</label><input id="backlog-semester" className="form-control" required maxLength={20} value={form.semester} onChange={(event) => updateForm('semester', event.target.value)} /></div>
            <div className="col-12 col-sm-6 col-lg-3"><label className="form-label" htmlFor="backlog-date">Backlog exam date</label><input id="backlog-date" type="date" className="form-control" value={form.exam_date} onChange={(event) => updateForm('exam_date', event.target.value)} /></div>
            <div className="col-12 col-sm-6 col-lg-3"><label className="form-label" htmlFor="backlog-priority">Priority</label><select id="backlog-priority" className="form-select" value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}>{['Low', 'Medium', 'High'].map((value) => <option key={value}>{value}</option>)}</select></div>
            <div className="col-12 col-sm-6 col-lg-3"><label className="form-label" htmlFor="backlog-status">Preparation status</label><select id="backlog-status" className="form-select" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></div>
            <div className="col-12 col-sm-6 col-lg-3"><label className="form-label" htmlFor="backlog-progress">Preparation progress: {form.progress}%</label><input id="backlog-progress" type="range" min="0" max="100" className="form-range mt-2" value={form.progress} onChange={(event) => updateForm('progress', Number(event.target.value))} /></div>
            <div className="col-12"><label className="form-label" htmlFor="backlog-notes">Preparation notes</label><textarea id="backlog-notes" className="form-control" rows="2" maxLength={5000} value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} /></div>
          </div>
          <div className="card-footer bg-transparent d-flex gap-2"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add backlog'}</button>{editing && <button className="btn btn-outline-secondary" type="button" onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}>Cancel</button>}</div>
        </form>
      </section>
      <section className="card">
        <div className="card-header bg-transparent d-flex justify-content-between"><span>Subject preparation</span><span className="text-secondary small">{active.filter((item) => item.exam_date && item.exam_date >= new Date().toISOString().slice(0, 10)).length} upcoming exams</span></div>
        {loading ? <div className="card-body text-secondary">Loading backlogs…</div> : backlogs.length === 0 ? <div className="card-body text-secondary">You have not added any backlog subjects.</div> : (
          <div className="list-group list-group-flush">
            {backlogs.map((item) => (
              <article className="list-group-item p-3" key={item.id}>
                <div className="d-flex flex-wrap gap-3 align-items-start">
                  <div className="flex-grow-1"><div className="d-flex flex-wrap gap-2 align-items-center"><h2 className="h6 mb-0">{item.subject_name}</h2>{item.subject_code && <span className="badge text-bg-light">{item.subject_code}</span>}<span className={`badge ${item.status === 'Cleared' ? 'text-bg-success' : item.status === 'Ready for Exam' ? 'text-bg-primary' : 'text-bg-secondary'}`}>{item.status}</span><span className="badge pastel-peach">{item.priority} priority</span></div><div className="small text-secondary mt-1">Semester {item.semester}{item.exam_date ? ` · Exam ${item.exam_date}` : ''}</div>{item.notes && <p className="small mt-2 mb-0">{item.notes}</p>}<div className="progress mt-3" role="progressbar" aria-label={`${item.subject_name} preparation`} aria-valuenow={item.progress} aria-valuemin="0" aria-valuemax="100"><div className="progress-bar" style={{ width: `${item.progress}%` }} /></div><div className="small text-secondary mt-1">{item.progress}% prepared</div></div>
                  <div className="d-flex flex-wrap gap-2"><select className="form-select form-select-sm" aria-label={`Update status for ${item.subject_name}`} value={item.status} onChange={(event) => setStatus(item, event.target.value)}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select><button className="btn btn-sm btn-outline-primary" type="button" onClick={() => edit(item)}>Edit</button></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
