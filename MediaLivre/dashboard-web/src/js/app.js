import { fetchDashboard, applyFilters, sourceLabel } from './data.js';
import { formatValue, formatDelta } from './format.js';
import {
  sparkline, bullet, ring, monthlyCombo, funnel, rankBars, stacked100, heatmap, scatter,
  waterfall, dumbbell, divergingBars, histogram, markerBars, targetBars, riskList, yoyRows
} from './charts.js';

// Estado central — é o que substitui o cross-filter nativo do Power BI.
const state = {
  filters: { canal: '', daypart: '', setor: '' },
  sort: { key: 'faturamento', dir: 'desc' },
  data: null
};

const $ = sel => document.querySelector(sel);
const set = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };

async function init() {
  state.data = await fetchDashboard(state);
  const { meta } = state.data;
  $('#lastUpdate').textContent = meta.last_data_updated;
  $('#periodo').textContent = meta.periodo;
  $('#fonte').textContent = sourceLabel(meta);
  $('#disclaimer').innerHTML = meta.source === 'mock'
    ? `Dados fictícios de <code>data/mock/dashboard.json</code> — a API ainda não respondeu.
       Cada indicador mapeia uma medida real do modelo (ver <code>docs/04-catalogo-indicadores.md</code>).`
    : `Dados servidos pela API (<code>${meta.source}</code>).
       Ver <code>docs/04-catalogo-indicadores.md</code> para a equivalência indicador ↔ medida DAX.`;

  renderFilters();
  render();

  // Delegação num contentor estável: sobrevive aos re-renders da tabela.
  $('main').addEventListener('click', e => {
    const th = e.target.closest('#detail thead th');
    if (th && th.dataset.sort) {
      const key = th.dataset.sort;
      state.sort = { key, dir: state.sort.key === key && state.sort.dir === 'desc' ? 'asc' : 'desc' };
      return renderTable();
    }
    // Cross-filter: clicar numa linha da tabela filtra o canal.
    const tr = e.target.closest('#detail tbody tr');
    if (tr && tr.dataset.canal) {
      state.filters.canal = state.filters.canal === tr.dataset.canal ? '' : tr.dataset.canal;
      const sel = $('#f-canal');
      if (sel) sel.value = state.filters.canal;
      render();
    }
  });

  // Realce da aba conforme a secção visível: o último título que já passou
  // a linha de 120px a contar do topo é a secção "atual".
  const links = [...document.querySelectorAll('.tabs .tab')];
  const titles = [...document.querySelectorAll('.section-title')];
  let queued = false;

  const activate = id => links.forEach(a =>
    a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));

  const syncTabs = () => {
    queued = false;
    const current = titles.filter(t => t.getBoundingClientRect().top <= 120).pop() || titles[0];
    if (current) activate(current.id);
  };

  // Clique e hashchange marcam a aba de imediato; o scroll só refina quando o
  // utilizador navega à mão. (Um clique não pode depender do evento de scroll:
  // em separadores em segundo plano o browser não o entrega.)
  $('#tabs').addEventListener('click', e => {
    const a = e.target.closest('.tab');
    if (a) activate(a.getAttribute('href').slice(1));
  });
  addEventListener('hashchange', () => activate(location.hash.slice(1)));

  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(syncTabs);
  }, { passive: true });

  syncTabs();
}

/* ---------------- filtros (slicers) ---------------- */

function renderFilters() {
  const f = state.data.filters;
  $('#filters').innerHTML = [
    slicer('canal', 'Canal', f.canal),
    slicer('daypart', 'Daypart', f.daypart),
    slicer('setor', 'Setor', f.setor),
    `<button class="btn-clear" id="clearFilters">Limpar filtros</button>`
  ].join('');

  $('#filters').addEventListener('change', e => {
    state.filters[e.target.name] = e.target.value;
    render();
  });
  $('#clearFilters').addEventListener('click', () => {
    state.filters = { canal: '', daypart: '', setor: '' };
    document.querySelectorAll('#filters select').forEach(s => { s.value = ''; });
    render();
  });
}

