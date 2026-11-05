import { addDays, daysBetween, dayOfWeek, toMin, toHHMM, uid, rangeDays, durMin } from './dates';
import { getSubjectColor } from './defaults';

const DIFF = { Easy: 1, Medium: 2, Hard: 3 };
const PRI = { Low: 1, Medium: 2, High: 3 };
const num = (v, d, min = 1) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : d;
};

export function isHoliday(data, date) {
  return data.holidays.find((h) => h.from <= date && date <= (h.to || h.from)) || null;
}

export function dayKind(data, date) {
  const h = isHoliday(data, date);
  if (h && h.type === 'unavailable') return 'unavailable';
  if (h) return 'holiday';
  const collegeDays = Array.isArray(data.settings?.collegeDays) ? data.settings.collegeDays : [1, 2, 3, 4, 5];
  return collegeDays.includes(dayOfWeek(date)) ? 'college' : 'holiday';
}

// Remove blocked [start,end] minute ranges from a list of windows.
function subtract(windows, blocks) {
  let res = windows;
  for (const [bs, be] of blocks) {
    const next = [];
    for (const [ws, we] of res) {
      if (be <= ws || bs >= we) {
        next.push([ws, we]);
        continue;
      }
      if (bs > ws) next.push([ws, bs]);
      if (be < we) next.push([be, we]);
    }
    res = next;
  }
  return res.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
}

// Free study windows for a date: availability minus sleep, commitments, meals and extra blocks.
export function freeWindows(data, date, extraBlocks = []) {
  const kind = dayKind(data, date);
  if (kind === 'unavailable') return { windows: [], meals: [] };
  const day = dayOfWeek(date);
  const s = data.settings || {};
  const av = (data.availability && data.availability[day]) || { college: [], holiday: [] };
  const raw = (kind === 'college' ? av.college : av.holiday) || [];
  let wins = raw
    .filter((w) => w.start && w.end && toMin(w.end) > toMin(w.start))
    .map((w) => [toMin(w.start), toMin(w.end)]);

  const sleepS = toMin(s.sleepStart || '23:00');
  const sleepE = toMin(s.sleepEnd || '06:30');
  const blocks = sleepS > sleepE ? [[0, sleepE], [sleepS, 1440]] : [[sleepS, sleepE]];

  (data.commitments || []).forEach((c) => {
    if ((c.day === 'all' || String(c.day) === String(day)) && c.start && c.end) {
      blocks.push([toMin(c.start), toMin(c.end)]);
    }
  });

  extraBlocks.forEach((b) => blocks.push(b));
  const base = subtract(wins, blocks);

  const meals = [];
  const mealBlocks = [];
  if (s.mealBreaks) {
    [
      ['Lunch break', s.lunchStart || '13:00', num(s.lunchDuration, 45)],
      ['Dinner break', s.dinnerStart || '20:00', num(s.dinnerDuration, 30)],
    ].forEach(([label, start, dur]) => {
      const ms = toMin(start);
      const host = base.find(([ws, we]) => ms >= ws && ms < we);
      if (host) {
        const me = Math.min(ms + dur, host[1]);
        meals.push({ label, start: ms, end: me });
        mealBlocks.push([ms, me]);
      }
    });
  }
  return { windows: subtract(base, mealBlocks), meals };
}

