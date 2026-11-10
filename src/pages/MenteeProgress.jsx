import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';

const today = () => new Date().toISOString().slice(0, 10);
const monday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

export default function MenteeProgress({ studentId, onBack, go }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest(`/mentor/students/${studentId}`)
      .then((result) => { if (active) setDetail(result); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [studentId]);

  const stats = useMemo(() => {
    if (!detail) return null;
    const data = detail.progress || {};
    const sessions = data.sessions || [];
    const logs = data.logs || [];
    const day = today();
    const weekStart = monday();
    const plannedToday = sessions.filter((item) => item.date === day && item.kind === 'study');
    const actualToday = logs.filter((item) => item.date === day);
    const actualTodayMinutes = actualToday.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
    const plannedMinutes = plannedToday.reduce((sum, item) => {
      const start = item.start?.split(':').map(Number);
      const end = item.end?.split(':').map(Number);
      return start?.length === 2 && end?.length === 2 ? sum + Math.max(0, end[0] * 60 + end[1] - start[0] * 60 - start[1]) : sum;
    }, 0);
    const weeklyLogs = logs.filter((item) => item.date >= weekStart && item.date <= day);
    const weeklyMinutes = weeklyLogs.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
    const weeklySessions = sessions.filter((item) => item.kind === 'study' && item.date >= weekStart && item.date <= day);
    const bySubject = new Map((data.subjects || []).map((subject) => [subject.id, { name: subject.name, code: subject.code, topics: subject.topics || [], weekMinutes: 0 }]));
    weeklyLogs.forEach((log) => {
      const subject = bySubject.get(log.subjectId);
      if (subject) subject.weekMinutes += Number(log.minutes) || 0;
    });
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${weekStart}T00:00:00`);
      date.setDate(date.getDate() + index);
      const value = date.toISOString().slice(0, 10);
      return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), minutes: logs.filter((log) => log.date === value).reduce((sum, log) => sum + (Number(log.minutes) || 0), 0) };
    });
    const recentDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${day}T00:00:00`);
      date.setDate(date.getDate() - (6 - index));
      const value = date.toISOString().slice(0, 10);
      return {
        date: value,
        minutes: logs.filter((log) => log.date === value).reduce((sum, log) => sum + (Number(log.minutes) || 0), 0),
        sessions: sessions.filter((session) => session.date === value && session.kind === 'study' && session.done).length,
      };
    });
    const tasks = data.tasks || [];
    const assignments = tasks.filter((task) => task.kind === 'assignment');
    const exams = (data.exams || []).filter((exam) => exam.date >= day).sort((a, b) => a.date.localeCompare(b.date));
    const plannedGoal = Number(data.settings?.dailyGoal || 0) * 60;
    return {
      data,
      sessions,
      actualTodayMinutes,
      plannedMinutes,
      actualToday,
      weeklyMinutes,
      weeklyLogs,
      completedWeeklySessions: weeklySessions.filter((item) => item.done).length,
      missedWeeklySessions: weeklySessions.filter((item) => !item.done && item.date < day).length,
      bySubject: [...bySubject.values()],
      weekDays,
      recentDays,
      completedSessions: plannedToday.filter((item) => item.done).length,
      pendingSessions: plannedToday.filter((item) => !item.done).length,
      dailyPct: plannedGoal ? Math.min(100, Math.round(actualTodayMinutes / plannedGoal * 100)) : plannedMinutes ? Math.min(100, Math.round(actualTodayMinutes / plannedMinutes * 100)) : 0,
      completedAssignments: assignments.filter((item) => item.done || item.status === 'Submitted'),
      pendingAssignments: assignments.filter((item) => !item.done && item.status !== 'Submitted'),
      exams,
    };
  }, [detail]);

  const submitFeedback = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const item = await apiRequest(`/mentor/students/${studentId}/feedback`, { method: 'POST', body: JSON.stringify({ content: feedback }) });
      setDetail((current) => ({ ...current, feedback: [item, ...current.feedback] }));
      setFeedback('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };
  const scheduleFollowUp = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const item = await apiRequest(`/mentor/students/${studentId}/follow-ups`, { method: 'POST', body: JSON.stringify({ scheduled_for: followUpDate, notes: followUpNotes }) });
      setDetail((current) => ({ ...current, follow_ups: [...current.follow_ups, item].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)) }));
      setFollowUpDate('');
      setFollowUpNotes('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !detail) return <><button className="btn btn-link px-0 mb-3" onClick={onBack}><i className="bi bi-arrow-left me-1" />My mentees</button><div className="alert alert-danger" role="alert">{error}</div></>;
  if (!detail || !stats) return <p className="text-secondary">Loading academic progress…</p>;
  const { student } = detail;
  const backlogs = detail.backlogs || [];
  const cleared = backlogs.filter((item) => item.status === 'Cleared');
  const active = backlogs.filter((item) => item.status !== 'Cleared');
  const maxMinutes = Math.max(60, ...stats.weekDays.map((item) => item.minutes));

  return (
    <>
      <button className="btn btn-link px-0 mb-3" onClick={onBack}><i className="bi bi-arrow-left me-1" />My mentees</button>
      <header className="page-header mb-4"><div><h1 className="page-title">{student.full_name}</h1><p className="text-secondary mb-0">{student.student_id} · {student.department} · Academic year {student.academic_year} · Semester {student.semester}</p></div><button className="btn btn-outline-primary" type="button" onClick={() => go('messages')}><i className="bi bi-chat-dots me-1" />Message student</button></header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row g-3 mb-4">
        {[['Subjects', (stats.data.subjects || []).length, 'journal-bookmark', 'pastel-blue'], ['Active backlogs', active.length, 'hourglass-split', 'pastel-peach'], ['Cleared backlogs', cleared.length, 'check-circle', 'pastel-mint'], ['Upcoming exams', stats.exams.length, 'mortarboard', 'pastel-lavender']].map(([label, count, icon, tone]) => <div className="col-6 col-xl-3" key={label}><div className={`card stat-card h-100 ${tone}`}><div className="card-body d-flex align-items-center gap-3"><span className="stat-icon"><i className={`bi bi-${icon}`} /></span><div><div className="small text-secondary">{label}</div><div className="stat-value">{count}</div></div></div></div></div>)}
      </div>
      <div className="row g-3 mb-4">
        <section className="col-12 col-xl-5"><div className="card h-100"><div className="card-header bg-transparent">Daily progress · {new Date().toLocaleDateString()}</div><div className="card-body"><div className="row g-2 mb-3"><div className="col-6"><div className="progress-summary"><span>Planned study</span><strong>{(stats.plannedMinutes / 60).toFixed(1)} h</strong></div></div><div className="col-6"><div className="progress-summary"><span>Actual study</span><strong>{(stats.actualTodayMinutes / 60).toFixed(1)} h</strong></div></div><div className="col-6"><div className="progress-summary"><span>Completed sessions</span><strong>{stats.completedSessions}</strong></div></div><div className="col-6"><div className="progress-summary"><span>Pending sessions</span><strong>{stats.pendingSessions}</strong></div></div></div><div className="d-flex justify-content-between small mb-1"><span>Daily progress</span><strong>{stats.dailyPct}%</strong></div><div className="progress" role="progressbar" aria-valuenow={stats.dailyPct} aria-valuemin="0" aria-valuemax="100"><div className="progress-bar" style={{ width: `${stats.dailyPct}%` }} /></div><div className="small text-secondary mt-3">{stats.actualToday.length} recorded progress session{stats.actualToday.length === 1 ? '' : 's'} today</div><h3 className="h6 mt-4">Recent daily records</h3><div className="small">{stats.recentDays.map((record) => <div className="d-flex justify-content-between border-top py-2" key={record.date}><span>{new Date(`${record.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span>{(record.minutes / 60).toFixed(1)} study hours · {record.sessions} completed</span></div>)}</div></div></div></section>
        <section className="col-12 col-xl-7"><div className="card h-100"><div className="card-header bg-transparent d-flex justify-content-between"><span>Weekly study progress</span><strong>{(stats.weeklyMinutes / 60).toFixed(1)} h total</strong></div><div className="card-body"><div className="weekly-chart" role="img" aria-label="Study hours for each day this week">{stats.weekDays.map((item) => <div className="weekly-chart-day" key={item.label}><div className="weekly-chart-track"><div className="weekly-chart-bar" style={{ height: `${Math.max(3, item.minutes / maxMinutes * 100)}%` }} title={`${(item.minutes / 60).toFixed(1)} hours`} /></div><span>{item.label}</span><small>{(item.minutes / 60).toFixed(1)}h</small></div>)}</div><div className="small text-secondary mt-3">{stats.weeklyLogs.length} daily progress record{stats.weeklyLogs.length === 1 ? '' : 's'} · {stats.completedWeeklySessions} sessions completed · {stats.missedWeeklySessions} missed sessions · Subject-wise:</div><div className="d-flex gap-2 flex-wrap mt-2">{stats.bySubject.filter((subject) => subject.weekMinutes > 0).map((subject) => <span className="badge text-bg-light" key={subject.name}>{subject.code || subject.name}: {(subject.weekMinutes / 60).toFixed(1)}h</span>)}</div></div></div></section>
      </div>
      <section className="card mb-4"><div className="card-header bg-transparent">Subject performance and progress</div><div className="card-body">{stats.bySubject.length === 0 ? <p className="text-secondary mb-0">No subject data has been synced by this student yet.</p> : <div className="row g-3">{stats.bySubject.map((subject) => { const pct = subject.topics.length ? Math.round(subject.topics.filter((topic) => topic.done).length / subject.topics.length * 100) : 0; return <div className="col-12 col-md-6" key={subject.name}><div className="progress-summary"><div className="d-flex justify-content-between"><span>{subject.code ? `${subject.code} · ` : ''}{subject.name}</span><strong>{pct}%</strong></div><div className="progress mt-2"><div className="progress-bar" style={{ width: `${pct}%` }} /></div><small className="text-secondary">{subject.weekMinutes ? `${(subject.weekMinutes / 60).toFixed(1)} study hours this week` : 'No study hours logged this week'}</small></div></div>; })}</div>}</div></section>
      <section className="card mb-4"><div className="card-header bg-transparent">Backlog monitoring</div><div className="card-body"><div className="small text-secondary mb-3">{active.length} active · {cleared.length} cleared</div>{backlogs.length === 0 ? <p className="text-secondary mb-0">No backlog records have been added.</p> : <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Subject</th><th>Semester</th><th>Exam date</th><th>Status</th><th>Preparation</th></tr></thead><tbody>{backlogs.map((item) => <tr key={item.id}><td>{item.subject_name}{item.subject_code && <span className="text-secondary small d-block">{item.subject_code}</span>}</td><td>{item.semester}</td><td>{item.exam_date || '—'}</td><td><span className="badge text-bg-light">{item.status}</span></td><td>{item.progress}%</td></tr>)}</tbody></table></div>}</div></section>
      <div className="row g-3 mb-4">
        <section className="col-12 col-lg-6"><div className="card h-100"><div className="card-header bg-transparent">Assignments and upcoming exams</div><div className="card-body"><h2 className="h6">Pending assignments ({stats.pendingAssignments.length})</h2>{stats.pendingAssignments.length ? <ul>{stats.pendingAssignments.map((item) => <li key={item.id}>{item.title}{item.deadline ? ` · due ${item.deadline}` : ''}</li>)}</ul> : <p className="small text-secondary">No pending assignments.</p>}<h2 className="h6 mt-3">Completed assignments ({stats.completedAssignments.length})</h2><ul className="small">{stats.completedAssignments.slice(0, 6).map((item) => <li key={item.id}>{item.title}</li>)}</ul><h2 className="h6 mt-3">Upcoming exams</h2>{stats.exams.length ? <ul className="small">{stats.exams.slice(0, 6).map((exam) => <li key={exam.id}>{exam.name} · {exam.date}{exam.status ? ` · ${exam.status}` : ''}</li>)}</ul> : <p className="small text-secondary">No upcoming exams.</p>}</div></div></section>
        <section className="col-12 col-lg-6"><div className="card h-100"><div className="card-header bg-transparent">Mentor guidance</div><div className="card-body"><form className="mb-4" onSubmit={submitFeedback}><label className="form-label" htmlFor="mentor-feedback">Send feedback or study guidance</label><textarea id="mentor-feedback" className="form-control mb-2" required maxLength={4000} rows="2" value={feedback} onChange={(event) => setFeedback(event.target.value)} /><button className="btn btn-sm btn-primary" disabled={saving}>Send feedback</button></form><form className="mb-4" onSubmit={scheduleFollowUp}><label className="form-label" htmlFor="follow-up-date">Schedule follow-up</label><div className="d-flex gap-2 flex-wrap"><input id="follow-up-date" type="date" className="form-control follow-up-date" required value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /><input className="form-control flex-grow-1" placeholder="Optional notes" maxLength={500} value={followUpNotes} onChange={(event) => setFollowUpNotes(event.target.value)} /><button className="btn btn-sm btn-outline-primary" disabled={saving}>Schedule</button></div></form><h3 className="h6">Recent feedback</h3>{detail.feedback.length ? detail.feedback.slice(0, 4).map((item) => <div className="small border-top py-2" key={item.id}>{item.content}<time className="d-block text-secondary">{new Date(item.created_at).toLocaleString()}</time></div>) : <p className="small text-secondary">No feedback sent yet.</p>}<h3 className="h6 mt-3">Follow-ups</h3>{detail.follow_ups.length ? detail.follow_ups.map((item) => <div className="small border-top py-2" key={item.id}>{item.scheduled_for}{item.notes ? ` · ${item.notes}` : ''}</div>) : <p className="small text-secondary">No follow-ups scheduled.</p>}</div></div></section>
      </div>
      <p className="small text-secondary">Academic records are read-only here; students retain control of their subjects, progress, assignments, and backlog records.</p>
    </>
  );
}
