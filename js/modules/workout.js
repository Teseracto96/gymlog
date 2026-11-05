/* ============================================================
   modules/workout.js — pestaña Entrenar, editor de entrenamiento
   (en curso y edición de pasados), timer de descanso y resumen
   ============================================================ */
App.workout = (() => {
  const U = App.utils, S = App.store, UI = App.ui;
  const SET_TYPES = { N: 'Normal', W: 'Calentamiento', D: 'Drop set', F: 'Al fallo' };
  let openPage = null;     // página del entreno activo si está abierta
  let elapsedTimer = null;

  /* ====================== timer de descanso ====================== */
  const timer = (() => {
    let endAt = 0, total = 0, iv = null, ctx = null;
    const el = () => document.getElementById('rest-timer');
    const unlockAudio = () => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch { } };
    const beep = () => {
      if (!S.state.settings.sound || !ctx) return;
      [0, 0.25, 0.5].forEach(t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.21); });
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    };
    const tick = () => {
      const left = Math.round((endAt - Date.now()) / 1000);
      const e = el(); if (!e) return;
      if (left <= 0) { stop(); beep(); UI.toast('¡Descanso terminado!'); return; }
      e.querySelector('.rt-time').textContent = U.fmtClock(left);
      e.querySelector('.rt-bar').style.width = (left / total * 100) + '%';
    };
    const start = (sec) => {
      unlockAudio();
      total = sec; endAt = Date.now() + sec * 1000;
      el().classList.add('show'); clearInterval(iv); iv = setInterval(tick, 250); tick();
    };
    const add = (sec) => { endAt += sec * 1000; total = Math.max(total + sec, 1); tick(); };
    const stop = () => { clearInterval(iv); iv = null; const e = el(); e && e.classList.remove('show'); };
    const init = () => {
      const e = U.h(`<div id="rest-timer"><div class="rt-bar"></div><div class="rt-inner">
        <button class="rt-btn" data-a="-15">−15</button><div class="rt-time">0:00</div><button class="rt-btn" data-a="15">+15</button>
        <button class="rt-btn skip" data-a="skip">Saltar</button></div></div>`);
      e.addEventListener('click', ev => { const a = ev.target.dataset.a; if (!a) return; a === 'skip' ? stop() : add(+a); });
      document.body.appendChild(e);
      document.addEventListener('touchstart', unlockAudio, { once: true });
    };
    const remaining = () => iv ? Math.max(0, Math.round((endAt - Date.now()) / 1000)) : 0;
    return { start, stop, init, remaining };
  })();

  /* ====================== pestaña Entrenar ====================== */
  const render = (el) => {
    const a = S.state.active;
    el.innerHTML = `<div class="tab-head"><h1>Entrenar</h1></div>
      ${a ? `<div class="card active-card"><div class="card-title">${U.esc(a.name)}<small>En curso · ${U.fmtClock((Date.now() - new Date(a.start)) / 1000)}</small></div>
        <button class="btn block" data-a="resume">Continuar entreno</button></div>`
        : `<button class="btn block big" data-a="empty">＋ Iniciar entreno vacío</button>`}
      <div class="templates-host"></div>`;
    el.querySelector('[data-a=resume]')?.addEventListener('click', openActive);
    el.querySelector('[data-a=empty]')?.addEventListener('click', () => start());
    App.templates.renderList(el.querySelector('.templates-host'));
  };

  const defaultName = () => { const h = new Date().getHours(); return h < 12 ? 'Entreno matutino' : h < 19 ? 'Entreno de la tarde' : 'Entreno nocturno'; };

  const start = async (tpl) => {
    if (S.state.active) {
      if (!await UI.confirm('Ya tienes un entreno en curso. ¿Descartarlo y empezar otro?', { ok: 'Descartar', danger: true })) return;
    }
    const w = {
      id: U.uid(), name: tpl ? tpl.name : defaultName(), start: new Date().toISOString(), end: null, notes: '', templateId: tpl ? tpl.id : null,
      exercises: tpl ? tpl.exercises.map(e => ({ id: U.uid(), exId: e.exId, group: e.group || null, notes: e.notes || '',
        sets: e.sets.map(st => ({ id: U.uid(), type: st.type || 'N', w: st.w ?? null, r: st.r ?? null, d: st.d ?? null, t: st.t ?? null, rpe: null, done: false })) })) : [],
    };
    // las superseries de la plantilla obtienen ids nuevos pero consistentes
    const gmap = {}; w.exercises.forEach(e => { if (e.group) e.group = gmap[e.group] = gmap[e.group] || U.uid(); });
    S.setActive(w);
    openActive();
  };

  const openActive = () => {
    if (!S.state.active) return;
    if (openPage) return;
    openPage = editor(S.state.active, { mode: 'active' });
    updateMiniBar();
  };

  /** Barra "entreno en curso" sobre las pestañas */
  const updateMiniBar = () => {
    const bar = document.getElementById('mini-bar');
    const a = S.state.active;
    const show = !!(a && !openPage);
    bar.classList.toggle('show', show);
    document.body.classList.toggle('has-minibar', show);
    if (!show) return;
    const rest = timer.remaining();
    bar.innerHTML = `<span>🏋️ ${U.esc(a.name)}</span><b>${rest ? '⏱ Descanso ' + U.fmtClock(rest) : U.fmtClock((Date.now() - new Date(a.start)) / 1000)}</b>`;
  };

  /* ====================== editor de entrenamiento ====================== */
  const parseTime = (v) => { if (!v) return null; const p = String(v).split(':').map(Number); return p.length === 2 ? p[0] * 60 + p[1] : (p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : Number(v)); };

  const editor = (w, { mode = 'active', onDone } = {}) => {
    const active = mode === 'active';
    const right = active ? `<button class="btn small" data-a="finish">Terminar</button>` : `<button class="btn small" data-a="save">Guardar</button>`;
    const pg = UI.page(active ? 'Entreno' : 'Editar entreno', { right, onClose: () => { if (active) { openPage = null; clearInterval(elapsedTimer); releaseWake(); updateMiniBar(); UI.refresh(); } } });
    pg.body.classList.add('no-refresh');
    let wake = null;
    const releaseWake = () => { try { wake && wake.release(); } catch { } wake = null; };
    if (active && 'wakeLock' in navigator) navigator.wakeLock.request('screen').then(l => wake = l).catch(() => { });

    const persist = () => { if (active) S.touchActive(); };

    const draw = () => {
      const groups = {}; let gi = 0;
      w.exercises.forEach(e => { if (e.group && !(e.group in groups)) groups[e.group] = String.fromCharCode(65 + gi++); });
      pg.body.innerHTML = `
        <div class="wk-head">
          <input class="wk-name" value="${U.esc(w.name)}" aria-label="Nombre del entreno">
          ${active ? `<div class="wk-sub"><span class="elapsed">0:00</span> · ${U.fmtDate(w.start, { time: true })}</div>`
          : `<div class="row gap"><label class="field grow"><span>Inicio</span><input type="datetime-local" class="wk-start" value="${U.toLocalInput(w.start)}"></label>
             <label class="field grow"><span>Fin</span><input type="datetime-local" class="wk-end" value="${w.end ? U.toLocalInput(w.end) : ''}"></label></div>`}
          <textarea class="wk-notes" rows="1" placeholder="Notas del entreno…">${U.esc(w.notes || '')}</textarea>
        </div>
        <div class="wk-list">${w.exercises.map((e, i) => entryHTML(e, i, groups)).join('')}</div>
        <button class="btn ghost block" data-a="add-ex">＋ Agregar ejercicios</button>
        ${active ? `<button class="btn danger-ghost block" data-a="cancel">Cancelar entreno</button>` : `<button class="btn danger-ghost block" data-a="delete">Eliminar entreno</button>`}
        <div style="height:120px"></div>`;
      bind();
      tickElapsed();
    };

    const colsFor = (type) => ({
      weight_reps: ['kg', 'Reps'], assisted: ['−kg', 'Reps'], reps: ['+kg', 'Reps'], time: ['Tiempo'],
      distance_time: ['km', 'Tiempo'], weight_distance: ['kg', 'm'],
    }[type] || ['kg', 'Reps']);

    const entryHTML = (e, i, groups) => {
      const ex = S.getEx(e.exId), unit = S.unitFor(e.exId);
      const prev = S.previousSets(e.exId, w.id);
      const cols = colsFor(ex.type).map(c => c.replace('kg', unit));
      let n = 0;
      return `<div class="entry ${e.group ? 'grouped' : ''}" data-i="${i}" ${e.group ? `data-g="${groups[e.group]}"` : ''}>
        <div class="entry-head">
          ${e.group ? `<span class="group-tag">${groups[e.group]}</span>` : ''}
          <div class="grow entry-title" data-a="detail">${App.exercises.label(ex)}</div>
          <button class="icon-btn" data-a="entry-menu">⋯</button>
        </div>
        ${e.notes ? `<div class="note" data-a="entry-notes">📝 ${U.esc(e.notes)}</div>` : ''}
        <div class="sets">
          <div class="set-row head"><span>Serie</span><span>Anterior</span>${cols.map(c => `<span>${c}</span>`).join('')}<span>✓</span></div>
          ${e.sets.map((st, j) => {
            const num = st.type === 'N' || !st.type ? ++n : st.type;
            const p = prev[j];
            const pv = p ? App.exercises.fmtSet(p, ex, unit) : '—';
            return `<div class="set-row ${st.done ? 'done' : ''}" data-j="${j}">
              <button class="set-tag ${st.type || 'N'}" data-a="set-menu">${num}${st.rpe ? `<sup>${st.rpe}</sup>` : ''}</button>
              <button class="prev" data-a="copy-prev">${pv}</button>
              ${inputsHTML(ex.type, st, p, unit)}
              <button class="chk" data-a="check">✓</button>
            </div>`;
          }).join('')}
        </div>
        <button class="btn ghost small block" data-a="add-set">＋ Agregar serie (${U.fmtClock(S.restFor(e.exId))})</button>
      </div>`;
    };

    const inp = (f, val, ph, mode = 'decimal') => `<input class="in" data-f="${f}" inputmode="${mode}" value="${val ?? ''}" placeholder="${ph ?? ''}" autocomplete="off">`;
    const inputsHTML = (type, st, p, unit) => {
      const wv = st.w != null ? U.toUnit(type === 'assisted' ? Math.abs(st.w) : st.w, unit) : '';
      const wp = p && p.w != null ? U.toUnit(type === 'assisted' ? Math.abs(p.w) : p.w, unit) : '';
      switch (type) {
        case 'time': return inp('t', st.t != null ? U.fmtClock(st.t) : '', p && p.t ? U.fmtClock(p.t) : 'm:ss', 'text');
        case 'distance_time': return inp('d', st.d, p?.d) + inp('t', st.t != null ? U.fmtClock(st.t) : '', p && p.t ? U.fmtClock(p.t) : 'm:ss', 'text');
        case 'weight_distance': return inp('w', wv, wp) + inp('d', st.d, p?.d);
        default: return inp('w', wv, wp) + inp('r', st.r, p?.r, 'numeric');
      }
    };

    /** Lee un input y lo guarda en el modelo */
    const readInput = (input) => {
      const e = w.exercises[input.closest('.entry').dataset.i], st = e.sets[input.closest('.set-row').dataset.j];
      const ex = S.getEx(e.exId), unit = S.unitFor(e.exId), f = input.dataset.f, v = input.value.trim().replace(',', '.');
      if (f === 'w') { let kg = U.fromUnit(v, unit); if (kg != null && ex.type === 'assisted') kg = -Math.abs(kg); st.w = kg; }
      else if (f === 'r') st.r = v === '' ? null : parseInt(v);
      else if (f === 'd') st.d = v === '' ? null : parseFloat(v);
      else if (f === 't') st.t = parseTime(v);
      persist();
    };

    const bind = () => {
      const b = pg.body;
      b.querySelector('.wk-name').oninput = (ev) => { w.name = ev.target.value; persist(); };
      const notes = b.querySelector('.wk-notes'); notes.oninput = () => { w.notes = notes.value; persist(); };
      if (!active) {
        b.querySelector('.wk-start').onchange = (ev) => { if (ev.target.value) w.start = new Date(ev.target.value).toISOString(); };
        b.querySelector('.wk-end').onchange = (ev) => { w.end = ev.target.value ? new Date(ev.target.value).toISOString() : null; };
      }
      b.querySelectorAll('input.in').forEach(i => { i.addEventListener('input', () => readInput(i)); i.addEventListener('focus', () => i.select()); });
      b.onclick = async (ev) => {
        const t = ev.target.closest('[data-a]'); if (!t) return;
        const a = t.dataset.a, entryEl = t.closest('.entry');
        const e = entryEl ? w.exercises[entryEl.dataset.i] : null;
        const row = t.closest('.set-row'), j = row ? +row.dataset.j : null;
        switch (a) {
          case 'add-ex': App.exercises.pick(ids => { ids.forEach(id => w.exercises.push(newEntry(id))); persist(); draw(); }); break;
          case 'detail': App.exercises.openDetail(e.exId); break;
          case 'add-set': {
            const last = e.sets[e.sets.length - 1];
            e.sets.push({ id: U.uid(), type: 'N', w: last?.w ?? null, r: last?.r ?? null, d: last?.d ?? null, t: last?.t ?? null, rpe: null, done: false });
            persist(); draw(); break;
          }
          case 'copy-prev': {
            const p = S.previousSets(e.exId, w.id)[j]; if (!p) break;
            Object.assign(e.sets[j], { w: p.w, r: p.r, d: p.d, t: p.t }); persist(); draw(); break;
          }
          case 'check': checkSet(e, j, row); break;
          case 'set-menu': setMenu(e, j); break;
          case 'entry-menu': entryMenu(+entryEl.dataset.i); break;
          case 'entry-notes': { const v = await UI.prompt('Notas del ejercicio', e.notes); if (v !== null) { e.notes = v; persist(); draw(); } break; }
          case 'cancel': if (await UI.confirm('¿Cancelar y descartar este entreno?', { ok: 'Descartar', danger: true })) { timer.stop(); S.setActive(null); pg.close(); } break;
          case 'delete': if (await UI.confirm('¿Eliminar este entreno del historial?', { ok: 'Eliminar', danger: true })) { S.deleteWorkout(w.id); pg.close(); onDone && onDone(); UI.refresh(); } break;
        }
      };
      const fin = pg.el.querySelector('[data-a=finish]'); if (fin) fin.onclick = finish;
      const sv = pg.el.querySelector('[data-a=save]'); if (sv) sv.onclick = () => { S.upsertWorkout(w); UI.toast('Entreno guardado'); pg.close(); onDone && onDone(); UI.refresh(); };
    };

    const newEntry = (exId) => ({ id: U.uid(), exId, group: null, notes: '', sets: [1, 2, 3].map(() => ({ id: U.uid(), type: 'N', w: null, r: null, d: null, t: null, rpe: null, done: false })) });

    const checkSet = (e, j, row) => {
      const st = e.sets[j];
      if (!st.done) {
        // si los campos están vacíos usa lo que se ve como sugerencia (placeholder)
        row.querySelectorAll('input.in').forEach(i => { if (i.value === '' && i.placeholder && i.placeholder !== 'm:ss') { i.value = i.placeholder; readInput(i); } });
        const ex = S.getEx(e.exId);
        const ok = ex.type === 'time' ? st.t : ex.type === 'distance_time' ? (st.d || st.t) : ex.type === 'weight_distance' ? st.d : st.r;
        if (!ok) { UI.toast('Captura los datos de la serie'); return; }
        st.done = true; row.classList.add('done');
        // descanso: en superseries sólo al terminar el último ejercicio del grupo
        const idx = w.exercises.indexOf(e), next = w.exercises[idx + 1];
        if (active && !(e.group && next && next.group === e.group)) timer.start(S.restFor(e.exId));
      } else { st.done = false; row.classList.remove('done'); }
      persist();
    };

    const setMenu = (e, j) => {
      const st = e.sets[j];
      UI.actions([
        ...Object.entries(SET_TYPES).map(([k, v]) => ({ label: `${st.type === k ? '● ' : ''}${v}`, onClick: () => { st.type = k; persist(); draw(); } })),
        { label: `RPE${st.rpe ? ' (' + st.rpe + ')' : ''}`, onClick: async () => { const v = await UI.prompt('RPE (6–10, vacío para quitar)', st.rpe || '', { type: 'number' }); if (v !== null) { st.rpe = v ? +v : null; persist(); draw(); } } },
        { label: 'Eliminar serie', danger: true, onClick: () => { e.sets.splice(j, 1); persist(); draw(); } },
      ], `Serie ${j + 1}`);
    };

    const entryMenu = (i) => {
      const e = w.exercises[i], next = w.exercises[i + 1];
      UI.actions([
        { label: 'Notas del ejercicio', onClick: async () => { const v = await UI.prompt('Notas', e.notes); if (v !== null) { e.notes = v; persist(); draw(); } } },
        next && !(e.group && e.group === next.group) && { label: 'Superserie / biserie con el siguiente', onClick: () => { const g = e.group || next.group || U.uid(); const old = next.group; w.exercises.forEach(x => { if (old && x.group === old) x.group = g; }); e.group = g; next.group = g; persist(); draw(); } },
        e.group && { label: 'Quitar de la superserie', onClick: () => { const g = e.group; e.group = null; if (w.exercises.filter(x => x.group === g).length < 2) w.exercises.forEach(x => { if (x.group === g) x.group = null; }); persist(); draw(); } },
        { label: 'Reemplazar ejercicio', onClick: () => App.exercises.pick(ids => { if (ids[0]) { e.exId = ids[0]; persist(); draw(); } }, { title: 'Reemplazar por…' }) },
        { label: `Unidad (${S.unitFor(e.exId)}) — cambiar`, onClick: () => { S.setExMeta(e.exId, { unit: S.unitFor(e.exId) === 'kg' ? 'lb' : 'kg' }); draw(); } },
        { label: `Descanso (${S.restFor(e.exId)} s)`, onClick: async () => { const v = await UI.prompt('Descanso en segundos para este ejercicio', S.restFor(e.exId), { type: 'number' }); if (v) { S.setExMeta(e.exId, { rest: +v }); draw(); } } },
        i > 0 && { label: 'Mover arriba', onClick: () => { w.exercises.splice(i - 1, 0, w.exercises.splice(i, 1)[0]); persist(); draw(); } },
        next && { label: 'Mover abajo', onClick: () => { w.exercises.splice(i + 1, 0, w.exercises.splice(i, 1)[0]); persist(); draw(); } },
        { label: 'Quitar ejercicio', danger: true, onClick: () => { w.exercises.splice(i, 1); persist(); draw(); } },
      ], S.getEx(e.exId).name);
    };

    const tickElapsed = () => {
      clearInterval(elapsedTimer);
      if (!active) return;
      const upd = () => { const el = pg.body.querySelector('.elapsed'); if (el) el.textContent = U.fmtClock((Date.now() - new Date(w.start)) / 1000); };
      upd(); elapsedTimer = setInterval(upd, 1000);
    };

    const finish = async () => {
      const pending = w.exercises.reduce((a, e) => a + e.sets.filter(s => !s.done).length, 0);
      const done = w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
      if (!done) { UI.toast('Marca al menos una serie como completada ✓'); return; }
      if (pending && !await UI.confirm(`Tienes ${pending} serie(s) sin completar. Se descartarán. ¿Terminar el entreno?`, { ok: 'Terminar' })) return;
      w.exercises.forEach(e => e.sets = e.sets.filter(s => s.done));
      w.exercises = w.exercises.filter(e => e.sets.length);
      w.end = new Date().toISOString();
      timer.stop();
      S.upsertWorkout(w);
      S.setActive(null);
      pg.close();
      summary(w);
    };

    draw();
    return pg;
  };

  /* ====================== resumen al terminar ====================== */
  const summary = (w) => {
    const st = S.workoutStats(w), prs = S.prsInWorkout(w);
    const count = S.state.workouts.length;
    const el = U.h(`<div class="summary">
      <div class="trophy">🏆</div>
      <h2>¡Buen trabajo!</h2>
      <p class="muted">Entreno #${count} · ${U.fmtDate(w.start)}</p>
      <div class="stats-grid">
        <div class="stat"><small>Duración</small><b>${U.fmtDuration(st.dur)}</b></div>
        <div class="stat"><small>Volumen</small><b>${Math.round(st.vol).toLocaleString()} kg</b></div>
        <div class="stat"><small>Series</small><b>${st.sets}</b></div>
        <div class="stat"><small>Récords</small><b>${prs.length}</b></div>
      </div>
      ${prs.length ? `<h3>Récords personales</h3>${prs.map(p => `<div class="pr-line">⭐ <b>${U.esc(S.getEx(p.exId).name)}</b><small>${p.kinds.join(' · ')}</small></div>`).join('')}` : ''}
      <div class="row gap" style="margin-top:16px">
        ${w.templateId && S.state.templates.find(t => t.id === w.templateId) ? `<button class="btn ghost grow" data-a="upd">Actualizar plantilla</button>` : `<button class="btn ghost grow" data-a="tpl">Guardar como plantilla</button>`}
        <button class="btn grow" data-a="ok">Listo</button>
      </div></div>`);
    const sh = UI.sheet(el, { onClose: () => UI.refresh() });
    el.querySelector('[data-a=ok]').onclick = sh.close;
    el.querySelector('[data-a=tpl]')?.addEventListener('click', async () => { const n = await UI.prompt('Nombre de la plantilla', w.name); if (n) { S.upsertTemplate(S.templateFromWorkout(w, n)); UI.toast('Plantilla creada'); } });
    el.querySelector('[data-a=upd]')?.addEventListener('click', () => {
      const old = S.state.templates.find(t => t.id === w.templateId);
      const nt = S.templateFromWorkout(w, old.name); nt.id = old.id; nt.folder = old.folder; nt.notes = old.notes;
      S.upsertTemplate(nt); UI.toast('Plantilla actualizada');
    });
  };

  const editPast = (w, onDone) => editor(JSON.parse(JSON.stringify(w)), { mode: 'edit', onDone });

  return { render, start, openActive, updateMiniBar, timer, editPast, summary, SET_TYPES };
})();
