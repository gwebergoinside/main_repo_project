import { fetchDashboard, applyFilters } from './data.js';
import { formatValue, formatDelta } from './format.js';
import { sparkline, bullet, ring } from './charts.js';
import { PAGES, getPage } from './pages.js';

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

  renderTabs();
  renderFilters();
  render();

  $('#tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    state.page = tab.dataset.page;
    renderTabs();
    render();
    window.scrollTo({ top: 0 });
  });

  // Delegação no contentor da página: sobrevive a cada re-render.
  $('#view').addEventListener('click', e => {
    const th = e.target.closest('#detail thead th');
    if (th && th.dataset.sort) {
      const key = th.dataset.sort;
      state.sort = { key, dir: state.sort.key === key && state.sort.dir === 'desc' ? 'asc' : 'desc' };
      return render();
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
}

/* ---------------- navegação ---------------- */

function renderTabs() {
  $('#tabs').innerHTML = PAGES.map(p =>
    `<button class="tab ${p.id === state.page ? 'is-active' : ''}" data-page="${p.id}">${p.label}</button>`
  ).join('');
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

/* ---------------- render da página ---------------- */

// Blocos partilhados entre páginas, injetados nos painéis via ctx.
const ctx = {
  alerts: d => `<div class="alerts">${d.alertas.map(a =>
    `<p class="alert alert-${a.nivel}">${a.texto}</p>`).join('')}</div>`,

  kpis: (d, ids = null) => {
    const list = ids ? ids.map(id => d.kpis.find(k => k.id === id)).filter(Boolean) : d.kpis;
    return `<div class="kpi-grid">${list.map(k => {
      const dd = formatDelta(k.delta, k.invertDelta);
      return `<article class="kpi">
        <div class="kpi-top">
          <span class="kpi-label" title="medida: ${k.hint}">${k.label}</span>
          ${sparkline(k.spark, { cls: dd.cls === 'down' ? 'spark-neg' : 'spark-pos' })}
        </div>
        <div class="kpi-value">${formatValue(k.value, k.format)}</div>
        <div class="kpi-delta ${dd.cls}">${dd.text}</div>
      </article>`;
    }).join('')}</div>`;
  },

  pacing: d => {
    const p = d.pacing;
    const atingimento = p.faturado / p.deveria_estar;
    const gapAmbicao = p.projetado - p.ambicao;
    const linear = p.dias_decorridos / p.dias_ano;

    const bullets = [
      bullet({ label: 'Ambição anual', sublabel: formatValue(p.ambicao, 'currency'),
        actual: p.ambicao, target: p.ambicao, reference: p.ambicao, max: p.ambicao }),
      bullet({ label: 'Contratado', sublabel: formatValue(p.contratado, 'currency'),
        actual: p.contratado, target: p.ambicao, reference: p.projetado, max: p.ambicao }),
      bullet({ label: 'Faturado', sublabel: formatValue(p.faturado, 'currency'),
        actual: p.faturado, target: p.contratado, reference: p.deveria_estar, max: p.ambicao })
    ].join('');

    const facts = [
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

    return `<div class="pacing-body">
      ${ring(atingimento, {
        label: 'do esperado',
        caption: `${formatValue(p.faturado, 'currency')} faturado vs. ${formatValue(p.deveria_estar, 'currency')} esperado a esta altura do ano`
      })}
      <div class="pacing-bullets">${bullets}</div>
      <dl class="facts">${facts}</dl>
    </div>`;
  },

  rowCount: d => {
    const n = applyFilters(d.rows, state.filters).length;
    return `${n} de ${d.rows.length} linhas`;
  },

  table: d => {
    const rows = applyFilters(d.rows, state.filters);
    const { key, dir } = state.sort;
    const sorted = [...rows].sort((a, b) => {
      const x = a[key], y = b[key];
      const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt');
      return dir === 'asc' ? cmp : -cmp;
    });

    const maxFat = Math.max(...d.rows.map(r => r.faturamento)) || 1;
    const cols = [
      ['canal', 'Canal', false], ['daypart', 'Daypart', false],
      ['insercoes', 'Inserções', true], ['grp', 'GRP eq.', true],
      ['cpr', 'CPR eq.', true], ['faturamento', 'Faturamento', true],
      ['desconto', 'Desconto', true]
    ];

    const head = cols.map(([k, label, num]) =>
      `<th class="${num ? 'num' : ''} ${key === k ? 'is-sorted' : ''}" data-sort="${k}">${label}${
        key === k ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</th>`).join('');

    const body = sorted.map(r => `<tr data-canal="${r.canal}"
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
    const foot = sorted.length ? `<tr>
      <td colspan="2">Total</td>
      <td class="num">${formatValue(sum('insercoes'), 'integer')}</td>
      <td class="num">${formatValue(totGrp, 'decimal')}</td>
      <td class="num">${formatValue(totGrp ? totFat / totGrp : 0, 'currency')}</td>
      <td class="num">${formatValue(totFat, 'currency')}</td>
      <td class="num">—</td>
    </tr>` : '';

    return `<div class="table-wrap"><table id="detail">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
      <tfoot>${foot}</tfoot>
    </table></div>`;
  }
};

function fact(label, value, note, cls) {
  return `<div class="fact"><dt>${label}</dt><dd>${value}</dd><p class="fact-note ${cls}">${note}</p></div>`;
}

function render() {
  const page = getPage(state.page);
  const d = state.data;

  $('#view').innerHTML = page.panels.map(p => {
    const body = p.render(d, ctx);
    if (p.bare) return `<div class="cell span-${p.span}">${body}</div>`;

    const hint = typeof p.hint === 'function' ? p.hint(d, ctx) : p.hint;
    return `<section class="panel cell span-${p.span}">
      <div class="panel-head">
        <h2>${p.title}</h2>
        ${hint ? `<span class="hint">${hint}</span>` : ''}
      </div>
      <div class="panel-body ${p.flush ? 'is-flush' : ''} ${p.scroll ? 'table-wrap' : ''}">${body}</div>
    </section>`;
  }).join('');
}

init().catch(err => {
  document.querySelector('#view').innerHTML =
    `<p class="alert alert-crit">Erro ao iniciar: ${err.message}</p>`;
});
