/* ============================================================
   modules/progress.js — resumen, entrenos por semana, series por
   músculo, peso corporal (con promedio semanal) y medidas
   ============================================================ */
App.progress = (() => {
  const U = App.utils, S = App.store, UI = App.ui;
  const MEASURES = { waist: 'Cintura', chest: 'Pecho', arm: 'Brazo', thigh: 'Muslo', hips: 'Cadera', neck: 'Cuello', calf: 'Pantorrilla', bf: '% grasa' };
  let mKey = 'waist';

  const weeklyCounts = (n = 12) => {
    const start = U.weekStart(new Date()); const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const ws = new Date(start); ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      out.push({ label: U.fmtShortDate(ws), value: S.state.workouts.filter(w => { const d = new Date(w.start); return d >= ws && d < we; }).length });
    }
    return out;
  };
  const streak = () => { const wc = weeklyCounts(104).reverse(); let s = 0; for (let i = 0; i < wc.length; i++) { if (wc[i].value) s++; else if (i > 0) break; } return s; };

  const muscleSets = (days = 7) => {
    const since = Date.now() - days * 86400000, c = {};
    S.state.workouts.filter(w => new Date(w.start) >= since).forEach(w => w.exercises.forEach(e => {
      const n = S.doneSets(e).filter(s => s.type !== 'W').length;
      S.getEx(e.exId).pm.forEach(m => c[m] = (c[m] || 0) + n);
    }));
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  };

  /** Promedio móvil de 7 días del peso corporal */
  const rolling = (arr) => arr.map((p) => {
    const t = new Date(p.date).getTime();
    const win = arr.filter(q => { const u = new Date(q.date).getTime(); return u <= t && u > t - 7 * 86400000; });
    return { x: new Date(p.date), y: U.round(win.reduce((a, q) => a + q.kg, 0) / win.length, 2) };
  });

  const render = (el) => {
    const body = S.state.body, ms = S.state.measures;
    const lastW = body[body.length - 1];
    const avg = rolling(body);
    const thisWeek = weeklyCounts(1)[0].value;
    const mus = muscleSets(7), maxMus = Math.max(1, ...mus.map(m => m[1]));
    el.innerHTML = `<div class="tab-head"><h1>Progreso</h1></div>
      <div class="stats-grid">
        <div class="stat"><small>Entrenos totales</small><b>${S.state.workouts.length}</b></div>
        <div class="stat"><small>Esta semana</small><b>${thisWeek}</b></div>
        <div class="stat"><small>Racha (semanas)</small><b>${streak()}</b></div>
        <div class="stat"><small>Peso actual</small><b>${lastW ? U.round(lastW.kg, 1) + ' kg' : '—'}</b></div>
      </div>
      <div class="card"><div class="card-title">Entrenos por semana</div>${U.barChart(weeklyCounts(12))}</div>
      <div class="card"><div class="card-title">Series por músculo · últimos 7 días</div>
        ${mus.length ? mus.map(([m, n]) => `<div class="mbar"><span>${App.exercises.mus(m)}</span><div><i style="width:${n / maxMus * 100}%"></i></div><b>${n}</b></div>`).join('') : '<div class="empty small">Sin series esta semana</div>'}</div>
      <div class="card"><div class="card-title">Peso corporal <button class="btn small" data-a="add-w">＋ Registrar</button></div>
        ${U.lineChart(body.map(p => ({ x: new Date(p.date), y: p.kg })), { unit: 'kg', avg })}
        ${avg.length ? `<p class="muted small">Línea punteada = promedio de 7 días: <b>${avg[avg.length - 1].y} kg</b>. Fíjate en la tendencia, no en el día a día.</p>` : ''}
        <details><summary>Registros (${body.length})</summary>${[...body].reverse().map(p => `<div class="kv" data-id="${p.id}"><span>${U.fmtDate(p.date)}</span><b>${p.kg} kg <button class="icon-btn" data-a="del-w">✕</button></b></div>`).join('')}</details>
      </div>
      <div class="card"><div class="card-title">Medidas <button class="btn small" data-a="add-m">＋ Registrar</button></div>
        <div class="chips">${Object.entries(MEASURES).map(([k, v]) => `<button class="chip ${mKey === k ? 'on' : ''}" data-m="${k}">${v}</button>`).join('')}</div>
        ${U.lineChart(ms.filter(m => m[mKey] != null).map(m => ({ x: new Date(m.date), y: m[mKey] })), { unit: mKey === 'bf' ? '%' : 'cm' })}
        <details><summary>Registros (${ms.length})</summary>${[...ms].reverse().map(m => `<div class="kv" data-id="${m.id}"><span>${U.fmtDate(m.date)}</span><b>${Object.keys(MEASURES).filter(k => m[k] != null).map(k => `${MEASURES[k]} ${m[k]}`).join(' · ')} <button class="icon-btn" data-a="del-m">✕</button></b></div>`).join('')}</details>
      </div>`;
    el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mKey = b.dataset.m; render(el); });
    el.onclick = async (ev) => {
      const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
      const id = ev.target.closest('[data-id]')?.dataset.id;
      if (a === 'add-w') addWeight();
      if (a === 'add-m') addMeasure();
      if (a === 'del-w' && await UI.confirm('¿Eliminar registro de peso?', { danger: true, ok: 'Eliminar' })) S.deleteFromList('body', id), render(el);
      if (a === 'del-m' && await UI.confirm('¿Eliminar registro de medidas?', { danger: true, ok: 'Eliminar' })) S.deleteFromList('measures', id), render(el);
    };
  };

  const today = () => U.toLocalInput(new Date()).slice(0, 10);

  const addWeight = () => {
    const f = U.h(`<form class="form"><label class="field"><span>Fecha</span><input type="date" name="date" value="${today()}"></label>
      <label class="field"><span>Peso (kg)</span><input name="kg" inputmode="decimal" required placeholder="Ej. 156.4"></label>
      <p class="muted small">Pésate por la mañana, después de ir al baño y antes de comer o beber.</p>
      <button class="btn block">Guardar</button></form>`);
    const sh = UI.sheet(f, { title: 'Peso corporal' });
    f.onsubmit = (e) => { e.preventDefault(); const kg = parseFloat(f.kg.value.replace(',', '.')); if (!kg) return; S.upsertList('body', { id: U.uid(), date: new Date(f.date.value + 'T08:00').toISOString(), kg }); sh.close(); UI.refresh(); };
  };

  const addMeasure = () => {
    const f = U.h(`<form class="form"><label class="field"><span>Fecha</span><input type="date" name="date" value="${today()}"></label>
      <div class="grid2">${Object.entries(MEASURES).map(([k, v]) => `<label class="field"><span>${v} ${k === 'bf' ? '(%)' : '(cm)'}</span><input name="${k}" inputmode="decimal"></label>`).join('')}</div>
      <button class="btn block">Guardar</button></form>`);
    const sh = UI.sheet(f, { title: 'Medidas', tall: true });
    f.onsubmit = (e) => {
      e.preventDefault(); const m = { id: U.uid(), date: new Date(f.date.value + 'T08:00').toISOString() };
      Object.keys(MEASURES).forEach(k => { const v = parseFloat((f[k].value || '').replace(',', '.')); if (!isNaN(v)) m[k] = v; });
      S.upsertList('measures', m); sh.close(); UI.refresh();
    };
  };

  return { render };
})();
