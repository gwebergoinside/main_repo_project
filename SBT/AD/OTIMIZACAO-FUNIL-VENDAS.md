# Otimização do modelo — GODASHBOARD SBT / Funil de Vendas

**Modelo:** `SBT/AD/GODASHBOARD - SBT - FUNIL DE VENDAS.SemanticModel`
**Data:** 17/09/2026
**Saldo:** 24 → 23 tabelas · 163 → 99 colunas · 17 → 12 queries · 14 → 10 idas à base de dados

> **Nada disto foi executado.** Não há Power BI Desktop nem acesso ao RDS/Dataverse nesta sessão.
> A verificação é estática (secção 8): todas as referências DAX resolvem, todos os `let`/`in` fecham,
> nenhuma relação aponta para coluna apagada e nenhum campo usado no report foi removido.

---

## 1. Padrão pedido: a query SQL na primeira variável

Os **10 objetos** com origem `Sql.Database` passam todos pelo mesmo molde — o mesmo já usado no
GESTOR CONTA:

```m
let
    SQL = "SELECT
            ...
        FROM ...
        WHERE ...",
    Source = Sql.Database(OrgDynamics, BD_Dynamics, [Query = SQL]),
    #"Passo seguinte" = ...
in
    #"Passo seguinte"
```

Antes, **nenhum** seguia: o SQL estava embutido na chamada `Sql.Database(...)` numa única linha com
`#(lf)` e `#(tab)` a fazer de quebras de linha — ilegível em diff e impossível de rever. Agora a query é
texto multi-linha na primeira variável e os passos de Power Query a seguir são só transformação.

| Objeto | Origem |
| --- | --- |
| `Lead`, `Neg`, `Briefings`, `EmpresaFaturamento`, `Executivos`, `LinhaDoTempo` | Dataverse TDS (`OrgDynamics` / `BD_Dynamics`) |
| `GrupoCliente`, `Programas_Lead`, `Programas_Opt_Lead` | RDS `GONEXTAD20` (`Org` / `BD`) |
| `DashboardUserPermission` | RDS `GONEXTADExternal` (`Org` / `BDExternal`) |

Os objetos que leem o Dataverse pelo conector (`RLSFILTER`, `Posi`, `UsersMain`) não têm texto SQL: a
origem é a função `GetCDST_EntityTable`. Aí o equivalente ao padrão é a primeira variável ser a leitura
da entidade — que já era o caso.

---

## 2. Queries e expressões removidas

### 2.1 `OPTSModified` — estava morta

No `Neg` havia um ramo pendurado. O passo `#"Merged Queries8"` não partia de `#"Changed Type2"` (o fim da
cadeia) mas de `#"Expanded OPTSCreated"`, sete passos atrás. Tudo o que estava pelo meio —
`Numero_Negociacao`, `Data Aprovação`, `Data de Aprovação`, `Data De Integração` — era calculado e
deitado fora. A prova está nas colunas do modelo: nenhuma dessas existia na tabela final.

`OPTSModified` só servia esse ramo. **Uma leitura completa de `go_opportunity` por refresh, para nada.**

### 2.2 `OPTSCreated` — resultado não usado

Produzia `Neg[First_Createdon]`, que nenhuma medida, coluna calculada, relação ou visual lê. Saiu a
coluna e saiu a query. **Menos uma leitura completa de `go_opportunity`.**

### 2.3 `OPTSIntegrated` — passou a subconsulta dentro do `Neg`

Lia `go_opportunity` inteira, convertia o fuso linha a linha em M e só depois agrupava. Agora é uma
subconsulta agregada dentro do próprio SQL do `Neg`:

```sql
LEFT JOIN (
    SELECT
        go_st_codnegociacao,
        MIN(CAST(DATEADD(hour, -3, go_dt_dataintegracao) AS date)) AS DataIntegracao
    FROM go_opportunity
    WHERE go_dt_dataintegracao IS NOT NULL
    GROUP BY go_st_codnegociacao
) Integracao
    ON Integracao.go_st_codnegociacao = OPT.go_st_codnegociacao
```

