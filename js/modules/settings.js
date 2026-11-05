/* ============================================================
   modules/settings.js — pestaña "Más": herramientas, ajustes y
   respaldo manual (JSON) para pasar datos entre iPhone y PC
   ============================================================ */
App.settings = (() => {
  const U = App.utils, S = App.store, UI = App.ui;
  const VERSION = '1.0.0';

  const daysSince = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null;

  const render = (el) => {
    const st = S.state.settings, last = S.state.meta.lastBackup, d = daysSince(last);
    el.innerHTML = `<div class="tab-head"><h1>Más</h1></div>
      <h3>Herramientas</h3>${App.tools.html}
      <h3>Respaldo y sincronización</h3>
      <div class="card">
        <p class="muted small">${last ? `Último respaldo: hace ${d === 0 ? 'menos de un día' : d + ' día(s)'}` : 'Aún no has descargado un respaldo.'}
        ${d == null || d >= 7 ? ' <b class="warn">Te recomiendo respaldar.</b>' : ''}</p>
        <button class="btn block" data-a="export">⬇️ Descargar respaldo (JSON)</button>
        <button class="btn ghost block" data-a="import">⬆️ Importar respaldo (JSON)</button>
        <p class="muted small">Para sincronizar: descarga el respaldo en un dispositivo e impórtalo en el otro con “Combinar”. Se queda la versión más reciente de cada entreno.</p>
        <details><summary>Más opciones de datos</summary>
          <button class="btn ghost block" data-a="csv">Exportar CSV (formato Strong / Excel)</button>
          <button class="btn ghost block" data-a="strong">Importar CSV de la app Strong</button>
          <button class="btn danger-ghost block" data-a="wipe">Borrar todos los datos</button>
        </details>
        <input type="file" class="hidden" accept=".json,application/json" data-in="json">
        <input type="file" class="hidden" accept=".csv,text/csv" data-in="csv">
      </div>
      <h3>Ajustes</h3>
      <div class="card settings">
        <label class="kv"><span>Unidad por defecto</span><select data-s="unit"><option value="kg" ${st.unit === 'kg' ? 'selected' : ''}>kg</option><option value="lb" ${st.unit === 'lb' ? 'selected' : ''}>lb</option></select></label>
        <label class="kv"><span>Descanso por defecto (s)</span><input data-s="rest" inputmode="numeric" value="${st.rest}"></label>
        <label class="kv"><span>Peso de la barra (kg)</span><input data-s="barKg" inputmode="decimal" value="${st.barKg}"></label>
        <label class="kv"><span>Discos disponibles (kg)</span><input data-s="plates" value="${st.plates.join(', ')}"></label>
        <label class="kv"><span>Sonido al terminar descanso</span><input type="checkbox" data-s="sound" ${st.sound ? 'checked' : ''}></label>
        <label class="kv"><span>Mostrar nombre en español</span><input type="checkbox" data-s="showEs" ${st.showEs ? 'checked' : ''}></label>
        <label class="kv"><span>Tema</span><select data-s="theme"><option value="dark" ${st.theme === 'dark' ? 'selected' : ''}>Oscuro</option><option value="light" ${st.theme === 'light' ? 'selected' : ''}>Claro</option><option value="auto" ${st.theme === 'auto' ? 'selected' : ''}>Automático</option></select></label>
      </div>
      <p class="muted small center">GymLog v${VERSION} · ${S.state.workouts.length} entrenos · ${S.allExercises().length} ejercicios<br>
      Imágenes de ejercicios: free-exercise-db (dominio público).<br><span class="persist"></span></p>`;
    App.tools.bind(el);

    el.querySelectorAll('[data-s]').forEach(inp => inp.onchange = () => {
      const k = inp.dataset.s;
      let v = inp.type === 'checkbox' ? inp.checked : inp.value;
      if (k === 'rest') v = parseInt(v) || 90;
      if (k === 'barKg') v = parseFloat(v) || 20;
      if (k === 'plates') v = v.split(/[,\s]+/).map(Number).filter(n => n > 0).sort((a, b) => b - a);
      S.setSetting(k, v);
      if (k === 'theme') App.applyTheme();
      UI.toast('Ajuste guardado');
    });

    el.querySelector('[data-a=export]').onclick = exportJSON;
    el.querySelector('[data-a=import]').onclick = () => el.querySelector('[data-in=json]').click();
    el.querySelector('[data-a=strong]').onclick = () => el.querySelector('[data-in=csv]').click();
    el.querySelector('[data-a=csv]').onclick = () => U.download(`gymlog-${U.dayKey(new Date())}.csv`, '﻿' + S.exportCSV(), 'text/csv');
    el.querySelector('[data-a=wipe]').onclick = async () => {
      if (!await UI.confirm('Esto borra TODO en este dispositivo (entrenos, plantillas, medidas). ¿Seguro? Descarga antes un respaldo.', { danger: true, ok: 'Borrar todo' })) return;
      await S.importData({ app: 'GymLog', workouts: [], templates: [], customExercises: [], body: [], measures: [], exMeta: {}, tombstones: {}, settings: S.state.settings }, 'replace');
      UI.toast('Datos borrados'); UI.refresh();
    };
    el.querySelector('[data-in=json]').onchange = async (e) => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      let data; try { data = JSON.parse(await file.text()); } catch { return UI.toast('El archivo no es un JSON válido'); }
      if (data.app !== 'GymLog') return UI.toast('El archivo no es un respaldo de GymLog');
      UI.actions([
        { label: `Combinar (recomendado) · ${data.workouts?.length || 0} entrenos en el archivo`, onClick: async () => { await S.importData(data, 'merge'); UI.toast('Datos combinados'); UI.refresh(); } },
        { label: 'Reemplazar todo con el archivo', danger: true, onClick: async () => { if (await UI.confirm('Se reemplazará todo lo de este dispositivo por el archivo.', { danger: true, ok: 'Reemplazar' })) { await S.importData(data, 'replace'); App.applyTheme(); UI.toast('Datos reemplazados'); UI.refresh(); } } },
      ], `Respaldo del ${data.exportedAt ? U.fmtDate(data.exportedAt, { time: true }) : '?'}`);
    };
    el.querySelector('[data-in=csv]').onchange = async (e) => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      try { const n = S.importStrongCSV(await file.text()); UI.toast(`${n} entrenos importados`); UI.refresh(); }
      catch (err) { console.error(err); UI.toast('No pude leer el CSV'); }
    };
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => { const s = el.querySelector('.persist'); if (s) s.textContent = p ? 'Almacenamiento persistente activado ✓' : 'Almacenamiento no persistente: instala la app en pantalla de inicio y respalda seguido.'; });
  };

  /** En iPhone abre el menú Compartir (guardar en Archivos / AirDrop); en PC descarga el archivo */
  const exportJSON = async () => {
    const name = `gymlog-${U.dayKey(new Date())}.json`;
    const text = JSON.stringify(S.exportData(), null, 1);
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({ files: [file], title: 'Respaldo GymLog' });
        S.markBackup(); UI.toast('Respaldo listo'); UI.refresh(); return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
    U.download(name, text);
    S.markBackup(); UI.toast('Respaldo descargado'); UI.refresh();
  };

  return { render, exportJSON };
})();
