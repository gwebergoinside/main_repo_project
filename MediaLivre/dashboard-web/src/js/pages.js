// Definição declarativa das páginas do relatório.
//
// Estrutura deliberadamente parecida com a de `report.json`: uma lista de páginas,
// cada uma com uma lista de painéis. Trocar de página é trocar de definição —
// nenhum HTML de página vive no index.html.
//
// Painel: { title, hint, span: 1|2, bare?: true, render: (data, ctx) => html }

import {
  bullet, ring, monthlyCombo, funnel, rankBars, stacked100, heatmap, scatter,
  waterfall, dumbbell, divergingBars, histogram, markerBars, targetBars, riskList, yoyRows
} from './charts.js';
import { formatValue } from './format.js';

export const PAGES = [
  {
    id: 'main',
    label: 'Main',
    panels: [
      { id: 'alertas', bare: true, span: 2, render: (d, ctx) => ctx.alerts(d) },
      { id: 'kpis',    bare: true, span: 2, render: (d, ctx) => ctx.kpis(d) },
      {
        id: 'pacing', span: 2,
        title: 'Pacing comercial — ambição, contratado e realizado',
        hint: 'Onde devíamos estar vs. onde estamos',
        render: (d, ctx) => ctx.pacing(d)
      },
      {
        id: 'monthly', span: 1,
        title: 'Faturamento mensal',
        hint: '<i class="key key-bar"></i>2026 <i class="key key-line"></i>2025',
        render: d => monthlyCombo(d.monthly)
      },
      {
        id: 'funnel', span: 1,
        title: 'Funil de negociações', hint: 'Registo → faturação',
        render: d => funnel(d.funnel)
      },
      {
        id: 'scatter', span: 1,
        title: 'Eficiência por canal', hint: 'GRP eq. × CPR eq. · área = faturamento',
        render: d => scatter(d.channels)
      },
      {
        id: 'share', span: 1,
        title: 'Share de investimento', hint: 'vs. ano anterior',
        render: d => stacked100(d.share_mercado)
      },
      {
        id: 'rankCanais', span: 1, title: 'Faturamento por canal',
        render: d => rankBars(d.channels, { valueKey: 'faturamento', labelKey: 'canal' })
      },
      {
        id: 'rankSetores', span: 1,
        title: 'Faturamento por setor', hint: 'variação vs. período homólogo',
        render: d => rankBars(d.setores, { valueKey: 'faturamento', labelKey: 'setor', deltaKey: 'delta' })
      },
      {
        id: 'heatmap', span: 2, scroll: true,
        title: 'Ocupação de audiência', hint: d => d.heatmap.metric,
        render: d => heatmap(d.heatmap)
      },
      {
        id: 'detail', span: 2, flush: true,
        title: 'Detalhe por canal e daypart', hint: (d, ctx) => ctx.rowCount(d),
        render: (d, ctx) => ctx.table(d)
      }
    ]
  },

  {
    id: 'negociacoes',
    label: 'Negociações 2026',
    panels: [
      { id: 'kpis', bare: true, span: 2, render: (d, ctx) => ctx.kpis(d, ['total_gross', 'pc_contracted_realised', 'total_billing', 'nr_insertions']) },
      {
        id: 'funnel', span: 1,
        title: 'Funil de negociações', hint: 'Registo → faturação',
        render: d => funnel(d.funnel)
      },
      {
        id: 'desvio', span: 1,
        title: 'Desvio: projetado vs. faturado',
        hint: 'pc_dif_project_negotiated_vs_billing',
        render: d => divergingBars(d.desvio_projecao, { labelKey: 'mes', valueKey: 'desvio' })
      },
      {
        id: 'ficheiros', span: 1,
        title: 'Negociado vs. fechado por ficheiro',
        hint: 'vl_negociado_ficheiro · vl_fechado_ficheiro',
        render: d => dumbbell(d.ficheiros, {
          labelKey: 'ficheiro', subKey: 'cliente',
          aKey: 'negociado', bKey: 'fechado',
          aLabel: 'Negociado', bLabel: 'Fechado'
        })
      },
      {
        id: 'ambicao', span: 1,
        title: 'Cobertura da ambição por ficheiro',
        hint: 'vl_contracted_shouldBe_ambicao · marcador = ambição',
        render: d => targetBars(d.ficheiros, {
          labelKey: 'ficheiro', subKey: 'cliente',
          valueKey: 'fechado', targetKey: 'ambicao'
        })
      },
      {
        id: 'risco', span: 2,
        title: 'Faturamento mínimo em risco',
        hint: 'total_dif_minimal_billing · negociações abaixo do mínimo contratado',
        render: d => riskList(d.risco, {
          idKey: 'negociacao', subKey: 'cliente',
          targetKey: 'minimo', actualKey: 'faturado', noteKey: 'dias_restantes'
        })
      }
    ]
  },

  {
    id: 'financeiro',
    label: 'Financeiro',
    panels: [
      {
        id: 'cascata', span: 2,
        title: 'Do bruto de tabela ao líquido faturado',
        hint: d => d.cascata.hint,
        render: d => waterfall(d.cascata.steps)
      },
      {
        id: 'rankSetores', span: 1,
        title: 'Faturamento por setor', hint: 'variação vs. período homólogo',
        render: d => rankBars(d.setores, { valueKey: 'faturamento', labelKey: 'setor', deltaKey: 'delta' })
      },
      {
        id: 'monthly', span: 1,
        title: 'Faturamento mensal',
        hint: '<i class="key key-bar"></i>2026 <i class="key key-line"></i>2025',
        render: d => monthlyCombo(d.monthly)
      }
    ]
  },

  {
    id: 'audiencia',
    label: 'Audiência',
    panels: [
      {
        id: 'yoy', span: 1,
        title: 'Evolução homóloga da audiência',
        hint: 'GRP_EQ_LY · CPR_EQ_LY · CPS_LY',
        render: d => yoyRows(d.yoy_audiencia)
      },
      {
        id: 'scatter', span: 1,
        title: 'Eficiência por canal', hint: 'GRP eq. × CPR eq. · área = faturamento',
        render: d => scatter(d.channels)
      },
      {
        id: 'heatmap', span: 2, scroll: true,
        title: 'Ocupação de audiência', hint: d => d.heatmap.metric,
        render: d => heatmap(d.heatmap)
      },
      {
        id: 'shareDim', span: 2,
        title: 'Share por dimensão',
        hint: 'share_media_investment · share_media_GRP · share_media_ocupation · share_channel',
        render: d => markerBars(d.share_dimensoes, {
          labelKey: 'dimensao', barKey: 'atual', barFormat: 'percent',
          markerKey: 'ly', markerFormat: 'percent', markerLabel: 'ano anterior'
        })
      }
    ]
  },

  {
    id: 'duration',
    label: 'Duration',
    panels: [
      {
        id: 'duracao', span: 2,
        title: 'Distribuição de inserções por duração',
        hint: d => `duração média ${formatValue(d.duracao.avg, 'decimal')}s · fitting ${formatValue(d.duracao.fitting, 'percent')}`,
        render: d => histogram(d.duracao.bins, {
          labelKey: 'seg', valueKey: 'insercoes',
          marker: d.duracao.avg, markerLabel: `média ${formatValue(d.duracao.avg, 'decimal')}s`
        })
      },
      {
        id: 'posicao', span: 2,
        title: 'Posição no break por canal',
        hint: 'pc_first_position · marcador = avg_position · nº de 1.as posições',
        render: d => markerBars(d.posicao, {
          labelKey: 'canal', barKey: 'pc_first', barFormat: 'percent',
          markerKey: 'avg_pos', markerFormat: 'decimal', markerLabel: 'posição média no break',
          noteKey: 'nr_first'
        })
      }
    ]
  }
];

export const getPage = id => PAGES.find(p => p.id === id) || PAGES[0];
