// Montagem da query final: CTEs base + agregação das medidas pedidas.
//
// Os joins reproduzem os relacionamentos do modelo semântico (relationships.tmdl):
//   ad_insertion.cd_campaign  -> dim_campaigns.cd_campaign
//   dim_campaigns.cd_list_channel -> dim_channels.cd_channel   <- o canal NÃO é direto
//   ad_insertion.hr_air       -> dim_daypart.nr_seconds
//   ad_insertion.cd_material  -> dim_materials.cd_material
//   dim_materials.cd_product  -> dim_products_sectors.cd_product
//   ad_insertion.dt_emission  -> dim_tempo.data                <- relação ATIVA

import { qualify } from '../config.js';
import { MEASURES, expressionFor } from './measures.js';
import { buildWhere } from './filters.js';

const t = qualify;

function baseCte(where) {
  return `base AS (
  SELECT
    i.*,
    c.cd_channel AS cd_channel_dim,
    c.nm_channel,
    d.ds_daypart,
    s.nm_sector,
    tp.nr_year,
    tp.nr_month
  FROM ${t('pbi_vw_ad_insertion')} i
  LEFT JOIN ${t('pbi_dim_campaigns')}        cp ON cp.cd_campaign = i.cd_campaign
  LEFT JOIN ${t('pbi_dim_channels')}         c  ON c.cd_channel   = cp.cd_list_channel
  LEFT JOIN ${t('dim_daypart')}              d  ON d.nr_seconds   = i.hr_air
  LEFT JOIN ${t('pbi_dim_materials')}        m  ON m.cd_material  = i.cd_material
  LEFT JOIN ${t('pbi_dim_products_sectors')} s  ON s.cd_product   = m.cd_product
  LEFT JOIN ${t('dim_tempo')}                tp ON tp.data        = i.dt_emission
  ${where}
)`;
}

// A relação ativa de negociações usa dt_first_air (ver total_contracted_gross).
function negCte() {
  return `neg AS (
  SELECT n.*
  FROM ${t('pbi_vw_negotiations')} n
)`;
}

/**
 * @param {string[]} measures ids de MEASURES
 * @param {object} filters
 * @param {object} params parâmetros das medidas (excludePositionTax, metric, ...)
 * @returns {{ statement: string, parameters: Array }}
 */
export function buildQuery(measures, filters = {}, params = {}) {
  const unknown = measures.filter(id => !MEASURES[id]);
  if (unknown.length) throw new Error(`Medidas desconhecidas: ${unknown.join(', ')}`);

  const { sql: where, parameters } = buildWhere(filters);

  const bySource = { base: [], neg: [] };
  for (const id of measures) bySource[MEASURES[id].source].push(id);

  const ctes = [];
  const selects = [];

  if (bySource.base.length) {
    ctes.push(baseCte(where));
    ctes.push(`agg_base AS (
  SELECT ${bySource.base.map(id => `${expressionFor(id, params)} AS ${id}`).join(',\n         ')}
  FROM base
)`);
    selects.push('agg_base');
  }

  if (bySource.neg.length) {
    ctes.push(negCte());
    ctes.push(`agg_neg AS (
  SELECT ${bySource.neg.map(id => `${expressionFor(id, params)} AS ${id}`).join(',\n         ')}
  FROM neg
)`);
    selects.push('agg_neg');
  }

  const from = selects.length === 2 ? 'agg_base CROSS JOIN agg_neg' : selects[0];
  const statement = `WITH ${ctes.join(',\n')}\nSELECT * FROM ${from}`;

  return { statement, parameters };
}

/** Query de detalhe: uma linha por canal × daypart (alimenta a tabela). */
export function buildDetailQuery(filters = {}, params = {}) {
  const { sql: where, parameters } = buildWhere(filters);
  const statement = `WITH ${baseCte(where)}
SELECT
  nm_channel AS canal,
  ds_daypart AS daypart,
  COUNT(*) AS insercoes,
  ${expressionFor('total_billing', params)} AS faturamento,
  ${expressionFor('pc_discount_avg')} AS desconto,
  AVG(CAST(nr_position AS DOUBLE)) AS avg_pos
FROM base
WHERE nm_channel IS NOT NULL
GROUP BY nm_channel, ds_daypart
ORDER BY faturamento DESC
LIMIT 200`;
  return { statement, parameters };
}
