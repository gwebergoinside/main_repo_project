# Refatoração do modelo — GODASHBOARD SBT / Gestor Conta

**Modelo:** `SBT/AD/GODASHBOARD - SBT - GESTOR CONTA.SemanticModel`
**Data:** 15/09/2026
**Saldo:** 22 ficheiros, **+260 / −498 linhas**, 66 → 64 queries

> **Nada disto foi executado.** Não há Power BI Desktop nem acesso ao RDS/Dataverse nesta sessão. A verificação feita foi estática: todas as referências `#"passo"` resolvem, todos os `let`/`in` fecham, e não sobrou nenhuma referência viva a query removida. A validação de dados é a da secção 6.

---

## 1. Padrão pedido: a query SQL na primeira variável

Dos 19 objetos com origem `Sql.Database`, **17 já seguiam o padrão** (`SQL = "..."` → `Source = Sql.Database(..., [Query = SQL])` → transformações). Faltavam dois, agora convertidos:

| Objeto | Antes | Depois |
| --- | --- | --- |
| `SnapShotForecast` | `[Query="Select Snapshotcode From ForecastSnapshot group by Snapshotcode"]` inline | `SQL = "SELECT DISTINCT Snapshotcode FROM ForecastSnapshot"` |
| `DashboardUserPermission` | `SQL = "SELECT#(lf) *#(lf)FROM#(lf) DashboardUserPermission DP WHERE ..."` | string multi-linha legível, sem `#(lf)`, sem o alias `DP` que não era usado |

`VendaImportada` era o terceiro caso — foi removido (ver 2.1).

Os objetos Dataverse (`Neg`, `Users`, `Activity`, `Briefings`, `Solicitacao`, `NucleoOport`, `RLSFILTER`) não têm texto SQL: a origem é a função `GetCDST_EntityTable`. Neles o equivalente ao padrão é a primeira variável ser a leitura da entidade — que já era o caso.

---

## 2. Queries unificadas e removidas

### 2.1 `VendaImportada` — removida

A sua lógica já vive dentro do SQL do `R0002`, como CTE `VI`. A única referência que restava estava em código comentado. Era uma segunda definição da mesma regra de negócio, à espera de divergir da primeira.

### 2.2 `EmpresaFaturamento` + `EmpresaVenda` → `AccountNome`

Eram **duas queries byte a byte idênticas** (`Account` → `accountid`, `name`), ambas usadas só no `Neg`, uma por cada join. Ficou uma. Os joins no `Neg` mantêm os nomes de coluna temporários (`"EmpresaFaturamento"` / `"EmpresaVenda"`), por isso as colunas do modelo não mudam.

Chama-se `AccountNome` e não `ContaNome` porque `Neg[ContaNome]` já existe como coluna e é usada em medidas — dois nomes iguais em papéis diferentes seriam uma armadilha de leitura.

### 2.3 `OPTSCreated` + `OPTSModified` + `OPTSIntegrated` → `OPTSDatas`

Três queries que liam `go_opportunity` inteira e agrupavam **pela mesma chave** (`go_st_codnegociacao`), cada uma para um agregado. O `Neg` juntava as três, uma a uma.

Agora é uma leitura, um agrupamento, um join:

```m
#"Agrupado por Negociação" = Table.Group(#"Tipo Data Integração", {"go_st_codnegociacao"}, {
    {"First_Createdon",          each List.Min([createdon]),   type nullable datetimezone},
    {"Data Aprovação",           each List.Min([modifiedon]),  type nullable datetimezone},
    {"Data de Integração_Final", each List.Min(List.RemoveNulls([go_dt_dataintegracao])), type nullable date}
})
```

`List.RemoveNulls` reproduz exactamente o `Table.SelectRows(..., [go_dt_dataintegracao] <> null)` que o `OPTSIntegrated` fazia antes de agrupar: os grupos sem data de integração continuam a dar `null`.

**Leituras de `go_opportunity` por refresh: 5 → 3** (`Neg`, `OPTSDatas`, `OPTSIntegrated_2`). O `OPTSIntegrated_2` ficou porque agrupa por outra chave (`go_opportunityid`) e serve o `NucleoOport`.

### 2.4 `Excecoes_SBTNEWS` — lista partilhada (nova)

As 30 chaves `chaveT` do SBT News estavam **duplicadas palavra por palavra** em `R0002` e em `LY`. Confirmei que as duas listas eram idênticas antes de as fundir. Passaram a uma query no grupo `Config`; os dois objetos referenciam-na. Acrescentar uma excepção passa a ser um sítio, não dois.

### 2.5 `Fn_TipoGoverno` — função partilhada (nova)

