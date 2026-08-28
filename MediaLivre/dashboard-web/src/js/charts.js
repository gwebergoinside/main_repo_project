// Gráficos em SVG inline — sem dependências externas.
// Cada função devolve uma string de markup pronta para innerHTML.

import { formatValue } from './format.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const round = (n, d = 1) => Number(n.toFixed(d));

/** Escala linear de [d0,d1] para [r0,r1]. */
function scale(d0, d1, r0, r1) {
  const span = d1 - d0 || 1;
  return v => r0 + ((v - d0) / span) * (r1 - r0);
}

/* ------------------------------------------------------------------ */
/* Sparkline — tendência dentro do KPI card                            */
/* ------------------------------------------------------------------ */
export function sparkline(values, { w = 84, h = 26, cls = 'spark-pos' } = {}) {
  if (!values || values.length < 2) return '';
  const x = scale(0, values.length - 1, 1, w - 1);
  const y = scale(Math.min(...values), Math.max(...values), h - 3, 3);
  const pts = values.map((v, i) => round(x(i)) + ',' + round(y(v))).join(' ');
  const last = values.at(-1);
  return `<svg class="spark ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${round(x(values.length - 1))}" cy="${round(y(last))}" r="2" fill="currentColor"/>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* Bullet — pacing: realizado vs. esperado vs. meta                    */
/* ------------------------------------------------------------------ */
export function bullet({ actual, target, reference, max, label, sublabel }) {
  const pct = v => Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="bullet">
    <div class="bullet-head"><span>${esc(label)}</span><b>${esc(sublabel)}</b></div>
    <svg viewBox="0 0 100 14" preserveAspectRatio="none" class="bullet-svg" aria-hidden="true">
      <rect x="0" y="3" width="100" height="8" rx="2" class="b-track"/>
      <rect x="0" y="3" width="${round(pct(target))}" height="8" rx="2" class="b-target"/>
      <rect x="0" y="4.5" width="${round(pct(actual))}" height="5" rx="1.5" class="b-actual"/>
      <rect x="${round(pct(reference)) - 0.35}" y="1" width="0.7" height="12" class="b-ref"/>
    </svg>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Anel de progresso — % de atingimento                                */
/* ------------------------------------------------------------------ */
export function ring(pct, { size = 118, label = '', caption = '' } = {}) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  const tone = pct >= 0.95 ? 'ok' : pct >= 0.8 ? 'warn' : 'bad';
  return `<div class="ring-wrap">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="ring ring-${tone}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bar"
        stroke-dasharray="${round(c, 2)}" stroke-dashoffset="${round(off, 2)}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text x="50%" y="48%" class="ring-value">${formatValue(pct, 'percent')}</text>
      <text x="50%" y="64%" class="ring-label">${esc(label)}</text>
    </svg>
    <p class="ring-caption">${esc(caption)}</p>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Combo mensal — barras (ano atual) + linha (ano anterior)            */
/* ------------------------------------------------------------------ */
export function monthlyCombo(rows, { w = 620, h = 232 } = {}) {
  const pad = { t: 12, r: 8, b: 22, l: 46 };
  const max = Math.max(...rows.flatMap(r => [r.billing, r.billing_ly])) * 1.12;
  const x = scale(0, rows.length, pad.l, w - pad.r);
  const y = scale(0, max, h - pad.b, pad.t);
  const step = x(1) - x(0);
  const bw = step * 0.55;

  const bars = rows.map((r, i) => {
    const bx = x(i) + (step - bw) / 2;
    return `<rect class="c-bar" x="${round(bx)}" y="${round(y(r.billing))}" width="${round(bw)}"
      height="${round(h - pad.b - y(r.billing))}" rx="2"><title>${esc(r.mes)}: ${formatValue(r.billing, 'currency')}</title></rect>`;
  }).join('');

  const linePts = rows.map((r, i) => round(x(i) + step / 2) + ',' + round(y(r.billing_ly))).join(' ');

  const gridY = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const gy = round(y(max * f));
    return `<line class="c-grid" x1="${pad.l}" y1="${gy}" x2="${w - pad.r}" y2="${gy}"/>
      <text class="c-axis" x="${pad.l - 6}" y="${gy + 3}" text-anchor="end">${round(max * f / 1e6, 1)}M</text>`;
  }).join('');

  const dots = rows.map((r, i) =>
    `<circle class="c-dot" cx="${round(x(i) + step / 2)}" cy="${round(y(r.billing_ly))}" r="2.5"><title>${esc(r.mes)} (ano anterior): ${formatValue(r.billing_ly, 'currency')}</title></circle>`).join('');

  const labels = rows.map((r, i) =>
    `<text class="c-axis" x="${round(x(i) + step / 2)}" y="${h - 6}" text-anchor="middle">${esc(r.mes)}</text>`).join('');

  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Faturamento mensal comparado com o ano anterior">
    ${gridY}${bars}
    <polyline class="c-line" points="${linePts}" fill="none"/>
    ${dots}${labels}
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* Funil de negociações                                                */
/* ------------------------------------------------------------------ */
export function funnel(steps) {
  const top = steps[0] ? steps[0].value : 1;
  return `<ul class="funnel">${steps.map((s, i) => {
    const pct = s.value / top;
    const drop = i === 0 ? null : (s.value / steps[i - 1].value) - 1;
    const dropTxt = drop === null ? ''
      : ` · <i class="${drop < -0.1 ? 'neg' : ''}">${formatValue(drop, 'percent')} vs. etapa anterior</i>`;
    return `<li class="funnel-step">
      <div class="funnel-meta"><span>${esc(s.label)}</span><b>${formatValue(s.value, 'integer')}</b></div>
      <div class="funnel-bar"><span style="width:${round(pct * 100)}%"></span></div>
      <div class="funnel-sub">${formatValue(pct, 'percent')} do topo${dropTxt}</div>
    </li>`;
  }).join('')}</ul>`;
}

