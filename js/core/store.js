/* ============================================================
   core/store.js — estado de la app, consultas y respaldo/importación
   Todos los pesos se guardan en KG. La unidad sólo afecta la vista.
   ============================================================ */
App.store = (() => {
  const U = App.utils;
  const SCHEMA = 1;
  const KEYS = ['workouts', 'templates', 'customExercises', 'exMeta', 'body', 'measures', 'settings', 'active', 'tombstones', 'meta'];
  const DEFAULT_SETTINGS = {
    unit: 'kg', rest: 90, barKg: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], sound: true,
    theme: 'dark', showEs: true,
  };

  const s = {
    workouts: [], templates: [], customExercises: [], exMeta: {}, body: [], measures: [],
    settings: { ...DEFAULT_SETTINGS }, active: null, tombstones: {}, meta: {},
  };
  let catalog = new Map();
  const listeners = new Set();

  /* ---------- carga y guardado ---------- */
  const load = async () => {
    for (const k of KEYS) {
      const v = await App.db.get(k);
      if (v != null) s[k] = v;
    }
    s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
    rebuildCatalog();
    if (!s.meta.seeded && !s.workouts.length && window.SEED_HISTORY) {
      s.workouts = window.SEED_HISTORY.map(w => ({ ...w, updated: Date.now() }));
      s.meta.seeded = true;
      await save('workouts'); await save('meta');
    }
  };

  const timers = {};
  const save = (key) => {
    clearTimeout(timers[key]);
    return new Promise(res => { timers[key] = setTimeout(async () => { await App.db.set(key, s[key]); res(); }, 120); });
  };
  const saveNow = (key) => App.db.set(key, s[key]);
  const emit = () => listeners.forEach(fn => fn());
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  /* ---------- catálogo de ejercicios ---------- */
  const rebuildCatalog = () => {
    catalog = new Map();
    (window.EXERCISE_DB || []).forEach(e => catalog.set(e.id, e));
    s.customExercises.forEach(e => catalog.set(e.id, { ...e, custom: true }));
  };
  const getEx = (id) => {
    const base = catalog.get(id) || { id, name: id, es: '', eq: 'Other', type: 'weight_reps', pm: [], sm: [], img: [], ins: [], missing: true };
    const m = s.exMeta[id];
    return m ? { ...base, es: m.es || base.es, media: m.media || base.media } : base;
  };
  const allExercises = () => [...catalog.values()].map(e => getEx(e.id));
  const unitFor = (exId) => (s.exMeta[exId] && s.exMeta[exId].unit) || s.settings.unit;
  const restFor = (exId) => (s.exMeta[exId] && s.exMeta[exId].rest) || s.settings.rest;
  const setExMeta = (exId, patch) => { s.exMeta[exId] = { ...(s.exMeta[exId] || {}), ...patch }; save('exMeta'); emit(); };

  const saveCustomExercise = (ex) => {
    const i = s.customExercises.findIndex(e => e.id === ex.id);
    ex.updated = Date.now();
    if (i >= 0) s.customExercises[i] = ex; else s.customExercises.push(ex);
    rebuildCatalog(); save('customExercises'); emit();
  };
  const deleteCustomExercise = (id) => {
    s.customExercises = s.customExercises.filter(e => e.id !== id);
    s.tombstones[id] = Date.now();
    rebuildCatalog(); save('customExercises'); save('tombstones'); emit();
  };

  /* ---------- entrenamientos ---------- */
  const sortedWorkouts = () => [...s.workouts].sort((a, b) => new Date(b.start) - new Date(a.start));
  const getWorkout = (id) => s.workouts.find(w => w.id === id);
  const upsertWorkout = (w) => {
    w.updated = Date.now();
    const i = s.workouts.findIndex(x => x.id === w.id);
    if (i >= 0) s.workouts[i] = w; else s.workouts.push(w);
    save('workouts'); emit();
  };
  const deleteWorkout = (id) => {
    s.workouts = s.workouts.filter(w => w.id !== id);
    s.tombstones[id] = Date.now();
    save('workouts'); save('tombstones'); emit();
  };
  const setActive = (w) => { s.active = w; saveNow('active'); emit(); };
  const touchActive = () => save('active');

  /** Series completadas válidas */
  const doneSets = (entry) => entry.sets.filter(st => st.done !== false);

  /** Historial de un ejercicio: [{workout, entry}] del más reciente al más antiguo */
  const sessionsFor = (exId, { excludeId } = {}) => {
    const out = [];
    for (const w of sortedWorkouts()) {
      if (w.id === excludeId) continue;
      for (const e of w.exercises) if (e.exId === exId && doneSets(e).length) out.push({ workout: w, entry: e });
    }
    return out;
  };
  const previousSets = (exId, excludeId) => { const p = sessionsFor(exId, { excludeId })[0]; return p ? doneSets(p.entry) : []; };

  const setVolume = (st) => (st.w > 0 && st.r) ? st.w * st.r : 0;

  /** Récords de un ejercicio (opcionalmente excluyendo un entreno) */
  const recordsFor = (exId, excludeId) => {
    const r = { maxW: 0, maxE1rm: 0, maxSetVol: 0, maxSessionVol: 0, maxReps: 0, totalReps: 0, totalSets: 0, sessions: 0, repBests: {}, maxDist: 0, maxTime: 0 };
    for (const { entry } of sessionsFor(exId, { excludeId })) {
      r.sessions++;
      let vol = 0;
      for (const st of doneSets(entry)) {
        if (st.type === 'W') continue; // calentamientos no cuentan
        r.totalSets++; r.totalReps += st.r || 0;
        r.maxW = Math.max(r.maxW, st.w || 0);
        r.maxReps = Math.max(r.maxReps, st.r || 0);
        if (st.r && st.r <= 12) r.maxE1rm = Math.max(r.maxE1rm, U.e1rm(st.w, st.r));
        r.maxSetVol = Math.max(r.maxSetVol, setVolume(st));
        r.maxDist = Math.max(r.maxDist, st.d || 0);
        r.maxTime = Math.max(r.maxTime, st.t || 0);
        if (st.r && st.w > 0) r.repBests[st.r] = Math.max(r.repBests[st.r] || 0, st.w);
        vol += setVolume(st);
      }
      r.maxSessionVol = Math.max(r.maxSessionVol, vol);
    }
    return r;
  };

  /** Detecta récords nuevos de un entreno comparando contra todo lo anterior a él */
  const prsInWorkout = (w) => {
    const prs = [];
    for (const e of w.exercises) {
      const ex = getEx(e.exId);
      if (ex.type !== 'weight_reps') continue;
      // sólo contra entrenos anteriores a éste
      const prev = { maxW: 0, maxE1rm: 0, maxSetVol: 0 };
      for (const { workout, entry } of sessionsFor(e.exId, { excludeId: w.id })) {
        if (new Date(workout.start) >= new Date(w.start)) continue;
        for (const st of doneSets(entry)) {
          if (st.type === 'W') continue;
          prev.maxW = Math.max(prev.maxW, st.w || 0);
          if (st.r <= 12) prev.maxE1rm = Math.max(prev.maxE1rm, U.e1rm(st.w, st.r));
          prev.maxSetVol = Math.max(prev.maxSetVol, setVolume(st));
        }
      }
      const hadHistory = prev.maxW > 0;
      let bW = 0, bE = 0, bV = 0;
      for (const st of doneSets(e)) {
        if (st.type === 'W') continue;
        bW = Math.max(bW, st.w || 0);
        if (st.r <= 12) bE = Math.max(bE, U.e1rm(st.w, st.r));
        bV = Math.max(bV, setVolume(st));
      }
      if (!hadHistory) continue;
      const kinds = [];
      if (bW > prev.maxW) kinds.push('Peso máx.');
      if (bE > prev.maxE1rm + 0.01) kinds.push('1RM est.');
      if (bV > prev.maxSetVol) kinds.push('Volumen');
      if (kinds.length) prs.push({ exId: e.exId, kinds });
    }
    return prs;
  };

  const workoutStats = (w) => {
    let vol = 0, sets = 0;
    w.exercises.forEach(e => doneSets(e).forEach(st => { sets++; vol += setVolume(st); }));
    const dur = w.end ? (new Date(w.end) - new Date(w.start)) / 1000 : null;
    return { vol, sets, dur };
  };

  /* ---------- plantillas ---------- */
  const upsertTemplate = (t) => {
    t.updated = Date.now();
    const i = s.templates.findIndex(x => x.id === t.id);
    if (i >= 0) s.templates[i] = t; else s.templates.push(t);
    save('templates'); emit();
  };
  const deleteTemplate = (id) => { s.templates = s.templates.filter(t => t.id !== id); s.tombstones[id] = Date.now(); save('templates'); save('tombstones'); emit(); };
  const templateFromWorkout = (w, name) => ({
    id: U.uid(), name: name || w.name, folder: '', notes: '',
    exercises: w.exercises.map(e => ({
      exId: e.exId, group: e.group || null, notes: e.notes || '',
      sets: (doneSets(e).length ? doneSets(e) : e.sets).map(st => ({ type: st.type || 'N', w: st.w ?? null, r: st.r ?? null, d: st.d ?? null, t: st.t ?? null })),
    })),
  });

  /* ---------- cuerpo y medidas ---------- */
  const upsertList = (key, item) => {
    item.updated = Date.now();
    const i = s[key].findIndex(x => x.id === item.id);
    if (i >= 0) s[key][i] = item; else s[key].push(item);
    s[key].sort((a, b) => new Date(a.date) - new Date(b.date));
    save(key); emit();
  };
  const deleteFromList = (key, id) => { s[key] = s[key].filter(x => x.id !== id); s.tombstones[id] = Date.now(); save(key); save('tombstones'); emit(); };

  const setSetting = (k, v) => { s.settings[k] = v; save('settings'); emit(); };

  /* ---------- respaldo / importación ---------- */
  const exportData = () => ({
    app: 'GymLog', schema: SCHEMA, exportedAt: new Date().toISOString(),
    workouts: s.workouts, templates: s.templates, customExercises: s.customExercises, exMeta: s.exMeta,
    body: s.body, measures: s.measures, settings: s.settings, tombstones: s.tombstones,
  });

  const mergeById = (local, incoming, tomb) => {
    const map = new Map(local.map(x => [x.id, x]));
    for (const x of incoming || []) {
      const cur = map.get(x.id);
      if (!cur || (x.updated || 0) > (cur.updated || 0)) map.set(x.id, x);
    }
    return [...map.values()].filter(x => !(tomb[x.id] && tomb[x.id] >= (x.updated || 0)));
  };

  /** mode: 'merge' (combina, gana lo más reciente) o 'replace' (reemplaza todo) */
  const importData = async (data, mode = 'merge') => {
    if (!data || data.app !== 'GymLog') throw new Error('El archivo no es un respaldo de GymLog');
    if (mode === 'replace') {
      ['workouts', 'templates', 'customExercises', 'body', 'measures'].forEach(k => s[k] = data[k] || []);
      s.exMeta = data.exMeta || {}; s.tombstones = data.tombstones || {};
      s.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    } else {
      s.tombstones = { ...s.tombstones, ...(data.tombstones || {}) };
      ['workouts', 'templates', 'customExercises', 'body', 'measures'].forEach(k => s[k] = mergeById(s[k], data[k], s.tombstones));
      s.exMeta = { ...(data.exMeta || {}), ...s.exMeta };
    }
    s.meta.seeded = true;
    rebuildCatalog();
    for (const k of KEYS) await App.db.set(k, s[k]);
    emit();
  };

  const markBackup = () => { s.meta.lastBackup = new Date().toISOString(); save('meta'); };

  /** CSV compatible con el formato de exportación de Strong */
  const exportCSV = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = ['Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Weight Unit,Reps,Distance,Seconds,Notes,Workout Notes,RPE'];
    for (const w of sortedWorkouts().reverse()) {
      const d = new Date(w.start), st = workoutStats(w);
      const date = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())} ${U.pad(d.getHours())}:${U.pad(d.getMinutes())}:00`;
      for (const e of w.exercises) {
        doneSets(e).forEach((set, i) => {
          const order = set.type === 'W' ? 'W' : set.type === 'D' ? 'D' : String(i + 1);
          rows.push([q(date), q(w.name), q(st.dur ? Math.round(st.dur / 60) + 'm' : ''), q(getEx(e.exId).name), order,
            set.w ?? '', 'kg', set.r ?? '', set.d ?? '', set.t ?? '', q(e.notes), q(w.notes), set.rpe ?? ''].join(','));
        });
      }
    }
    return rows.join('\n');
  };

  /** Importa un CSV exportado por Strong (crea ejercicios personalizados si no existen) */
  const importStrongCSV = (text) => {
    const parse = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',' || c === ';') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const head = parse(lines[0]).map(x => x.trim().toLowerCase());
    const col = (n) => head.indexOf(n);
    const byName = new Map(allExercises().map(e => [U.norm(e.name), e.id]));
    const groups = new Map();
    for (const line of lines.slice(1)) {
      const c = parse(line);
      const date = c[col('date')], wname = c[col('workout name')], exName = c[col('exercise name')];
      if (!date || !exName) continue;
      let exId = byName.get(U.norm(exName));
      if (!exId) {
        exId = 'c_' + U.uid();
        const ex = { id: exId, name: exName, es: '', eq: 'Other', cat: 'strength', type: 'weight_reps', pm: [], sm: [], img: [], ins: [] };
        s.customExercises.push(ex); byName.set(U.norm(exName), exId); rebuildCatalog();
      }
      const key = date + '|' + wname;
      if (!groups.has(key)) groups.set(key, { id: U.uid(), name: wname, start: new Date(date.replace(' ', 'T')).toISOString(), end: null, notes: c[col('workout notes')] || '', exercises: [] });
      const w = groups.get(key);
      let entry = w.exercises[w.exercises.length - 1];
      if (!entry || entry.exId !== exId) { entry = { id: U.uid(), exId, notes: c[col('notes')] || '', sets: [] }; w.exercises.push(entry); }
      const order = (c[col('set order')] || '').toUpperCase();
      let wt = parseFloat(c[col('weight')]); const unit = (c[col('weight unit')] || 'kg').toLowerCase();
      if (!isNaN(wt) && unit.startsWith('lb')) wt *= U.KG_PER_LB;
      const dur = c[col('duration')] || '';
      if (!w.end && dur) { const m = dur.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/); const min = (+m[1] || 0) * 60 + (+m[2] || 0); if (min) w.end = new Date(new Date(w.start).getTime() + min * 60000).toISOString(); }
      entry.sets.push({ id: U.uid(), type: order === 'W' ? 'W' : order === 'D' ? 'D' : order === 'F' ? 'F' : 'N', w: isNaN(wt) ? null : wt, r: parseInt(c[col('reps')]) || null, d: parseFloat(c[col('distance')]) || null, t: parseInt(c[col('seconds')]) || null, rpe: parseFloat(c[col('rpe')]) || null, done: true });
    }
    const incoming = [...groups.values()].map(w => ({ ...w, updated: Date.now() }));
    s.workouts = mergeById(s.workouts, incoming, s.tombstones);
    save('workouts'); save('customExercises'); emit();
    return incoming.length;
  };

  return {
    state: s, load, save, saveNow, subscribe, emit,
    getEx, allExercises, unitFor, restFor, setExMeta, saveCustomExercise, deleteCustomExercise,
    sortedWorkouts, getWorkout, upsertWorkout, deleteWorkout, setActive, touchActive,
    doneSets, sessionsFor, previousSets, recordsFor, prsInWorkout, workoutStats, setVolume,
    upsertTemplate, deleteTemplate, templateFromWorkout,
    upsertList, deleteFromList, setSetting,
    exportData, importData, markBackup, exportCSV, importStrongCSV,
  };
})();
