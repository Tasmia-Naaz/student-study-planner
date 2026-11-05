import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { defaultData } from '../utils/defaults';
import { durMin, uid } from '../utils/dates';

const KEY = 'studyPlanner.v1';
const Ctx = createContext(null);
const LISTS = ['commitments', 'holidays', 'subjects', 'exams', 'tasks', 'sessions', 'logs'];

export function normalize(raw) {
  const base = defaultData();
  const d = raw && typeof raw === 'object' ? raw : {};
  const out = {
    ...base,
    ...d,
    profile: { ...base.profile, ...(d.profile || {}) },
    settings: { ...base.settings, ...(d.settings || {}) },
    availability: { ...base.availability, ...(d.availability || {}) },
  };
  LISTS.forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!Array.isArray(out.settings.collegeDays)) out.settings.collegeDays = [1, 2, 3, 4, 5];
  return out;
}

function load() {
  try {
    const text = localStorage.getItem(KEY);
    return text ? normalize(JSON.parse(text)) : defaultData();
  } catch {
    return defaultData();
  }
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(load);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [data]);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', data.settings.theme);
  }, [data.settings.theme]);

  const api = useMemo(() => ({
    data,
    saveError,
    setData,
    patch: (key, value) => setData((d) => ({ ...d, [key]: typeof value === 'function' ? value(d[key]) : value })),
    setSetting: (key, value) => setData((d) => ({ ...d, settings: { ...d.settings, [key]: value } })),
    upsert: (key, item) => setData((d) => {
      const list = d[key];
      const exists = list.some((x) => x.id === item.id);
      return { ...d, [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] };
    }),
    remove: (key, id) => setData((d) => ({ ...d, [key]: d[key].filter((x) => x.id !== id) })),
    // Marking a study session done also records the time in the daily progress log.
    toggleSession: (id) => setData((d) => {
      const s = d.sessions.find((x) => x.id === id);
      if (!s || s.kind !== 'study') return d;
      const done = !s.done;
      const sessions = d.sessions.map((x) => (x.id === id ? { ...x, done } : x));
      let logs = d.logs.filter((l) => l.sessionId !== id);
      if (done) {
        logs = [...logs, { id: uid(), sessionId: id, date: s.date, subjectId: s.subjectId || '', minutes: durMin(s), topics: s.topic || s.title || '', notes: 'Completed from timetable' }];
      }
      return { ...d, sessions, logs };
    }),
  }), [data, saveError]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
