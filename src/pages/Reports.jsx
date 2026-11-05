import { useState, useMemo } from 'react';
import { Chart as ChartJS, Bar, Doughnut, Line } from 'react-chartjs-2';
import { useStore } from '../hooks/useStore';
import { PageHeader, ProgressBar, StatCard, Empty, SubjectColorBadge } from '../components/common';
import {
  addDays,
  addMonths,
  daysBetween,
  fmtHours,
  hoursNum,
  MONTH_NAMES,
  parseDate,
  shortDate,
  startOfWeek,
  todayStr,
} from '../utils/dates';
import { PALETTE } from '../utils/chartSetup';
import { getSubjectColor } from '../utils/defaults';

export default function Reports() {
  const { data } = useStore();
  const today = todayStr();
  const [period, setPeriod] = useState('week'); // 'week' | 'month' | 'prev-month' | 'custom'
  const [cursor, setCursor] = useState(today);
  const [customRange, setCustomRange] = useState({
    from: addDays(today, -14),
    to: today,
  });

  const goalMin = (Number(data.settings.dailyGoal) || 0) * 60;

  const subjectMap = useMemo(() => {
    const map = {};
    (data.subjects || []).forEach((s, idx) => {
      map[s.id] = { ...s, color: getSubjectColor(s, idx) };
    });
    return map;
  }, [data.subjects]);

  // Determine date bounds based on period selector
  let from, to, label;
  if (period === 'week') {
    from = startOfWeek(cursor);
    to = addDays(from, 6);
    label = `${shortDate(from)} – ${shortDate(to)}`;
  } else if (period === 'month') {
    from = cursor.slice(0, 8) + '01';
    to = addDays(addMonths(from, 1), -1);
    const d = parseDate(from);
    label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  } else if (period === 'prev-month') {
    const curMonthFirst = cursor.slice(0, 8) + '01';
    const prevMonthFirst = addMonths(curMonthFirst, -1);
    from = prevMonthFirst;
    to = addDays(curMonthFirst, -1);
    const d = parseDate(from);
    label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  } else {
    from = customRange.from || addDays(today, -14);
    to = customRange.to || today;
    label = `${shortDate(from)} – ${shortDate(to)}`;
  }

  const n = Math.max(1, daysBetween(from, to) + 1);
  const dates = Array.from({ length: n }, (_, i) => addDays(from, i));
  const inRange = (d) => d >= from && d <= to;

  // Filter logs and compute stats
  const logs = (data.logs || []).filter((l) => inRange(l.date));
  const perDay = dates.map((d) => logs.filter((l) => l.date === d).reduce((t, l) => t + l.minutes, 0));
  const total = perDay.reduce((a, b) => a + b, 0);
  const avgDaily = Math.round(total / n);
  const goalDays = goalMin > 0 ? perDay.filter((m) => m >= goalMin).length : 0;
  const goalAchievementPct = n > 0 ? Math.round((goalDays / n) * 100) : 0;

  // Consistency: % of days where at least 30 minutes were studied
  const activeDays = perDay.filter((m) => m >= 30).length;
  const consistencyPct = Math.round((activeDays / n) * 100);

  // Planned sessions in this range
  const planned = (data.sessions || []).filter((s) => s.kind === 'study' && inRange(s.date));
  const plannedDone = planned.filter((s) => s.done).length;

  // Subject rows with study time and completion
  const subjRows = (data.subjects || []).map((s) => {
    const m = logs.filter((l) => l.subjectId === s.id).reduce((t, l) => t + l.minutes, 0);
    const topics = s.topics || [];
    const done = topics.filter((t) => t.done).length;
    return {
      s,
      m,
      pct: topics.length ? Math.round((done / topics.length) * 100) : 0,
      done,
      totalTopics: topics.length,
      color: subjectMap[s.id]?.color || '#0f766e',
    };
  });

  const withTime = subjRows.filter((r) => r.m > 0);
  const mostStudied = [...subjRows].sort((a, b) => b.m - a.m)[0];

  // Tasks and Assignments
  const studyTasks = (data.tasks || []).filter((t) => t.kind === 'study');
  const completedStudyTasks = studyTasks.filter((t) => t.done).length;
  const pendingStudyTasks = studyTasks.filter((t) => !t.done).length;

  const assignments = (data.tasks || []).filter((t) => t.kind === 'assignment');
  const completedAssignments = assignments.filter((t) => t.done || t.status === 'Submitted').length;
  const overdueAssignments = assignments.filter((a) => !a.done && a.deadline && a.deadline < today).length;
  const pendingAssignments = assignments.filter((a) => !a.done && a.status !== 'Submitted').length;

  const projects = (data.tasks || []).filter((t) => t.kind === 'project');
  const completedProjects = projects.filter((t) => t.done).length;

  const step = (dir) => {
    if (period === 'week') setCursor(addDays(cursor, 7 * dir));
    else if (period === 'month' || period === 'prev-month') setCursor(addMonths(cursor, dir));
  };

  const commonOpts = {
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <>
      <PageHeader
        title="Academic Progress Reports"
        subtitle="Detailed analysis of study hours, subject performance, task completion and goal achievement."
      >
        <button className="btn btn-outline-secondary no-print" onClick={() => window.print()}>
          <i className="bi bi-printer me-1" /> Print Report
        </button>
      </PageHeader>

      {/* Date Range Selector Toolbar */}
      <div className="card mb-4 border-0 shadow-sm bg-body-tertiary no-print">
        <div className="card-body py-2 d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div className="btn-group" role="group">
            {[
              ['week', 'Weekly'],
              ['month', 'This Month'],
              ['prev-month', 'Last Month'],
              ['custom', 'Custom Range'],
            ].map(([p, l]) => (
              <button
                key={p}
                className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setPeriod(p)}
              >
                {l}
              </button>
            ))}
          </div>

          {period !== 'custom' ? (
            <div className="d-flex align-items-center gap-2">
              <div className="btn-group">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => step(-1)} aria-label="Previous">
                  <i className="bi bi-chevron-left" />
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setCursor(today)}>
                  Current
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => step(1)} aria-label="Next">
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
              <strong className="text-body ms-2">{label}</strong>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <input
                type="date"
                className="form-control form-control-sm"
                value={customRange.from}
                onChange={(e) => setCustomRange({ ...customRange, from: e.target.value })}
              />
              <span>to</span>
              <input
                type="date"
                className="form-control form-control-sm"
                value={customRange.to}
                min={customRange.from}
                onChange={(e) => setCustomRange({ ...customRange, to: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard
            icon="clock-history"
            label="Total Study Time"
            value={fmtHours(total)}
            hint={`${n} days in period`}
            tone="primary"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard
            icon="speedometer"
            label="Daily Study Average"
            value={fmtHours(avgDaily)}
            hint={goalMin ? `Target: ${fmtHours(goalMin)}/day` : 'No goal set'}
            tone="info"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard
            icon="bullseye"
            label="Goal Days Met"
            value={`${goalDays} of ${n} days`}
            hint={`${goalAchievementPct}% achievement rate`}
            tone="success"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard
            icon="graph-up"
            label="Study Consistency"
            value={`${consistencyPct}%`}
            hint={`${activeDays} active study days`}
            tone="warning"
          />
        </div>
      </div>

      {/* Charts Section: Hours per day & Distribution */}
      <div className="row g-3 mb-4">
        {/* Daily Study Hours with Target Line */}
        <div className="col-12 col-lg-8">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold border-bottom">
              <i className="bi bi-bar-chart-line text-primary me-2" />
              Daily Study Hours vs Target ({label})
            </div>
            <div className="card-body">
              <div className="chart-box" style={{ height: 260 }}>
                <ChartJS
                  type="bar"
                  data={{
                    labels: dates.map((d) => (period === 'week' ? shortDate(d) : String(parseDate(d).getDate()))),
                    datasets: [
                      {
                        type: 'bar',
                        label: 'Study Hours',
                        data: perDay.map(hoursNum),
                        backgroundColor: '#0f766e',
                        borderRadius: 4,
                        order: 2,
                      },
                      {
                        type: 'line',
                        label: 'Daily Target Goal',
                        data: dates.map(() => hoursNum(goalMin)),
                        borderColor: '#f59e0b',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        borderWidth: 2,
                        order: 1,
                      },
                    ],
                  }}
                  options={{
                    ...commonOpts,
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Hours' },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Time by Subject Doughnut */}
        <div className="col-12 col-lg-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold border-bottom">
              <i className="bi bi-pie-chart text-primary me-2" />
              Time by Subject
            </div>
            <div className="card-body">
              {withTime.length === 0 ? (
                <Empty icon="pie-chart">No study hours logged in this period.</Empty>
              ) : (
                <div className="chart-box" style={{ height: 260 }}>
                  <Doughnut
                    data={{
                      labels: withTime.map((r) => r.s.code || r.s.name),
                      datasets: [
                        {
                          data: withTime.map((r) => hoursNum(r.m)),
                          backgroundColor: withTime.map((r) => r.color),
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{
                      ...commonOpts,
                      plugins: {
                        legend: { position: 'bottom' },
                      },
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tables & Progress Cards */}
      <div className="row g-3">
        {/* Subject Performance Table */}
        <div className="col-12 col-lg-7">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold border-bottom d-flex justify-content-between align-items-center">
              <span>Subject Performance & Topics Completed</span>
              {mostStudied && mostStudied.m > 0 && (
                <span className="small text-secondary">
                  Most studied: <strong>{mostStudied.s.name}</strong> ({fmtHours(mostStudied.m)})
                </span>
              )}
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Subject</th>
                    <th>Category</th>
                    <th>Hours Studied</th>
                    <th style={{ width: '35%' }}>Topic Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {subjRows.length === 0 ? (
                    <tr>
                      <td colSpan="4">
                        <Empty icon="journal">No subjects added yet.</Empty>
                      </td>
                    </tr>
                  ) : (
                    subjRows.map((r) => (
                      <tr key={r.s.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: r.color,
                                flexShrink: 0,
                              }}
                            />
                            <div>
                              <div className="fw-semibold">{r.s.name}</div>
                              {r.s.code && <div className="small text-secondary">{r.s.code}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge text-bg-${r.s.category === 'exam' ? 'primary' : 'secondary'}`}>
                            {r.s.category === 'exam' ? 'Exam Prep' : 'College'}
                          </span>
                        </td>
                        <td className="fw-bold">{fmtHours(r.m)}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="flex-grow-1">
                              <ProgressBar value={r.pct} customColor={r.color} height={8} />
                            </div>
                            <span className="small text-secondary text-nowrap">
                              {r.done}/{r.totalTopics} ({r.pct}%)
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Task, Assignment & Project Completion Summary */}
        <div className="col-12 col-lg-5">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-transparent fw-bold border-bottom">
              Task, Assignment & Project Summary
            </div>
            <div className="card-body">
              {/* Study Tasks */}
              <div className="mb-3">
                <div className="d-flex justify-content-between small mb-1">
                  <span className="fw-semibold">Study Tasks</span>
                  <span>
                    <strong>{completedStudyTasks}</strong> / {studyTasks.length} completed
                  </span>
                </div>
                <ProgressBar
                  value={studyTasks.length ? (completedStudyTasks / studyTasks.length) * 100 : 0}
                  variant="primary"
                />
              </div>

              {/* Assignments */}
              <div className="mb-3">
                <div className="d-flex justify-content-between small mb-1">
                  <span className="fw-semibold">College Assignments</span>
                  <span>
                    <strong>{completedAssignments}</strong> / {assignments.length} submitted
                    {overdueAssignments > 0 && <span className="text-danger ms-1">({overdueAssignments} overdue)</span>}
                  </span>
                </div>
                <ProgressBar
                  value={assignments.length ? (completedAssignments / assignments.length) * 100 : 0}
                  variant={overdueAssignments > 0 ? 'warning' : 'success'}
                />
              </div>

              {/* Projects */}
              <div className="mb-3">
                <div className="d-flex justify-content-between small mb-1">
                  <span className="fw-semibold">Academic Projects</span>
                  <span>
                    <strong>{completedProjects}</strong> / {projects.length} completed
                  </span>
                </div>
                <ProgressBar
                  value={projects.length ? (completedProjects / projects.length) * 100 : 0}
                  variant="info"
                />
              </div>

              {/* Timetable Session Adherence */}
              <div className="mb-3 pt-2 border-top">
                <div className="d-flex justify-content-between small mb-1">
                  <span className="fw-semibold">Timetable Session Adherence</span>
                  <span>
                    <strong>{plannedDone}</strong> / {planned.length} sessions completed
                  </span>
                </div>
                <ProgressBar
                  value={planned.length ? (plannedDone / planned.length) * 100 : 0}
                  variant="success"
                />
              </div>

              {/* Project breakdown */}
              {projects.length > 0 && (
                <div className="mt-3 pt-2 border-top">
                  <div className="small fw-semibold text-secondary mb-2">Project Milestone Progress:</div>
                  {projects.map((p) => {
                    const ms = (data.tasks || []).filter((m) => m.parentId === p.id);
                    const completedM = ms.filter((m) => m.done).length;
                    const pct = ms.length ? Math.round((completedM / ms.length) * 100) : p.done ? 100 : 0;
                    return (
                      <div key={p.id} className="mb-2">
                        <div className="d-flex justify-content-between small text-secondary">
                          <span className="text-truncate" style={{ maxWidth: 220 }}>{p.title}</span>
                          <span>{pct}% ({completedM}/{ms.length})</span>
                        </div>
                        <ProgressBar value={pct} variant="primary" height={6} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
