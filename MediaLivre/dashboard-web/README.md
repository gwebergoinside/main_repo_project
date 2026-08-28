# 📊 MediaLivre — Dashboard Web (HTML / CSS / JavaScript)

Projeto de reconstrução do relatório Power BI
**`GO NEXT 360 - MEDIA LIVRE - AD - NEGOCIAÇÕES E AUDIENCIAS.pbip`**
como aplicação web própria (HTML + CSS + JavaScript), fora do Power BI.

> Branch de desenvolvimento: `feat/medialivre-dashboard-web`
> Fonte de referência: `MediaLivre/Encomendas e Negociações/`

---

## ✅ Resposta curta: é possível?

**Sim, é tecnicamente possível** — e este `.pbip` em particular é um caso favorável,
porque boa parte da camada visual **já é HTML** (41 dos visuais são do custom visual
*HTML Content*). Mas é importante separar as duas metades do arquivo `.pbip`:

| Camada do `.pbip` | O que é | Replicável em HTML/CSS/JS? |
| --- | --- | --- |
| **`.Report`** (`report.json`) | Layout, páginas, visuais, cores, filtros, interações | **Sim, integralmente.** É um JSON declarativo — dá para ler e traduzir para componentes web |
| **`.SemanticModel`** (TMDL) | 44 tabelas, 37 relacionamentos, **141 medidas DAX**, calculation groups, parâmetros | **Sim, mas é aqui que está 90% do esforço.** Não existe motor DAX no browser — cada medida precisa ser reescrita em SQL/JS |

Ou seja: **não é uma conversão automática, é uma reimplementação.**
O `.pbip` serve como *especificação legível* (é tudo JSON + texto), não como algo que se
"compila" para web.

### O que muda de fato

| Recurso | Power BI | Dashboard Web |
| --- | --- | --- |
| Motor de cálculo | VertiPaq + DAX (in-memory, colunar) | SQL no Databricks (ou pré-agregação) + JS |
| Cross-filter automático entre visuais | Nativo | Precisa ser implementado (estado central + re-fetch) |
| Segurança / RLS | Nativo do workspace | Precisa de autenticação + filtro no backend |
| Refresh de dados | Agendado no Fabric | Cron / API própria |
| Export para Excel / PDF | Nativo | Biblioteca externa |
| Custo de licença por usuário | Pro / PPU | Zero (custo vira infra + desenvolvimento) |
| Liberdade de UI/UX | Limitada ao canvas do PBI | Total |

### Recomendação

Vale a pena **se** o objetivo for: distribuição sem licença Power BI, embed em portal
próprio, ou UX que o canvas do PBI não entrega.
**Não vale** se o objetivo for só "modernizar o visual" — nesse caso, custa muito menos
evoluir os visuais HTML Content que o relatório já usa.

---

## 🧱 Arquitetura proposta

```
┌───────────────────┐     SQL      ┌──────────────────┐   JSON   ┌─────────────────┐
│    Databricks     │◄────────────►│  API (backend)   │◄────────►│  Front-end web  │
│ medialivre.pbi_out│              │ Node/Python      │          │ HTML + CSS + JS │
│  (mesmas views)   │              │ + cache + auth   │          │  (este projeto) │
└───────────────────┘              └──────────────────┘          └─────────────────┘
```

**Por que precisa de backend:** o browser não pode (e não deve) falar direto com o
Databricks — credencial exposta, CORS, e cada medida DAX vira uma query SQL que precisa
ser montada no servidor. O front-end consome só JSON agregado.

---

## 📁 Estrutura do diretório

```
dashboard-web/
├── README.md                       # este arquivo
├── docs/
│   ├── 01-inventario-pbip.md       # o que existe hoje no .pbip (páginas, visuais, medidas)
│   ├── 02-mapeamento-visuais.md    # visual PBI → equivalente web
│   ├── 03-roadmap.md               # fases de implementação
│   ├── 04-catalogo-indicadores.md  # indicadores ↔ medida DAX de origem
│   └── 05-fase1-backend.md         # fontes, contrato da API, tradução DAX→SQL, segurança
├── src/                            # front-end
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── app.js                  # estado central + render dos visuais
│       ├── charts.js               # gráficos em SVG inline (sem bibliotecas)
│       ├── data.js                 # acesso a dados: API primeiro, mock em fallback
│       └── format.js               # formatação pt-PT alinhada às formatStrings do modelo
├── data/mock/                      # JSONs de exemplo (desenvolvimento sem backend)
└── api/                            # backend Node sem dependências (Fase 1)
    ├── server.js                   # serve front-end + API na mesma origem
    ├── config.js  databricks.js  cache.js
    └── queries/                    # tradução DAX → SQL
```

### Secções e visuais implementados

Tudo em HTML/CSS/SVG puro — **zero dependências externas**. O `index.html` declara as
secções explicitamente; as abas do topo são âncoras que saltam para cada uma.

| Secção | Visuais |
| --- | --- |
| **Main** | alertas · 8 KPI cards com sparkline · pacing (anel + bullets + factos) · combo mensal · funil · dispersão GRP×CPR · share 100% empilhado · 2 rankings · heatmap · tabela |
| **Negociações 2026** | barras divergentes do desvio da projeção · dumbbell negociado vs. fechado · barras com meta (ambição) · cartões de faturamento mínimo em risco |
| **Financeiro** | cascata bruto → desconto → líquido |
| **Audiência** | comparação homóloga (GRP/CPR/CPS/TRP) · share por dimensão |
| **Duration** | histograma de duração com marcador da média · posição no break por canal |

Biblioteca de visuais em `charts.js`: `sparkline`, `bullet`, `ring`, `monthlyCombo`,
`funnel`, `rankBars`, `stacked100`, `heatmap`, `scatter`, `waterfall`, `dumbbell`,
`divergingBars`, `histogram`, `markerBars`, `targetBars`, `riskList`, `yoyRows`.

Clicar numa linha da tabela filtra o canal — é o **cross-filter do Power BI reimplementado
à mão**, sobre um estado central em `app.js`.

> ⚠️ Os KPIs do topo vêm pré-calculados no mock e por isso ainda não reagem aos filtros.
> Com o backend, cada mudança de filtro refaz a query e eles passam a responder.

## 🚀 Como correr

```bash
cd "MediaLivre/dashboard-web" && node api/server.js
```

Abre em `http://localhost:8080/`. O servidor serve o front-end **e** a API na mesma
origem. Requer apenas Node ≥ 18 — **sem dependências npm**.

**Sem credenciais do Databricks arranca em modo mock** e o cabeçalho mostra a origem dos
dados (*Fonte: mock*), para nunca haver dúvida se um número é real. Para ligar ao
Databricks: copiar `api/.env.example` para `api/.env` e preencher. Ver
[`docs/05-fase1-backend.md`](docs/05-fase1-backend.md).

## 📍 Estado

| Fase | Estado |
| --- | --- |
| **0** — decisão de escopo | ⬜ por decidir com a equipa |
| **1** — fundação de dados | ✅ backend, contrato de API, cache · ⚠️ autenticação é placeholder |
| **2** — tradução das medidas | 🟡 **21 de 141** traduzidas, por validar contra o Power BI |
| **3** — front-end | ✅ 18 painéis, cross-filter, filtros |
| **4** — matriz e páginas restantes | ⬜ |
| **5** — paridade e entrega | ⬜ |

> ⚠️ **Nada foi validado contra o Power BI ainda.** As 21 medidas traduzidas só contam
> como feitas depois de baterem certo, número a número, com o relatório atual.