`WHERE go_dt_dataintegracao IS NOT NULL` reproduz exatamente o `Table.SelectRows(... <> null)` que
existia antes do agrupamento: os códigos sem data de integração continuam a dar `null`.

**Leituras de `go_opportunity` por refresh: 4 → 1.**

### 2.4 `Anotacoes` — fundida no `LinhaDoTempo`

Eram duas queries à mesma base, com o mesmo filtro de data e a mesma chave, unidas logo a seguir por um
`Table.Combine`. Passaram a um `UNION ALL` dentro da mesma query. O `Table.Group` com
`Text.Combine([has], "/")` fica em M, porque é ele que produz o `"Atividade/Anotação"`.

Aproveitou-se para tirar de ambas o `left join go_opportunity o` que lá estava: nenhuma coluna dessa
tabela era selecionada e o join só multiplicava linhas antes do `GROUP BY`.

### 2.5 `Programas_OPT` — tabela duplicada em memória

`Programas_Opt_Lead` era uma tabela **calculada** cuja definição era, literalmente, `= Programas_OPT`.
Duas cópias da mesma tabela no modelo; o report e a relação só usavam a cópia. A query passou para o
`Programas_Opt_Lead` e o `Programas_OPT` foi apagado.

### 2.6 `LinkActivity` — parâmetro sem consumidor

Declarado, nunca lido (e já estava em erro: `PBI_ResultType = Exception`). O `Link` e o `LinkLead`
mantêm-se — constroem o `Neg[URL]` e o `Lead[URL]`.

---

## 3. SQL reescrito, query a query

| Objeto | O que mudou | Porquê |
| --- | --- | --- |
| `Neg` | `SELECT` de 33 → 12 colunas; caem os joins a `systemuser` e a `Account`; `OPTSIntegrated` vira subconsulta; filtros `SF-`, `originatingleadid IS NOT NULL`, `REPLACE`+`TRY_CAST` empurrados para SQL | Os joins existiam só para colunas que ninguém lê (`NomeExecutivo`, `Cod_Executivo`, `accountid`, `accountnumber`, `go_pl_funcao`, `ContaFuncao`, `DeuOrigemConta`) |
| `Lead` | Conversão de fuso (`DATEADD` + `CAST AS date`) e o `SEM CODIGO_<empresa>` passam para SQL; `SELECT` de 19 → 13 colunas | Eram 8 passos de M (`Changed Type` × 3, `Adjusted Time Zone`, `Extracted Text`, 2 `Renamed`, 2 `Replaced Value`, 2 `Inserted/Added Custom`, `Removed Columns`) a fazer o que o SQL faz numa expressão |
| `Briefings` | `SELECT` explícito de 3 colunas e filtro `statecode` em SQL | O `Table.SelectColumns` repetia o `SELECT` que já estava escrito acima |
| `DashboardUserPermission` | `SELECT *` de 9 colunas → `SELECT DISTINCT Email`; filtro `Status = 'Ativadas'` em SQL | A tabela só é lida pela medida `RLS`, que faz `VALUES(DashboardUserPermission[Email])` |
| `EmpresaFaturamento` | `WHERE EXISTS (... go_lk_empresafaturamentoid = EV.accountid)` | Lia a tabela `account` inteira para servir de dimensão a um punhado de empresas de faturamento |
| `Executivos` | O `if [Gerente] = null and [GerenteFlag] = "Sim"` passou a `CASE` em SQL; caem `ExecutivoCodigo`, `azureactivedirectoryobjectid`, `parentsystemuserid` e a coluna auxiliar `GerenteFlag` | 4 passos de M (`Added Custom`, `Removed Columns`, `Renamed Columns`, `Changed Type`) para uma coluna |
| `GrupoCliente` | `UNION` reescrito com aliases e `JOIN ... ON`; `UPPER()` em SQL; caem 3 colunas | Os `Inner Join` com a condição de filtro à mistura (`And cl.ParentID Is Null`, `EntityTypeID = 1` no `WHERE`) liam-se mal |
| `Programas_Lead` | `SELECT DISTINCT` de 2 colunas | `go_go_lead_go_programid` e `go_programid` não são lidos por nada |
| `Programas_Opt_Lead` | `UPPER()`, `DISTINCT` e exclusão do GUID `9999…` em SQL | Eram 2 passos de M sobre a tabela já carregada |
| `LinhaDoTempo` | `UNION ALL` com a antiga `Anotacoes`; `INNER JOIN` em vez de `LEFT JOIN`; sai o join inútil a `go_opportunity` | Ver 2.4 |

