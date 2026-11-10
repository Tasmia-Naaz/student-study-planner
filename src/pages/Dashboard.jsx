import { useContext, useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useStore } from '../hooks/useStore';
import { AuthContext } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { PageHeader, StatCard, ProgressBar, Empty, SubjectColorBadge } from '../components/common';
import { addDays, daysBetween, fmtHours, fmtTimeRange, hoursNum, niceDate, shortDate, todayStr, toMin, durMin } from '../utils/dates';
import { getReminders } from '../utils/notifications';
import { dayKind, studyMinutes } from '../utils/scheduler';
import { PALETTE } from '../utils/chartSetup';
import { getSubjectColor } from '../utils/defaults';

export default function Dashboard({ go }) {
  const { data, toggleSession } = useStore();
  const { user } = useContext(AuthContext);
  const [backlogs, setBacklogs] = useState([]);
  const [mentor, setMentor] = useState(null);
  const [accountError, setAccountError] = useState('');
  const [accountLoading, setAccountLoading] = useState(true);
  const today = todayStr();
  const goalMin = (Number(data.settings.dailyGoal) || 0) * 60;
  const timeFormat = data.settings?.timeFormat || '12h';
  const [activeChartTab, setActiveChartTab] = useState('weekly');
  const [showCompletedToday, setShowCompletedToday] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest('/students/me/dashboard')
      .then((result) => {
        if (active) {
          setBacklogs(result.backlogs);
          setMentor(result.mentor);
        }
      })
      .catch((error) => { if (active) setAccountError(error.message); })
      .finally(() => { if (active) setAccountLoading(false); });
    return () => { active = false; };
  }, []);

  // Subject lookup helper
  const subjectMap = useMemo(() => {
    const map = {};
    (data.subjects || []).forEach((s, idx) => {
      map[s.id] = {
        ...s,
        color: getSubjectColor(s, idx),
      };
    });
    return map;
  }, [data.subjects]);

  const subName = (id) => subjectMap[id]?.name || 'General';

  // Calculations for Stat Cards
  const totalSubjects = (data.subjects || []).length;

  const taskSummary = useMemo(() => {
    const studyTasks = [];
    const assignments = [];
    const projects = [];
    const deadlines = [];
    const overdueTasks = [];
    const recentlyCompleted = [];
    let actionableCount = 0;
    let overallCompletedCount = 0;
    let completedStudyTasks = 0;
    let completedAssignments = 0;
    let pendingAssignments = 0;
    let completedProjects = 0;
    let overdueAssignmentsCount = 0;
    for (const task of data.tasks || []) {
      if (task.kind === 'study') {
        studyTasks.push(task);
        if (task.done) completedStudyTasks += 1;
      }
      if (task.kind === 'assignment') {
        assignments.push(task);
        if (task.done || task.status === 'Submitted') completedAssignments += 1;
        else {
          pendingAssignments += 1;
        }
        if (!task.done && task.deadline && task.deadline < today) overdueAssignmentsCount += 1;
      }
      if (task.kind === 'project') {
        projects.push(task);
        if (task.done) completedProjects += 1;
      }
      if (task.kind !== 'milestone') {
        actionableCount += 1;
        if (task.done) overallCompletedCount += 1;
      }
      if (!task.done && task.deadline && task.kind !== 'project') deadlines.push(task);
      if (!task.done && task.deadline && task.deadline < today) overdueTasks.push(task);
      if (task.done && recentlyCompleted.length < 5) recentlyCompleted.push(task);
    }
    deadlines.sort((a, b) => a.deadline.localeCompare(b.deadline));
    return {
      studyTasks,
      assignments,
      projects,
      deadlines: deadlines.slice(0, 6),
      overdueTasks,
      recentlyCompleted,
      actionableCount,
      overallCompletedCount,
      completedStudyTasks,
      pendingAssignments,
      completedAssignments,
      completedProjects,
      overdueAssignmentsCount,
      activeProjects: projects.length - completedProjects,
      overallTaskPct: actionableCount ? Math.round((overallCompletedCount / actionableCount) * 100) : 0,
    };
  }, [data.tasks, today]);
  const {
    studyTasks,
    assignments,
    projects,
    deadlines,
    overdueTasks,
    recentlyCompleted,
    actionableCount,
    overallCompletedCount,
    completedStudyTasks,
    pendingAssignments,
    completedAssignments,
    completedProjects,
    overdueAssignmentsCount,
    activeProjects,
    overallTaskPct,
  } = taskSummary;
  const totalStudyTasks = studyTasks.length;
  const pendingStudyTasks = totalStudyTasks - completedStudyTasks;
  const totalAssignments = assignments.length;
  const totalProjects = projects.length;
  const upcomingExams = useMemo(
    () => (data.exams || []).filter((exam) => exam.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    [data.exams, today],
  );

  // Today study time calculations
  const todaySessions = useMemo(() => (data.sessions || []).filter((session) => session.date === today), [data.sessions, today]);
  const logTotals = useMemo(() => {
    const byDate = new Map();
    const bySubject = new Map();
    for (const log of data.logs || []) {
      const minutes = Number(log.minutes) || 0;
      byDate.set(log.date, (byDate.get(log.date) || 0) + minutes);
      bySubject.set(log.subjectId, (bySubject.get(log.subjectId) || 0) + minutes);
    }
    return { byDate, bySubject };
  }, [data.logs]);
  const todayPlannedMin = todaySessions.reduce((total, session) => total + (session.kind === 'study' ? durMin(session) : 0), 0);
  const todayCompletedMin = logTotals.byDate.get(today) || 0;
  const dailyGoalPct = goalMin > 0 ? Math.round((todayCompletedMin / goalMin) * 100) : 0;

  const reminders = useMemo(() => getReminders(data), [data]);

  // Chart 1: Weekly study activity
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const weekData = {
    labels: week.map((d) => shortDate(d)),
    datasets: [
      {
        label: 'Actual Study Hours',
        data: week.map((d) => hoursNum(logTotals.byDate.get(d) || 0)),
        backgroundColor: '#536f91',
        borderRadius: 5,
      },
    ],
  };

  // Chart 2: Subject-wise study progress (topics %)
  const subjectProgressData = {
    labels: (data.subjects || []).map((s) => s.code || s.name),
    datasets: [
      {
        label: 'Topics Completed (%)',
        data: (data.subjects || []).map((s) =>
          s.topics?.length ? Math.round((s.topics.filter((t) => t.done).length / s.topics.length) * 100) : 0
        ),
        backgroundColor: (data.subjects || []).map((s, i) => subjectMap[s.id]?.color || PALETTE[i % PALETTE.length]),
        borderRadius: 4,
      },
    ],
  };

  // Chart 3: Study Tasks Completed vs Pending
  const tasksChartData = {
    labels: ['Completed Study Tasks', 'Pending Study Tasks'],
    datasets: [
      {
        data: [completedStudyTasks, pendingStudyTasks],
        backgroundColor: ['#6b9b7c', '#c4a15b'],
        borderWidth: 0,
      },
    ],
  };

  // Chart 4: Assignment Status
  const inProgressAssignmentsCount = Math.max(0, pendingAssignments - overdueAssignmentsCount);
  const assignmentsChartData = {
    labels: ['Completed / Submitted', 'In Progress', 'Overdue'],
    datasets: [
      {
        data: [completedAssignments, inProgressAssignmentsCount, overdueAssignmentsCount],
        backgroundColor: ['#6b9b7c', '#8299b4', '#b96b70'],
        borderWidth: 0,
      },
    ],
  };

  // Chart 5: Study Hours by Subject
  const subjectHours = (data.subjects || []).map((s) => {
    const min = logTotals.bySubject.get(s.id) || 0;
    return { name: s.code || s.name, hours: hoursNum(min), color: subjectMap[s.id]?.color || '#536f91' };
  }).filter((x) => x.hours > 0);

  const subjectHoursData = {
    labels: subjectHours.map((x) => x.name),
    datasets: [
      {
        data: subjectHours.map((x) => x.hours),
        backgroundColor: subjectHours.map((x) => x.color),
        borderWidth: 0,
      },
    ],
  };

  // Chart 6: Daily Goal Achievement (Last 7 Days Actual vs Goal)
  const goalAchievementData = {
    labels: week.map((d) => shortDate(d)),
    datasets: [
      {
        type: 'bar',
        label: 'Study Hours',
        data: week.map((d) => hoursNum(logTotals.byDate.get(d) || 0)),
        backgroundColor: '#8299b4',
        borderRadius: 4,
      },
      {
        type: 'line',
        label: 'Daily Target Goal',
        data: week.map(() => hoursNum(goalMin)),
        borderColor: '#c4a15b',
        borderDash: [5, 5],
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const commonChartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  const kind = dayKind(data, today);

  return (
    <>
      <PageHeader
        title={data.profile.name ? `Welcome back, ${data.profile.name}` : 'Student Academic Dashboard'}
        subtitle={`${niceDate(today)} · ${kind === 'college' ? 'College Working Day' : kind === 'holiday' ? 'Holiday / Free Study Day' : 'Unavailable'}${user?.semester ? ` · Semester ${user.semester}` : ''}`}
      >
        <button className="btn btn-primary" onClick={() => go('timetable')}>
          <i className="bi bi-magic me-1" /> Open Timetable
        </button>
      </PageHeader>
      <section className="card student-profile-summary mb-4">
        <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div><div className="small text-secondary text-uppercase">Student profile</div><div className="fw-semibold">{user?.full_name || data.profile.name}{user?.student_id ? ` · ${user.student_id}` : ''}</div><div className="small text-secondary">{user?.department || data.profile.department || 'Department not set'}{user?.academic_year ? ` · Academic year ${user.academic_year}` : ''}{user?.semester ? ` · Semester ${user.semester}` : ''}</div></div>
          <div className="d-flex flex-wrap gap-3 align-items-center"><div className="small"><span className="text-secondary d-block">Assigned mentor</span><strong>{accountLoading ? 'Loading…' : mentor?.full_name || (accountError ? 'Unavailable' : 'Not assigned')}</strong></div><div className="small"><span className="text-secondary d-block">Active backlogs</span><strong>{accountLoading ? '…' : backlogs.filter((item) => item.status !== 'Cleared').length}</strong></div><div className="small"><span className="text-secondary d-block">Cleared backlogs</span><strong>{accountLoading ? '…' : backlogs.filter((item) => item.status === 'Cleared').length}</strong></div><button className="btn btn-sm btn-outline-primary" onClick={() => go('backlogs')}>View backlogs</button></div>
        </div>
        {accountError && <div className="card-footer bg-transparent small text-warning-emphasis">Account dashboard information could not refresh: {accountError}</div>}
      </section>

      {/* Quick Actions Bar */}
      <div className="card mb-4 border-0 shadow-sm bg-body-tertiary">
        <div className="card-body py-2">
          <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <span className="small fw-bold text-secondary text-uppercase tracking-wider">
              <i className="bi bi-lightning-charge-fill text-warning me-1" /> Quick Actions
            </span>
            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-sm btn-outline-primary" onClick={() => go('subjects')}>
                <i className="bi bi-journal-plus me-1" /> Add Subject
              </button>
              <button className="btn btn-sm btn-outline-primary" onClick={() => go('timetable')}>
                <i className="bi bi-calendar-plus me-1" /> Add Study Session
              </button>
              <button className="btn btn-sm btn-outline-primary" onClick={() => go('tasks')}>
                <i className="bi bi-plus-circle me-1" /> Add Task / Assignment
              </button>
              <button className="btn btn-sm btn-outline-primary" onClick={() => go('exams')}>
                <i className="bi bi-mortarboard me-1" /> Add Exam
              </button>
              <button className="btn btn-sm btn-outline-primary" onClick={() => go('progress')}>
                <i className="bi bi-pencil-square me-1" /> Record Progress
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => go('timetable')}>
                <i className="bi bi-magic me-1" /> Generate Timetable
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Statistics Cards Grid */}
      <div className="row g-3 mb-4">
        {/* Row 1: Today Study Hours, Daily Goal, Overall Task Progress, Upcoming Exams */}
        <div className="col-6 col-lg-3">
          <StatCard
            icon="clock-history"
            label="Today's Study Hours"
            value={fmtHours(todayCompletedMin)}
            hint={`${fmtHours(todayPlannedMin)} planned today`}
            tone="primary"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard
            icon="bullseye"
            label="Daily Goal Progress"
            value={`${dailyGoalPct}%`}
            hint={todayCompletedMin >= goalMin && goalMin > 0 ? 'Goal achieved!' : `${fmtHours(Math.max(0, goalMin - todayCompletedMin))} remaining`}
            tone={todayCompletedMin >= goalMin && goalMin > 0 ? 'success' : 'warning'}
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard
            icon="check2-all"
            label="Overall Task Completion"
            value={`${overallTaskPct}%`}
            hint={`${overallCompletedCount} of ${actionableCount} tasks done`}
            tone="info"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard
            icon="mortarboard"
            label="Upcoming Exams"
            value={upcomingExams.length}
            hint={upcomingExams[0] ? `Next: in ${daysBetween(today, upcomingExams[0].date)}d` : 'None scheduled'}
            tone="danger"
          />
        </div>

        {/* Row 2: Subjects, Study Tasks, Assignments, Projects */}
        <div className="col-6 col-lg-3">
          <StatCard
            icon="journal-bookmark"
            label="Total Subjects"
            value={totalSubjects}
            hint={`${(data.subjects || []).filter((s) => s.category === 'exam').length} outside exam subjects`}
            tone="primary"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard
            icon="list-check"
            label="Study Tasks Pending"
            value={pendingStudyTasks}
            hint={`${completedStudyTasks} completed of ${totalStudyTasks}`}
            tone="warning"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard
            icon="file-earmark-text"
            label="Assignments Pending"
            value={pendingAssignments}
            hint={`${completedAssignments} submitted of ${totalAssignments}`}
            tone="warning"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard
            icon="kanban"
            label="Active Projects"
            value={activeProjects}
            hint={`${completedProjects} completed of ${totalProjects}`}
            tone="secondary"
          />
        </div>
      </div>

      {/* Main Center Sections: Today's Timetable + Goal Progress */}
      <div className="row g-3 mb-4">
        {/* Today's Goal Progress Bar Box */}
        <div className="col-12 col-lg-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold d-flex justify-content-between align-items-center">
              <span>Today's Study Goal</span>
              <span className={`badge ${todayCompletedMin >= goalMin && goalMin > 0 ? 'text-bg-success' : 'text-bg-primary'}`}>
                {dailyGoalPct}% Met
              </span>
            </div>
            <div className="card-body d-flex flex-column justify-content-center">
              <div className="countdown mb-1 text-primary">
                {fmtHours(todayCompletedMin)}{' '}
                <span className="fs-6 text-secondary fw-normal">of {fmtHours(goalMin)} target</span>
              </div>
              <ProgressBar
                value={dailyGoalPct}
                variant={todayCompletedMin >= goalMin && goalMin > 0 ? 'success' : 'primary'}
                height={12}
                label="Daily study goal progress"
              />
              <p className="small text-secondary mt-2 mb-3">
                {todayCompletedMin >= goalMin && goalMin > 0
                  ? 'Fantastic work! You have met your study goal for today.'
                  : `${fmtHours(Math.max(0, goalMin - todayCompletedMin))} more needed to reach today's target.`}
              </p>
              <div className="d-flex gap-2 mt-auto">
                <button className="btn btn-sm btn-outline-primary flex-grow-1" onClick={() => go('progress')}>
                  <i className="bi bi-plus-lg me-1" /> Log Study Time
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => go('settings')}>
                  Change Goal
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Timetable with Subject Colors */}
        <div className="col-12 col-lg-8">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <span>Today's Timetable Schedule</span>
                <span className="badge text-bg-light border small">
                  {todaySessions.filter((s) => s.kind === 'study').length} sessions
                </span>
              </div>
              <button className="btn btn-sm btn-link text-decoration-none p-0" onClick={() => go('timetable')}>
                View Full Timetable <i className="bi bi-arrow-right" />
              </button>
            </div>
            <div className="card-body p-2 p-sm-3" style={{ maxHeight: 310, overflowY: 'auto' }}>
              {todaySessions.length === 0 ? (
                <Empty icon="calendar2-x">
                  No sessions scheduled for today.{' '}
                  <button className="btn btn-sm btn-link p-0" onClick={() => go('timetable')}>
                    Generate timetable
                  </button>
                </Empty>
              ) : (
                todaySessions.map((s) => {
                  const isStudy = s.kind === 'study';
                  const subj = subjectMap[s.subjectId];
                  const color = isStudy ? (subj?.color || s.color || getSubjectColor(subj)) : null;

                  return (
                    <div
                      key={s.id}
                      className={`session-card mb-2 p-2 rounded-2 ${
                        s.kind === 'break' ? 'session-break' : 'session-study'
                      } ${s.done ? 'session-done' : ''}`}
                      style={{
                        borderLeft: isStudy ? `5px solid ${color}` : '3px dashed var(--bs-border-color)',
                        backgroundColor: isStudy ? 'var(--bs-tertiary-bg)' : 'transparent',
                      }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        {isStudy ? (
                          <input
                            className="form-check-input mt-0"
                            type="checkbox"
                            checked={s.done}
                            onChange={() => toggleSession(s.id)}
                            title={s.done ? 'Mark incomplete' : 'Mark done'}
                            aria-label={`Mark ${s.title} done`}
                            style={{ width: 17, height: 17, cursor: 'pointer' }}
                          />
                        ) : (
                          <span className="text-secondary small opacity-75" style={{ width: 17, textAlign: 'center' }}>
                            <i className="bi bi-cup-hot" />
                          </span>
                        )}

                        <div className="time-badge small text-secondary font-monospace" style={{ minWidth: timeFormat === '12h' ? 122 : 92 }}>
                          <span className="fw-semibold text-body">{fmtTimeRange(s.start, s.end, timeFormat)}</span>
                        </div>

                        <div className="flex-grow-1 min-w-0">
                          <div className="d-flex align-items-center gap-1 flex-wrap">
                            {isStudy && subj?.code && (
                              <span
                                className="badge px-1"
                                style={{
                                  backgroundColor: color,
                                  color: '#fff',
                                  fontSize: '0.65rem',
                                }}
                              >
                                {subj.code}
                              </span>
                            )}
                            <span className={`fw-semibold text-truncate small ${s.kind === 'break' ? 'text-secondary fst-italic' : 'text-body'}`}>
                              {s.title}
                            </span>
                          </div>
                          {s.topic && <div className="small text-secondary text-truncate">{s.topic}</div>}
                        </div>

                        {s.label && (
                          <span className="badge text-bg-light border small flex-shrink-0" style={{ fontSize: '0.68rem' }}>
                            {s.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section with Tab Switcher for 6 Charts */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom">
          <div className="fw-bold">
            <i className="bi bi-bar-chart-fill text-primary me-2" /> Academic Analytics & Progress Charts
          </div>
          <div className="btn-group btn-group-sm dashboard-chart-tabs" role="group" aria-label="Dashboard Charts">
            <button
              className={`btn ${activeChartTab === 'weekly' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveChartTab('weekly')}
            >
              Weekly Activity
            </button>
            <button
              className={`btn ${activeChartTab === 'subject' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveChartTab('subject')}
            >
              Subject Progress
            </button>
            <button
              className={`btn ${activeChartTab === 'tasks' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveChartTab('tasks')}
            >
              Tasks Status
            </button>
            <button
              className={`btn ${activeChartTab === 'assignments' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveChartTab('assignments')}
            >
              Assignments
            </button>
            <button
              className={`btn ${activeChartTab === 'hours' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveChartTab('hours')}
            >
              Hours by Subject
            </button>
            <button
              className={`btn ${activeChartTab === 'goal' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveChartTab('goal')}
            >
              Goal Achievement
            </button>
          </div>
        </div>

        <div className="card-body">
          <div className="chart-box" style={{ height: 280 }}>
            {activeChartTab === 'weekly' && (
              <Bar
                data={weekData}
                options={{
                  ...commonChartOpts,
                  scales: { y: { beginAtZero: true, title: { display: true, text: 'Study Hours' } } },
                }}
              />
            )}
            {activeChartTab === 'subject' && (
              data.subjects.length === 0 ? (
                <Empty icon="journal-plus">Add subjects and topics to see subject progress.</Empty>
              ) : (
                <Bar
                  data={subjectProgressData}
                  options={{
                    ...commonChartOpts,
                    scales: { y: { min: 0, max: 100, title: { display: true, text: 'Completion (%)' } } },
                  }}
                />
              )
            )}
            {activeChartTab === 'tasks' && (
              totalStudyTasks === 0 ? (
                <Empty icon="check2-square">No study tasks created yet.</Empty>
              ) : (
                <Doughnut
                  data={tasksChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                  }}
                />
              )
            )}
            {activeChartTab === 'assignments' && (
              totalAssignments === 0 ? (
                <Empty icon="file-earmark-text">No assignments recorded.</Empty>
              ) : (
                <Doughnut
                  data={assignmentsChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                  }}
                />
              )
            )}
            {activeChartTab === 'hours' && (
              subjectHours.length === 0 ? (
                <Empty icon="pie-chart">No study hours logged yet. Complete timetable sessions to record hours.</Empty>
              ) : (
                <Doughnut
                  data={subjectHoursData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                  }}
                />
              )
            )}
            {activeChartTab === 'goal' && (
              <Bar
                data={goalAchievementData}
                options={{
                  ...commonChartOpts,
                  scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } },
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Information Grid: Upcoming Exams, Deadlines, Reminders */}
      <div className="row g-3">
        {/* Upcoming Examinations Countdown */}
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold d-flex justify-content-between align-items-center">
              <span>Upcoming Examinations</span>
              <button className="btn btn-sm btn-link text-decoration-none p-0" onClick={() => go('exams')}>
                View all
              </button>
            </div>
            <div className="list-group list-group-flush">
              {upcomingExams.length === 0 ? (
                <div className="list-group-item">
                  <Empty icon="mortarboard">No upcoming examinations.</Empty>
                </div>
              ) : (
                upcomingExams.slice(0, 4).map((e) => {
                  const left = daysBetween(today, e.date);
                  return (
                    <div key={e.id} className="list-group-item d-flex justify-content-between align-items-center py-2">
                      <div className="min-w-0 me-2">
                        <div className="fw-semibold text-truncate">{e.name}</div>
                        <div className="small text-secondary">
                          {e.type} · {shortDate(e.date)}
                        </div>
                      </div>
                      <span className={`badge flex-shrink-0 text-bg-${left <= 3 ? 'danger' : left <= 7 ? 'warning' : 'primary'}`}>
                        {left === 0 ? 'Today' : left === 1 ? 'Tomorrow' : `${left}d left`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Assignment & Task Deadlines */}
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold d-flex justify-content-between align-items-center">
              <span>Upcoming Deadlines</span>
              <button className="btn btn-sm btn-link text-decoration-none p-0" onClick={() => go('tasks')}>
                View all
              </button>
            </div>
            <div className="list-group list-group-flush">
              {deadlines.length === 0 ? (
                <div className="list-group-item">
                  <Empty icon="check2-all">No pending deadlines.</Empty>
                </div>
              ) : (
                deadlines.map((t) => {
                  const left = daysBetween(today, t.deadline);
                  const isOverdue = left < 0;
                  return (
                    <div key={t.id} className="list-group-item d-flex justify-content-between align-items-center py-2">
                      <div className="min-w-0 me-2">
                        <div className="fw-semibold text-truncate">{t.title}</div>
                        <div className="small text-secondary text-capitalize">
                          {t.kind} {t.subjectId ? `· ${subName(t.subjectId)}` : ''}
                        </div>
                      </div>
                      <span
                        className={`badge flex-shrink-0 text-bg-${
                          isOverdue ? 'danger' : left <= 3 ? 'warning' : left <= 7 ? 'warning' : 'secondary'
                        }`}
                      >
                        {isOverdue ? `${-left}d overdue` : left === 0 ? 'Due today' : `${left}d`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Important Reminders */}
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold">Important Reminders</div>
            <div className="list-group list-group-flush" style={{ maxHeight: 250, overflowY: 'auto' }}>
              {reminders.length === 0 ? (
                <div className="list-group-item">
                  <Empty icon="bell">No reminders right now.</Empty>
                </div>
              ) : (
                reminders.slice(0, 6).map((r) => (
                  <div key={r.id} className="list-group-item small d-flex gap-2 align-items-start py-2">
                    <i className={`bi bi-${r.icon} text-${r.level === 'info' ? 'primary' : r.level} mt-1 flex-shrink-0`} />
                    <span className="text-body">{r.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
