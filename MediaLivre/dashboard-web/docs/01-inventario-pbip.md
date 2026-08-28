# Inventário do `.pbip` de origem

Levantamento feito diretamente sobre os arquivos de
`MediaLivre/Encomendas e Negociações/`.

---

## 1. Estrutura do artefato

| Item | Valor |
| --- | --- |
| Arquivo raiz | `GO NEXT 360 - MEDIA LIVRE - AD - NEGOCIAÇÕES E AUDIENCIAS.pbip` |
| Report | `.Report/report.json` — **812 KB**, formato PBIR legado (arquivo único) |
| Semantic Model | `.SemanticModel/definition/` — TMDL |
| Fonte de dados | **Databricks** (`Databricks.Query`), catálogo `medialivre.pbi_out` |
| Modo de armazenamento | **Import** (41 partições) |

## 2. Páginas e visuais (7 páginas, 160 visuais)

| Página | Canvas | Visuais | Composição |
| --- | --- | --- | --- |
| **Main** | 2590×1190 | 38 | 15 slicer, 11 HTML Content, 5 Toggle, 3 pivotTable, 3 shape, 1 image |
| **Agencies** *(in const.)* | 1500×840 | 34 | 12 HTML Content, 8 slicer, 4 Toggle, 3 advancedSlicer, 3 shape, 1 pivotTable |
| **Simulate** *(in const.)* | 1496×840 | 40 | 14 slicer, 11 HTML Content, 6 shape, 4 Toggle, 2 advancedSlicer, 1 pivotTable |
| **Negociações 2026** | 1700×780 | 18 | 6 slicer, 5 HTML Content, 3 advancedSlicer, 1 pivotTable, 1 Toggle |
| **Share** *(in const.)* | 1500×840 | 16 | 11 slicer, 1 HTML Content, 1 pivotTable, 1 card, 1 advancedSlicer |
| **Duration** *(in const.)* | 1500×840 | 11 | 7 slicer, 1 HTML Content, 1 pivotTable, 1 card |
| **Duration Detail** | 480×980 | 3 | 1 slicer, 1 tableEx, 1 card |

### Tipos de visual agregados

| Tipo | Qtd | Observação para a migração |
| --- | --- | --- |
| `slicer` | 62 | Filtros — viram controles HTML + estado central |
| `htmlContent...` | 41 | **Já é HTML/CSS** — maior parte é reaproveitável |
| `ToggleSwitch...` | 14 | Switch custom — trivial em CSS |
| `shape` | 12 | Decoração — vira CSS |
| `advancedSlicerVisual` | 9 | Slicer com busca — `<input>` + filtro JS |
| `pivotTable` | 8 | **Matriz hierárquica — item mais caro da migração** |
| `image` | 6 | `<img>` (logo já está em `StaticResources`) |
| `cardVisual` | 3 | KPI card — trivial |
| `tableEx` | 1 | Tabela — trivial |

### Custom visuals declarados

`advancedtrellis`, `htmlContent`, `powerKPI`, `simpleImage`, `Tachometer`,
`ToggleSwitch` e 2 visuais `PBI_CV_*`.
Todos têm equivalente web direto, exceto o *trellis* (small multiples), que exige
uma biblioteca de gráficos.

## 3. Modelo semântico

| Item | Qtd |
| --- | --- |
| Tabelas | 44 |
| Relacionamentos | 37 |
| **Medidas DAX** | **141** (140 em `~Medidas`, 1 em `pmt_discount_investment`) |
| Calculation groups | 3 (`is_MediaLivre_advertiser`, `tp_agencies`, `until_last_updated`) |
| Culturas / traduções | 5 (en-GB, en-US, es-ES, pt-BR, pt-PT) |
| Parâmetros M | `Host`, `Path`, `Server`, `BD`, `AnoUpdate`, `RangeStart`, `RangeEnd` |

### Domínios de medidas (display folders)

Faturamento (`total_billing`, `total_gross`, `total_contracted_gross`, `total_budget`),
Inserções (`nr_insertions*`, `nr_campaigns`, `nr_channels`, `nr_programs`),
Negociações (`nr_negotiations_total`, `nr_negotiations_with_insertions`),
Audiência / `08 Audience` (`GRP`, `GRP_EQ`, `TRP`, `CPR`, `CPR_EQ`, `CPS`),
Percentuais (`pc_active_rate`, `pc_contracted_realised`, `pc_discount_avg`, `pc_first_position`),
Duração (`avg_duration`, `total_seconds/minutes/hours`),
Crescimento MoM/YTD e medidas de texto (`tx_*`).

### Complexidade DAX — exemplo real (`GRP`)

A medida `GRP` usa `SELECTEDVALUE` de duas tabelas-parâmetro, `SUMX` sobre
`FILTER` com `CONTAINSSTRING`, `REMOVEFILTERS` e **dois `TREATAS`** para religar
`pbi_vw_targets_var` a `pbi_vw_targets` por variante.

> Esse é o nível de reescrita esperado: cada medida dessas vira uma CTE/subquery SQL
> parametrizada, não uma linha de JavaScript. É o principal driver de esforço do projeto.
