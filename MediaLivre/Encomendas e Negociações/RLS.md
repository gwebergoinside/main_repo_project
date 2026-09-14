# RLS — GO NEXT 360 · Media Livre · AD · Negociações e Audiências

RLS **dinâmico**: uma só regra, conduzida pela tabela `pbi_tb_rls`
(`medialivre.pbi_out.pbi_tb_rls`). Quem vê o quê define-se **nos dados**, não no modelo —
adicionar ou tirar um diretor passa a ser um `INSERT`/`DELETE`, sem republicar.

## Arquitetura

```
pbi_tb_rls[ds_email] = USERPRINCIPALNAME()
        │  cd_group = Código
        ▼
    Ambição  ──1:N──>  Relação Ambição  ──1:N──>  pbi_dim_accounts_agency
                                                        │
                                                        └──> pbi_dim_campaigns ──> factos
                                                             (inserções, faturação,
                                                              negociações, projeções, …)
```

A regra está escrita como **lookup** em `pbi_tb_rls`, não depende da propagação pela
relação `pbi_tb_rls[cd_group] → Ambição[Código]`:

```dax
CONTAINS (
    FILTER ( ALL ( pbi_tb_rls ), pbi_tb_rls[ds_email] = USERPRINCIPALNAME () ),
    pbi_tb_rls[cd_group], 'Ambição'[Código]
)
```

Assim não é preciso ligar *Apply security filter in both directions* na relação — que é o
passo que costuma faltar e faz o RLS não filtrar nada.

## Roles

| Role | Filtro | Membros a atribuir no Service |
|---|---|---|
| `RLS Diretores` | dinâmico, pela `pbi_tb_rls` | tmedeiros@, icastilho@, pb@, ligiareis@, joanasantana@ |
| `RLS Total` | nenhum — vê tudo | LuciaCosta@, RuteFerreira@, JoanaLourenco@ |

Os membros atribuem-se no **Power BI Service** (Semantic model → ⋯ → *Security*); o
Desktop não permite atribuir membros.

As três de acesso total ficam na `RLS Total` para não ser preciso carregar 45 linhas na
tabela. Em alternativa, dá-lhes os 15 códigos na `pbi_tb_rls` e mete-as na `RLS Diretores`.

## Conteúdo que a `pbi_tb_rls` tem de ter

`cd_group` corresponde a `Ambição[Código]` — uma linha por **agência**, não por grupo:

| Código | Agência | Grupo |
|---|---|---|
| 1 | ARENA | GRUPO HAVAS |
| 2 | Caetsu | Caetsu |
| 3 | Dentsu | Dentsu |
| 4 | Ess. Mediacom | WPP Media |
| 5 | HAVAS Media | GRUPO HAVAS |
| 6 | Initiative | OMNICOM |
| 7 | MDY | MDY |
| 8 | MEDIAGATE | MEDIAGATE |
| 9 | Mindshare | WPP Media |
| 10 | Nova Expressão | Nova Expressão |
| 11 | OMD | OMNICOM |
| 12 | PHD | OMNICOM |
| 13 | Publicis | Publicis |
| 14 | Universal Mc | OMNICOM |
| 15 | Wavemaker | WPP Media |

Linhas necessárias (26 no total), conforme as instruções:

| ds_email | ds_user | cd_group | Grupos |
|---|---|---|---|
| tmedeiros@medialivre.pt | Tiago Medeiros | 2, 7 | Caetsu, MDY |
| icastilho@medialivre.pt | Isabel Castilho | 1, 5, 8 | Havas, Mediagate |
| pb@medialivre.pt | Paulo Barata | 3, 6, 10, 11, 12, 14 | Dentsu, Nova Expressão, Omnicom |
| ligiareis@medialivre.pt | Ligia Reis | 4, 6, 9, 11, 12, 13, 14, 15 | Publicis, WPP, Omnicom |
| joanasantana@medialivre.pt | Joana Santana | 4, 6, 9, 11, 12, 14, 15 | WPP, Omnicom |

Para conferir o que lá está:

```sql
SELECT ds_email, ds_user, sort_array(collect_list(cd_group)) AS grupos, count(*) AS n
FROM medialivre.pbi_out.pbi_tb_rls
GROUP BY ds_email, ds_user
ORDER BY ds_email;
```

**Se a tabela não tiver estas linhas, o RLS não filtra o que é suposto** — a regra é só o
mecanismo, o mapeamento vive nos dados.

## Aplicar

1. Power BI Desktop → **TMDL view** → separador **Script 5** → *Apply*.
   (As roles também estão em `definition/roles/`, carregadas ao abrir o `.pbip`.)
2. Atualizar a `pbi_tb_rls` para trazer as linhas do Databricks.

## Testar

Desktop: **Modelling → View as → Other user**, escrever o email (ex.: `pb@medialivre.pt`)
**e** marcar a role `RLS Diretores`. Sem o campo *Other user*, `USERPRINCIPALNAME()`
devolve a tua própria conta e parece que o RLS não faz nada.

