# Fase 1 — Fundação de dados

Estado da fase definida em [`03-roadmap.md`](03-roadmap.md).

| Item da Fase 1 | Estado |
| --- | --- |
| Levantar as views de `medialivre.pbi_out` usadas pelo modelo | ✅ feito |
| Backend mínimo com ligação ao Databricks + cache | ✅ feito |
| Contrato de API | ✅ feito |
| Autenticação | ⚠️ **placeholder** — ver *Segurança* no fim |

Arranca também a Fase 2: **21 medidas já traduzidas** de DAX para SQL.

---

## 1. Inventário das fontes

Extraído dos `partition` do TMDL e de `expressions.tmdl`. **23 objetos** em
`medialivre.pbi_out`, todos em modo *import* no Power BI:

**Factos** — `pbi_vw_ad_insertion`, `pbi_vw_negotiations`, `pbi_vw_invoices`,
`pbi_vw_indicators`, `pbi_vw_targets`, `pbi_vw_projected_revenue`,
`pbi_vw_media_investment`, `pbi_vw_max_media_investment`, `pbi_vw_media_investment_GRP`,
`pbi_vw_ad_units`, `pbi_vw_ad_break_units`, `pbi_vw_packages`, `pbi_vw_yummi`,
`pbi_vw_audit_transactions_native_json`

**Dimensões** — `dim_tempo`, `dim_daypart`, `pbi_dim_campaigns`, `pbi_dim_channels`,
`pbi_dim_programs`, `pbi_dim_materials`, `pbi_dim_accounts_client`,
`pbi_dim_accounts_agency`, `pbi_dim_products_sectors`, `pbi_dim_buy_units`

**Metadados** — `pbi_last_data_updated`, `pb_vw_max_date_indicators`

### Joins que não são óbvios

Reproduzidos de `relationships.tmdl` em `api/queries/sql.js`:

| Ligação | Caminho |
| --- | --- |
| **Canal** | `ad_insertion.cd_campaign` → `dim_campaigns.cd_list_channel` → `dim_channels.cd_channel` |
| **Setor** | `ad_insertion.cd_material` → `dim_materials.cd_product` → `dim_products_sectors.cd_product` |
| **Daypart** | `ad_insertion.hr_air` → `dim_daypart.nr_seconds` |
| **Data** | `ad_insertion.dt_emission` → `dim_tempo.data` (relação **ativa**) |

> ⚠️ **O canal não é direto.** `pbi_vw_ad_insertion` tem uma coluna `cd_channel`, mas o
> modelo **não a usa** para ligar a `pbi_dim_channels` — passa por `cd_list_channel` da
> campanha. Ligar pela coluna direta daria números diferentes dos do Power BI.

> ⚠️ **A data ativa é `dt_emission`, não `dt_air`.** E `total_contracted_gross` troca-a
> por `dt_first_air` com `USERELATIONSHIP` — está registado como `todo` na medida.

---

## 2. Arquitetura

```
api/
├── server.js          HTTP: serve o front-end e a API na mesma origem (sem CORS)
├── config.js          .env → config; deteta modo offline
├── databricks.js      cliente REST do SQL Statement Execution API
├── cache.js           cache em memória com TTL
├── queries/
│   ├── measures.js    DAX → SQL, com o DAX original em comentário
│   ├── filters.js     WHERE parametrizado
│   └── sql.js         montagem das CTEs
└── .env.example
```

**Zero dependências npm.** Só `node:http`, `node:fs` e o `fetch` nativo (Node ≥ 18).
Não há `package.json`, `node_modules` nem lockfile para manter.

### Modo mock

Sem `DATABRICKS_HOST`, `DATABRICKS_WAREHOUSE_ID` e `DATABRICKS_TOKEN` o servidor
**arranca na mesma**, em modo mock, e a API devolve `data/mock/dashboard.json`.
O front-end mostra a origem no cabeçalho (*Fonte: mock (sem credenciais Databricks)*),
para nunca haver dúvida se um número é real.

---

## 3. Contrato da API

### `POST /api/query`

```json
{
  "measures": ["total_billing", "nr_insertions", "pc_contracted_realised"],
  "filters":  { "canal": ["Canal A"], "ano": 2026 },
  "params":   { "excludePositionTax": true, "metric": "vl_billing" },
  "detail":   true
}
```

Resposta:

```json
{
  "meta":   { "source": "databricks", "periodo": "Ano 2026", "cached": false },
  "values": { "total_billing": 12845300, "nr_insertions": 48213, "pc_contracted_realised": 0.411 },
  "rows":   [ { "canal": "...", "daypart": "...", "insercoes": 0, "faturamento": 0 } ]
}
```

Campos filtráveis: `canal`, `daypart`, `setor`, `ano`, `mes`. Cada um aceita valor único
ou lista. **Campo desconhecido é ignorado, nunca interpolado.**

