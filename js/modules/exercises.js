/* ============================================================
   modules/exercises.js — catálogo, buscador, selector de ejercicios,
   detalle (Cómo / Historial / Gráficas / Récords) y ejercicios propios
   ============================================================ */
App.exercises = (() => {
  const U = App.utils, S = App.store, UI = App.ui;
  const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

  const MUSCLES = {
    chest: 'Pecho', lats: 'Dorsales', 'middle back': 'Espalda media', 'lower back': 'Espalda baja', traps: 'Trapecio',
    shoulders: 'Hombros', biceps: 'Bíceps', triceps: 'Tríceps', forearms: 'Antebrazos', abdominals: 'Abdomen',
    quadriceps: 'Cuádriceps', hamstrings: 'Femorales', glutes: 'Glúteos', calves: 'Pantorrillas',
    adductors: 'Aductores', abductors: 'Abductores', neck: 'Cuello',
  };
  const EQUIP = {
    Barbell: 'Barra', Dumbbell: 'Mancuerna', Machine: 'Máquina', Cable: 'Polea', Bodyweight: 'Peso corporal',
    Kettlebell: 'Kettlebell', Band: 'Banda', 'EZ Bar': 'Barra Z', 'Medicine Ball': 'Balón medicinal',
    'Exercise Ball': 'Fitball', 'Foam Roll': 'Foam roller', Other: 'Otro', None: 'Ninguno',
  };
  const TYPES = {
    weight_reps: 'Peso × reps', reps: 'Sólo reps', assisted: 'Asistido (− peso)', time: 'Tiempo',
    distance_time: 'Distancia y tiempo', weight_distance: 'Peso y distancia',
  };

  const mus = (m) => MUSCLES[m] || m;
  const thumb = (ex) => {
    if (ex.media && /\.(gif|png|jpe?g|webp)(\?|$)/i.test(ex.media)) return ex.media;
    return ex.img && ex.img[0] ? IMG_BASE + ex.img[0] : '';
  };
  const label = (ex) => `<div class="ex-name">${U.esc(ex.name)}</div>${S.state.settings.showEs && ex.es ? `<div class="ex-es">(${U.esc(ex.es)})</div>` : ''}`;

  const usageCount = () => {
    const c = {};
    S.state.workouts.forEach(w => w.exercises.forEach(e => c[e.exId] = (c[e.exId] || 0) + 1));
    return c;
  };

  /* ---------- lista filtrable (compartida por la pestaña y el selector) ---------- */
  const buildList = (container, { onTap, multi = false, selected = new Set(), onSelChange } = {}) => {
    const st = { q: '', muscle: '', equip: '', onlyMine: false };
    const counts = usageCount();
    container.innerHTML = `
      <div class="search-bar"><input type="search" placeholder="Buscar en inglés o español…" class="search"></div>
      <div class="chips">
        <select class="chip-select" data-f="muscle"><option value="">Músculo</option>${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <select class="chip-select" data-f="equip"><option value="">Equipo</option>${Object.entries(EQUIP).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <button class="chip" data-f="mine">Hechos por mí</button>
      </div>
      <div class="ex-list"></div>`;
    const listEl = container.querySelector('.ex-list');
    let all = S.allExercises();

    const render = () => {
      const q = U.norm(st.q);
      let items = all.filter(e =>
        (!q || U.norm(e.name + ' ' + (e.es || '')).includes(q)) &&
        (!st.muscle || e.pm.includes(st.muscle)) &&
        (!st.equip || e.eq === st.equip) &&
        (!st.onlyMine || counts[e.id]));
      // Ordena: los que usas y los estilo Strong primero si no hay búsqueda
      items.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name));
      const total = items.length;
      items = items.slice(0, 250);
      listEl.innerHTML = items.length ? items.map(e => `
        <div class="ex-row ${selected.has(e.id) ? 'sel' : ''}" data-id="${e.id}">
          <div class="thumb">${thumb(e) ? `<img loading="lazy" src="${thumb(e)}" alt="">` : `<span>${U.esc(e.name[0])}</span>`}</div>
          <div class="grow">${label(e)}<div class="ex-meta">${U.esc(e.pm.map(mus).join(', ') || '—')} · ${U.esc(EQUIP[e.eq] || e.eq)}${e.custom ? ' · propio' : ''}</div></div>
          ${counts[e.id] ? `<span class="badge">${counts[e.id]}</span>` : ''}
          ${multi ? `<span class="check">${selected.has(e.id) ? '✓' : ''}</span>` : ''}
        </div>`).join('') + (total > 250 ? `<div class="empty small">Mostrando 250 de ${total}. Afina la búsqueda.</div>` : '')
        : `<div class="empty">Sin resultados. Puedes crear el ejercicio con el botón +.</div>`;
    };
    container.querySelector('.search').addEventListener('input', U.debounce(e => { st.q = e.target.value; render(); }, 150));
    container.querySelectorAll('.chip-select').forEach(sel => sel.onchange = () => { st[sel.dataset.f] = sel.value; sel.classList.toggle('on', !!sel.value); render(); });
    container.querySelector('[data-f=mine]').onclick = (e) => { st.onlyMine = !st.onlyMine; e.target.classList.toggle('on', st.onlyMine); render(); };
    listEl.addEventListener('click', (e) => {
      const row = e.target.closest('.ex-row'); if (!row) return;
      const id = row.dataset.id;
      if (multi) {
        selected.has(id) ? selected.delete(id) : selected.add(id);
        row.classList.toggle('sel'); row.querySelector('.check').textContent = selected.has(id) ? '✓' : '';
        onSelChange && onSelChange(selected);
      } else onTap && onTap(id);
    });
    render();
    return { refresh: () => { all = S.allExercises(); render(); } };
  };

  /* ---------- pestaña Ejercicios ---------- */
  const render = (el) => {
    el.innerHTML = `<div class="tab-head"><h1>Ejercicios</h1><button class="icon-btn add" aria-label="Nuevo ejercicio">＋</button></div><div class="list-host"></div>`;
    const list = buildList(el.querySelector('.list-host'), { onTap: (id) => openDetail(id) });
    el.querySelector('.add').onclick = () => editCustom(null, () => list.refresh());
  };

  /* ---------- selector (para entrenos y plantillas) ---------- */
  const pick = (onDone, { title = 'Agregar ejercicios' } = {}) => {
    const selected = new Set();
    const pg = UI.page(title, { right: `<button class="icon-btn add">＋</button>` });
    const footer = U.h(`<div class="sticky-foot"><button class="btn block" disabled>Agregar</button></div>`);
    const btn = footer.querySelector('button');
    const list = buildList(pg.body, { multi: true, selected, onSelChange: (s) => { btn.disabled = !s.size; btn.textContent = s.size ? `Agregar (${s.size})` : 'Agregar'; } });
    pg.el.appendChild(footer);
    btn.onclick = () => { onDone([...selected]); pg.close(); };
    pg.el.querySelector('.add').onclick = () => editCustom(null, (ex) => { selected.add(ex.id); list.refresh(); btn.disabled = false; btn.textContent = `Agregar (${selected.size})`; });
  };

  /* ---------- medios: imagen animada / GIF / video ---------- */
  const mediaHTML = (ex) => {
    if (ex.media) {
      if (/\.(mp4|webm|mov)(\?|$)/i.test(ex.media)) return `<video src="${U.esc(ex.media)}" autoplay loop muted playsinline class="media"></video>`;
      if (/youtube\.com|youtu\.be|instagram|tiktok/i.test(ex.media)) return `<a class="btn ghost block" href="${U.esc(ex.media)}" target="_blank" rel="noopener">▶ Ver video de la técnica</a>`;
      return `<img src="${U.esc(ex.media)}" class="media" alt="">`;
    }
    if (ex.img && ex.img.length) return `<div class="media anim" data-frames='${JSON.stringify(ex.img.map(i => IMG_BASE + i))}'><img src="${IMG_BASE + ex.img[0]}" alt=""></div>`;
    return `<div class="empty small">Sin imagen. Agrega un enlace a un GIF, imagen o video desde ⋯</div>`;
  };
  const animate = (root) => {
    root.querySelectorAll('.anim').forEach(box => {
      const frames = JSON.parse(box.dataset.frames); const img = box.querySelector('img'); let i = 0;
      frames.forEach(f => { const p = new Image(); p.src = f; });
      const t = setInterval(() => { if (!document.body.contains(box)) return clearInterval(t); i = (i + 1) % frames.length; img.src = frames[i]; }, 900);
    });
  };

  /* ---------- detalle del ejercicio ---------- */
  const fmtSet = (st, ex, unit) => {
    const w = st.w != null ? `${U.toUnit(st.w, unit)} ${unit}` : '';
    switch (ex.type) {
      case 'reps': return `${st.r ?? 0} reps${st.w ? ' +' + w : ''}`;
      case 'time': return U.fmtClock(st.t || 0);
      case 'distance_time': return `${st.d ?? 0} km · ${U.fmtClock(st.t || 0)}`;
      case 'weight_distance': return `${w} · ${st.d ?? 0} m`;
      default: return `${w || '—'} × ${st.r ?? 0}`;
    }
  };

  const openDetail = (exId) => {
    const ex = S.getEx(exId);
    const pg = UI.page(ex.name, { right: `<button class="icon-btn more">⋯</button>` });
    let tab = 'how';
    const draw = () => {
      const e = S.getEx(exId), unit = S.unitFor(exId);
      pg.body.innerHTML = `
        ${e.es ? `<p class="subtitle">(${U.esc(e.es)})</p>` : ''}
        <div class="seg">${[['how', 'Cómo'], ['hist', 'Historial'], ['charts', 'Gráficas'], ['rec', 'Récords']].map(([k, v]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${v}</button>`).join('')}</div>
        <div class="tab-content"></div>`;
      pg.body.querySelectorAll('.seg button').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
      const c = pg.body.querySelector('.tab-content');
      if (tab === 'how') {
        c.innerHTML = `${mediaHTML(e)}
          <div class="card"><div class="kv"><span>Músculo principal</span><b>${U.esc(e.pm.map(mus).join(', ') || '—')}</b></div>
          ${e.sm.length ? `<div class="kv"><span>Secundarios</span><b>${U.esc(e.sm.map(mus).join(', '))}</b></div>` : ''}
          <div class="kv"><span>Equipo</span><b>${U.esc(EQUIP[e.eq] || e.eq)}</b></div>
          <div class="kv"><span>Registro</span><b>${TYPES[e.type] || e.type}</b></div>
          <div class="kv"><span>Unidad</span><b>${unit}</b></div>
          <div class="kv"><span>Descanso</span><b>${S.restFor(exId)} s</b></div></div>
          ${e.ins && e.ins.length ? `<h3>Instrucciones</h3><ol class="ins">${e.ins.map(i => `<li>${U.esc(i)}</li>`).join('')}</ol>` : ''}
          ${S.state.exMeta[exId]?.notes ? `<h3>Mis notas</h3><p class="card">${U.esc(S.state.exMeta[exId].notes)}</p>` : ''}`;
        animate(c);
      } else if (tab === 'hist') {
        const ses = S.sessionsFor(exId);
        c.innerHTML = ses.length ? ses.map(({ workout, entry }) => `
          <div class="card"><div class="card-title">${U.esc(workout.name)}<small>${U.fmtDate(workout.start)}</small></div>
          ${S.doneSets(entry).map((st, i) => `<div class="set-line"><span class="set-tag ${st.type}">${st.type === 'N' || !st.type ? i + 1 : st.type}</span>${fmtSet(st, e, unit)}${e.type === 'weight_reps' && st.r <= 12 && st.w > 0 ? `<small>1RM ${U.round(U.toUnit(U.e1rm(st.w, st.r), unit), 1)}</small>` : ''}</div>`).join('')}
          ${entry.notes ? `<p class="note">${U.esc(entry.notes)}</p>` : ''}</div>`).join('')
          : `<div class="empty">Todavía no registras este ejercicio.</div>`;
      } else if (tab === 'charts') {
        const ses = S.sessionsFor(exId).reverse();
        const pts = (fn) => ses.map(({ workout, entry }) => ({ x: new Date(workout.start), y: fn(S.doneSets(entry).filter(x => x.type !== 'W')) })).filter(p => p.y > 0);
        if (e.type === 'weight_reps') {
          c.innerHTML = `
            <div class="card"><div class="card-title">1RM estimado</div>${U.lineChart(pts(ss => U.toUnit(Math.max(0, ...ss.filter(x => x.r <= 12).map(x => U.e1rm(x.w, x.r))), unit)), { unit })}</div>
            <div class="card"><div class="card-title">Peso máximo</div>${U.lineChart(pts(ss => U.toUnit(Math.max(0, ...ss.map(x => x.w || 0)), unit)), { unit })}</div>
            <div class="card"><div class="card-title">Volumen por sesión</div>${U.lineChart(pts(ss => U.toUnit(ss.reduce((a, x) => a + S.setVolume(x), 0), unit)), { unit })}</div>
            <div class="card"><div class="card-title">Reps totales</div>${U.lineChart(pts(ss => ss.reduce((a, x) => a + (x.r || 0), 0)))}</div>`;
        } else if (e.type === 'distance_time') {
          c.innerHTML = `<div class="card"><div class="card-title">Distancia (km)</div>${U.lineChart(pts(ss => ss.reduce((a, x) => a + (x.d || 0), 0)), { unit: 'km' })}</div>
            <div class="card"><div class="card-title">Tiempo (min)</div>${U.lineChart(pts(ss => U.round(ss.reduce((a, x) => a + (x.t || 0), 0) / 60, 1)), { unit: 'min' })}</div>`;
        } else {
          c.innerHTML = `<div class="card"><div class="card-title">Reps totales</div>${U.lineChart(pts(ss => ss.reduce((a, x) => a + (x.r || 0), 0)))}</div>
            <div class="card"><div class="card-title">Tiempo (s)</div>${U.lineChart(pts(ss => ss.reduce((a, x) => a + (x.t || 0), 0)))}</div>`;
        }
      } else {
        const r = S.recordsFor(exId);
        const u = (v) => `${U.toUnit(v, unit)} ${unit}`;
        c.innerHTML = r.sessions ? `
          <div class="stats-grid">
            <div class="stat"><small>1RM estimado</small><b>${u(r.maxE1rm)}</b></div>
            <div class="stat"><small>Peso máximo</small><b>${u(r.maxW)}</b></div>
            <div class="stat"><small>Mejor serie (vol.)</small><b>${u(r.maxSetVol)}</b></div>
            <div class="stat"><small>Mejor sesión (vol.)</small><b>${u(r.maxSessionVol)}</b></div>
            <div class="stat"><small>Reps máx.</small><b>${r.maxReps}</b></div>
            <div class="stat"><small>Sesiones</small><b>${r.sessions}</b></div>
            ${r.maxDist ? `<div class="stat"><small>Distancia máx.</small><b>${r.maxDist} km</b></div>` : ''}
            ${r.maxTime ? `<div class="stat"><small>Tiempo máx.</small><b>${U.fmtClock(r.maxTime)}</b></div>` : ''}
          </div>
          ${Object.keys(r.repBests).length ? `<h3>Mejor peso por repeticiones</h3><div class="card">${Object.entries(r.repBests).sort((a, b) => a[0] - b[0]).map(([reps, w]) => `<div class="kv"><span>${reps} reps</span><b>${u(w)}</b></div>`).join('')}</div>` : ''}`
          : `<div class="empty">Sin récords todavía.</div>`;
      }
    };
    pg.el.querySelector('.more').onclick = () => {
      const e = S.getEx(exId);
      UI.actions([
        { label: `Unidad: ${S.unitFor(exId) === 'kg' ? 'cambiar a lb' : 'cambiar a kg'}`, onClick: () => { S.setExMeta(exId, { unit: S.unitFor(exId) === 'kg' ? 'lb' : 'kg' }); draw(); } },
        { label: 'Tiempo de descanso', onClick: async () => { const v = await UI.prompt('Descanso en segundos', S.restFor(exId), { type: 'number' }); if (v) { S.setExMeta(exId, { rest: +v }); draw(); } } },
        { label: 'Enlace de imagen / GIF / video', onClick: async () => { const v = await UI.prompt('URL (deja vacío para quitar)', S.state.exMeta[exId]?.media || '', { placeholder: 'https://…gif' }); if (v !== null) { S.setExMeta(exId, { media: v }); draw(); } } },
        { label: 'Nombre en español', onClick: async () => { const v = await UI.prompt('Nombre en español', e.es); if (v !== null) { S.setExMeta(exId, { es: v }); draw(); } } },
        { label: 'Mis notas del ejercicio', onClick: async () => { const v = await UI.prompt('Notas (técnica, ajustes de máquina…)', S.state.exMeta[exId]?.notes || ''); if (v !== null) { S.setExMeta(exId, { notes: v }); draw(); } } },
        e.custom && { label: 'Editar ejercicio', onClick: () => editCustom(e, () => { pg.setTitle(S.getEx(exId).name); draw(); }) },
        e.custom && { label: 'Eliminar ejercicio', danger: true, onClick: async () => { if (await UI.confirm('¿Eliminar este ejercicio? El historial se conserva.', { danger: true, ok: 'Eliminar' })) { S.deleteCustomExercise(exId); pg.close(); UI.refresh(); } } },
      ]);
    };
    draw();
  };

  /* ---------- crear / editar ejercicio propio ---------- */
  const editCustom = (ex, onSaved) => {
    const e = ex || { id: 'c_' + U.uid(), name: '', es: '', eq: 'Machine', cat: 'strength', type: 'weight_reps', pm: [], sm: [], img: [], ins: [], media: '' };
    const form = U.h(`<form class="form">
      <label class="field"><span>Nombre (inglés)</span><input name="name" required value="${U.esc(e.name)}" placeholder="Ej. Seated Row (Machine)"></label>
      <label class="field"><span>Nombre en español</span><input name="es" value="${U.esc(e.es)}" placeholder="Ej. Remo sentado en máquina"></label>
      <label class="field"><span>Músculo principal</span><select name="pm">${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}" ${e.pm[0] === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Equipo</span><select name="eq">${Object.entries(EQUIP).map(([k, v]) => `<option value="${k}" ${e.eq === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Tipo de registro</span><select name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Imagen / GIF / video (URL, opcional)</span><input name="media" value="${U.esc(e.media || '')}" placeholder="https://…"></label>
      <label class="field"><span>Instrucciones (opcional, una por línea)</span><textarea name="ins" rows="3">${U.esc((e.ins || []).join('\n'))}</textarea></label>
      <button class="btn block">Guardar</button></form>`);
    const sh = UI.sheet(form, { title: ex ? 'Editar ejercicio' : 'Nuevo ejercicio', tall: true });
    form.onsubmit = (ev) => {
      ev.preventDefault();
      const f = new FormData(form);
      const out = { ...e, name: f.get('name').trim(), es: f.get('es').trim(), pm: [f.get('pm')], eq: f.get('eq'), type: f.get('type'),
        media: f.get('media').trim(), ins: f.get('ins').split('\n').map(x => x.trim()).filter(Boolean), cat: f.get('type') === 'distance_time' ? 'cardio' : 'strength' };
      S.saveCustomExercise(out); sh.close(); UI.toast('Ejercicio guardado'); onSaved && onSaved(out);
    };
  };

  return { render, pick, openDetail, fmtSet, thumb, label, mus, MUSCLES, EQUIP, IMG_BASE };
})();
