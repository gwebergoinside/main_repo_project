# Mapeamento: visual Power BI → equivalente web

| Visual no `.pbip` | Qtd | Equivalente web | Esforço |
| --- | --- | --- | --- |
| `htmlContent` (HTML Content) | 41 | **Reaproveitar o HTML/CSS existente**, trocando os placeholders de medida por dados do JSON | 🟢 Baixo |
| `shape` | 12 | `<div>` com `border-radius` / `background` a partir do JSON do visual | 🟢 Baixo |
| `image` | 6 | `<img>` — assets já em `.Report/StaticResources/RegisteredResources/` | 🟢 Baixo |
| `cardVisual` | 3 | Componente KPI (`<div class="kpi">`) | 🟢 Baixo |
| `ToggleSwitch` | 14 | `<input type="checkbox">` estilizado + handler de estado | 🟢 Baixo |
| `tableEx` | 1 | `<table>` com ordenação | 🟢 Baixo |
| `slicer` | 62 | Select / checkbox list / date range ligados ao estado global | 🟡 Médio (volume) |
| `advancedSlicerVisual` | 9 | Slicer com busca — `<input>` + lista filtrada | 🟡 Médio |
| `advancedtrellis` (small multiples) | — | Grid de mini-gráficos (ECharts / D3) | 🟡 Médio |
| `powerKPI` / `Tachometer` | — | Sparkline com meta / gauge (ECharts) | 🟡 Médio |
| **`pivotTable` (matriz)** | 8 | Matriz hierárquica com expand/collapse, subtotais, medidas em coluna | 🔴 **Alto** |

## Onde mora o risco

1. **`pivotTable` (8 ocorrências)** — a matriz do Power BI faz hierarquia em linha e
   coluna, subtotais em cada nível, drill down/up e formatação condicional por célula.
   Não existe componente HTML pronto que entregue isso; é implementação dedicada
   (ou uma lib de data grid comercial).
2. **Cross-filter** — no PBI, clicar numa barra filtra todos os outros visuais de graça.
   Na web, isso é um store central: clique → atualiza estado → refaz as queries afetadas.
3. **As 141 medidas DAX** — cada uma precisa de reescrita em SQL, com validação número a
   número contra o relatório atual. É o item que domina o cronograma.

## Estratégia de tradução das medidas

```
DAX (~Medidas.tmdl)  ──►  SQL parametrizado (api/queries/)  ──►  JSON  ──►  front-end
```

Regra prática por tipo de medida:

| Padrão DAX | Tradução |
| --- | --- |
| `SUM` / `COUNT` / `DISTINCTCOUNT` simples | `SUM()` / `COUNT()` / `COUNT(DISTINCT)` |
| `CALCULATE(..., filtro)` | `WHERE` / `FILTER (WHERE ...)` |
| `DIVIDE(a, b)` | `a / NULLIF(b, 0)` |
| Time intelligence (`YTD`, `PREVIOUSMONTH`) | Window functions sobre `dim_tempo` |
| `SELECTEDVALUE(tabela_parâmetro)` | Parâmetro vindo do front-end na chamada da API |
| `TREATAS` / `REMOVEFILTERS` | `JOIN` explícito reescrito à mão — **caso a caso** |
| Calculation groups | Ramificação no montador da query (não tem equivalente direto) |