O mesmo bloco de 4 linhas (join à `Account` por `accountnumber` → expandir `go_pl_classificacaogoverno_display` como `Tipo Governo` → `null` vira `"Setor Privado"`) estava repetido em **cinco** objetos. Agora:

```m
#"Merged Account" = Fn_TipoGoverno(Source, "ExternalCode")
```

| Objeto | Chamada |
| --- | --- |
| `R0002` | `Fn_TipoGoverno(#"Ajuste Nucleo SBTNEWS", "Cod_Cliente")` |
| `LY` | `Fn_TipoGoverno(#"Ajuste Nucleo SBTNEWS", "Cod_Cliente")` |
| `Forecast` | `Fn_TipoGoverno(Source, "ExternalCode")` |
| `Metas` | `Fn_TipoGoverno(Source, "ExternalCode")` |
| `ForecastSnapshot` | `Fn_TipoGoverno(Source, "ExternalCode")` |

---

## 3. SQL reescrito

| Objeto | O que mudou | Porquê |
| --- | --- | --- |
| `Veiculacao_Segmento` | 3 níveis (`Base` → `Final` → `SELECT`) → **1 `SELECT`**; o filtro de data passou do nível exterior para a tabela base | Os dois CTE eram pass-through: repetiam a lista de colunas três vezes sem transformar nada. Com o filtro em `r.Data_Exibicao` o índice é usado sem depender de o otimizador empurrar o predicado |
| `PosicaoCarteira` | `Mes Inicio`, `Ano Inicio`, `Mes Fim`, `StartInicio`, `EndFim` calculados em SQL (`MONTH`, `YEAR`, `DATEFROMPARTS`, `EOMONTH`); `CASE WHEN EndDate IS NULL` → `COALESCE` | Eram 6 `Table.AddColumn` encadeados — 6 passagens sobre a tabela, nenhuma a dobrar |
| `ForecastSnapshot` | Filtro de `Snapshotcode` empurrado para o `WHERE`, usando os parâmetros `SnapShot` e `SnapShotAnterior` | Descarregava **todos** os snapshots para depois filtrar dois em memória. Os parâmetros já valiam `20220805` e `20220617` — os mesmos valores que estavam codificados à mão no passo removido |
| `Executivos` | A exclusão do duplicado (`BVENA`) passou para o `WHERE` | Filtrar na origem em vez de trazer a linha e descartá-la |
| `PosicaoCarteiraNacional` | `GROUP BY` sobre todas as colunas → `SELECT DISTINCT` | Era um `DISTINCT` escrito como `GROUP BY`; a intenção fica explícita |
| `SnapShotForecast` | `group by Snapshotcode` → `SELECT DISTINCT` | Idem |
| `GrupoCliente`, `GrupoAgencia` | Reposto o **desduplicado por código**, agora em SQL com `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` | Ver 3.1 — é uma correcção, não uma optimização |

### 3.1 O desduplicado que faltava em `GrupoCliente` / `GrupoAgencia`

A versão antiga destes objetos terminava em `Table.Distinct(..., {"ClienteCodigo"})`. Na reescrita anterior para SQL esse passo desapareceu e o `UNION` só remove linhas inteiras repetidas — dois códigos iguais com nomes de grupo diferentes passam os dois.

`GrupoCliente.ClienteCodigo` e `GrupoAgencia.AgenciaCodigo` estão do **lado 1** de várias relações. Um duplicado ali não dá erro discreto: o refresh falha com *"a coluna contém valores duplicados"* e o modelo não carrega.

Como funciona hoje, presume-se que não existem duplicados e o `ROW_NUMBER` é uma rede de segurança que não muda o resultado. Se existirem, o `ROW_NUMBER` escolhe uma linha por código com desempate determinístico (`ORDER BY GrupoClienteCodigo, Cliente`) — melhor do que o `Table.Distinct`, que ficava com a primeira linha numa ordem que o SQL não garante.

---

## 4. Passos de Power Query eliminados

