/* ============================================================
   core/ui.js — navegación por pestañas, páginas apiladas, hojas,
   avisos (toast), confirmaciones y menús de acciones
   ============================================================ */
App.ui = (() => {
  const U = App.utils;
  const tabs = {};          // id -> módulo {title, render(el)}
  let current = null;
  const layer = () => document.getElementById('layers');

  const registerTab = (id, mod) => { tabs[id] = mod; };

  const showTab = (id) => {
    current = id;
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    const main = document.getElementById('view');
    main.innerHTML = '';
    main.scrollTop = 0;
    tabs[id].render(main);
    try { localStorage.setItem('gymlog:tab', id); } catch { }
  };
  const refresh = () => { if (current && !document.querySelector('#view .no-refresh')) showTab(current); };
  const currentTab = () => current;

  /** Página completa apilada (con botón atrás). Devuelve {el, body, close} */
  const page = (title, { right = '', onClose } = {}) => {
    const el = U.h(`<section class="page">
      <header class="page-head">
        <button class="icon-btn back" aria-label="Atrás">‹</button>
        <h2>${U.esc(title)}</h2>
        <div class="head-right">${right}</div>
      </header>
      <div class="page-body"></div>
    </section>`);
    const close = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 180); onClose && onClose(); };
    el.querySelector('.back').onclick = close;
    layer().appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
    return { el, body: el.querySelector('.page-body'), close, setTitle: (t) => el.querySelector('h2').textContent = t };
  };

  /** Hoja inferior (modal). content: string HTML o elemento */
  const sheet = (content, { title = '', onClose, tall = false } = {}) => {
    const el = U.h(`<div class="sheet-wrap"><div class="sheet ${tall ? 'tall' : ''}">
      <div class="sheet-grip"></div>
      ${title ? `<div class="sheet-title">${U.esc(title)}</div>` : ''}
      <div class="sheet-body"></div></div></div>`);
    const body = el.querySelector('.sheet-body');
    if (typeof content === 'string') body.innerHTML = content; else body.appendChild(content);
    const close = () => { el.classList.remove('open'); setTimeout(() => el.remove(), 200); onClose && onClose(); };
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    layer().appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
    return { el, body, close };
  };

  /** Menú de acciones. actions: [{label, danger?, onClick}] */
  const actions = (actionsList, title = '') => {
    const wrap = U.h(`<div class="action-list"></div>`);
    const sh = sheet(wrap, { title });
    actionsList.filter(Boolean).forEach(a => {
      const b = U.h(`<button class="action ${a.danger ? 'danger' : ''}">${U.esc(a.label)}</button>`);
      b.onclick = () => { sh.close(); setTimeout(() => a.onClick(), 50); };
      wrap.appendChild(b);
    });
    const c = U.h(`<button class="action cancel">Cancelar</button>`); c.onclick = sh.close; wrap.appendChild(c);
  };

  const confirm = (msg, { ok = 'Aceptar', danger = false } = {}) => new Promise(res => {
    const el = U.h(`<div><p class="confirm-msg">${U.esc(msg)}</p>
      <div class="row gap"><button class="btn ghost grow" data-a="no">Cancelar</button><button class="btn grow ${danger ? 'danger' : ''}" data-a="yes">${U.esc(ok)}</button></div></div>`);
    const sh = sheet(el, { onClose: () => res(false) });
    el.querySelector('[data-a=no]').onclick = () => sh.close();
    el.querySelector('[data-a=yes]').onclick = () => { res(true); sh.el.remove(); };
  });

  const prompt = (label, value = '', { placeholder = '', type = 'text' } = {}) => new Promise(res => {
    const el = U.h(`<form><label class="field"><span>${U.esc(label)}</span>
      <input type="${type}" value="${U.esc(value)}" placeholder="${U.esc(placeholder)}" autocomplete="off"></label>
      <div class="row gap"><button type="button" class="btn ghost grow" data-a="no">Cancelar</button><button class="btn grow">Guardar</button></div></form>`);
    const sh = sheet(el, { onClose: () => res(null) });
    const inp = el.querySelector('input'); setTimeout(() => inp.focus(), 250);
    el.querySelector('[data-a=no]').onclick = () => sh.close();
    el.onsubmit = (e) => { e.preventDefault(); res(inp.value.trim()); sh.el.remove(); };
  });

  let toastTimer;
  const toast = (msg) => {
    let t = document.getElementById('toast');
    if (!t) { t = U.h('<div id="toast"></div>'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  return { registerTab, showTab, refresh, currentTab, page, sheet, actions, confirm, prompt, toast };
})();