/* ------------------------------------------------------------------ */
/* Barras horizontais com ranking                                      */
/* ------------------------------------------------------------------ */
export function rankBars(items, { valueKey, labelKey, format = 'currency', deltaKey = null }) {
  const max = Math.max(...items.map(i => i[valueKey])) || 1;
  return `<ul class="rank">${items.map(it => {
    const d = deltaKey ? it[deltaKey] : null;
    const dCls = d == null ? '' : d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    const arrow = d == null ? '' : (d > 0 ? '▲' : d < 0 ? '▼' : '—') + ' ' + formatValue(Math.abs(d), 'percent');
    return `<li>
      <span class="rank-label">${esc(it[labelKey])}</span>
      <span class="rank-bar"><i style="width:${round((it[valueKey] / max) * 100)}%"></i></span>
      <span class="rank-value">${formatValue(it[valueKey], format)}</span>
      <span class="rank-delta ${dCls}">${arrow}</span>
    </li>`;
  }).join('')}</ul>`;
}

/* ------------------------------------------------------------------ */
/* Barra 100% empilhada — share de mercado                             */
/* ------------------------------------------------------------------ */
export function stacked100(items) {
  const seg = items.map((it, i) =>
    `<span class="st-seg ${it.self ? 'is-self' : ''} tone-${i}" style="width:${round(it.pct * 100)}%"
      title="${esc(it.player)}: ${formatValue(it.pct, 'percent')}"></span>`).join('');
  const leg = items.map((it, i) => {
    const d = it.pct_ly == null ? null : it.pct - it.pct_ly;
    const dCls = d == null ? 'flat' : d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    const dTxt = d == null ? '' : (d > 0 ? '+' : '') + round(d * 100, 1) + ' p.p.';
    return `<li><i class="dot tone-${i} ${it.self ? 'is-self' : ''}"></i>
      <span>${esc(it.player)}</span><b>${formatValue(it.pct, 'percent')}</b>
      <em class="${dCls}">${dTxt}</em></li>`;
  }).join('');
  return `<div class="stacked">${seg}</div><ul class="stacked-legend">${leg}</ul>`;
}

/* ------------------------------------------------------------------ */
/* Heatmap canal × daypart                                             */
/* ------------------------------------------------------------------ */
export function heatmap({ canais, dayparts, values }) {
  const max = Math.max(...values.flat()) || 1;
  const head = `<div class="hm-cell hm-corner"></div>` +
    dayparts.map(d => `<div class="hm-cell hm-head">${esc(d)}</div>`).join('');
  const body = canais.map((c, r) =>
    `<div class="hm-cell hm-row">${esc(c)}</div>` +
    values[r].map((v, i) =>
      `<div class="hm-cell hm-val" style="--t:${round(v / max, 3)}"
        title="${esc(c)} · ${esc(dayparts[i])}: ${formatValue(v, 'decimal')}">${formatValue(v, 'integer')}</div>`
    ).join('')).join('');
  return `<div class="heatmap" style="grid-template-columns: 92px repeat(${dayparts.length}, 1fr)">${head}${body}</div>`;
}

/* ------------------------------------------------------------------ */
/* Dispersão GRP × CPR — eficiência por canal                          */
/* ------------------------------------------------------------------ */
export function scatter(items, { w = 620, h = 210 } = {}) {
  const pad = { t: 18, r: 18, b: 26, l: 54 };
  const gx = items.map(i => i.grp_eq);
  const cy = items.map(i => i.cpr_eq);
  const yMin = Math.min(...cy) * 0.9;
  const yMax = Math.max(...cy) * 1.08;
  const x = scale(Math.min(...gx) * 0.8, Math.max(...gx) * 1.12, pad.l, w - pad.r);
  const y = scale(yMin, yMax, h - pad.b, pad.t);
  const rMax = Math.max(...items.map(i => i.faturamento)) || 1;

  const grid = [0, 0.5, 1].map(f => {
    const v = yMin + f * (yMax - yMin);
    return `<line class="c-grid" x1="${pad.l}" y1="${round(y(v))}" x2="${w - pad.r}" y2="${round(y(v))}"/>
      <text class="c-axis" x="${pad.l - 6}" y="${round(y(v)) + 3}" text-anchor="end">${Math.round(v)}€</text>`;
  }).join('');

  const pts = items.map(it => {
    const r = 6 + 16 * Math.sqrt(it.faturamento / rMax);
    return `<g class="sc-pt">
      <circle cx="${round(x(it.grp_eq))}" cy="${round(y(it.cpr_eq))}" r="${round(r)}">
        <title>${esc(it.canal)} — GRP ${formatValue(it.grp_eq, 'decimal')}, CPR ${formatValue(it.cpr_eq, 'currency')}, ${formatValue(it.faturamento, 'currency')}</title>
      </circle>
      <text x="${round(x(it.grp_eq))}" y="${round(y(it.cpr_eq) - r - 5)}" text-anchor="middle" class="sc-label">${esc(it.canal)}</text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Eficiência: GRP equivalente por CPR equivalente">
    ${grid}${pts}
    <text class="c-axis" x="${w / 2}" y="${h - 4}" text-anchor="middle">GRP eq. 30&quot; →</text>
    <text class="c-axis" x="10" y="${pad.t - 4}">CPR ↑</text>
  </svg>`;
}