function slicer(name, label, options) {
  const opts = ['<option value="">Todos</option>', ...options.map(o => `<option>${o}</option>`)].join('');
  return `<div class="slicer"><label for="f-${name}">${label}</label>
    <select id="f-${name}" name="${name}">${opts}</select></div>`;
}

/* ---------------- render ---------------- */

function render() {
  const d = state.data;

  renderAlerts();
  renderKpis();
  renderPacing();

  set('#monthly', monthlyCombo(d.monthly));
  set('#funnel', funnel(d.funnel));
  set('#scatter', scatter(d.channels));
  set('#share', stacked100(d.share_mercado));
  set('#rankCanais', rankBars(d.channels, { valueKey: 'faturamento', labelKey: 'canal' }));
  set('#rankSetores', rankBars(d.setores, { valueKey: 'faturamento', labelKey: 'setor', deltaKey: 'delta' }));
  $('#hmMetric').textContent = d.heatmap.metric;
  set('#heatmap', heatmap(d.heatmap));

  set('#desvio', divergingBars(d.desvio_projecao, { labelKey: 'mes', valueKey: 'desvio' }));
  set('#ficheiros', dumbbell(d.ficheiros, {
    labelKey: 'ficheiro', subKey: 'cliente',
    aKey: 'negociado', bKey: 'fechado', aLabel: 'Negociado', bLabel: 'Fechado'
  }));
  set('#ambicao', targetBars(d.ficheiros, {
    labelKey: 'ficheiro', subKey: 'cliente', valueKey: 'fechado', targetKey: 'ambicao'
  }));
  set('#risco', riskList(d.risco, {
    idKey: 'negociacao', subKey: 'cliente',
    targetKey: 'minimo', actualKey: 'faturado', noteKey: 'dias_restantes'
  }));

  $('#cascataHint').textContent = d.cascata.hint;
  set('#cascata', waterfall(d.cascata.steps));

  set('#yoy', yoyRows(d.yoy_audiencia));
  set('#shareDim', markerBars(d.share_dimensoes, {
    labelKey: 'dimensao', barKey: 'atual', barFormat: 'percent',
    markerKey: 'ly', markerFormat: 'percent', markerLabel: 'ano anterior'
  }));

  $('#duracaoHint').textContent =
    `duração média ${formatValue(d.duracao.avg, 'decimal')}s · fitting ${formatValue(d.duracao.fitting, 'percent')}`;
  set('#duracao', histogram(d.duracao.bins, {
    labelKey: 'seg', valueKey: 'insercoes',
    marker: d.duracao.avg, markerLabel: `média ${formatValue(d.duracao.avg, 'decimal')}s`
  }));
  set('#posicao', markerBars(d.posicao, {
    labelKey: 'canal', barKey: 'pc_first', barFormat: 'percent',
    markerKey: 'avg_pos', markerFormat: 'decimal', markerLabel: 'posição média no break',
    noteKey: 'nr_first'
  }));

  renderTable();
}

function renderAlerts() {
  set('#alertas', state.data.alertas.map(a =>
    `<p class="alert alert-${a.nivel}">${a.texto}</p>`).join(''));
}

// Nota: com o mock os KPIs vêm pré-calculados e não reagem aos filtros.
// Com a API, cada mudança de filtro refaz a query e eles passam a responder.
function renderKpis() {
  set('#kpis', state.data.kpis.map(k => {
    const d = formatDelta(k.delta, k.invertDelta);
    return `<article class="kpi">
      <div class="kpi-top">
        <span class="kpi-label" title="medida: ${k.hint}">${k.label}</span>
        ${sparkline(k.spark, { cls: d.cls === 'down' ? 'spark-neg' : 'spark-pos' })}
      </div>
      <div class="kpi-value">${formatValue(k.value, k.format)}</div>
      <div class="kpi-delta ${d.cls}">${d.text}</div>
    </article>`;
  }).join(''));
}

