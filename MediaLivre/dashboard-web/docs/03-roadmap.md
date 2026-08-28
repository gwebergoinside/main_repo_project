# Roadmap de implementação

Fases pensadas para entregar valor cedo e só depois atacar o que é caro.

## Fase 0 — Decisão (antes de codar)
- [ ] Confirmar o *porquê* da migração: licenciamento? embed em portal? UX?
- [ ] Definir escopo: **todas as 7 páginas** ou só `Main` + `Negociações 2026`?
      (as 4 páginas marcadas *"in const."* podem estar inacabadas no PBI — validar)
- [ ] Definir se o acesso ao Databricks será direto (SQL Warehouse) ou via camada
      agregada intermediária

## Fase 1 — Fundação de dados
- [ ] Levantar as views de `medialivre.pbi_out` já usadas pelo modelo
- [ ] Backend mínimo (Node ou Python) com conexão ao Databricks + cache
- [ ] Contrato de API: `POST /query { page, filtros, medidas }` → JSON
- [ ] Autenticação

## Fase 2 — Tradução das medidas
- [ ] Priorizar as ~20 medidas que aparecem na página `Main`
- [ ] Reescrever DAX → SQL, **uma a uma**, com teste de valor contra o PBI atual
- [ ] Registrar cada equivalência em `api/queries/` (SQL + medida DAX original em comentário)

## Fase 3 — Front-end
- [ ] Estado global de filtros (o "cross-filter" do PBI)
- [ ] Componentes: KPI card, slicer, toggle, tabela
- [ ] Reaproveitar o HTML/CSS dos 41 visuais *HTML Content*
- [ ] Página `Main` completa como prova de conceito

## Fase 4 — O item caro
- [ ] Componente de matriz (hierarquia, subtotais, expand/collapse, formatação condicional)
- [ ] Demais páginas

## Fase 5 — Paridade e entrega
- [ ] Validação número a número contra o relatório Power BI
- [ ] Export (Excel / PDF)
- [ ] Responsividade e performance
- [ ] Deploy

---

## Estimativa grosseira de esforço

| Fase | Peso relativo |
| --- | --- |
| Backend + tradução das 141 medidas | **~55%** |
| Componente de matriz + páginas | ~25% |
| Front-end restante (cards, slicers, layout) | ~15% |
| Deploy / validação | ~5% |
