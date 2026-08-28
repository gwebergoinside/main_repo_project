import { fetchDashboard, applyFilters } from './data.js';
import { formatValue, formatDelta } from './format.js';
import {
  sparkline, bullet, ring, monthlyCombo, funnel,
  rankBars, stacked100, heatmap, scatter
} from './charts.js';

// Estado central — é o que substitui o cross-filter nativo do Power BI.
const state = {
  page: 'main',
  filters: { canal: '', daypart: '', setor: '' },
  sort: { key: 'faturamento', dir: 'desc' },
  data: null
};

const $ = sel => document.querySelector(sel);

async function init() {
  state.data = await fetchDashboard(state);
  const { meta } = state.data;
  $('#lastUpdate').textContent = meta.last_data_updated;
  $('#periodo').textContent = meta.periodo;

  renderFilters();
  render();

  $('#tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t === tab));
    state.page = tab.dataset.page;
    render();
  });

  $('#detail thead').addEventListener('click', e => {
    const key = e.target.closest('th') && e.target.closest('th').dataset.sort;
    if (!key) return;
    state.sort = { key, dir: state.sort.key === key && state.sort.dir === 'desc' ? 'asc' : 'desc' };
    renderTable();
  });

  // Cross-filter: clicar numa linha da tabela filtra o canal.
  $('#detail tbody').addEventListener('click', e => {
    const canal = e.target.closest('tr') && e.target.closest('tr').dataset.canal;
    if (!canal) return;
    state.filters.canal = state.filters.canal === canal ? '' : canal;
    $('#f-canal').value = state.filters.canal;
    render();
  });
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
  renderAlerts();
  renderKpis();
  renderPacing();
  $('#monthly').innerHTML = monthlyCombo(state.data.monthly);
  $('#funnel').innerHTML = funnel(state.data.funnel);
  $('#scatter').innerHTML = scatter(state.data.channels);
  $('#share').innerHTML = stacked100(state.data.share_mercado);
  $('#rankCanais').innerHTML = rankBars(state.data.channels,
    { valueKey: 'faturamento', labelKey: 'canal', format: 'currency' });
  $('#rankSetores').innerHTML = rankBars(state.data.setores,
    { valueKey: 'faturamento', labelKey: 'setor', format: 'currency', deltaKey: 'delta' });
  $('#hmMetric').textContent = state.data.heatmap.metric;
  $('#heatmap').innerHTML = heatmap(state.data.heatmap);
  renderTable();
}

function renderAlerts() {
  $('#alertas').innerHTML = state.data.alertas.map(a =>
    `<p class="alert alert-${a.nivel}">${a.texto}</p>`).join('');
}

// Nota: no mock os KPIs vêm pré-calculados e por isso não reagem aos filtros.
// Com o backend, cada mudança de filtro refaz a query e os KPIs passam a responder.
function renderKpis() {
  $('#kpis').innerHTML = state.data.kpis.map(k => {
    const d = formatDelta(k.delta, k.invertDelta);
    return `<article class="kpi">
      <div class="kpi-top">
        <span class="kpi-label" title="medida: ${k.hint}">${k.label}</span>
        ${sparkline(k.spark, { cls: d.cls === 'down' ? 'spark-neg' : 'spark-pos' })}
      </div>
      <div class="kpi-value">${formatValue(k.value, k.format)}</div>
      <div class="kpi-delta ${d.cls}">${d.text}</div>
    </article>`;
  }).join('');
}