Convenções aplicadas em todas: palavras-chave em maiúsculas, um campo por linha, alias curto e maiúsculo
por tabela (`OPT`, `GL`, `SU`, `EV`, `DOP`), `JOIN ... ON` alinhado, `AS` explícito em todos os alias,
zero `SELECT *`.

---

## 4. Colunas retiradas do modelo

Cruzaram-se **todas** as colunas com: referências DAX (medidas, colunas calculadas, tabelas calculadas),
relações, `sortByColumn`, e os 122 visuais + filtros do report (incluindo filtros de nível visual, de
página e de report). Só saiu o que não aparece em nenhum desses sítios.

| Tabela | Antes | Depois | Colunas retiradas |
| --- | ---: | ---: | --- |
| `Neg` | 40 | 16 | `go_dt_competenciainicial`, `go_dt_dataintegracao`, `go_int_versao`, `go_lk_empresavendaid`, `go_lk_executivovendasid`, `modifiedon`, `ownerid`, `statecode`, `statuscode`, `NomeExecutivo`, `Cod_Executivo`, `First_Createdon`, `estimatedclosedate`, `ParentAccountId`, `Status`, `go_pl_funcao`, `ContaFuncao`, `accountid`, `accountnumber`, `Cliente`, `Clientes`, `DeuOrigemConta`, `go_name`, `createdon` |
| `DashboardUserPermission` | 9 | 1 | `Id`, `Name`, `Notes`, `Status`, `StampDate`, `CreatedBy`, `ModifiedDate`, `ModifiedBy` |
| `Calendario` | 13 | 6 | `Dia`, `Dia_`, `Today`, `Trimestre`, `Dias Úteis`, `MêsCorrente`, `Ano_Classificação` |
| `Lead` | 43 | 36 | `statecode`, `statecodename`, `statuscode`, `cod_executivo`, `Conta Primária`, `go_st_subject`, `Opt DeuOrigemConta` |
| `Briefings` | 6 | 3 | `go_briefingid`, `statecode`, `statecodename` |
| `Executivos` | 6 | 3 | `ExecutivoCodigo`, `azureactivedirectoryobjectid`, `parentsystemuserid` |
| `GrupoCliente` | 6 | 3 | `GrupoCliente`, `GrupoClienteCodigo`, `Grupo_Cliente` |
| `RLSFILTER` | 7 | 4 | `fullname`, `internalemailaddress`, `go_st_codigoexterno` |
| `RLS` | 6 | 4 | `Filho`, `Pai` |
| `Programas_Lead` | 4 | 2 | `go_go_lead_go_programid`, `go_programid` |
| `Programas_OPT` | 2 | — | tabela apagada (2.5) |
| **Total** | **163** | **99** | **−64** |

O `Neg` é o caso extremo: é uma tabela **desligada** (não tem uma única relação), lida só por
`LOOKUPVALUE` a partir do `Lead` e por duas medidas. Metade das suas colunas nunca foi consultada por
ninguém — e cada uma delas era um dicionário inteiro em memória, ao nível de linha da oportunidade.

Limpou-se também o `cultures/en-US.tmdl`: 27 entradas do esquema linguístico (Q&A) apontavam para
colunas apagadas agora **e para objetos que já não existiam antes desta sessão** (`contato2.*`,
`medidas.qtd_*`, `carteira.datainicio`), herdados da cópia do GESTOR CONTA.

---

## 5. Simplificações em DAX

