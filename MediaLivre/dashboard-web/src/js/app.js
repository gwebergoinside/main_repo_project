import { fetchDashboard, applyFilters } from './data.js';
import { formatValue, formatDelta } from './format.js';

// Estado central — é o que substitui o cross-filter nativo do Power BI.
const state = {
  page: 'main',
  filters: { canal: '', daypart: '' },
  sort: { key: 'faturamento', dir: 'desc' },
  data: null
};

const $ = sel => document.querySelector(sel);

async function init() {
  state.data = await fetchDashboard(state);
  $('#lastUpdate').textContent = state.data.meta.last_data_updated;
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
    const key = e.target.closest('th')?.dataset.sort;
    if (!key) return;
    state.sort = { key, dir: state.sort.key === key && state.sort.dir === 'desc' ? 'asc' : 'desc' };
    renderTable();
  });
}

function renderFilters() {
  const { canal, daypart } = state.data.filters;
  $('#filters').innerHTML = [
    slicer('canal', 'Canal', canal),
    slicer('daypart', 'Daypart', daypart)
  ].join('');

  $('#filters').addEventListener('change', e => {
    state.filters[e.target.name] = e.target.value;
    render();
  });
}

function slicer(name, label, options) {
  const opts = ['<option value="">Todos</option>', ...options.map(o => `<option>${o}</option>`)].join('');
  return `<div class="slicer"><label for="f-${name}">${label}</label>
    <select id="f-${name}" name="${name}">${opts}</select></div>`;
}

function render() {
  renderKpis();
  renderTable();
}

// Nota: no mock os KPIs vem pre-calculados e por isso nao reagem aos filtros.
// Com o backend, cada mudanca de filtro refaz a query e os KPIs passam a responder.
function renderKpis() {
  $('#kpis').innerHTML = state.data.kpis.map(k => {
    const d = formatDelta(k.delta);
    return `<article class="kpi">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${formatValue(k.value, k.format)}</div>
      <div class="kpi-delta ${d.cls}">${d.text}</div>
    </article>`;
  }).join('');
}

function renderTable() {
  const rows = applyFilters(state.data.rows, state.filters);
  const { key, dir } = state.sort;
  const sorted = [...rows].sort((a, b) => {
    const [x, y] = [a[key], b[key]];
    const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt');
    return dir === 'asc' ? cmp : -cmp;
  });

  $('#detail tbody').innerHTML = sorted.map(r => `<tr>
    <td>${r.canal}</td>
    <td>${r.daypart}</td>
    <td class="num">${formatValue(r.insercoes, 'integer')}</td>
    <td class="num">${formatValue(r.grp, 'decimal')}</td>
    <td class="num">${formatValue(r.faturamento, 'currency')}</td>
    <td class="num">${formatValue(r.desconto, 'percent')}</td>
  </tr>`).join('');

  $('#rowCount').textContent = `${sorted.length} de ${state.data.rows.length} linhas`;
}

init().catch(err => {
  document.querySelector('main').insertAdjacentHTML('afterbegin',
    `<p class="disclaimer">Erro ao iniciar: ${err.message}</p>`);
});
