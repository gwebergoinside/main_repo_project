# API / Backend

Camada que **substitui o motor DAX**: recebe os filtros do front-end, monta o SQL contra
o Databricks (`medialivre.pbi_out`) e devolve JSON agregado.

Ainda não implementada — ver `docs/03-roadmap.md`, Fase 1 e 2.

## Contrato pretendido

```
POST /query
{
  "page": "main",
  "measures": ["total_billing", "nr_insertions", "GRP"],
  "filters": { "ano": [2026], "canal": ["Canal A"], "daypart": [] }
}
```

Resposta: mesmo shape de `data/mock/dashboard.json`.

## Regras

- A credencial do Databricks **fica só aqui** — nunca no front-end.
- Cada arquivo em `queries/` traduz **uma** medida DAX e deve conter, em comentário,
  o DAX original copiado de `~Medidas.tmdl`, para permitir auditoria da equivalência.
- Cache por combinação (medidas + filtros); as views são `import` no PBI hoje, ou seja,
  o volume já é conhecido e cabe em pré-agregação.
