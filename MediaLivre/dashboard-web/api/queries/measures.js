// Tradução das medidas DAX para SQL.
//
// Cada entrada guarda o DAX ORIGINAL copiado de ~Medidas.tmdl. Isto não é
// decoração: é o que permite auditar a equivalência quando os números não baterem
// certo com o Power BI. Se a medida mudar no modelo, o comentário tem de mudar aqui.
//
// `base`  = pbi_vw_ad_insertion com as dimensões ligadas (ver sql.js)
// `neg`   = pbi_vw_negotiations
//
// Estado:
//   ok       tradução completa e fiel
//   parcial  ramo principal traduzido; ramos de parâmetro por fazer (ver `todo`)

export const MEASURES = {

  /* ---------------------------------------------------------- 01 Volume */

  nr_insertions: {
    folder: '01 Volume', source: 'base', status: 'ok',
    dax: 'COUNTROWS ( pbi_vw_ad_insertion )',
    sql: 'COUNT(*)'
  },

  nr_insertions_active: {
    folder: '01 Volume', source: 'base', status: 'ok',
    dax: `CALCULATE ( [nr_insertions],
      pbi_vw_ad_insertion[st_status] IN { "Broadcasted", "Delivered", "In Playlist" } )`,
    sql: `COUNT_IF(st_status IN ('Broadcasted', 'Delivered', 'In Playlist'))`
  },

  nr_campaigns: {
    folder: '01 Volume', source: 'base', status: 'ok',
    dax: 'DISTINCTCOUNT ( pbi_dim_campaigns[cd_campaign] )',
    sql: 'COUNT(DISTINCT cd_campaign)'
  },

  nr_channels: {
    folder: '01 Volume', source: 'base', status: 'ok',
    dax: 'DISTINCTCOUNT ( pbi_dim_channels[cd_channel] )',
    sql: 'COUNT(DISTINCT cd_channel_dim)'
  },

  nr_programs: {
    folder: '01 Volume', source: 'base', status: 'ok',
    dax: 'DISTINCTCOUNT ( pbi_dim_programs[cd_program] )',
    sql: 'COUNT(DISTINCT cd_program)'
  },

  /* ---------------------------------------------------------- 02 Duration */

  total_seconds: {
    folder: '02 Duration', source: 'base', status: 'ok',
    dax: 'SUM ( pbi_vw_ad_insertion[vl_duration_fitting] )',
    sql: 'SUM(vl_duration_fitting)'
  },

  avg_duration: {
    folder: '02 Duration', source: 'base', status: 'ok',
    dax: 'DIVIDE ( [total_seconds], [nr_insertions_active] )',
    // DIVIDE devolve BLANK em vez de erro quando o denominador é 0.
    sql: `SUM(vl_duration_fitting) /
      NULLIF(COUNT_IF(st_status IN ('Broadcasted', 'Delivered', 'In Playlist')), 0)`
  },

  /* ---------------------------------------------------------- 03 Financial */

  total_gross: {
    folder: '03 Financial', source: 'base', status: 'parcial',
    dax: `VAR _fl_adults = SELECTEDVALUE ( pmt_adults_GRP[fl_adults_eq] )
      VAR _CALC = IF ( _fl_adults,
        CALCULATE ( SUM ( pbi_vw_ad_insertion[vl_gross] ), VALUES ( pbi_vw_targets[ds_variant] ),
          TREATAS ( VALUES ( pbi_vw_targets_var[ds_variant] ), pbi_vw_targets[ds_variant_adults] ) ),
        CALCULATE ( SUM ( pbi_vw_ad_insertion[vl_gross] ), ... ) )`,
    sql: 'SUM(vl_gross)',
    todo: 'O ramo _fl_adults religa targets_var a targets por TREATAS. Depende de pbi_vw_targets, ainda não incluída na base.'
  },

  total_billing: {
    folder: '03 Financial', source: 'base', status: 'ok',
    dax: `VAR _fl_VBN_consider = SELECTEDVALUE( pmt_values_KPI[ds_metrics] )
      VAR _postion_tax = SELECTEDVALUE ( pmt_exclude_position_tax[fl_validate] )
      VAR _multiproduct_tax = SELECTEDVALUE ( pmt_exclude_multiproduct_tax[fl_validate] )
      ... IF( _fl_VBN_consider = "vl_invoice_billing"
        , SUMX( FILTER( pbi_vw_invoices, pbi_vw_invoices[nr_quantity] = 1 ), pbi_vw_invoices[vl_invoice_gross] )
        , SWITCH( TRUE()
            , AND( _postion_tax <> 0, _multiproduct_tax <> 0 ), SUMX( ..., vl_billing - vl_billing_position - vl_billing_multiproduct )
            , _postion_tax <> 0, SUMX( ..., vl_billing - vl_billing_position )
            , _multiproduct_tax <> 0, SUMX( ..., vl_billing - vl_billing_multiproduct )
            , SUM( vl_billing ) ) )`,
    // Os SELECTEDVALUE de tabelas-parâmetro viram parâmetros da chamada à API.
    // params.excludePositionTax / excludeMultiproductTax / metric
    sqlFor: params => {
      if (params.metric === 'vl_invoice_billing') return 'NULL'; // vem da CTE `inv`
      const parts = ['vl_billing'];
      if (params.excludePositionTax) parts.push('- COALESCE(vl_billing_position, 0)');
      if (params.excludeMultiproductTax) parts.push('- COALESCE(vl_billing_multiproduct, 0)');
      return `SUM(${parts.join(' ')})`;
    }
  },

  total_net: {
    folder: '03 Financial', source: 'base', status: 'ok',
    dax: 'SUM ( pbi_vw_ad_insertion[vl_net] )',
    sql: 'SUM(vl_net)'
  },

  total_bonus: {
    folder: '03 Financial', source: 'base', status: 'ok',
    dax: 'SUM ( pbi_vw_ad_insertion[vl_bonus] )',
    sql: 'SUM(vl_bonus)'
  },

  total_dif_minimal_billing: {
    folder: '03 Financial', source: 'base', status: 'ok',
    dax: 'SUM ( pbi_vw_ad_insertion[vl_dif_minimal_billing] )',
    sql: 'SUM(vl_dif_minimal_billing)'
  },

  pc_discount_avg: {
    folder: '03 Financial', source: 'base', status: 'ok',
    dax: `VAR _calc = DIVIDE ( [total_gross] - [total_billing], [total_gross] )
      RETURN SWITCH( TRUE()
        , ISBLANK( [total_gross] ) || NOT( ABS( [total_gross] ) > 0 ), BLANK()
        , ISBLANK( [total_billing] ) || NOT( ABS( [total_billing] ) > 0 ), BLANK()
        , _calc )`,
    // O SWITCH devolve BLANK se qualquer um dos dois for zero/vazio — daí os dois NULLIF.
    sql: `CASE WHEN COALESCE(ABS(SUM(vl_gross)), 0) = 0 THEN NULL
               WHEN COALESCE(ABS(SUM(vl_billing)), 0) = 0 THEN NULL
               ELSE (SUM(vl_gross) - SUM(vl_billing)) / SUM(vl_gross) END`
  },

  /* ---------------------------------------------------------- 06 Breaks */

  nr_first_position: {
    folder: '06 Breaks', source: 'base', status: 'ok',
    dax: 'CALCULATE ( COUNTROWS ( pbi_vw_ad_insertion ), pbi_vw_ad_insertion[nr_position] = 1 )',
    sql: 'COUNT_IF(nr_position = 1)'
  },

  avg_position: {
    folder: '06 Breaks', source: 'base', status: 'ok',
    dax: 'AVERAGE ( pbi_vw_ad_insertion[nr_position] )',
    sql: 'AVG(CAST(nr_position AS DOUBLE))'
  },

  pc_first_position: {
    folder: '06 Breaks', source: 'base', status: 'ok',
    dax: 'DIVIDE ( [nr_first_position], [nr_insertions_active] )',
    sql: `COUNT_IF(nr_position = 1) /
      NULLIF(COUNT_IF(st_status IN ('Broadcasted', 'Delivered', 'In Playlist')), 0)`
  },

  /* ---------------------------------------------------------- 09 Negotiations */

  nr_negotiations_total: {
    folder: '09 Negotiations', source: 'neg', status: 'ok',
    dax: 'COUNTROWS ( pbi_vw_negotiations )',
    sql: 'COUNT(*)'
  },

  nr_negotiations_with_insertions: {
    folder: '09 Negotiations', source: 'neg', status: 'ok',
    dax: 'CALCULATE ( COUNTROWS ( pbi_vw_negotiations ), pbi_vw_negotiations[nr_insertions_total] > 0 )',
    sql: 'COUNT_IF(nr_insertions_total > 0)'
  },

  total_contracted_gross: {
    folder: '09 Negotiations', source: 'neg', status: 'parcial',
    dax: `CALCULATE( SUM ( pbi_vw_negotiations[vl_negotiation_gross_contracted] )
      , USERELATIONSHIP( pbi_vw_negotiations[dt_first_air], dim_tempo[data] ) )`,
    sql: 'SUM(vl_negotiation_gross_contracted)',
    todo: 'USERELATIONSHIP troca a data ativa para dt_first_air. A CTE `neg` já usa dt_first_air, mas o filtro de data ainda não é aplicado a esta CTE.'
  },

  pc_contracted_realised: {
    folder: '09 Negotiations', source: 'neg', status: 'ok',
    dax: `DIVIDE ( SUM ( pbi_vw_negotiations[vl_net_total] ),
      SUM ( pbi_vw_negotiations[vl_negotiation_gross_contracted] ) )`,
    sql: 'SUM(vl_net_total) / NULLIF(SUM(vl_negotiation_gross_contracted), 0)'
  },

  mt_max_gross_per_neg: {
    folder: '09 Negotiations', source: 'neg', status: 'ok',
    dax: 'MAX ( pbi_vw_negotiations[vl_gross_total] )',
    sql: 'MAX(vl_gross_total)'
  }
};

export const measureIds = () => Object.keys(MEASURES);

/** Expressão SQL de uma medida, resolvendo os parâmetros quando existem. */
export function expressionFor(id, params = {}) {
  const m = MEASURES[id];
  if (!m) throw new Error(`Medida desconhecida: ${id}`);
  return typeof m.sqlFor === 'function' ? m.sqlFor(params) : m.sql;
}