function renderPacing() {
  const p = state.data.pacing;
  const atingimento = p.faturado / p.deveria_estar;
  const gapAmbicao = p.projetado - p.ambicao;

  $('#pacingRing').innerHTML = ring(atingimento, {
    label: 'do esperado',
    caption: `${formatValue(p.faturado, 'currency')} faturado vs. ${formatValue(p.deveria_estar, 'currency')} esperado a esta altura do ano`
  });

  $('#pacingBullets').innerHTML = [
    bullet({
      label: 'Ambição anual', sublabel: formatValue(p.ambicao, 'currency'),
      actual: p.ambicao, target: p.ambicao, reference: p.ambicao, max: p.ambicao
    }),
    bullet({
      label: 'Contratado', sublabel: formatValue(p.contratado, 'currency'),
      actual: p.contratado, target: p.ambicao, reference: p.projetado, max: p.ambicao
    }),
    bullet({
      label: 'Faturado', sublabel: formatValue(p.faturado, 'currency'),
      actual: p.faturado, target: p.contratado, reference: p.deveria_estar, max: p.ambicao
    })
  ].join('');

  const linear = p.dias_decorridos / p.dias_ano;
  $('#pacingFacts').innerHTML = [
    fact('Projeção fecho', formatValue(p.projetado, 'currency'),
      `${gapAmbicao >= 0 ? '+' : ''}${formatValue(gapAmbicao, 'currency')} vs. ambição`,
      gapAmbicao >= 0 ? 'up' : 'down'),
    fact('Cenário pessimista', formatValue(p.projetado_pessimista, 'currency'),
      `${formatValue(p.projetado_pessimista / p.ambicao, 'percent')} da ambição`, 'flat'),
    fact('Por contratar', formatValue(p.ambicao - p.contratado, 'currency'),
      'para atingir a ambição', 'flat'),
    fact('Ano decorrido', formatValue(linear, 'percent'),
      `${p.dias_decorridos} de ${p.dias_ano} dias`, 'flat')
  ].join('');
}

function fact(label, value, note, cls) {
  return `<div class="fact">
    <dt>${label}</dt>
    <dd>${value}</dd>
    <p class="fact-note ${cls}">${note}</p>
  </div>`;
}

function renderTable() {
  const rows = applyFilters(state.data.rows, state.filters);
  const { key, dir } = state.sort;
  const sorted = [...rows].sort((a, b) => {
    const x = a[key], y = b[key];
    const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt');
    return dir === 'asc' ? cmp : -cmp;
  });

  const maxFat = Math.max(...state.data.rows.map(r => r.faturamento)) || 1;

  $('#detail tbody').innerHTML = sorted.map(r => `<tr data-canal="${r.canal}"
    class="${state.filters.canal === r.canal ? 'is-selected' : ''}">
    <td>${r.canal}</td>
    <td>${r.daypart}</td>
    <td class="num">${formatValue(r.insercoes, 'integer')}</td>
    <td class="num">${formatValue(r.grp, 'decimal')}</td>
    <td class="num">${formatValue(r.cpr, 'currency')}</td>
    <td class="num databar" style="--t:${(r.faturamento / maxFat).toFixed(3)}">${formatValue(r.faturamento, 'currency')}</td>
    <td class="num">${formatValue(r.desconto, 'percent')}</td>
  </tr>`).join('');

  // Totais — no Power BI viriam do subtotal da matriz.
  const sum = k => sorted.reduce((a, r) => a + r[k], 0);
  const totFat = sum('faturamento'), totGrp = sum('grp');
  $('#detail tfoot').innerHTML = sorted.length ? `<tr>
    <td colspan="2">Total</td>
    <td class="num">${formatValue(sum('insercoes'), 'integer')}</td>
    <td class="num">${formatValue(totGrp, 'decimal')}</td>
    <td class="num">${formatValue(totGrp ? totFat / totGrp : 0, 'currency')}</td>
    <td class="num">${formatValue(totFat, 'currency')}</td>
    <td class="num">—</td>
  </tr>` : '';

  $('#rowCount').textContent = `${sorted.length} de ${state.data.rows.length} linhas`;
}

init().catch(err => {
  document.querySelector('main').insertAdjacentHTML('afterbegin',
    `<p class="alert alert-crit">Erro ao iniciar: ${err.message}</p>`);
});
