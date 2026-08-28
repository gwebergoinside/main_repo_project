# Catálogo de indicadores

Indicadores propostos para o dashboard web, **ancorados nas medidas que já existem** em
`~Medidas.tmdl` (141 medidas, organizadas em 11 display folders). Nada aqui inventa métrica
nova: a coluna *Medida no modelo* é o nome exato do DAX de origem.

Legenda de estado: ✅ implementado no `index.html` · ⭕ proposto, ainda não implementado.

---

## 1. Faixa de KPIs (topo)

O critério foi cobrir os quatro ângulos do negócio numa só linha — **dinheiro, volume,
audiência e qualidade de entrega** — em vez de oito variações de faturamento.

| # | Indicador | Medida no modelo | Porquê | Estado |
|---|---|---|---|---|
| 1 | Faturamento | `total_billing` | Resultado efetivo do período | ✅ |
| 2 | Bruto contratado | `total_contracted_gross` | O que foi vendido, antes de emitir | ✅ |
| 3 | Contratado realizado | `pc_contracted_realised` | **O indicador mais importante do relatório**: quanto do vendido virou receita | ✅ |
| 4 | Inserções | `nr_insertions` | Volume operacional | ✅ |
| 5 | GRP eq. 30" | `GRP_EQ` | Audiência entregue, normalizada a 30 segundos | ✅ |
| 6 | CPR eq. 30" | `CPR_EQ` | Custo por rating — eficiência comercial | ✅ |
| 7 | Desconto médio | `pc_discount_avg` | Erosão de preço; sobe = mau | ✅ |
| 8 | 1ª posição no break | `pc_first_position` | Qualidade da entrega ao anunciante | ✅ |

> **Sinal invertido:** CPR e Desconto usam `invertDelta` — a seta aponta a direção real,
> mas a cor inverte, porque subir é mau. Sem isto, um dashboard mostra "▲ verde" numa
> deterioração de preço.

### Alternativas para trocar por contexto
| Indicador | Medida | Quando faz mais sentido |
|---|---|---|
| Taxa de atividade | `pc_active_rate` | Foco operacional |
| Nº de anunciantes / agências | `nr_accounts_client`, `nr_agencies` | Foco comercial de carteira |
| Bónus concedido | `total_bonus` | Negociação de contrapartidas |
| Margem líquida | `total_net`, `total_invoice_net` | Visão financeira |

---

## 2. Pacing comercial ✅

A pergunta que a direção comercial faz todos os dias: **estamos onde devíamos estar?**

| Elemento | Medidas |
|---|---|
| Anel de atingimento | `total_billing` ÷ `vl_contracted_shouldBe_realised` |
| Bullet "Ambição anual" | `vl_ambicao` / `total_budget` |
| Bullet "Contratado" | `total_contracted_gross` |
| Bullet "Faturado" | `total_billing`, com marcador em `vl_contracted_shouldBe_realised` |
| Projeção fecho | `vl_projected_revenue_negotiated` |
| Cenário pessimista | `vl_projected_revenue_negotiated_pessimist` |
| Por contratar | `vl_projected_revenue_left` |

O marcador âmbar no bullet é a **linha de referência do esperado** — é o que transforma
"faturámos 12,8M€" em "faturámos 12,8M€ e devíamos ter 14,1M€".

---

## 3. Evolução mensal ✅

Barras = ano atual (`total_billing`), linha = homólogo (`total_billing_LY`).
Complementos disponíveis no modelo: `yoy_billing_growth_pct`, `mom_billing_growth_pct`,
`total_billing_ytd`, `total_billing_mtd`.

---

## 4. Funil de negociações ✅

| Etapa | Medida |
|---|---|
| Negociações registadas | `nr_register` |
| Com inserções | `nr_negotiations_with_insertions` |
| Emitidas | `nr_insertions_active` |
| Faturadas | `total_invoice_gross` (contagem) |

Mostra a **queda percentual entre etapas**, não só o valor absoluto — é onde se vê a fuga.
O modelo já tem uma medida de texto `tx_funnel`, o que sugere que este visual já era
pretendido no relatório original.

---

## 5. Eficiência por canal (dispersão) ✅

`GRP_EQ` no eixo X, `CPR_EQ` no eixo Y, área da bolha = `total_billing`.
Responde a "**que canal entrega audiência barata e em volume**" — o quadrante inferior
direito (muito GRP, CPR baixo) é o desejável. Um ranking em barras não mostra isto.

---

## 6. Share de investimento ✅

`share_media_investment` vs. `share_media_investment_ly`, com variação em **pontos
percentuais** (não em %, que seria enganador num indicador que já é percentagem).
O modelo tem ainda `share_channel`, `share_media_GRP`, `share_media_ocupation`
e as respetivas versões `_ly` e `_all` — dá para uma página inteira de share.

---

## 7. Rankings ✅

Faturamento por canal e por setor (`pbi_dim_products_sectors`), com variação homóloga.

---

## 8. Heatmap canal × daypart ✅

`GRP_EQ` cruzado com `dim_daypart`. É a leitura de **onde está a audiência**, e substitui
com vantagem uma matriz para este cruzamento específico — a cor mostra o padrão de
imediato.

