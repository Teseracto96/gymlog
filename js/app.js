/* ============================================================
   app.js — arranque: carga datos, registra pestañas y service worker
   ============================================================ */
(async () => {
  const S = App.store, UI = App.ui;

  App.applyTheme = () => {
    const t = S.state.settings.theme;
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name=theme-color]').content = dark ? '#0f1115' : '#f5f6f8';
  };

  await S.load();
  App.applyTheme();
  App.db.persist();

  UI.registerTab('history', App.history);
  UI.registerTab('workout', App.workout);
  UI.registerTab('exercises', App.exercises);
  UI.registerTab('progress', App.progress);
  UI.registerTab('more', App.settings);

  App.workout.timer.init();
  document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => UI.showTab(b.dataset.tab));
  document.getElementById('mini-bar').onclick = App.workout.openActive;

  let start = 'workout';
  try { start = localStorage.getItem('gymlog:tab') || 'workout'; } catch { }
  UI.showTab(start);
  setInterval(App.workout.updateMiniBar, 1000);
  App.workout.updateMiniBar();

  // si había un entreno en curso (se cerró la app), lo reabre
  if (S.state.active) App.workout.openActive();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
  }
})();
