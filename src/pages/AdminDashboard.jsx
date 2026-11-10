import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { departmentLabel } from "../utils/departments";
import { PageHeader } from "../components/common";
import { apiUrl } from "../utils/apiBase";
import { csrfHeaders } from "../utils/api";

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [students, setStudents] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [approving, setApproving] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(apiUrl('/api/auth/admin/students'), { credentials: 'include' }),
      fetch(apiUrl('/api/auth/admin/mentors'), { credentials: 'include' }),
    ])
      .then(async ([studentResponse, mentorResponse]) => {
        const [studentResult, mentorResult] = await Promise.all([studentResponse.json(), mentorResponse.json()]);
        if (!studentResponse.ok) throw new Error(studentResult.error || 'Could not load student records.');
        if (!mentorResponse.ok) throw new Error(mentorResult.error || 'Could not load mentor records.');
        return { students: studentResult, mentors: mentorResult };
      })
      .then((result) => {
        if (active) {
          setStudents(result.students);
          setMentors(result.mentors);
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const departments = useMemo(
    () => [...new Set(students.map((student) => student.department).filter(Boolean))].sort(),
    [students]
  );
  const filteredStudents = department
    ? students.filter((student) => student.department === department)
    : students;

  const approveMentor = async (mentorId) => {
    setActionError('');
    setApproving(mentorId);
    try {
      const response = await fetch(apiUrl(`/api/auth/admin/mentors/${mentorId}/approve`), {
        method: 'POST',
        credentials: 'include',
        headers: csrfHeaders('POST'),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not approve mentor.');
      setMentors((current) => current.map((mentor) => (
        mentor.id === mentorId ? { ...mentor, approved: true } : mentor
      )));
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setApproving(null);
    }
  };

  return (
    <div className="py-4">
      <PageHeader title="Admin Dashboard" subtitle={user ? `Welcome, ${user.full_name}. Manage student accounts and mentor approvals.` : 'Manage student accounts and mentor approvals.'} />
      {actionError && <div className="alert alert-danger" role="alert">{actionError}</div>}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-3 align-items-end mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="student-department-filter">Filter students by Department / Branch</label>
              <select id="student-department-filter" className="form-select" value={department} onChange={(event) => setDepartment(event.target.value)}>
                <option value="">All departments</option>
                {departments.map((value) => <option key={value} value={value}>{departmentLabel(value)}</option>)}
              </select>
            </div>
            <div className="card border-0 shadow-sm mt-4">
              <div className="card-header bg-transparent fw-bold">Mentor account approvals</div>
              <div className="card-body">
                {loading && <p role="status">Loading mentor accounts…</p>}
                {!loading && mentors.length === 0 && <p className="text-secondary mb-0">No mentor accounts registered.</p>}
                {!loading && mentors.length > 0 && (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead><tr><th>Name</th><th>Employee ID</th><th>Email</th><th>Department</th><th>Status</th><th /></tr></thead>
                      <tbody>{mentors.map((mentor) => (
                        <tr key={mentor.id}>
                          <td>{mentor.full_name}</td>
                          <td>{mentor.employee_id}</td>
                          <td>{mentor.email}</td>
                          <td>{departmentLabel(mentor.department)}</td>
                          <td><span className={`badge ${mentor.approved ? 'text-bg-success' : 'text-bg-warning'}`}>{mentor.approved ? 'Approved' : 'Pending'}</span></td>
                          <td>{!mentor.approved && (
                            <button type="button" className="btn btn-sm btn-outline-primary" disabled={approving === mentor.id} onClick={() => approveMentor(mentor.id)}>
                              {approving === mentor.id ? 'Approving…' : 'Approve'}
                            </button>
                          )}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="col-12 col-md-6 text-secondary">{filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'}</div>
          </div>
          {loading && <p role="status">Loading students…</p>}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {!loading && !error && filteredStudents.length === 0 && <p className="text-secondary mb-0">No student records found.</p>}
          {!loading && !error && filteredStudents.length > 0 && (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead><tr><th>Name</th><th>Student ID</th><th>Department / Branch</th><th>Year</th><th>Semester</th><th>Current mentor</th></tr></thead>
                <tbody>{filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>{student.full_name}</td>
                    <td>{student.student_id}</td>
                    <td>{departmentLabel(student.department)}</td>
                    <td>{student.academic_year}</td>
                    <td>{student.semester}</td>
                    <td>{student.current_mentor || <span className="text-secondary">Unassigned</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
