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
    values[r].map((v, i) => {
      const t = v / max;
      // Acima de ~55% de intensidade o fundo fica claro demais para texto claro.
      return `<div class="hm-cell hm-val ${t > 0.55 ? 'is-hot' : ''}" style="--t:${round(t, 3)}"
        title="${esc(c)} · ${esc(dayparts[i])}: ${formatValue(v, 'decimal')}">${formatValue(v, 'integer')}</div>`;
    }).join('')).join('');
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

/* ------------------------------------------------------------------ */
/* Cascata — bruto → descontos → líquido                               */
/* ------------------------------------------------------------------ */
export function waterfall(steps, { w = 620, h = 235 } = {}) {
  const pad = { t: 26, r: 10, b: 34, l: 52 };

  // Posição acumulada de cada barra: as de tipo start/total assentam no zero.
  let run = 0;
  const bars = steps.map(s => {
    const isAnchor = s.type === 'start' || s.type === 'total';
    const from = isAnchor ? 0 : run;
    const to = isAnchor ? s.value : run + s.value;
    run = to;
    return { ...s, from, to, isAnchor };
  });

  const max = Math.max(...bars.map(b => Math.max(b.from, b.to))) * 1.08;
  const x = scale(0, steps.length, pad.l, w - pad.r);
  const y = scale(0, max, h - pad.b, pad.t);
  const step = x(1) - x(0);
  const bw = step * 0.56;

  const grid = [0, 0.5, 1].map(f => {
    const gy = round(y(max * f));
    return `<line class="c-grid" x1="${pad.l}" y1="${gy}" x2="${w - pad.r}" y2="${gy}"/>
      <text class="c-axis" x="${pad.l - 6}" y="${gy + 3}" text-anchor="end">${round(max * f / 1e6, 1)}M</text>`;
  }).join('');

  const rects = bars.map((b, i) => {
    const bx = x(i) + (step - bw) / 2;
    const top = Math.min(y(b.from), y(b.to));
    const hh = Math.max(2, Math.abs(y(b.to) - y(b.from)));
    const cls = b.isAnchor ? 'wf-anchor' : b.value < 0 ? 'wf-neg' : 'wf-pos';
    const connector = i < bars.length - 1 && !bars[i + 1].isAnchor
      ? `<line class="wf-link" x1="${round(bx + bw)}" y1="${round(y(b.to))}" x2="${round(x(i + 1) + (step - bw) / 2)}" y2="${round(y(b.to))}"/>`
      : '';
    return `${connector}<rect class="${cls}" x="${round(bx)}" y="${round(top)}" width="${round(bw)}" height="${round(hh)}" rx="2">
        <title>${esc(b.label)}: ${formatValue(b.value, 'currency')}</title></rect>
      <text class="wf-value" x="${round(bx + bw / 2)}" y="${round(top - 5)}" text-anchor="middle">${
        (b.value > 0 && !b.isAnchor ? '+' : '') + formatValue(b.value, 'currency')}</text>
      <text class="c-axis" x="${round(bx + bw / 2)}" y="${h - 12}" text-anchor="middle">${esc(b.label.split(' ')[0])}</text>
      <text class="c-axis" x="${round(bx + bw / 2)}" y="${h - 3}" text-anchor="middle">${esc(b.label.split(' ').slice(1).join(' '))}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Cascata do bruto ao líquido">${grid}${rects}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Dumbbell — dois valores por linha (negociado vs. fechado)           */
/* ------------------------------------------------------------------ */
export function dumbbell(items, { labelKey, aKey, bKey, aLabel, bLabel, subKey = null, format = 'currency' }) {
  const max = Math.max(...items.flatMap(i => [i[aKey], i[bKey]])) * 1.02 || 1;
  const rows = items.map(it => {
    const a = (it[aKey] / max) * 100;
    const b = (it[bKey] / max) * 100;
    const pc = it[aKey] ? it[bKey] / it[aKey] : 0;
    const tone = pc >= 0.9 ? 'ok' : pc >= 0.7 ? 'warn' : 'bad';
    return `<li>
      <span class="db-label">${esc(it[labelKey])}${subKey ? `<em>${esc(it[subKey])}</em>` : ''}</span>
      <span class="db-track">
        <i class="db-line" style="left:${round(Math.min(a, b))}%;width:${round(Math.abs(a - b))}%"></i>
        <i class="db-dot db-a" style="left:${round(a)}%" title="${esc(aLabel)}: ${formatValue(it[aKey], format)}"></i>
        <i class="db-dot db-b" style="left:${round(b)}%" title="${esc(bLabel)}: ${formatValue(it[bKey], format)}"></i>
      </span>
      <span class="db-value">${formatValue(it[bKey], format)}</span>
      <span class="db-pct tone-${tone}">${formatValue(pc, 'percent')}</span>
    </li>`;
  }).join('');

  return `<div class="db-legend">
      <i class="db-dot db-a"></i><span>${esc(aLabel)}</span>
      <i class="db-dot db-b"></i><span>${esc(bLabel)}</span>
    </div>
    <ul class="dumbbell">${rows}</ul>`;
}

/* ------------------------------------------------------------------ */
/* Barras divergentes — desvios em torno do zero                       */
/* ------------------------------------------------------------------ */
export function divergingBars(items, { labelKey, valueKey, w = 620, h = 180 } = {}) {
  const pad = { t: 16, r: 10, b: 20, l: 40 };
  const vals = items.map(i => i[valueKey]);
  const bound = Math.max(...vals.map(Math.abs)) * 1.25 || 1;
  const x = scale(0, items.length, pad.l, w - pad.r);
  const y = scale(-bound, bound, h - pad.b, pad.t);
  const step = x(1) - x(0);
  const bw = step * 0.5;
  const zero = y(0);

  const bars = items.map((it, i) => {
    const v = it[valueKey];
    const bx = x(i) + (step - bw) / 2;
    const top = v >= 0 ? y(v) : zero;
    const hh = Math.max(1.5, Math.abs(y(v) - zero));
    return `<rect class="${v >= 0 ? 'dv-pos' : 'dv-neg'}" x="${round(bx)}" y="${round(top)}"
        width="${round(bw)}" height="${round(hh)}" rx="2">
        <title>${esc(it[labelKey])}: ${formatValue(v, 'percent')}</title></rect>
      <text class="dv-value" x="${round(bx + bw / 2)}" y="${round(v >= 0 ? top - 4 : top + hh + 9)}"
        text-anchor="middle">${formatValue(v, 'percent')}</text>
      <text class="c-axis" x="${round(bx + bw / 2)}" y="${h - 5}" text-anchor="middle">${esc(it[labelKey])}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Desvio face ao projetado">
    <line class="c-grid" x1="${pad.l}" y1="${round(zero)}" x2="${w - pad.r}" y2="${round(zero)}"/>
    <text class="c-axis" x="${pad.l - 6}" y="${round(zero) + 3}" text-anchor="end">0%</text>
    ${bars}
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* Histograma — distribuição com marcador de média                     */
/* ------------------------------------------------------------------ */
export function histogram(bins, { labelKey, valueKey, marker = null, markerLabel = '', w = 620, h = 200 } = {}) {
  const pad = { t: 22, r: 12, b: 26, l: 46 };
  const max = Math.max(...bins.map(b => b[valueKey])) * 1.15;
  const x = scale(0, bins.length, pad.l, w - pad.r);
  const y = scale(0, max, h - pad.b, pad.t);
  const step = x(1) - x(0);
  const bw = step * 0.72;

  const cols = bins.map((b, i) => {
    const bx = x(i) + (step - bw) / 2;
    return `<rect class="c-bar" x="${round(bx)}" y="${round(y(b[valueKey]))}" width="${round(bw)}"
        height="${round(h - pad.b - y(b[valueKey]))}" rx="2">
        <title>${esc(b[labelKey])}&quot;: ${formatValue(b[valueKey], 'integer')} inserções</title></rect>
      <text class="wf-value" x="${round(bx + bw / 2)}" y="${round(y(b[valueKey]) - 5)}" text-anchor="middle">${formatValue(b[valueKey], 'integer')}</text>
      <text class="c-axis" x="${round(bx + bw / 2)}" y="${h - 8}" text-anchor="middle">${esc(b[labelKey])}&quot;</text>`;
  }).join('');

  // Marcador da média: interpolado linearmente entre os centros dos dois bins vizinhos.
  let markerEl = '';
  if (marker != null) {
    const labels = bins.map(b => Number(b[labelKey]));
    const center = i => x(i) + step / 2;
    let idx = labels.findIndex(v => v >= marker);
    let mx;
    if (idx <= 0) {
      mx = center(idx < 0 ? labels.length - 1 : 0);
    } else {
      const frac = (marker - labels[idx - 1]) / (labels[idx] - labels[idx - 1]);
      mx = center(idx - 1) + frac * step;
    }
    markerEl = `<line class="hg-marker" x1="${round(mx)}" y1="${pad.t - 6}" x2="${round(mx)}" y2="${h - pad.b}"/>
      <text class="hg-marker-label" x="${round(mx)}" y="${pad.t - 10}" text-anchor="middle">${esc(markerLabel)}</text>`;
  }

  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Distribuição de inserções por duração">${cols}${markerEl}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Barras com marcador — valor + referência numa 2.ª escala            */
/* ------------------------------------------------------------------ */
export function markerBars(items, { labelKey, barKey, barFormat = 'percent', markerKey = null, markerFormat = 'decimal', markerLabel = '', noteKey = null }) {
  const max = Math.max(...items.map(i => i[barKey])) * 1.15 || 1;
  const rows = items.map(it => `<li>
      <span class="mb-label">${esc(it[labelKey])}</span>
      <span class="mb-track"><i style="width:${round((it[barKey] / max) * 100)}%"></i></span>
      <span class="mb-value">${formatValue(it[barKey], barFormat)}</span>
      ${markerKey ? `<span class="mb-marker" title="${esc(markerLabel)}">${formatValue(it[markerKey], markerFormat)}</span>` : ''}
      ${noteKey ? `<span class="mb-note">${formatValue(it[noteKey], 'integer')}</span>` : ''}
    </li>`).join('');
  return `<ul class="markerbars">${rows}</ul>`;
}

/* ------------------------------------------------------------------ */
/* Progresso com meta — realizado vs. ambição por linha                */
/* ------------------------------------------------------------------ */
export function targetBars(items, { labelKey, valueKey, targetKey, subKey = null, format = 'currency' }) {
  const max = Math.max(...items.flatMap(i => [i[valueKey], i[targetKey]])) || 1;
  const rows = items.map(it => {
    const pc = it[targetKey] ? it[valueKey] / it[targetKey] : 0;
    const tone = pc >= 1 ? 'ok' : pc >= 0.85 ? 'warn' : 'bad';
    return `<li>
      <span class="tb-label">${esc(it[labelKey])}${subKey ? `<em>${esc(it[subKey])}</em>` : ''}</span>
      <span class="tb-track">
        <i class="tb-fill tone-${tone}" style="width:${round((it[valueKey] / max) * 100)}%"></i>
        <i class="tb-target" style="left:${round((it[targetKey] / max) * 100)}%"
           title="Ambição: ${formatValue(it[targetKey], format)}"></i>
      </span>
      <span class="tb-value">${formatValue(it[valueKey], format)}</span>
      <span class="tb-pct tone-${tone}">${formatValue(pc, 'percent')}</span>
    </li>`;
  }).join('');
  return `<ul class="targetbars">${rows}</ul>`;
}

/* ------------------------------------------------------------------ */
/* Lista de risco — falta face a um mínimo contratado                  */
/* ------------------------------------------------------------------ */
export function riskList(items, { idKey, subKey, targetKey, actualKey, noteKey = null }) {
  const rows = items.map(it => {
    const gap = it[targetKey] - it[actualKey];
    const pc = it[targetKey] ? it[actualKey] / it[targetKey] : 0;
    // Verde só quando o mínimo já está coberto — abaixo dele nada é "bom".
    const tone = pc >= 1 ? 'ok' : pc >= 0.9 ? 'warn' : 'bad';
    return `<li class="risk-item tone-${tone}">
      <div class="risk-head">
        <span class="risk-id">${esc(it[idKey])}<em>${esc(it[subKey])}</em></span>
        <span class="risk-gap">${gap > 0 ? '−' : '+'}${formatValue(Math.abs(gap), 'currency')}</span>
      </div>
      <div class="risk-track"><i style="width:${round(Math.min(pc, 1) * 100)}%"></i></div>
      <div class="risk-sub">
        ${formatValue(it[actualKey], 'currency')} de ${formatValue(it[targetKey], 'currency')} mínimo
        · ${formatValue(pc, 'percent')}${noteKey ? ` · ${it[noteKey]} dias para o fim` : ''}
      </div>
    </li>`;
  }).join('');
  return `<ul class="risklist">${rows}</ul>`;
}

/* ------------------------------------------------------------------ */
/* Comparação homóloga — atual vs. ano anterior por métrica            */
/* ------------------------------------------------------------------ */
export function yoyRows(items) {
  return `<ul class="yoy">${items.map(it => {
    const delta = it.ly ? (it.atual / it.ly) - 1 : 0;
    const good = it.invert ? delta < 0 : delta > 0;
    const cls = delta === 0 ? 'flat' : good ? 'up' : 'down';
    return `<li>
      <span class="yoy-metric" title="medida: ${esc(it.hint)}">${esc(it.metrica)}</span>
      <span class="yoy-now">${formatValue(it.atual, it.format)}</span>
      <span class="yoy-ly">ant. ${formatValue(it.ly, it.format)}</span>
      <span class="yoy-delta ${cls}">${delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} ${formatValue(Math.abs(delta), 'percent')}</span>
    </li>`;
  }).join('')}</ul>`;
}