- **`Lead[Status]`** — o `SWITCH` tinha 34 ramos; 22 devolviam `"Desqualificado"`, que já é o valor por
  omissão do próprio `SWITCH`. Ficaram 12 ramos, com o mesmo resultado para qualquer entrada. A lista de
  motivos de desqualificação não se perde: continua visível em `Lead[Motivo Lead Desqualificada]`, que lê
  o `statuscodename` em bruto.
- **`Neg[Estado]`** — saíram 3 linhas comentadas que referenciavam `statuscode` (a coluna acabou de ser
  removida, pelo que o comentário passaria a mentir).
- **`Lead[Opt Data Integracao_Opt]`** — era `VAR _1 = LOOKUPVALUE(...) RETURN _1`. Ficou o `LOOKUPVALUE`.

---

## 6. O que muda de facto no resultado

Três alterações não são neutras. Estão aqui em separado, de propósito.

1. **`Programas_Opt_Lead` passa a `SELECT DISTINCT`.** A query junta `NegotiationDiscount` a `Program`,
   por isso um programa que aparecesse em vários descontos da mesma negociação vinha repetido. Em
   `Lead[Opt Programa]` — um `CONCATENATEX` — isso escrevia o mesmo nome de programa duas, três vezes.
   Com `DISTINCT` cada programa aparece uma vez. É uma correção, mas o texto da coluna muda.
2. **`EmpresaFaturamento` deixa de trazer contas sem oportunidade associada.** São linhas de dimensão que
   nunca casavam com nada; o slicer de Empresa de Faturamento passa a listar só o que existe.
3. **`LinhaDoTempo` e `Programas_Opt_Lead` deixam de trazer linhas com chave nula** (`INNER JOIN` e
   `IS NOT NULL`). Essas linhas nunca eram encontradas por `LOOKUPVALUE` nem por uma relação.

Tudo o resto foi escrito para dar exatamente o mesmo. Onde a tradução de M para SQL mudava o tratamento
de nulos, o SQL leva a cláusula extra — é o caso do `Briefings`, onde `WHERE statecode <> 2` sozinho
descartaria os nulos que o `Table.SelectRows` mantinha, e por isso ficou
`WHERE statecode <> 2 OR statecode IS NULL`.

---

## 7. Pontos a confirmar e boas práticas

### 7.1 Três coisas que parecem bugs — não foram tocadas

- **`Lead[ClienteCodigo]` nunca é igual a `"SEM CODIGO"`.** O fallback constrói
  `"SEM CODIGO_" & go_st_companyname`, mas as medidas `QTD Clientes Novos`, `Tipo de Cliente` e
  `Qtd Leads_Novos_Opt_Ganhas` filtram por `'Lead'[ClienteCodigo] <> "SEM CODIGO"` — comparação exata,
  que nunca exclui ninguém. Ou o filtro devia ser `NOT LEFT(..., 10) = "SEM CODIGO"`, ou o fallback devia
  ser só `"SEM CODIGO"`.
- **`LinhaDoTempo` devolve `"nac"` mais vezes do que devia.** `MAX(CASE ... 'Atividade' ELSE 'nac' END)`
  ordena texto: `'nac' > 'Atividade'`. Basta **uma** atividade sem `subject`, `description` e
  `activitytypecodename` para o lead inteiro ficar `"Sim (nac)"`. Provavelmente queria-se `MIN`.
- **`Neg` resolve empates com `Table.Distinct` sobre a ordem de chegada.** Quando um lead tem mais do
  que uma oportunidade viva, a linha que fica é a primeira que o servidor devolver — hoje não
  determinístico. O correto seria `ROW_NUMBER() OVER (PARTITION BY go_lk_originatingleadid ORDER BY
  go_int_versao DESC)` em SQL. Não foi mudado porque **escolhe outra linha** e isso altera números.

### 7.2 Boas práticas a aplicar a seguir

