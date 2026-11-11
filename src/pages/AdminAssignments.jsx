import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';

export default function AdminAssignments() {
  const [students, setStudents] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState([]);
  const [mentorId, setMentorId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [mentorSearch, setMentorSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const result = await apiRequest('/admin/assignments');
      setStudents(result.students);
      setMentors(result.mentors);
      setAssignments(result.assignments);
      setHistory(result.history);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const assignmentByStudent = useMemo(() => new Map(assignments.map((item) => [item.student_id, item])), [assignments]);
  const academicYears = useMemo(() => [...new Set(students.map((student) => student.academic_year).filter(Boolean))].sort(), [students]);
  const semesters = useMemo(() => [...new Set(students.map((student) => student.semester).filter(Boolean))].sort(), [students]);
  const departments = useMemo(() => [...new Set(students.map((student) => student.department).filter(Boolean))].sort(), [students]);
  const filteredStudents = students.filter((student) => {
    const text = `${student.full_name} ${student.student_id} ${student.department} ${student.academic_year} ${student.semester}`.toLowerCase();
    const matchesText = text.includes(studentSearch.toLowerCase());
    const assigned = student.assignment_locked;
    const matchesAssignment = assignmentFilter === 'all' || (assignmentFilter === 'unassigned' ? !assigned : assigned);
    return matchesText
      && matchesAssignment
      && (!yearFilter || student.academic_year === yearFilter)
      && (!semesterFilter || student.semester === semesterFilter)
      && (!departmentFilter || student.department === departmentFilter);
  });
  const filteredMentors = mentors.filter((mentor) => `${mentor.full_name} ${mentor.employee_id} ${mentor.department}`.toLowerCase().includes(mentorSearch.toLowerCase()));

  const toggleStudent = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const assign = async (event) => {
    event.preventDefault();
    if (!mentorId || !selected.length) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest('/admin/assignments', { method: 'POST', body: JSON.stringify({ mentor_id: Number(mentorId), student_ids: selected }) });
      setSelected([]);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <header className="page-header mb-4"><div><h1 className="page-title">Mentor–Student Assignment</h1><p className="text-secondary mb-0">Students with an inactive past assignment can be assigned again. Active assignments cannot be removed or reassigned.</p></div></header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form className="card mb-4" onSubmit={assign}>
        <div className="card-header bg-transparent">Assign students</div>
        <div className="card-body row g-3">
          <div className="col-12 col-md-6"><label className="form-label" htmlFor="assignment-mentor-search">Find mentor</label><input id="assignment-mentor-search" className="form-control mb-2" placeholder="Search name, employee ID, department" value={mentorSearch} onChange={(event) => setMentorSearch(event.target.value)} /><label className="visually-hidden" htmlFor="assignment-mentor">Select a mentor</label><select id="assignment-mentor" className="form-select" required value={mentorId} onChange={(event) => setMentorId(event.target.value)}><option value="">Select a mentor</option>{filteredMentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.full_name} · {mentor.department || 'No department'}</option>)}</select>{mentors.length === 0 && <div className="form-text">No active mentors are available to assign.</div>}</div>
          <div className="col-12 col-md-6 d-flex flex-column justify-content-end"><div className="small text-secondary mb-2">{selected.length} student{selected.length === 1 ? '' : 's'} selected</div><button className="btn btn-primary align-self-start" disabled={saving || !mentorId || !selected.length}>{saving ? 'Saving assignments…' : 'Assign selected students'}</button></div>
          <div className="col-12">
            <div className="row g-2 align-items-end mb-3">
              <div className="col-12 col-md-6 col-xl-3"><label htmlFor="assignment-student-search" className="form-label">Find students</label><input id="assignment-student-search" className="form-control" placeholder="Name, student ID, department" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} /></div>
              <div className="col-12 col-sm-6 col-xl-2"><label htmlFor="assignment-status-filter" className="form-label">Assignment status</label><select id="assignment-status-filter" className="form-select" value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)}><option value="all">All students</option><option value="assigned">Assigned</option><option value="unassigned">Available</option></select></div>
              <div className="col-12 col-sm-6 col-xl-2"><label htmlFor="assignment-year-filter" className="form-label">Academic year</label><select id="assignment-year-filter" className="form-select" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="">All years</option>{academicYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
              <div className="col-12 col-sm-6 col-xl-2"><label htmlFor="assignment-semester-filter" className="form-label">Semester</label><select id="assignment-semester-filter" className="form-select" value={semesterFilter} onChange={(event) => setSemesterFilter(event.target.value)}><option value="">All semesters</option>{semesters.map((semester) => <option key={semester} value={semester}>{semester}</option>)}</select></div>
              <div className="col-12 col-sm-6 col-xl-3"><label htmlFor="assignment-department-filter" className="form-label">Department</label><select id="assignment-department-filter" className="form-select" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="">All departments</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</select></div>
              <div className="col-12 d-flex justify-content-between align-items-center"><span className="small text-secondary">Showing {filteredStudents.length} of {students.length} students</span><button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setStudentSearch(''); setAssignmentFilter('all'); setYearFilter(''); setSemesterFilter(''); setDepartmentFilter(''); }}>Clear filters</button></div>
            </div>
            {loading ? <p className="text-secondary">Loading users…</p> : filteredStudents.length === 0 ? <p className="text-secondary">No students match this filter.</p> : (
              <div className="table-responsive assignment-student-list"><table className="table align-middle mb-0"><thead><tr><th><span className="visually-hidden">Select</span></th><th>Student</th><th>Student ID</th><th>Department</th><th>Year / Semester</th><th>Current mentor</th></tr></thead><tbody>{filteredStudents.map((student) => {
                const assignment = assignmentByStudent.get(student.id);
                const assignedMentor = mentors.find((item) => item.id === assignment?.mentor_id);
                const hasPreviousAssignment = !student.assignment_locked && history.some((item) => item.student_id === student.id);
                return <tr key={student.id}><td><input className="form-check-input" type="checkbox" aria-label={`Select ${student.full_name}`} checked={selected.includes(student.id)} disabled={student.assignment_locked} onChange={() => toggleStudent(student.id)} /></td><td>{student.full_name}</td><td>{student.student_id}</td><td>{student.department}</td><td>{student.academic_year} / {student.semester}</td><td>{student.current_mentor || assignedMentor?.full_name || (hasPreviousAssignment ? <span className="badge text-bg-secondary">Previously assigned · available</span> : <span className="badge pastel-peach">Unassigned</span>)}</td></tr>;
              })}</tbody></table></div>
            )}
          </div>
        </div>
      </form>
      <section className="card">
        <div className="card-header bg-transparent">Students by mentor</div>
        <div className="card-body"><div className="row g-3">{mentors.filter((mentor) => `${mentor.full_name} ${mentor.employee_id} ${mentor.department}`.toLowerCase().includes(mentorSearch.toLowerCase())).map((mentor) => {
          const mentees = assignments.filter((item) => item.mentor_id === mentor.id).map((item) => students.find((student) => student.id === item.student_id)).filter(Boolean);
          return <div className="col-12 col-lg-6" key={mentor.id}><div className="mentor-assignment-card h-100"><div className="d-flex justify-content-between gap-2"><div><h2 className="h6 mb-1">{mentor.full_name}</h2><div className="small text-secondary">{mentor.department} · {mentees.length} mentee{mentees.length === 1 ? '' : 's'}</div></div><i className="bi bi-person-workspace text-primary fs-5" /></div>{mentees.length === 0 ? <p className="small text-secondary mt-3 mb-0">No students currently assigned.</p> : <ul className="list-unstyled small mt-3 mb-0">{mentees.map((student) => <li className="py-2 border-top" key={student.id}>{student.full_name} <span className="text-secondary">· {student.student_id}</span></li>)}</ul>}</div></div>;
        })}</div></div>
      </section>
      <section className="card mt-4">
        <div className="card-header bg-transparent">Assignment history</div>
        <div className="card-body">
          {history.length === 0 ? <p className="text-secondary mb-0">No mentor assignment history yet.</p> : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>Student</th><th>Mentor</th><th>Assigned</th><th>Ended</th><th>Status</th></tr></thead>
                <tbody>{history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.student_name}</td>
                    <td>{item.mentor_name}</td>
                    <td>{new Date(item.assigned_at).toLocaleString()}</td>
                    <td>{item.ended_at ? new Date(item.ended_at).toLocaleString() : '—'}</td>
                    <td><span className={`badge ${item.active ? 'text-bg-success' : 'text-bg-secondary'}`}>{item.active ? 'Current' : 'Previous'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
