/* ============================================================
   modules/tools.js — calculadora de discos, calentamiento y 1RM
   ============================================================ */
App.tools = (() => {
  const U = App.utils, S = App.store, UI = App.ui;

  /** Discos por lado (algoritmo voraz con los discos disponibles) */
  const platesFor = (total, bar, plates) => {
    let side = (total - bar) / 2; const out = [];
    if (side < 0) return { out, rest: side };
    for (const p of [...plates].sort((a, b) => b - a)) { while (side >= p - 1e-9) { out.push(p); side -= p; } }
    return { out, rest: U.round(side, 2) };
  };

  const plateCalc = () => {
    const st = S.state.settings;
    const f = U.h(`<div class="form">
      <div class="grid2"><label class="field"><span>Peso total (kg)</span><input class="t" inputmode="decimal" placeholder="Ej. 100"></label>
      <label class="field"><span>Barra (kg)</span><input class="b" inputmode="decimal" value="${st.barKg}"></label></div>
      <div class="plates-out"></div>
      <p class="muted small">Discos disponibles: ${st.plates.join(', ')} kg (se cambian en Ajustes).</p></div>`);
    UI.sheet(f, { title: 'Calculadora de discos' });
    const calc = () => {
      const t = parseFloat(f.querySelector('.t').value), b = parseFloat(f.querySelector('.b').value) || 0;
      const o = f.querySelector('.plates-out');
      if (!t) { o.innerHTML = ''; return; }
      const r = platesFor(t, b, st.plates);
      o.innerHTML = r.rest < 0 ? `<div class="empty small">El peso es menor que la barra.</div>` :
        `<div class="plates-viz">${r.out.map(p => `<span class="plate p${String(p).replace('.', '_')}" style="height:${40 + p * 2.4}px">${p}</span>`).join('') || '<span class="muted">Sólo barra</span>'}</div>
         <p class="center">Por lado: <b>${r.out.join(' + ') || '0'}</b>${r.rest ? ` <small class="muted">(faltan ${r.rest} kg por lado)</small>` : ''}</p>`;
    };
    f.querySelectorAll('input').forEach(i => i.oninput = calc);
  };

  const warmup = () => {
    const f = U.h(`<div class="form"><label class="field"><span>Peso de trabajo (kg)</span><input class="t" inputmode="decimal" placeholder="Ej. 60"></label><div class="out"></div></div>`);
    UI.sheet(f, { title: 'Series de calentamiento' });
    f.querySelector('.t').oninput = (e) => {
      const w = parseFloat(e.target.value), bar = S.state.settings.barKg;
      if (!w) return f.querySelector('.out').innerHTML = '';
      const scheme = [[0, 10], [0.5, 5], [0.7, 3], [0.85, 2]];
      f.querySelector('.out').innerHTML = `<div class="card">${scheme.map(([p, r]) => { const kg = p ? Math.max(bar, Math.round(w * p / 2.5) * 2.5) : bar; return `<div class="kv"><span>${p ? Math.round(p * 100) + '%' : 'Barra sola'}</span><b>${kg} kg × ${r}</b></div>`; }).join('')}<div class="kv"><span>Trabajo</span><b>${w} kg</b></div></div>`;
    };
  };

  const oneRM = () => {
    const f = U.h(`<div class="form"><div class="grid2"><label class="field"><span>Peso (kg)</span><input class="w" inputmode="decimal"></label>
      <label class="field"><span>Reps</span><input class="r" inputmode="numeric"></label></div><div class="out"></div>
      <p class="muted small">Fórmula de Epley. Es una estimación: más confiable entre 3 y 10 reps.</p></div>`);
    UI.sheet(f, { title: 'Calculadora 1RM', tall: true });
    const calc = () => {
      const w = parseFloat(f.querySelector('.w').value), r = parseInt(f.querySelector('.r').value);
      if (!w || !r) return f.querySelector('.out').innerHTML = '';
      const one = U.e1rm(w, r);
      f.querySelector('.out').innerHTML = `<div class="big-num">${U.round(one, 1)} kg</div><div class="card">${[1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map(n => `<div class="kv"><span>${n} reps</span><b>${U.round(n === 1 ? one : one / (1 + n / 30), 1)} kg</b></div>`).join('')}</div>`;
    };
    f.querySelectorAll('input').forEach(i => i.oninput = calc);
  };

  const html = `<div class="card tools">
      <button class="tool" data-t="plates"><span>🔩</span>Calculadora de discos</button>
      <button class="tool" data-t="warm"><span>🔥</span>Series de calentamiento</button>
      <button class="tool" data-t="1rm"><span>📈</span>Calculadora 1RM</button>
      <button class="tool" data-t="timer"><span>⏱</span>Timer de descanso</button></div>`;
  const bind = (el) => el.querySelectorAll('.tool').forEach(b => b.onclick = () => ({
    plates: plateCalc, warm: warmup, '1rm': oneRM,
    timer: async () => { const v = await UI.prompt('Segundos', S.state.settings.rest, { type: 'number' }); if (v) App.workout.timer.start(+v); },
  })[b.dataset.t]());

  return { html, bind, platesFor };
})();
