# API / Backend

Camada que **substitui o motor DAX**: recebe os filtros do front-end, monta o SQL contra
o Databricks (`medialivre.pbi_out`) e devolve JSON agregado.

Documentação completa: [`../docs/05-fase1-backend.md`](../docs/05-fase1-backend.md).

## Correr

```bash
cd "MediaLivre/dashboard-web" && node api/server.js
```

Serve o front-end **e** a API na mesma origem (`http://localhost:8080/`). Sem credenciais
arranca em modo mock — o cabeçalho do dashboard mostra a origem dos dados.

Requer apenas Node ≥ 18. **Sem dependências npm.**

## Ficheiros

| Ficheiro | Função |
| --- | --- |
| `server.js` | HTTP, rotas, autenticação, ficheiros estáticos |
| `config.js` | `.env` → configuração; deteta o modo offline |
| `databricks.js` | cliente REST do SQL Statement Execution API |
| `cache.js` | cache em memória com TTL |
| `queries/measures.js` | **tradução DAX → SQL**, com o DAX original em comentário |
| `queries/filters.js` | `WHERE` parametrizado |
| `queries/sql.js` | montagem das CTEs e dos joins do modelo |

## Endpoints

```
POST   /api/query      { measures, filters, params, detail } → { meta, values, rows }
GET    /api/health     modo, cache, ping ao Databricks
GET    /api/measures   catálogo com o DAX original de cada medida
DELETE /api/cache      limpa o cache
```

## Regras

- A credencial do Databricks **fica só aqui** — nunca no front-end.
- Cada medida em `queries/measures.js` traz o DAX original de `~Medidas.tmdl`.
  Se a medida mudar no modelo, o comentário tem de mudar aqui — é o que permite auditar
  divergências de números.
- **Nenhum valor do cliente é interpolado no SQL.** Parâmetros nomeados, sempre.
- Os joins reproduzem `relationships.tmdl`, não o que parece óbvio pelos nomes das colunas
  (o canal, em particular, passa pela campanha).

## Segurança — estado atual

A autenticação por `API_TOKEN` é um **placeholder**: um segredo partilhado, visível no
DevTools de quem usar o dashboard. **Não há RLS** — quem chegar à API vê tudo.
Antes de qualquer utilização real é preciso sessão autenticada (SSO/OIDC) e o filtro de
identidade aplicado no servidor. Ver a secção *Segurança* em `../docs/05-fase1-backend.md`.
