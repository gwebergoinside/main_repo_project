// Construção do WHERE a partir dos filtros do front-end.
//
// REGRA: nenhum valor vindo do cliente é interpolado no SQL. Tudo passa por
// parâmetros nomeados do Databricks (:nome). Listas geram um parâmetro por valor.

/** Campos filtráveis → coluna na CTE `base`. */
export const FIELDS = {
  canal:   'nm_channel',
  daypart: 'ds_daypart',
  setor:   'nm_sector',
  ano:     'nr_year',
  mes:     'nr_month'
};

const NUMERIC_FIELDS = new Set(['ano', 'mes']);

/**
 * @param {Record<string, string|string[]>} filters
 * @returns {{ sql: string, parameters: Array<{name,value,type}> }}
 */
export function buildWhere(filters = {}) {
  const clauses = [];
  const parameters = [];

  for (const [key, raw] of Object.entries(filters)) {
    const column = FIELDS[key];
    if (!column) continue; // campo desconhecido é ignorado, não interpolado

    const values = (Array.isArray(raw) ? raw : [raw])
      .filter(v => v !== '' && v != null)
      .slice(0, 200); // teto defensivo
    if (!values.length) continue;

    const type = NUMERIC_FIELDS.has(key) ? 'INT' : 'STRING';
    const names = values.map((v, i) => {
      const name = `${key}_${i}`;
      parameters.push({ name, value: v, type });
      return `:${name}`;
    });

    clauses.push(`${column} IN (${names.join(', ')})`);
  }

  return { sql: clauses.length ? `WHERE ${clauses.join('\n    AND ')}` : '', parameters };
}