`params` são os `SELECTEDVALUE` das tabelas-parâmetro do modelo — é assim que
`pmt_exclude_position_tax`, `pmt_exclude_multiproduct_tax` e `pmt_values_KPI` passam a
existir sem calculation groups.

### Outros endpoints

| Endpoint | Efeito |
| --- | --- |
| `GET /api/health` | modo, estado do cache, ping ao Databricks |
| `GET /api/measures` | catálogo das medidas **com o DAX original** — para auditar a tradução |
| `DELETE /api/cache` | limpa o cache |

---

## 4. Tradução DAX → SQL

21 medidas em `api/queries/measures.js`. Cada uma guarda o **DAX original** copiado de
`~Medidas.tmdl`; sem isso não é possível auditar uma divergência de números.

| Estado | Nº | Significado |
| --- | --- | --- |
| `ok` | 19 | tradução completa e fiel |
| `parcial` | 2 | ramo principal traduzido, ramos de parâmetro por fazer (campo `todo`) |

### Casos que exigiram cuidado

**`total_billing`** — tem três interruptores de parâmetro no DAX. A tradução é uma função
que recebe `params` e devolve a expressão certa:

| `params` | SQL |
| --- | --- |
| — | `SUM(vl_billing)` |
| `excludePositionTax` | `SUM(vl_billing - COALESCE(vl_billing_position, 0))` |
| ambos | `SUM(vl_billing - COALESCE(vl_billing_position,0) - COALESCE(vl_billing_multiproduct,0))` |
| `metric = "vl_invoice_billing"` | passa a ler `pbi_vw_invoices` (CTE por fazer) |

**`pc_discount_avg`** — o DAX devolve `BLANK()` se o bruto **ou** o faturado forem zero.
Traduzir só como `DIVIDE` daria `0` onde o Power BI mostra vazio; a tradução replica o
`SWITCH` com dois `CASE WHEN … THEN NULL`.

**`DIVIDE`** → `x / NULLIF(y, 0)`, sempre. `DIVIDE` não rebenta com divisão por zero; o
`/` do SQL também não, desde que o denominador passe por `NULLIF`.

**`COUNTROWS` com filtro** → `COUNT_IF(...)`, não `COUNT(*)` com `WHERE` — o filtro é da
medida, não da query, e outras medidas na mesma linha não o podem herdar.

---

## 5. Segurança

**Feito:**

- O PAT do Databricks vive só no servidor. `api/.env` está no `.gitignore`.
- **Nenhum valor vindo do cliente entra no SQL.** Tudo passa por parâmetros nomeados
  (`:canal_0`); listas geram um parâmetro por valor. Testado com
  `x'; DROP TABLE y; --` — o valor fica no parâmetro, o SQL não muda.
- Campos de filtro validados contra uma lista fixa; desconhecidos são descartados.
- Erros do Databricks são registados no servidor; o cliente recebe só a mensagem, nunca
  o corpo da resposta (que pode revelar detalhes do warehouse).
- Travessia de caminhos bloqueada nos ficheiros estáticos; corpo do pedido limitado a 64 KB.

**Por fazer — e é preciso antes de qualquer utilização real:**

- **A autenticação é um placeholder.** `API_TOKEN` é um segredo partilhado; num browser
  qualquer utilizador o vê no DevTools. Serve para impedir acesso anónimo direto em
  desenvolvimento, **não identifica o utilizador**.
- **Não há RLS.** No Power BI a segurança ao nível da linha é do workspace. Aqui, quem
  chegar à API vê tudo. Uma sessão autenticada (SSO/OIDC) tem de passar a identidade
  para o `WHERE` — no servidor, nunca a partir do pedido do cliente.
- Falta rate limiting e registo de auditoria dos acessos.

---

## 6. Como correr

```bash
cd "MediaLivre/dashboard-web" && node api/server.js
```

Abre em `http://localhost:8080/`. Sem `.env` corre em modo mock.

Para ligar ao Databricks: copiar `api/.env.example` para `api/.env` e preencher
`DATABRICKS_HOST`, `DATABRICKS_WAREHOUSE_ID` e `DATABRICKS_TOKEN`. Confirmar com:

```bash
curl -s http://localhost:8080/api/health
```

---

## 7. Próximo passo — Fase 2

1. Ligar a um warehouse real e **validar as 21 medidas número a número** contra o
   relatório Power BI. Nenhuma tradução conta como feita antes disso.
2. Fechar os dois `todo`: a CTE de `pbi_vw_targets` (ramo `_fl_adults`) e o filtro de data
   por `dt_first_air` nas negociações.
3. Traduzir as medidas de audiência (`GRP_EQ`, `CPR_EQ`, `TRP`, `CPS`) — dependem de
   `pbi_vw_indicators` e dos `TREATAS` sobre targets, e são as mais difíceis do modelo.
4. Ligar os restantes blocos do dashboard à API: hoje só os KPIs e a tabela de detalhe têm
   query; cascata, ficheiros, funil e heatmap continuam a vir do mock.
