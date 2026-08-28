// Camada de acesso a dados.
//
// Tenta primeiro a API (api/server.js). Se ela não estiver a correr — o caso
// quando se serve só a pasta com um http.server — cai para o mock, para o
// front-end continuar a poder ser desenvolvido isolado.

const API_URL = '/api/query';
const MOCK_URL = '../data/mock/dashboard.json';

export async function fetchDashboard(state = {}) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: cleanFilters(state.filters || {}),
        params: state.params || {}
      })
    });
    if (res.ok) return normalize(await res.json());
    // 4xx/5xx da API: mostrar o mock em vez de página em branco, mas dizer porquê.
    console.warn(`API respondeu ${res.status}; a usar o mock.`);
  } catch (e) {
    console.warn(`API indisponível (${e.message}); a usar o mock.`);
  }

  const res = await fetch(MOCK_URL);
  if (!res.ok) throw new Error(`Falha ao carregar dados (${res.status})`);
  const mock = await res.json();
  return normalize({ ...mock, meta: { ...mock.meta, source: 'mock' } });
}

/** Remove filtros vazios — a API trata ausência como "todos". */
function cleanFilters(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
}

/**
 * A API devolve { meta, values, rows }; o mock devolve o payload completo.
 * Enquanto a Fase 2 não traduzir todas as medidas, os blocos que a API ainda
 * não produz continuam a vir do mock — e ficam marcados como tal.
 */
function normalize(payload) {
  if (!payload.values) return payload; // já é o payload completo (mock)

  return {
    ...payload,
    meta: { ...payload.meta, partial: true },
    values: payload.values
  };
}

export function sourceLabel(meta = {}) {
  if (!meta.source) return '—';
  if (meta.source === 'databricks') return meta.cached ? 'Databricks (cache)' : 'Databricks';
  return meta.source;
}

// Aplica os filtros no cliente. Com a API a servir o detalhe, isto passa a ser
// só o caminho do mock — o SQL já devolve as linhas filtradas.
export function applyFilters(rows, filters) {
  return rows.filter(r =>
    (!filters.canal || r.canal === filters.canal) &&
    (!filters.daypart || r.daypart === filters.daypart)
  );
}
