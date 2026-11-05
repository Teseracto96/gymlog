/* ============================================================
   core/utils.js — utilidades generales (sin dependencias)
   ============================================================ */
window.App = window.App || {};

App.utils = (() => {
  const KG_PER_LB = 0.45359237;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /** Escapa texto para insertarlo en HTML */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Normaliza para búsquedas (sin acentos, minúsculas) */
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const round = (n, d = 1) => { const f = Math.pow(10, d); return Math.round(n * f) / f; };

  /** Convierte kg (almacenamiento) a la unidad de despliegue */
  const toUnit = (kg, unit) => (kg == null || kg === '') ? '' : (unit === 'lb' ? round(kg / KG_PER_LB, 1) : round(kg, 2) % 1 ? round(kg, kg % 0.25 ? 1 : 2) : kg);
  const fromUnit = (v, unit) => (v === '' || v == null || isNaN(v)) ? null : (unit === 'lb' ? Number(v) * KG_PER_LB : Number(v));

  /** 1RM estimado (Epley). Sólo tiene sentido para 1-12 reps */
  const e1rm = (w, r) => (!w || !r || w <= 0) ? 0 : (r === 1 ? w : w * (1 + r / 30));

  const pad = (n) => String(n).padStart(2, '0');

  const fmtDuration = (sec) => {
    if (sec == null || isNaN(sec)) return '—';
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}h ${pad(m)}m` : (m ? `${m}m ${pad(s)}s` : `${s}s`);
  };
  const fmtClock = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  };

  const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const fmtDate = (iso, opts = {}) => {
    const d = new Date(iso);
    let s = `${opts.noDay ? '' : DAYS[d.getDay()] + ', '}${d.getDate()} de ${MONTHS[d.getMonth()]}`;
    if (opts.year !== false && d.getFullYear() !== new Date().getFullYear()) s += ` ${d.getFullYear()}`;
    if (opts.time) s += `, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return s;
  };
  const fmtShortDate = (iso) => { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
  const monthLabel = (y, m) => `${MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1)} ${y}`;
  const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  /** Lunes de la semana de la fecha (clave de semana) */
  const weekStart = (iso) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d; };
  const toLocalInput = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  /** Crea un elemento desde HTML */
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  const download = (filename, content, mime = 'application/json') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };

  /** Gráfica de línea SVG simple. points: [{x: Date|number, y: number, label?}] */
  const lineChart = (points, { height = 160, unit = '', color = 'var(--accent)', avg = null } = {}) => {
    if (!points.length) return `<div class="empty small">Sin datos todavía</div>`;
    const W = 320, H = height, P = { l: 36, r: 10, t: 12, b: 22 };
    const xs = points.map(p => +p.x), ys = points.map(p => p.y).concat(avg ? avg.map(p => p.y) : []);
    let minX = Math.min(...xs), maxX = Math.max(...xs); if (minX === maxX) { minX -= 86400000; maxX += 86400000; }
    let minY = Math.min(...ys), maxY = Math.max(...ys); const pad = (maxY - minY) * 0.15 || Math.max(1, maxY * 0.1); minY -= pad; maxY += pad;
    const X = x => P.l + ((x - minX) / (maxX - minX)) * (W - P.l - P.r);
    const Y = y => P.t + (1 - (y - minY) / (maxY - minY)) * (H - P.t - P.b);
    const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${X(+p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
    const grid = [0, 0.5, 1].map(f => { const v = minY + (maxY - minY) * f; return `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${P.l - 4}" y="${Y(v) + 3}" text-anchor="end" class="axis">${round(v, v < 10 ? 1 : 0)}</text>`; }).join('');
    const first = new Date(minX), last = new Date(maxX);
    const dots = points.length <= 40 ? points.map(p => `<circle cx="${X(+p.x)}" cy="${Y(p.y)}" r="3" fill="${color}"/>`).join('') : '';
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">
      ${grid}
      ${avg && avg.length > 1 ? `<path d="${path(avg)}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 3"/>` : ''}
      <path d="${path(points)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
      ${dots}
      <text x="${P.l}" y="${H - 6}" class="axis">${fmtShortDate(first)}</text>
      <text x="${W - P.r}" y="${H - 6}" text-anchor="end" class="axis">${fmtShortDate(last)}</text>
      ${unit ? `<text x="${W - P.r}" y="${P.t}" text-anchor="end" class="axis">${unit}</text>` : ''}
    </svg>`;
  };

  /** Gráfica de barras SVG simple. bars: [{label, value}] */
  const barChart = (bars, { height = 150 } = {}) => {
    if (!bars.length) return `<div class="empty small">Sin datos todavía</div>`;
    const W = 320, H = height, P = { l: 8, r: 8, t: 14, b: 20 };
    const max = Math.max(1, ...bars.map(b => b.value));
    const bw = (W - P.l - P.r) / bars.length;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${bars.map((b, i) => {
        const bh = (b.value / max) * (H - P.t - P.b), x = P.l + i * bw + bw * 0.15, y = H - P.b - bh;
        return `<rect x="${x}" y="${y}" width="${bw * 0.7}" height="${Math.max(bh, b.value ? 2 : 0)}" rx="3" fill="var(--accent)"/>
          ${b.value ? `<text x="${x + bw * 0.35}" y="${y - 3}" text-anchor="middle" class="axis">${b.value}</text>` : ''}
          ${i % Math.ceil(bars.length / 6) === 0 ? `<text x="${x + bw * 0.35}" y="${H - 5}" text-anchor="middle" class="axis">${esc(b.label)}</text>` : ''}`;
      }).join('')}
    </svg>`;
  };

  return { KG_PER_LB, uid, esc, norm, round, toUnit, fromUnit, e1rm, fmtDuration, fmtClock, fmtDate, fmtShortDate, monthLabel, dayKey, weekStart, toLocalInput, h, debounce, download, lineChart, barChart, DAYS, MONTHS, pad };
})();