Service: *Security* → ⋯ na role → **Test as role**.

Confirmar em cada caso:

- [ ] só aparecem as agências dos grupos esperados
- [ ] `vl_ambicao` mostra apenas a ambição desses grupos
- [ ] faturação, encomendas e negociações acompanham
- [ ] **o calendário continua a mostrar todos os anos** (ver aviso abaixo)

## Aviso — `Ambição` × `dim_tempo`

`Ambição[Ano]` tem uma relação muitos-para-muitos com `dim_tempo[nr_year]` e todas as
linhas de `Ambição` têm `Ano = 2026`. Filtrar `Ambição` por RLS pode propagar para
`dim_tempo` e reduzir o relatório inteiro a 2026, incluindo comparativos com anos
anteriores.

**Verifica isto logo no primeiro teste.** Se acontecer, a correção é mover a regra da
`Ambição` para a ponte `Relação Ambição`, que não toca em `dim_tempo` — substituir a linha
`tablePermission Ambição = …` por:

```tmdl
tablePermission 'Relação Ambição' = CONTAINS ( FILTER ( ALL ( pbi_tb_rls ), pbi_tb_rls[ds_email] = USERPRINCIPALNAME () ), pbi_tb_rls[cd_group], 'Relação Ambição'[cd_ambicao] )
```

(`Relação Ambição[cd_ambicao]` tem os mesmos valores de `Ambição[Código]`.) Contrapartida:
a tabela `Ambição` deixa de ser filtrada, por isso uma medida de ambição avaliada **sem
contexto de agência** — um cartão com o total geral — mostra o total de todos os grupos.

---

# Refactor DAX exigido pelo RLS

O motor do Power BI **proíbe `USERELATIONSHIP()` e `CROSSFILTER()` em qualquer consulta
que toque numa tabela restrita por RLS**:

> As funções UseRelationship() e CrossFilter() não podem ser usadas ao consultar
> 'pbi_vw_invoices' porque ela é restrita pela segurança em nível de linha.

Como o RLS propaga até aos factos, todas as medidas com relações dinâmicas falhavam.
Foram reescritas em DAX compatível com RLS.

| Objeto | Antes | Depois |
|---|---|---|
| `total_budget`, `total_invoice_net` | `CROSSFILTER( campaigns[cd_campaign], ad_insertion[cd_campaign], Both )` | `TREATAS( VALUES( ad_insertion[cd_campaign] ), campaigns[cd_campaign] )` |
| `total_contracted_gross`, `dt_first_air_`, `dt_last_air_`, `pc_contracted_shouldBe_realised` | `USERELATIONSHIP( negotiations[dt_first_air], dim_tempo[data] )` | `TREATAS( VALUES( dim_tempo[data] ), negotiations[dt_first_air] )` |
| `vl_projected` | `CROSSFILTER( projected_revenue[dt_negotiation_projected], dim_tempo[data], NONE )` | `REMOVEFILTERS( dim_tempo )` |
| `vl_negociado_ficheiro` | `USERELATIONSHIP( client[cd_account_agency], agency[cd_account] )` | `TREATAS( VALUES( agency[cd_account] ), client[cd_account_agency] )` |
| `vl_ambicao` | idem | `TREATAS( VALUES( client[cd_account_agency] ), agency[cd_account] )` |
| `tp_agencies` → *Última Agência* | idem | `TREATAS( VALUES( agency[cd_account] ), client[cd_account_agency] )` + `REMOVEFILTERS( agency )` |

A direção do `TREATAS` não é a mesma em todos: em `vl_ambicao` é o **cliente que filtra a
agência** (a Ambição é alcançada a partir de `pbi_dim_accounts_agency`), nos restantes é a
**agência que filtra o cliente**. `REMOVEFILTERS` não remove filtros de RLS.

## Diferenças de comportamento a vigiar

1. **`TREATAS( VALUES( ad_insertion[cd_campaign] ), campaigns[cd_campaign] )`** — sem
   filtro sobre `pbi_vw_ad_insertion`, o `CROSSFILTER Both` não restringia nada, enquanto o
   `TREATAS` deixa de fora campanhas **sem inserções**. O `IF( ABS( [total_seconds] ) > 0, … )`
   de ambas as medidas já anula essas linhas — confirmar o **total geral**.

2. **`TREATAS( VALUES( dim_tempo[data] ), negotiations[dt_first_air] )`** — negociações com
   `dt_first_air` nulo ou fora do intervalo de `dim_tempo` deixam de ser contadas quando não
   há filtro de data.

3. **Item *Última Agência*** — o `REMOVEFILTERS( pbi_dim_accounts_agency )` reproduz a
   desativação do caminho `campaigns → agency`. Combinado com `vl_ambicao` deixa de filtrar
   a Ambição pela agência selecionada; usar `vl_ambicao` com *Ordem de Publicidade*.