function buildItems(data, track, startDate, useShare) {
  const items = [];
  const exams = Object.fromEntries((data.exams || []).map((e) => [e.id, e]));
  const subjects = Object.fromEntries((data.subjects || []).map((s) => [s.id, s]));
  const share = num(data.settings?.examShare, 40, 0);
  const mult = (t) => (useShare ? (t === 'exam' ? share / 50 : (100 - share) / 50) : 1);

  (data.subjects || []).forEach((sub, idx) => {
    if (track !== 'both' && sub.category !== track) return;
    const ex = sub.examId ? exams[sub.examId] : null;
    const t = sub.topics || [];
    const done = t.filter((x) => x.done).length;
    const color = getSubjectColor(sub, idx);
    items.push({
      key: 's:' + sub.id,
      subjectId: sub.id,
      code: sub.code || '',
      color,
      taskId: '',
      title: sub.name,
      track: sub.category || 'college',
      difficulty: sub.difficulty || 'Medium',
      weight: (DIFF[sub.difficulty] || 2) * mult(sub.category || 'college'),
      examDate: ex ? ex.date : null,
      examType: ex ? ex.type : null,
      deadline: null,
      pending: t.filter((x) => !x.done).map((x) => x.name),
      allDone: t.length > 0 && done === t.length,
      topicFactor: t.length ? Math.max(0.3, (t.length - done) / t.length) : 1,
      maxMin: null,
    });
  });

  (data.tasks || []).forEach((task) => {
    if (task.done || !task.deadline) return;
    if (!['study', 'assignment', 'project', 'milestone'].includes(task.kind)) return;
    if (task.kind === 'project' && (data.tasks || []).some((m) => m.kind === 'milestone' && m.parentId === task.id && !m.done)) return;
    const sub = task.subjectId ? subjects[task.subjectId] : null;
    const tTrack = (sub && sub.category) || 'college';
    if (track !== 'both' && tTrack !== track) return;
    const color = sub ? getSubjectColor(sub) : '#0f766e';
    items.push({
      key: 't:' + task.id,
      subjectId: task.subjectId || '',
      code: sub?.code || '',
      color,
      taskId: task.id,
      title: task.title,
      track: tTrack,
      difficulty: sub?.difficulty || 'Medium',
      weight: (PRI[task.priority] || 2) * 1.5 * mult(tTrack),
      examDate: null,
      deadline: task.deadline,
      pending: [],
      allDone: false,
      topicFactor: 1,
      maxMin: Math.round(num(task.estimate, 2, 0.25) * 60),
      isAssignment: task.kind === 'assignment',
      isProjectMilestone: task.kind === 'milestone' || task.kind === 'project',
    });
  });

  return items;
}

function score(item, date, assignedMin) {
  let sc = item.weight;
  if (item.examDate) {
    const left = daysBetween(date, item.examDate);
    if (left < 0) return -1; // exam has passed
    // Priority boost as exam approaches
    sc *= 1 + 15 / (left + 1);
  }
  sc *= item.topicFactor;
  if (item.deadline) {
    const left = Math.max(0, daysBetween(date, item.deadline)); // overdue = most urgent
    sc *= 1 + 20 / (left + 1);
  }
  if (item.maxMin != null && assignedMin >= item.maxMin) return -1;
  return sc / (1 + assignedMin / 180);
}

/**
 * Rule-based timetable generator.
 * Keeps completed and manually edited sessions, regenerates the rest in the date range.
 */