---

## 9. Tabela de detalhe ✅

Com barra de dados na coluna de faturamento, totais no rodapé (o subtotal da matriz do PBI)
e ordenação por qualquer coluna. Clicar numa linha filtra o canal — é o **cross-filter**
reimplementado à mão.

---

## 10. Cascata: do bruto de tabela ao líquido ✅ · página *Financeiro*

`total_gross` → desconto (`pc_discount_avg`) → `total_bonus` → taxas → `total_net`.
Mostra **onde o valor se perde** entre a tabela de preços e a fatura. Barras âncora
(bruto e líquido) assentam no zero; as intermédias flutuam sobre o acumulado.

## 11. Negociado vs. fechado por ficheiro ✅ · página *Negociações 2026*

Dumbbell: `vl_negociado_ficheiro` (ponto vazado) vs. `vl_fechado_ficheiro` (ponto cheio).
**O comprimento da linha é a distância por fechar** — é o que se quer ver de relance, e
uma tabela com duas colunas não mostra. % = `pc_contracted_efective_realised_ficheiro`.

## 12. Cobertura da ambição por ficheiro ✅ · página *Negociações 2026*

Barra colorida por atingimento com **marcador da ambição** (`vl_contracted_shouldBe_ambicao`,
`pc_contracted_shouldBe_realised_ambicao`). É o pacing da secção 2, mas ao nível do ficheiro.

## 13. Desvio projetado vs. faturado ✅ · página *Negociações 2026*

Barras divergentes em torno do zero (`pc_dif_project_negotiated_vs_billing`).
Mede a **qualidade da própria previsão**, mês a mês — um indicador sobre o processo, não
sobre a receita.

## 14. Faturamento mínimo em risco ✅ · página *Negociações 2026*

`total_dif_minimal_billing`: negociações abaixo do mínimo contratado, com a falta em euros,
a barra de cobertura e os dias que faltam para o fim da emissão.

> **Regra de cor:** verde só quando o mínimo já está coberto. Uma negociação a 92% do
> mínimo é âmbar, não verde — abaixo do mínimo nada é "bom", por muito perto que esteja.

## 15. Evolução homóloga da audiência ✅ · página *Audiência*

`GRP_EQ`/`GRP_EQ_LY`, `CPR_EQ`/`CPR_EQ_LY`, `CPS`/`CPS_LY`, `TRP`. Mostra a evolução da
**eficiência**, não só do volume — com o sinal invertido em CPR e CPS.

## 16. Share por dimensão ✅ · página *Audiência*

`share_media_investment`, `share_media_GRP`, `share_media_ocupation`, `share_channel`,
cada um com o marcador do ano anterior (`_ly`). Revela divergências úteis: ganhar share de
investimento e perder share de ocupação diz algo que nenhuma das medidas diz sozinha.

## 17. Distribuição por duração ✅ · página *Duration*

Histograma de inserções por duração, com marcador da média (`avg_duration`) interpolado
entre os bins. `vl_duration_fitting` e `pc_duration` no cabeçalho.

## 18. Posição no break por canal ✅ · página *Duration*

`pc_first_position` na barra, `avg_position` no marcador, `nr_first_position` como nota —
três medidas relacionadas numa linha só.

---

## Mapa de páginas

O ficheiro `src/js/pages.js` declara as páginas e os seus painéis — estrutura
deliberadamente parecida com a das `sections` do `report.json`. Trocar de página é
trocar de definição; nenhum HTML de página vive no `index.html`.

| Página | Painéis |
|---|---|
| **Main** | alertas, 8 KPIs, pacing, mensal, funil, dispersão, share, 2 rankings, heatmap, tabela |
| **Negociações 2026** | 4 KPIs, funil, desvio da projeção, ficheiros (dumbbell), cobertura da ambição, risco |
| **Financeiro** | cascata bruto→líquido, ranking por setor, mensal |
| **Audiência** | homólogo, dispersão, heatmap, share por dimensão |
| **Duration** | distribuição por duração, posição no break |

## Ainda por explorar

| Indicador | Medidas |
|---|---|
| ⭕ Bónus e taxas em detalhe | `total_bonus`, `pmt_exclude_position_tax`, `pmt_exclude_multiproduct_tax` |
| ⭕ Investimento de tabela | `vl_table_investment`, `rk_nm_field_investment`, `vl_duration_invest` |
| ⭕ Simulação de cenários | `pbi_vw_targets_simulado`, `filter_simulated_ds_variant` (página *Simulate* do PBI) |
| ⭕ Agências | `tp_agencies`, `nr_agencies`, `tx_relationship_agency` (página *Agencies* do PBI) |

---

## Princípios aplicados

1. **Uma pergunta por visual.** Cada painel responde a uma pergunta de negócio explícita,
   escrita no cabeçalho.
2. **Sempre com referência.** Um número sozinho não informa — todos os KPIs têm variação,
   e o pacing tem a linha do esperado.
3. **Cor com significado.** Verde/vermelho só onde há juízo de valor, e invertido nas
   métricas onde subir é mau.
4. **Sem gráfico decorativo.** Não há gráfico circular, 3D nem gauge duplicado: cada
   visual mostra algo que os outros não mostram.
