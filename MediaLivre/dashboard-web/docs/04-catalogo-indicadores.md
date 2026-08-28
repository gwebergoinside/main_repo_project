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

## Indicadores sugeridos ainda não implementados

| Indicador | Medidas | Valor |
|---|---|---|
| ⭕ Cascata bruto → desconto → líquido | `total_gross`, `pc_discount_avg`, `total_net` | Mostra onde o valor se perde entre tabela e fatura |
| ⭕ Negociado vs. faturado por ficheiro | `vl_negociado_ficheiro`, `vl_fechado_ficheiro`, `pc_contracted_efective_realised_ficheiro` | Toda a pasta `11 Ficheiro` está por explorar |
| ⭕ Desvio projetado vs. faturado | `vl_dif_project_negotiated_vs_billing`, `pc_dif_project_negotiated_vs_billing` | Qualidade da própria previsão |
| ⭕ Curva de duração | `avg_duration`, `pc_duration`, `vl_duration_fitting` | Alimenta a página *Duration* |
| ⭕ Posição média no break | `avg_position`, `nr_first_position` | Qualidade de entrega por canal |
| ⭕ YoY de audiência | `yoy_GRP_EQ_growth_pct`, `yoy_CPR_EQ_growth_pct`, `CPS_LY` | Evolução da eficiência, não só do volume |
| ⭕ Faturamento mínimo em risco | `total_dif_minimal_billing` | Contratos abaixo do mínimo acordado |
| ⭕ Cobertura de ambição por ficheiro | `vl_contracted_shouldBe_ambicao`, `pc_contracted_shouldBe_realised_ambicao` | Pacing ao nível do ficheiro |

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