| Objeto | Antes → Depois | O que era |
| --- | --- | --- |
| `Neg` | 3 passos → 1 | `Divided Column`, `Divided Column1`, `Divided Column2`: três `Table.TransformColumns` seguidos, um por coluna |
| `Neg` | 8 passos → 2 | Os 3 pares join+expand das OPTS, mais `Renamed Columns2` (o `Table.ExpandTableColumn` já aceita o nome final) e `Changed Type3` (redundante) |
| `Users` | 6 passos → 2 | `type text` + 3 `Table.ReplaceValue` sobre a mesma coluna + `Text.Upper`: cinco passagens para tratar um booleano. Agora um `Table.TransformColumns` com `if _ = null then "Não Definido" else if _ = true then "Sim" else "Não"` |
| `Executivos` | 3 passos → 0 | `Verificar` e `#"Registros Duplicados"` eram **código morto**: calculados e nunca referenciados pelo passo final. `#"Filtrar Sem Duplicidade"` foi para o SQL |
| `PosicaoCarteira` | 6 passos → 1 | Ver 3. Só o `Mes Nome Inicio` ficou — ver 5 |
| `ForecastSnapshot` | 2 passos → 0 | `#"Valores SnapShot"` e `#"Filtrar SnapShot"`, ambos absorvidos pelo `WHERE` |
| `Emp_Venda`, `Forecast_OPT`, `Veiculacao_Segmento` | — | Linhas de passos comentados soltas dentro do `let` |

E **176 linhas de queries legacy comentadas** (o `// let … // in …` com a origem `Sql.Database` inline) saíram de 13 ficheiros. Estão todas no histórico do git.

Ficaram de propósito:
- o `// Exceções = let … // Condicional solicitada ticket Intercom 96052764` em `R0002` — é um interruptor que o autor deixou anotado com o ticket;
- o bloco comentado do `Metas`, que carrega a nota *"Depois retirar o filtro da DATE"*;
- as linhas comentadas do `MAISSBT`/`SITE` com data de corte em `R0002`, `LY` e `NucleoOport`.

---

## 5. Uma coisa que ficou de fora de propósito

`Mes Nome Inicio` (`PosicaoCarteira`) continua em Power Query:

```m
#"Inserted Coluns" = Table.AddColumn(Source, "Mes Nome Inicio", each Date.MonthName([DataInicio]), type text)
```

`Date.MonthName` usa a cultura do modelo (`sourceQueryCulture: pt-BR`); o `DATENAME(MONTH, …)` equivalente usa o idioma da **sessão do SQL Server**, que pode devolver `January` em vez de `janeiro` — e isso mudaria os rótulos nos visuais. Passar isto para SQL exigiria um `CASE` com os doze nomes escritos à mão; o ganho não paga o risco.

---

## 6. O que validar antes de publicar

Refresh completo em Desktop, com o `.pbix` anterior aberto em paralelo.

**Primeiro, o que rebenta alto (e é bom que rebente):**

1. `GrupoCliente` e `GrupoAgencia` carregam? Se sim, o `ROW_NUMBER` não mudou nada. Compare a contagem de linhas com a versão anterior — tem de ser igual.
2. `PosicaoCarteira`: `Mes Inicio`, `Ano Inicio`, `Mes Fim`, `StartInicio`, `EndFim` vêm preenchidos e batem certo com os da versão anterior, linha a linha, para uma amostra. `EndFim` para carteiras sem `EndDate` tem de dar `31/12` de `ano+5`.
3. `ForecastSnapshot`: contagem de linhas igual à de antes. Se vier vazia, o `IN` com os parâmetros não bateu — confirme que `SnapShot` e `SnapShotAnterior` continuam a valer `20220805` e `20220617`.
4. `Executivos`: contagem igual, e `BVENA` aparece uma única vez.

**Depois, o que mente baixinho:**

5. `Neg`: soma de `go_mn_valornegociado`, contagem de linhas, e `First_Createdon` / `Data de Aprovação` / `Data de Integração_Final` **não-nulos na mesma proporção que antes**. É aqui que a unificação das três OPTS se prova — se a proporção de nulos mudou, o `List.RemoveNulls` não fez o que devia.
6. `Users`: a coluna `Executivo Corporativo` só pode conter `Sim`, `Não` e `Não Definido`. Qualquer outro valor significa que `go_bl_executivocorporativo` não está a chegar como booleano.
7. `Veiculacao_Segmento`: soma de `Valor` e contagem de linhas iguais às de antes.
8. `R0002` e `LY`: contagem de `is_SBTNEWS = "Sim"` igual à de antes — confirma que a lista partilhada é lida pelos dois.

**Por fim:** `Ver como` em cada role de `definition/roles/`, e um passar de olhos pelas páginas do relatório à procura de visuais partidos por nome de coluna.

Esta lista soma-se — não substitui — a validação da migração para TDS em [MIGRACAO-TDS.md](MIGRACAO-TDS.md), que mexe nas mesmas tabelas Dataverse.

---

## 7. Rollback

Tudo num commit. Para desfazer só o modelo:

```
git checkout HEAD~1 -- "SBT/AD/GODASHBOARD - SBT - GESTOR CONTA.SemanticModel"
```

No serviço, o rollback continua a ser republicar o `.pbix` anterior com **Replace** no mesmo workspace.
