import { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { departmentLabel } from '../utils/departments';
import { PageHeader } from '../components/common';

export default function MentorDashboard({ openStudent }) {
  const { user } = useContext(AuthContext);
  const [mentees, setMentees] = useState([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await apiRequest('/mentor/students');
        if (active) setMentees(result);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const departments = useMemo(() => [...new Set(mentees.map((student) => student.department).filter(Boolean))].sort(), [mentees]);
  const filtered = mentees.filter((student) => {
    const query = `${student.full_name} ${student.student_id || ''} ${student.department || ''}`.toLowerCase();
    return query.includes(search.toLowerCase()) && (!department || student.department === department);
  });

  return (
    <>
      <PageHeader title="My Mentees" subtitle={`Welcome, ${user?.full_name}. ${mentees.length} currently assigned mentee${mentees.length === 1 ? '' : 's'}.`} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="card mb-4"><div className="card-body row g-3 align-items-end"><div className="col-12 col-md-7"><label className="form-label" htmlFor="mentee-search">Search mentees</label><input id="mentee-search" className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, student ID, or department" /></div><div className="col-12 col-md-5"><label className="form-label" htmlFor="mentee-department">Department</label><select id="mentee-department" className="form-select" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">All departments</option>{departments.map((value) => <option key={value} value={value}>{departmentLabel(value)}</option>)}</select></div></div></div>
      {loading ? <p className="text-secondary">Loading assigned mentees…</p> : filtered.length === 0 ? <div className="card"><div className="card-body text-secondary">{mentees.length ? 'No mentees match the selected filters.' : 'No students have been assigned to you yet.'}</div></div> : (
        <div className="row g-3">
          {filtered.map((student) => (
            <div className="col-12 col-xl-6" key={student.id}>
              <article className="card mentee-card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between gap-3 mb-3"><div><h2 className="h5 mb-1">{student.full_name}</h2><div className="small text-secondary">{student.student_id} · {departmentLabel(student.department)}</div></div><span className="mentee-avatar" aria-hidden="true">{student.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span></div>
                  <div className="small text-secondary mb-3">Academic year {student.academic_year || '—'} · Semester {student.semester || '—'} · {student.total_subjects} subjects</div>
                  <div className="row g-2 mentee-metrics">
                    <div className="col-6"><span>Active backlogs</span><strong>{student.active_backlogs}</strong></div><div className="col-6"><span>Cleared backlogs</span><strong>{student.cleared_backlogs}</strong></div>
                    <div className="col-6"><span>Daily study time</span><strong>{Math.floor(student.daily_study_minutes / 60)}h {student.daily_study_minutes % 60}m</strong></div><div className="col-6"><span>Weekly study time</span><strong>{Math.floor(student.weekly_study_minutes / 60)}h {student.weekly_study_minutes % 60}m</strong></div>
                    <div className="col-6"><span>Assignments complete</span><strong>{student.completed_assignments}</strong></div><div className="col-6"><span>Upcoming exams</span><strong>{student.upcoming_exams.length}</strong></div>
                  </div>
                </div>
                <div className="card-footer bg-transparent d-flex align-items-center justify-content-between"><span className="small text-secondary">{student.pending_assignments} pending assignment{student.pending_assignments === 1 ? '' : 's'}</span><button className="btn btn-sm btn-primary" type="button" onClick={() => openStudent(student.id)}>View academic progress <i className="bi bi-arrow-right ms-1" /></button></div>
              </article>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