export function generateTimetable(data, { startDate, days, track }) {
  const s = data.settings || {};
  const sessionMin = num(s.sessionMinutes, 50, 15);
  const shortB = num(s.shortBreak, 10, 0);
  const longB = num(s.longBreak, 30, 0);
  const longAfter = num(s.longAfter, 3, 1);
  const dailyGoalMin = num(s.dailyGoal, 4, 0.5) * 60;
  const maxDailyMin = num(s.maxDailyHours, 8, 1) * 60;
  const minSess = Math.min(20, sessionMin);

  const dates = rangeDays(startDate, days);
  const inRange = new Set(dates);
  const keep = (data.sessions || []).filter((x) => !inRange.has(x.date) || x.done || x.locked);
  const items = buildItems(data, track, startDate, track === 'both');
  const warnings = [];

  if (!items.length) {
    return {
      sessions: data.sessions || [],
      created: 0,
      warnings: ['Add subjects, or tasks with deadlines, before generating a timetable.'],
    };
  }

  const assigned = {};
  const counts = {};
  keep.forEach((x) => {
    if (x.kind !== 'study') return;
    const key = x.taskId ? 't:' + x.taskId : 's:' + x.subjectId;
    if (inRange.has(x.date) || (x.taskId && x.date < startDate)) {
      assigned[key] = (assigned[key] || 0) + durMin(x);
    }
  });

  const out = [];
  const mk = (date, a, b, extra) => ({
    id: uid(),
    date,
    start: toHHMM(a),
    end: toHHMM(b),
    done: false,
    locked: false,
    subjectId: '',
    taskId: '',
    topic: '',
    label: '',
    track: '',
    ...extra,
  });

  for (const date of dates) {
    const isHolidayDay = dayKind(data, date) === 'holiday';
    const dayKept = keep.filter((x) => x.date === date);
    const extra = dayKept.map((x) => [toMin(x.start), toMin(x.end)]);
    const { windows, meals } = freeWindows(data, date, extra);
    let studyMin = dayKept.filter((x) => x.kind === 'study').reduce((t, x) => t + durMin(x), 0);

    // On holidays, students can allocate up to maxDailyMin or an expanded goal
    const effectiveGoal = isHolidayDay ? Math.min(maxDailyMin, Math.max(dailyGoalMin, dailyGoalMin * 1.25)) : dailyGoalMin;

    meals.forEach((m) => {
      if (!extra.some(([a, b]) => m.start < b && m.end > a)) {
        out.push(mk(date, m.start, m.end, { kind: 'break', breakKind: 'meal', title: m.label }));
      }
    });

    let sinceLong = 0;
    let lastKey = null;
    let stop = false;

    for (const [ws, we] of windows) {
      if (stop) break;
      let cur = ws;
      while (we - cur >= minSess && studyMin < effectiveGoal && studyMin < maxDailyMin) {
        const len = Math.min(sessionMin, we - cur, effectiveGoal - studyMin, maxDailyMin - studyMin);
        if (len < 15) break;

        let best = null;
        let bestScore = 0;

        for (const it of items) {
          let sc = score(it, date, assigned[it.key] || 0);
          if (sc <= 0) continue;
          if (it.key === lastKey) sc *= 0.5; // Avoid scheduling the same subject back-to-back
          if (sc > bestScore) {
            best = it;
            bestScore = sc;
          }
        }

        if (!best) {
          stop = true;
          break;
        }

        const left = best.examDate ? daysBetween(date, best.examDate) : null;
        const n = counts[best.key] || 0;

        // Determine session label tag
        let label = 'Topic Study';
        if (best.isAssignment) label = 'Assignment Work';
        else if (best.isProjectMilestone) label = 'Project Work';
        else if (best.allDone) label = 'Revision';
        else if (left !== null && left <= 5) label = 'Exam Revision';
        else if (best.track === 'exam') {
          // Competitive exam sessions cycle through preparation modes
          const examModes = ['Topic Study', 'Practice Questions', 'Mock Test', 'Revision', 'PYQ Practice'];
          label = examModes[n % examModes.length];
        } else if (isHolidayDay && (best.difficulty === 'Hard' || n % 3 === 0)) {
          label = 'Practice & Revision';
        }

        out.push(
          mk(date, cur, cur + len, {
            kind: 'study',
            subjectId: best.subjectId,
            taskId: best.taskId,
            title: best.title,
            topic: !best.allDone && best.pending.length ? best.pending[n % best.pending.length] : (label.includes('PYQ') ? 'Previous Years Questions' : label.includes('Mock') ? 'Timed Practice Test' : 'Comprehensive Review'),
            label,
            track: best.track,
            color: best.color,
          })
        );

        counts[best.key] = n + 1;
        assigned[best.key] = (assigned[best.key] || 0) + len;
        studyMin += len;
        cur += len;
        lastKey = best.key;
        sinceLong += 1;

        const isLong = sinceLong % longAfter === 0;
        const brLen = isLong ? longB : shortB;

        if (studyMin < effectiveGoal && brLen > 0 && we - (cur + brLen) >= minSess) {
          out.push(
            mk(date, cur, cur + brLen, {
              kind: 'break',
              breakKind: isLong ? 'long' : 'short',
              title: isLong ? 'Long break' : 'Short break',
            })
          );
          cur += brLen;
        } else if (brLen > 0 && studyMin < effectiveGoal) {
          break;
        }
      }
    }

    if (dayKind(data, date) !== 'unavailable' && dailyGoalMin - studyMin >= 30 && dates.length <= 31) {
      warnings.push(`${date}: ${(studyMin / 60).toFixed(1)}h of ${(dailyGoalMin / 60).toFixed(1)}h daily target fits within configured available hours.`);
    }
  }

  const sessions = [...keep, ...out].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return {
    sessions,
    created: out.filter((x) => x.kind === 'study').length,
    warnings: warnings.slice(0, 6),
  };
}

export function studyMinutes(sessions, filter = () => true) {
  return (sessions || []).filter((x) => x.kind === 'study' && filter(x)).reduce((t, x) => t + durMin(x), 0);
}

export function overlaps(sessions, cand) {
  const a = toMin(cand.start);
  const b = toMin(cand.end);
  return (sessions || []).find(
    (x) => x.id !== cand.id && x.date === cand.date && a < toMin(x.end) && b > toMin(x.start)
  );
}

export { addDays };
