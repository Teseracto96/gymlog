/* ============================================================
   modules/history.js — historial (lista por mes y calendario)
   ============================================================ */
App.history = (() => {
  const U = App.utils, S = App.store, UI = App.ui;
  let view = 'list', calMonth = null;

  const bestSet = (entry, ex) => {
    const ss = S.doneSets(entry).filter(s => s.type !== 'W');
    if (!ss.length) return null;
    if (ex.type === 'weight_reps') return ss.reduce((b, s) => U.e1rm(s.w, s.r) > U.e1rm(b.w, b.r) ? s : b);
    return ss[ss.length - 1];
  };

  const card = (w) => {
    const st = S.workoutStats(w), prs = S.prsInWorkout(w);
    return `<div class="card wk-card" data-id="${w.id}">
      <div class="card-title">${U.esc(w.name)}<small>${U.fmtDate(w.start, { time: true })}</small></div>
      <div class="wk-stats"><span>⏱ ${U.fmtDuration(st.dur)}</span><span>🏋️ ${Math.round(st.vol).toLocaleString()} kg</span><span>${st.sets} series</span>${prs.length ? `<span class="pr">⭐ ${prs.length} PR</span>` : ''}</div>
      <div class="wk-ex">${w.exercises.map(e => { const ex = S.getEx(e.exId), b = bestSet(e, ex); return `<div class="wk-ex-row"><span>${S.doneSets(e).length} × ${U.esc(ex.name)}</span><small>${b ? App.exercises.fmtSet(b, ex, S.unitFor(e.exId)) : ''}</small></div>`; }).join('')}</div>
    </div>`;
  };

  const render = (el) => {
    const ws = S.sortedWorkouts();
    el.innerHTML = `<div class="tab-head"><h1>Historial</h1>
      <div class="seg mini"><button data-v="list" class="${view === 'list' ? 'on' : ''}">Lista</button><button data-v="cal" class="${view === 'cal' ? 'on' : ''}">Calendario</button></div></div>
      <div class="hist-body"></div>`;
    el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; render(el); });
    const body = el.querySelector('.hist-body');
    if (!ws.length) { body.innerHTML = `<div class="empty">Aquí aparecerán tus entrenos terminados.</div>`; return; }
    if (view === 'list') {
      let html = '', cur = '';
      ws.forEach(w => {
        const d = new Date(w.start), key = U.monthLabel(d.getFullYear(), d.getMonth());
        if (key !== cur) { const n = ws.filter(x => { const y = new Date(x.start); return y.getMonth() === d.getMonth() && y.getFullYear() === d.getFullYear(); }).length; html += `<h3 class="month">${key} <small>${n} entrenos</small></h3>`; cur = key; }
        html += card(w);
      });
      body.innerHTML = html;
    } else {
      calMonth = calMonth || (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();
      const { y, m } = calMonth;
      const byDay = {}; ws.forEach(w => (byDay[U.dayKey(w.start)] = byDay[U.dayKey(w.start)] || []).push(w));
      const first = new Date(y, m, 1), offset = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
      let cells = '';
      for (let i = 0; i < offset; i++) cells += `<div></div>`;
      for (let d = 1; d <= days; d++) {
        const k = `${y}-${U.pad(m + 1)}-${U.pad(d)}`, has = byDay[k];
        const today = k === U.dayKey(new Date());
        cells += `<button class="cal-day ${has ? 'has' : ''} ${today ? 'today' : ''}" data-k="${k}">${d}</button>`;
      }
      const monthWs = ws.filter(w => { const d = new Date(w.start); return d.getFullYear() === y && d.getMonth() === m; });
      body.innerHTML = `<div class="cal">
        <div class="cal-head"><button class="icon-btn" data-m="-1">‹</button><b>${U.monthLabel(y, m)}</b><button class="icon-btn" data-m="1">›</button></div>
        <div class="cal-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<small>${d}</small>`).join('')}${cells}</div>
        <p class="muted center">${monthWs.length} entrenos este mes</p></div>
        <div class="cal-list">${monthWs.map(card).join('')}</div>`;
      body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { let nm = m + +b.dataset.m, ny = y; if (nm < 0) { nm = 11; ny--; } if (nm > 11) { nm = 0; ny++; } calMonth = { y: ny, m: nm }; render(el); });
      body.querySelectorAll('.cal-day.has').forEach(b => b.onclick = () => { const w = byDay[b.dataset.k]; if (w.length === 1) open(w[0]); else body.querySelector('.cal-list').innerHTML = w.map(card).join(''); bindCards(body); });
    }
    bindCards(body);
  };

  const bindCards = (root) => root.querySelectorAll('.wk-card').forEach(c => c.onclick = () => open(S.getWorkout(c.dataset.id)));

  const open = (w) => {
    const pg = UI.page(w.name, { right: `<button class="icon-btn more">⋯</button>` });
    const draw = () => {
      w = S.getWorkout(w.id) || w;
      const st = S.workoutStats(w), prs = S.prsInWorkout(w);
      const prMap = Object.fromEntries(prs.map(p => [p.exId, p.kinds]));
      pg.body.innerHTML = `<p class="subtitle">${U.fmtDate(w.start, { time: true })}</p>
        <div class="stats-grid">
          <div class="stat"><small>Duración</small><b>${U.fmtDuration(st.dur)}</b></div>
          <div class="stat"><small>Volumen</small><b>${Math.round(st.vol).toLocaleString()} kg</b></div>
          <div class="stat"><small>Series</small><b>${st.sets}</b></div>
          <div class="stat"><small>Récords</small><b>${prs.length}</b></div></div>
        ${w.notes ? `<p class="note">${U.esc(w.notes)}</p>` : ''}
        ${w.exercises.map(e => { const ex = S.getEx(e.exId), unit = S.unitFor(e.exId); let n = 0; return `<div class="card">
          <div class="card-title link" data-ex="${e.exId}">${App.exercises.label(ex)}${prMap[e.exId] ? `<small class="pr">⭐ ${prMap[e.exId].join(' · ')}</small>` : ''}</div>
          ${S.doneSets(e).map(s => `<div class="set-line"><span class="set-tag ${s.type || 'N'}">${!s.type || s.type === 'N' ? ++n : s.type}</span>${App.exercises.fmtSet(s, ex, unit)}${s.rpe ? `<small>RPE ${s.rpe}</small>` : ''}${ex.type === 'weight_reps' && s.w > 0 && s.r <= 12 ? `<small>1RM ${U.round(U.toUnit(U.e1rm(s.w, s.r), unit), 1)}</small>` : ''}</div>`).join('')}
          ${e.notes ? `<p class="note">${U.esc(e.notes)}</p>` : ''}</div>`; }).join('')}`;
      pg.body.querySelectorAll('[data-ex]').forEach(t => t.onclick = () => App.exercises.openDetail(t.dataset.ex));
    };
    pg.el.querySelector('.more').onclick = () => UI.actions([
      { label: 'Editar entreno', onClick: () => App.workout.editPast(w, () => { if (!S.getWorkout(w.id)) pg.close(); else { pg.setTitle(S.getWorkout(w.id).name); draw(); } }) },
      { label: 'Repetir este entreno', onClick: () => { pg.close(); App.workout.start({ ...S.templateFromWorkout(w), id: null }); } },
      { label: 'Guardar como plantilla', onClick: async () => { const n = await UI.prompt('Nombre de la plantilla', w.name); if (n) { S.upsertTemplate(S.templateFromWorkout(w, n)); UI.toast('Plantilla creada'); } } },
      { label: 'Eliminar entreno', danger: true, onClick: async () => { if (await UI.confirm('¿Eliminar este entreno?', { danger: true, ok: 'Eliminar' })) { S.deleteWorkout(w.id); pg.close(); UI.refresh(); } } },
    ]);
    draw();
  };

  return { render, open };
})();