1. **Ligar o `Neg` ao `Lead` por relação 1:1 e apagar os 16 `LOOKUPVALUE`.** As colunas `Opt *` do `Lead`
   são todas `LOOKUPVALUE(Neg[x], Neg[go_lk_originatingleadid], Lead[go_leadid])` — ou seja, 16 varrimentos
   do `Neg` no fim de cada refresh para materializar o que uma relação resolveria de graça (ou um
   `LEFT JOIN` ao `go_opportunity` dentro do SQL do `Lead`, que é ainda mais barato). É a maior
   otimização que falta neste modelo.
2. **Substituir `USERELATIONSHIP` por `TREATAS` nas medidas sob RLS.** `QTD Opt`, `QTD Lead` e
   `Valor Negociado` usam `USERELATIONSHIP(RLS[RLS], 'Lead'[ownerid])`. Com uma role ativa, o motor
   recusa `USERELATIONSHIP`/`CROSSFILTER` — é exatamente o problema que o MediaLivre teve (ver
   `MediaLivre/Encomendas e Negociações/RLS.md`). Aqui a role `RLS` existe e está ativa.
3. **Desativar a data automática.** `__PBI_TimeIntelligenceEnabled = 0` já está — manter assim, e nunca
   deixar o Desktop recriar as `LocalDateTable_*`.
4. **Ordenar os `Table.Distinct` explicitamente** ou trocá-los por `ROW_NUMBER()` em SQL (ver 7.1).
5. **Marcar `Calendario` como tabela de datas** (`dataCategory: Time` já lá está) e esconder
   `Mes No`, que só serve de `sortByColumn`.
6. **Esconder as colunas técnicas** que ficaram por serem chaves: `Lead[ownerid]`, `Lead[go_leadid]`,
   `Neg[OpportunityId]`, `Neg[go_lk_originatingleadid]`, `Programas_Opt_Lead[DynamicsOpportunityID]`.
   Não ocupam menos memória escondidas, mas tiram ruído do painel de campos.
7. **Limpar o report.** Ficaram referências mortas a campos que nunca existiram neste modelo —
   `Medidas`, `Users`, `Executivos[Executivo3]`, `Lead[StatusLead]`,
   `@Medidas[Forecast Var Carteira]`, `[Meta Var Atual]`, `[Val Liquido Carteira % Atual]`,
   `[YoY YTD Carteira Atual]`. São filtros herdados da cópia do GESTOR CONTA; **já estavam partidos antes
   desta sessão** e só se resolvem abrindo o report no Desktop.
8. **Medidas sem consumidor** (não foram apagadas, não custam memória, mas são 7 a manter):
   `% Leads Novos Opt Ganhas`, `Estagio OPT subtitle`, `Estagio Leads subtitle`,
   `Visual Control Clientes_Novos`, `Tipo de Cliente` e, por arrasto, `Qtd Leads_Novos_Opt_Ganhas` e
   `QTD Opt_Clientes_Novos`.

---

## 8. Verificação feita

Toda estática, com um script que lê o TMDL e o `report.json`:

| Verificação | Resultado |
| --- | --- |
| `ref table` do `model.tmdl` ↔ ficheiros em `tables/` | coincidem (23) |
| Relações apontam para colunas existentes | 12 relações, 24 referências |
| Referências DAX `Tabela[Coluna]` (fora de comentários) | todas resolvem |
| Referências a `OPTSCreated`, `OPTSModified`, `OPTSIntegrated`, `Anotacoes`, `LinkActivity`, `Programas_OPT` | nenhuma sobrou |
| `let`/`in` e paridade de aspas nas 10 queries | fecham todos |
| Campos usados nos 122 visuais e filtros do report | todos existem, **exceto os 8 que já estavam partidos antes** (7.2, ponto 7) |

**Falta:** abrir no Power BI Desktop, fazer refresh e comparar os cartões do funil (QTD Lead, QTD Opt,
Valor Negociado, % de conversão) com a versão anterior. Três queries usam construções que o endpoint TDS
do Dataverse deve aceitar mas que não foi possível testar aqui — `TRY_CAST`, a subconsulta agregada do
`Neg` e o `EXISTS` do `EmpresaFaturamento`. Se alguma for recusada, o recuo é isolado: repor o passo
equivalente em M nessa query, sem tocar no resto.
