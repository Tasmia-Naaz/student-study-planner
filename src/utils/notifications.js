import { daysBetween, fmtDate, fmtTime, shortDate, toMin } from './dates';

// Build the list of reminders shown in the bell menu and dashboard.
export function getReminders(data, now = new Date()) {
  const today = fmtDate(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  const out = [];

  // Overdue and upcoming task & assignment deadlines
  (data.tasks || [])
    .filter((t) => !t.done && t.deadline)
    .forEach((t) => {
      const left = daysBetween(today, t.deadline);
      const isAssignment = t.kind === 'assignment';
      const isMilestone = t.kind === 'milestone';
      const prefix = isAssignment ? 'Assignment' : isMilestone ? 'Milestone' : 'Task';

      if (left < 0) {
        out.push({
          id: 'o' + t.id,
          level: 'danger',
          icon: 'exclamation-octagon',
          text: `Overdue: ${prefix} "${t.title}" (was due ${shortDate(t.deadline)})`,
          sort: left,
        });
      } else if (left <= 3) {
        out.push({
          id: 'd' + t.id,
          level: 'warning',
          icon: 'alarm',
          text: `Urgent: ${prefix} "${t.title}" is due ${left === 0 ? 'today' : left === 1 ? 'tomorrow' : 'in ' + left + ' days'}`,
          sort: left,
        });
      } else if (left <= 7) {
        out.push({
          id: 'd' + t.id,
          level: 'info',
          icon: 'calendar-event',
          text: `${prefix} "${t.title}" deadline in ${left} days (${shortDate(t.deadline)})`,
          sort: left,
        });
      }
    });

  // Upcoming examinations
  (data.exams || []).forEach((e) => {
    const left = daysBetween(today, e.date);
    if (left < 0) return; // Passed exam
    if (left === 0) {
      out.push({
        id: 'e' + e.id,
        level: 'danger',
        icon: 'mortarboard-fill',
        text: `TODAY: ${e.name} (${e.type} Examination)`,
        sort: 0,
      });
    } else if (left <= 3) {
      out.push({
        id: 'e' + e.id,
        level: 'warning',
        icon: 'mortarboard',
        text: `Urgent: ${e.name} is ${left === 1 ? 'tomorrow' : 'in ' + left + ' days'}!`,
        sort: left,
      });
    } else if (left <= 7) {
      out.push({
        id: 'e' + e.id,
        level: 'warning',
        icon: 'mortarboard',
        text: `Exam approaching: ${e.name} in ${left} days (${shortDate(e.date)})`,
        sort: left,
      });
    } else if (left <= 30) {
      out.push({
        id: 'e' + e.id,
        level: 'info',
        icon: 'calendar2-check',
        text: `${e.name} in ${left} days (${shortDate(e.date)})`,
        sort: left,
      });
    }
  });

  // Today's upcoming study sessions
  (data.sessions || [])
    .filter((s) => s.date === today && s.kind === 'study' && !s.done && toMin(s.end) > mins && toMin(s.start) - mins <= 120)
    .forEach((s) => {
      out.push({
        id: 's' + s.id,
        level: 'info',
        icon: 'clock',
        text: `Upcoming Study: ${s.title} at ${fmtTime(s.start, data.settings?.timeFormat || '12h')}`,
        sort: toMin(s.start) - mins,
      });
    });

  const rank = { danger: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level] || a.sort - b.sort);
}
