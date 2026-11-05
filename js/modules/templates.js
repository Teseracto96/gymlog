/* ============================================================
   modules/templates.js — plantillas (rutinas) con carpetas
   ============================================================ */
App.templates = (() => {
  const U = App.utils, S = App.store, UI = App.ui;

  const lastDone = (tid) => {
    const w = S.sortedWorkouts().find(w => w.templateId === tid);
    return w ? U.fmtDate(w.start, { noDay: true }) : null;
  };

  const renderList = (el) => {
    const tpls = [...S.state.templates].sort((a, b) => a.name.localeCompare(b.name));
    const folders = {};
    tpls.forEach(t => (folders[t.folder || ''] = folders[t.folder || ''] || []).push(t));
    const keys = Object.keys(folders).sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
    el.innerHTML = `<div class="section-head"><h2>Plantillas</h2><button class="btn small ghost" data-a="new">＋ Plantilla</button></div>
      ${!tpls.length ? `<div class="empty">Aún no tienes plantillas. Crea una con “＋ Plantilla” o guarda un entreno terminado como plantilla.</div>` : ''}
      ${keys.map(k => `<div class="folder"><h3 class="folder-name">${k ? '📁 ' + U.esc(k) : 'Mis plantillas'} <small>${folders[k].length}</small></h3>
        <div class="tpl-grid">${folders[k].map(t => `<div class="tpl-card" data-id="${t.id}">
          <div class="tpl-name">${U.esc(t.name)}</div>
          <div class="tpl-ex">${t.exercises.slice(0, 5).map(e => `${e.sets.length} × ${U.esc(S.getEx(e.exId).name)}`).join('<br>')}${t.exercises.length > 5 ? `<br>+${t.exercises.length - 5} más` : ''}</div>
          <div class="tpl-last">${lastDone(t.id) ? 'Último: ' + lastDone(t.id) : 'Sin usar'}</div>
        </div>`).join('')}</div></div>`).join('')}`;
    el.querySelector('[data-a=new]').onclick = () => edit({ id: U.uid(), name: 'Nueva plantilla', folder: '', notes: '', exercises: [] }, true);
    el.querySelectorAll('.tpl-card').forEach(c => c.onclick = () => preview(S.state.templates.find(t => t.id === c.dataset.id)));
  };

  const preview = (t) => {
    const el = U.h(`<div>
      ${t.notes ? `<p class="note">${U.esc(t.notes)}</p>` : ''}
      <div class="tpl-preview">${t.exercises.map(e => { const ex = S.getEx(e.exId); return `<div class="ex-row compact">
        <div class="thumb">${App.exercises.thumb(ex) ? `<img src="${App.exercises.thumb(ex)}" alt="">` : ''}</div>
        <div class="grow">${App.exercises.label(ex)}<div class="ex-meta">${e.sets.length} series${e.group ? ' · superserie' : ''}</div></div></div>`; }).join('') || '<div class="empty small">Sin ejercicios</div>'}</div>
      <button class="btn block big" data-a="start">Iniciar entreno</button>
      <button class="btn ghost block" data-a="more">Opciones…</button></div>`);
    const sh = UI.sheet(el, { title: t.name, tall: true });
    el.querySelector('[data-a=start]').onclick = () => { sh.close(); App.workout.start(t); };
    el.querySelector('[data-a=more]').onclick = () => { sh.close(); menu(t); };
  };

  const menu = (t) => UI.actions([
    { label: 'Editar', onClick: () => edit(JSON.parse(JSON.stringify(t))) },
    { label: 'Duplicar', onClick: () => { S.upsertTemplate({ ...JSON.parse(JSON.stringify(t)), id: U.uid(), name: t.name + ' (copia)' }); UI.refresh(); } },
    { label: 'Mover a carpeta', onClick: async () => { const f = await UI.prompt('Carpeta (vacío = sin carpeta)', t.folder || '', { placeholder: 'Ej. Rutina 6.0' }); if (f !== null) { t.folder = f; S.upsertTemplate(t); UI.refresh(); } } },
    { label: 'Eliminar', danger: true, onClick: async () => { if (await UI.confirm(`¿Eliminar la plantilla “${t.name}”?`, { danger: true, ok: 'Eliminar' })) { S.deleteTemplate(t.id); UI.refresh(); } } },
  ], t.name);

  /** Editor de plantilla */
  const edit = (t, isNew = false) => {
    const pg = UI.page(isNew ? 'Nueva plantilla' : 'Editar plantilla', { right: `<button class="btn small" data-a="save">Guardar</button>` });
    const draw = () => {
      const groups = {}; let gi = 0;
      t.exercises.forEach(e => { if (e.group && !(e.group in groups)) groups[e.group] = String.fromCharCode(65 + gi++); });
      pg.body.innerHTML = `
        <label class="field"><span>Nombre</span><input class="t-name" value="${U.esc(t.name)}"></label>
        <label class="field"><span>Carpeta</span><input class="t-folder" value="${U.esc(t.folder || '')}" placeholder="Ej. Rutina 6.0"></label>
        <label class="field"><span>Notas</span><textarea class="t-notes" rows="2">${U.esc(t.notes || '')}</textarea></label>
        ${t.exercises.map((e, i) => {
          const ex = S.getEx(e.exId), unit = S.unitFor(e.exId);
          return `<div class="entry ${e.group ? 'grouped' : ''}" data-i="${i}" ${e.group ? `data-g="${groups[e.group]}"` : ''}>
            <div class="entry-head">${e.group ? `<span class="group-tag">${groups[e.group]}</span>` : ''}<div class="grow">${App.exercises.label(ex)}</div><button class="icon-btn" data-a="menu">⋯</button></div>
            <div class="sets tpl">
              <div class="set-row head"><span>Serie</span><span>${unit}</span><span>Reps</span><span></span></div>
              ${e.sets.map((st, j) => `<div class="set-row" data-j="${j}">
                <button class="set-tag ${st.type || 'N'}" data-a="type">${st.type && st.type !== 'N' ? st.type : j + 1}</button>
                <input class="in" data-f="w" inputmode="decimal" value="${st.w != null ? U.toUnit(st.w, unit) : ''}" placeholder="—">
                <input class="in" data-f="r" inputmode="numeric" value="${st.r ?? ''}" placeholder="—">
                <button class="icon-btn" data-a="del-set">✕</button></div>`).join('')}
            </div>
            <button class="btn ghost small block" data-a="add-set">＋ Agregar serie</button></div>`;
        }).join('')}
        <button class="btn ghost block" data-a="add-ex">＋ Agregar ejercicios</button>`;
      pg.body.querySelector('.t-name').oninput = (e) => t.name = e.target.value;
      pg.body.querySelector('.t-folder').oninput = (e) => t.folder = e.target.value.trim();
      pg.body.querySelector('.t-notes').oninput = (e) => t.notes = e.target.value;
      pg.body.querySelectorAll('input.in').forEach(inp => inp.oninput = () => {
        const e = t.exercises[inp.closest('.entry').dataset.i], st = e.sets[inp.closest('.set-row').dataset.j];
        const v = inp.value.replace(',', '.');
        if (inp.dataset.f === 'w') st.w = U.fromUnit(v, S.unitFor(e.exId)); else st.r = v === '' ? null : parseInt(v);
      });
    };
    pg.body.onclick = (ev) => {
      const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
      const ent = ev.target.closest('.entry'), i = ent ? +ent.dataset.i : null, e = ent ? t.exercises[i] : null;
      const row = ev.target.closest('.set-row'), j = row ? +row.dataset.j : null;
      if (a === 'add-ex') App.exercises.pick(ids => { ids.forEach(id => t.exercises.push({ exId: id, group: null, notes: '', sets: [{ type: 'N' }, { type: 'N' }, { type: 'N' }].map(s => ({ ...s, w: null, r: null })) })); draw(); });
      if (a === 'add-set') { const l = e.sets[e.sets.length - 1] || {}; e.sets.push({ type: 'N', w: l.w ?? null, r: l.r ?? null }); draw(); }
      if (a === 'del-set') { e.sets.splice(j, 1); draw(); }
      if (a === 'type') UI.actions(Object.entries(App.workout.SET_TYPES).map(([k, v]) => ({ label: v, onClick: () => { e.sets[j].type = k; draw(); } })));
      if (a === 'menu') {
        const next = t.exercises[i + 1];
        UI.actions([
          next && { label: 'Superserie / biserie con el siguiente', onClick: () => { const g = e.group || next.group || U.uid(); e.group = g; next.group = g; draw(); } },
          e.group && { label: 'Quitar de la superserie', onClick: () => { e.group = null; draw(); } },
          i > 0 && { label: 'Mover arriba', onClick: () => { t.exercises.splice(i - 1, 0, t.exercises.splice(i, 1)[0]); draw(); } },
          next && { label: 'Mover abajo', onClick: () => { t.exercises.splice(i + 1, 0, t.exercises.splice(i, 1)[0]); draw(); } },
          { label: 'Quitar ejercicio', danger: true, onClick: () => { t.exercises.splice(i, 1); draw(); } },
        ]);
      }
    };
    pg.el.querySelector('[data-a=save]').onclick = () => {
      if (!t.name.trim()) return UI.toast('Ponle nombre a la plantilla');
      S.upsertTemplate(t); UI.toast('Plantilla guardada'); pg.close(); UI.refresh();
    };
    draw();
  };

  return { renderList, preview, edit };
})();