function renderPacing() {
  const p = state.data.pacing;
  const atingimento = p.faturado / p.deveria_estar;
  const gapAmbicao = p.projetado - p.ambicao;
  const linear = p.dias_decorridos / p.dias_ano;

  set('#pacingRing', ring(atingimento, {
    label: 'do esperado',
    caption: `${formatValue(p.faturado, 'currency')} faturado vs. ${formatValue(p.deveria_estar, 'currency')} esperado a esta altura do ano`
  }));

  set('#pacingBullets', [
    bullet({ label: 'Ambição anual', sublabel: formatValue(p.ambicao, 'currency'),
      actual: p.ambicao, target: p.ambicao, reference: p.ambicao, max: p.ambicao }),
    bullet({ label: 'Contratado', sublabel: formatValue(p.contratado, 'currency'),
      actual: p.contratado, target: p.ambicao, reference: p.projetado, max: p.ambicao }),
    bullet({ label: 'Faturado', sublabel: formatValue(p.faturado, 'currency'),
      actual: p.faturado, target: p.contratado, reference: p.deveria_estar, max: p.ambicao })
  ].join(''));

  set('#pacingFacts', [
    fact('Projeção fecho', formatValue(p.projetado, 'currency'),
      `${gapAmbicao >= 0 ? '+' : ''}${formatValue(gapAmbicao, 'currency')} vs. ambição`,
      gapAmbicao >= 0 ? 'up' : 'down'),
    fact('Cenário pessimista', formatValue(p.projetado_pessimista, 'currency'),
      `${formatValue(p.projetado_pessimista / p.ambicao, 'percent')} da ambição`, 'flat'),
    fact('Por contratar', formatValue(p.ambicao - p.contratado, 'currency'),
      'para atingir a ambição', 'flat'),
    fact('Ano decorrido', formatValue(linear, 'percent'),
      `${p.dias_decorridos} de ${p.dias_ano} dias`, 'flat')
  ].join(''));
}

function fact(label, value, note, cls) {
  return `<div class="fact"><dt>${label}</dt><dd>${value}</dd><p class="fact-note ${cls}">${note}</p></div>`;
}

function renderTable() {
  const d = state.data;
  const rows = applyFilters(d.rows, state.filters);
  const { key, dir } = state.sort;
  const sorted = [...rows].sort((a, b) => {
    const x = a[key], y = b[key];
    const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt');
    return dir === 'asc' ? cmp : -cmp;
  });

  const maxFat = Math.max(...d.rows.map(r => r.faturamento)) || 1;

  document.querySelectorAll('#detail thead th').forEach(th => {
    const k = th.dataset.sort;
    th.classList.toggle('is-sorted', k === key);
    th.textContent = th.textContent.replace(/ [↑↓]$/, '') + (k === key ? (dir === 'asc' ? ' ↑' : ' ↓') : '');
  });

  set('#detail tbody', sorted.map(r => `<tr data-canal="${r.canal}"
    class="${state.filters.canal === r.canal ? 'is-selected' : ''}">
    <td>${r.canal}</td>
    <td>${r.daypart}</td>
    <td class="num">${formatValue(r.insercoes, 'integer')}</td>
    <td class="num">${formatValue(r.grp, 'decimal')}</td>
    <td class="num">${formatValue(r.cpr, 'currency')}</td>
    <td class="num databar" style="--t:${(r.faturamento / maxFat).toFixed(3)}">${formatValue(r.faturamento, 'currency')}</td>
    <td class="num">${formatValue(r.desconto, 'percent')}</td>
  </tr>`).join(''));

  // Totais — no Power BI viriam do subtotal da matriz.
  const sum = k => sorted.reduce((a, r) => a + r[k], 0);
  const totFat = sum('faturamento'), totGrp = sum('grp');
  set('#detail tfoot', sorted.length ? `<tr>
    <td colspan="2">Total</td>
    <td class="num">${formatValue(sum('insercoes'), 'integer')}</td>
    <td class="num">${formatValue(totGrp, 'decimal')}</td>
    <td class="num">${formatValue(totGrp ? totFat / totGrp : 0, 'currency')}</td>
    <td class="num">${formatValue(totFat, 'currency')}</td>
    <td class="num">—</td>
  </tr>` : '');

  $('#rowCount').textContent = `${sorted.length} de ${d.rows.length} linhas`;
}

init().catch(err => {
  document.querySelector('main').insertAdjacentHTML('afterbegin',
    `<p class="alert alert-crit">Erro ao iniciar: ${err.message}</p>`);
});
