// Camada de acesso a dados.
// Hoje lê o mock; quando a API existir, trocar apenas fetchDashboard().

const MOCK_URL = '../data/mock/dashboard.json';

export async function fetchDashboard(/* state */) {
  // Versão futura:
  // return (await fetch('/api/query', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ page: state.page, filters: state.filters })
  // })).json();

  const res = await fetch(MOCK_URL);
  if (!res.ok) throw new Error(`Falha ao carregar dados (${res.status})`);
  return res.json();
}

// Aplica os filtros no cliente. Com backend, isso passa a ser feito no SQL.
export function applyFilters(rows, filters) {
  return rows.filter(r =>
    (!filters.canal || r.canal === filters.canal) &&
    (!filters.daypart || r.daypart === filters.daypart)
  );
}
