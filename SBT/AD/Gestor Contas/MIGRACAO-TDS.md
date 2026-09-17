# Migração Dataverse → endpoint TDS — GODASHBOARD SBT / Gestor Conta

**Modelo:** `SBT/AD/GODASHBOARD - SBT - GESTOR CONTA.SemanticModel`
**Ambiente:** `sbtcomercialprd.crm2.dynamics.com`
**Data:** 15/09/2026

---

## 0. Correção de premissa (ler antes do resto)

As instruções falavam em `Cds.Contents(...)` com `EntitySetName="accounts"`. **Esse código não existe neste modelo** — não há uma única ocorrência de `Cds.Contents` nem de `EntitySetName` em todo o repositório.

O que está lá é o outro padrão do conector legacy:

```m
Source = Cds.Entities(Url, [ReorderColumns=null, UseFormattedValue=true])
Entities = Source{[Group="entities"]}[Data],
DataTable = Entities{[SchemaName=#"schema name"]}[Data]
```

Isto **melhora** o plano: em vez de `Cds.Contents` repetido em cada query, o modelo já centraliza tudo em duas expressões do grupo `Config` — `#CDSTEntitySource` (a ligação) e `GetCDST_EntityTable` (a navegação). **22 queries** chamam essa função. Trocar a origem é trocar duas expressões; nenhuma das 22 é tocada.

A substituição efectiva é portanto:

| | Antes | Depois |
| --- | --- | --- |
| Ligação | `Cds.Entities(Url, [ReorderColumns=null, UseFormattedValue=true])` | `CommonDataService.Database(Server, [CreateNavigationProperties=false])` |
| Navegação | `{[Group="entities"]}` → `{[SchemaName="Account"]}` | `{[Schema="dbo", Item="account"]}` |

---

## 1. Plano A — alteração de código

Ficheiro único: `definition/expressions.tmdl`. Diff aplicado:

```diff
 expression #CDSTEntitySource =
 		let
 		    Url = #"@CRMOrgUrl",
-		    //TrimmedUrl = Text.TrimEnd(Text.Trim(Url), "/"), // We cannot trim the URL because then data sourcewill not be recognized
-		    Source = Cds.Entities(Url, [ReorderColumns=null, UseFormattedValue=true])
+		    // ATENÇÃO: o servidor tem de ser um literal (ou um parâmetro simples).
+		    // Qualquer transformação torna a origem dinâmica e o serviço recusa agendar o refresh.
+		    Source = CommonDataService.Database("sbtcomercialprd.crm2.dynamics.com", [CreateNavigationProperties=false])
+		    // Origem anterior (conector Dataverse legacy, deprecado) — manter para rollback de emergência:
+		    // Source = Cds.Entities(Url, [ReorderColumns=null, UseFormattedValue=true])
 		in
 		    Source

 expression GetCDST_EntityTable =
 		let
 		    Source = (#"schema name" as text) =>
 		        let
 		            Source = #"#CDSTEntitySource",
-		            Entities = Source{[Group="entities"]}[Data],
-		            DataTable = Entities{[SchemaName=#"schema name"]}[Data]
+		            // O TDS endereça a tabela pelo NOME LÓGICO (singular, minúsculas),
+		            // não pelo SchemaName em PascalCase nem pelo EntitySetName no plural.
+		            DataTable = Source{[Schema="dbo", Item=Text.Lower(#"schema name")]}[Data],
+		            // Compatibilidade com UseFormattedValue=true do conector antigo:
+		            // o TDS devolve o rótulo em <coluna>name; o modelo consome <coluna>_display.
+		            // Só renomeia quando a coluna base existe, para não tocar em name/fullname/go_name/domainname.
+		            Colunas = Table.ColumnNames(DataTable),
+		            Rotulos = List.Select(Colunas, each Text.EndsWith(_, "name")
+		                and Text.Length(_) > 4
+		                and List.Contains(Colunas, Text.Start(_, Text.Length(_) - 4))),
+		            DataTableCompat = Table.RenameColumns(DataTable,
+		                List.Transform(Rotulos, each {_, Text.Start(_, Text.Length(_) - 4) & "_display"}))
 		        in
-		            DataTable
+		            DataTableCompat
 		in
 		    Source
```

### Duas decisões que vale a pena justificar

**O servidor é um literal — e tem de ser.** A primeira versão desta migração derivava o host de `@CRMOrgUrl` com `Text.AfterDelimiter` e um `if`, para manter uma única fonte de verdade. **Estava errado** e partiu o agendamento do refresh no serviço:

> You can't schedule refresh for this semantic model because the following data sources currently don't support refresh: Data source for Query1

O serviço tem de identificar cada origem **estaticamente**, antes de correr a query, para lhe ligar credenciais. Se o argumento de ligação for calculado em tempo de execução — `Text.*`, `if`, concatenação, ou um valor vindo de outra query — a origem passa a *dynamic data source*: o serviço dá-lhe um nome genérico e recusa agendar. O código original já trazia o aviso, que foi apagado por engano:

```m
//TrimmedUrl = Text.TrimEnd(Text.Trim(Url), "/"), // We cannot trim the URL because then data source will not be recognized
```

O que é permitido como argumento de ligação:

| | Exemplo | Agenda refresh? |
| --- | --- | --- |
| Literal | `CommonDataService.Database("sbtcomercialprd.crm2.dynamics.com", ...)` | Sim |
| Parâmetro referenciado **directamente** | `Sql.Database(Org, BD, ...)` — como o resto do modelo já faz | Sim |
| Qualquer expressão calculada | `CommonDataService.Database(Text.AfterDelimiter(Url, "://"), ...)` | **Não** |

Se quiseres a troca PRD↔QA de volta, o caminho é um parâmetro que guarde **só o host** e seja referenciado sem transformação nenhuma — exactamente como o `Org` e o `BD` fazem hoje para o RDS:

```m
// parâmetro novo: @CRMOrgHost = "sbtcomercialprd.crm2.dynamics.com"
Source = CommonDataService.Database(#"@CRMOrgHost", [CreateNavigationProperties=false])
```

O `@CRMOrgUrl` fica como está: não é usado por mais nada no modelo, mas é a base do Plano B (secção 6).

**O shim de renomeação existe para que os passos seguintes não se toquem.** O conector antigo, com `UseFormattedValue=true`, criava `<coluna>_display`. O TDS não tem `_display` nenhum: devolve `<coluna>name`. Sem o shim, as 22 queries teriam de ser reescritas uma a uma. Com ele, `GetCDST_EntityTable("Account")` devolve as mesmas colunas com os mesmos nomes de antes.

A guarda `List.Contains(Colunas, base)` é o que impede o shim de estragar colunas reais: `name`, `fullname`, `go_name`, `domainname` não têm coluna-base irmã e ficam intactas. `statuscodename` tem `statuscode` → vira `statuscode_display`. É exactamente a convenção do próprio Dataverse.

---

## 2. Colunas que mudam de nome

### 2.1 As que o modelo consome hoje (tratadas pelo shim)

| Coluna hoje (CDS) | Coluna no TDS | Onde é usada |
| --- | --- | --- |
| `statecode_display` | `statecodename` | `Activity`, `Briefings`, `Solicitacao`, `Neg` (→ `Status`) |
| `statuscode_display` | `statuscodename` | `Neg` (filtro de versionamento), `Conta` (→ `Status Cliente`) |
| `go_pl_tiporegistro_display` | `go_pl_tiporegistroname` | `Neg` |
| `go_pl_tabelamidiaprincipal_display` | `go_pl_tabelamidiaprincipalname` | `Neg` (→ `Tabela`) |
| `go_pl_classificacaogoverno_display` | `go_pl_classificacaogovernoname` | `Account`, `Conta` (→ `Tipo Governo`); expandido em `Forecast`, `ForecastSnapshot`, `LY`, `Metas`, `R0002` |

### 2.2 Regra geral

| Tipo de coluna | CDS (`UseFormattedValue=true`) | TDS |
| --- | --- | --- |
| Choice / Option set — valor | `statuscode` (int) | `statuscode` (int) — **igual** |
| Choice / Option set — rótulo | `statuscode_display` | `statuscodename` |
| Lookup — GUID | `ownerid`, `go_lk_clienteid` | **igual** |
| Lookup — rótulo | `ownerid_display` | `owneridname`, `go_lk_clienteidname` |
| Lookup — tipo da entidade | — | `owneridtype` (novo, sem equivalente) |
| Texto / número / data | `name`, `go_name`, `fullname` | **igual** |

Os GUIDs de lookup não mudam de nome — todos os `Table.NestedJoin` do `Neg` continuam a bater. **Nota:** isto é o TDS, não a Web API. Na Web API (Plano B) o mesmo lookup chama-se `_go_lk_clienteid_value`; ver secção 6.

---

## 3. Avisos — por ordem de quanto mordem

### 3.1 O nome da tabela é o nome lógico singular, em minúsculas

Este é o erro que mais tempo custa a diagnosticar, porque a mensagem do Power Query só diz que a chave não foi encontrada.

| Errado (EntitySetName, plural) | Errado (SchemaName, PascalCase) | Certo (nome lógico) |
| --- | --- | --- |
| `Item="accounts"` | `Item="Account"` | `Item="account"` |
| `Item="systemusers"` | `Item="SystemUser"` | `Item="systemuser"` |
| `Item="go_opportunities"` | — | `Item="go_opportunity"` |

O plural só vale na Web API / OData. O TDS é SQL: o nome da tabela é o nome lógico. E a navegação `{[Schema="dbo", Item=...]}` em M é *case-sensitive* — mesmo que o SQL Server não seja — porque é um match exacto de campo de registo. É por isso que o `Text.Lower(#"schema name")` está lá: o modelo passa `"Account"`, `"SystemUser"`, `"ActivityPointer"` em PascalCase e o shim converte.

### 3.2 Os rótulos são strings e o `Neg` filtra por elas

```m
#"Filtered Rows" = Table.SelectRows(#"Divided Column2", each ([statuscode_display] <> "Versionada"
    and [statuscode_display] <> "Versionamento Cancelado"
    and [statuscode_display] <> "Versionamento Reprovado")),
```

Se o TDS devolver estes rótulos noutro idioma (inglês, ou o *base language* do ambiente em vez do pt-BR), o filtro deixa de apanhar nada, as versões antigas das negociações entram no modelo e **o valor negociado infla sem erro nenhum**. Não rebenta — mente. É a primeira coisa a validar (secção 4).

### 3.3 Datas: `datetimezone` → `datetime`

O conector antigo devolvia `datetimezone` (UTC). O TDS devolve `datetime2` sem zona. Os passos `Table.TransformColumnTypes(..., type date)` continuam a funcionar, e as anotações `type nullable datetimezone` dentro dos `Table.Group` (`OPTSCreated`, `OPTSModified`, `OPTSIntegrated`) são ascrições que o Power Query não valida — o `OPTSIntegrated` já hoje ascreve `datetimezone` a um valor `date` e funciona. Por isso **não foram alteradas**.

O que é preciso confirmar é o *valor*, não o tipo: se o TDS devolver hora local (UTC-3) em vez de UTC, as datas em torno da meia-noite deslocam-se um dia e `createdon` / `Data de Aprovação` / `Data De Integração` passam a cair no dia errado. Ver secção 4.

### 3.4 Tabelas que podem não existir no TDS

| Entidade | Risco | Plano |
| --- | --- | --- |
| `go_opportunity_nucleo` | **Alto** — os campos seleccionados (`go_opportunityid`, `go_nucleoid`, sem o prefixo `go_lk_` usado no resto do modelo e sem chave primária própria) indicam tabela de junção N:N, que o TDS pode não expor | Plano B |
| `activitypointer` | Médio — tabela-base de actividades, com tratamento especial | Verificar no Navigator; Plano B se faltar |
| `position` | Baixo | — |

### 3.5 Query folding

O shim usa `Table.ColumnNames`, que é uma chamada de metadados, e `Table.RenameColumns`, que folda contra fontes SQL — o `Table.SelectColumns` a jusante deve continuar a descer para o servidor. **Confirmar com botão direito no último passo do `Neg` → "View Native Query".** Se estiver a cinzento, o folding partiu e o `go_opportunity` inteiro está a ser descarregado com todas as colunas; nesse caso substitui-se o shim genérico por um `Table.RenameColumns` explícito em cada query, com a lista da secção 2.1.

### 3.6 O argumento de ligação tem de ser estático

Sintoma: o refresh corre no Desktop e até corre à mão no serviço, mas o **agendamento** é recusado com *"Data source for Query1"*. `Query1` não é uma query do modelo — é o nome de substituição que o serviço usa quando não consegue identificar a origem. Ver a caixa na secção 1.

### 3.7 Pré-requisitos do lado do ambiente

- TDS ligado: **Power Platform admin center → Ambiente → Definições → Funcionalidades → "Enable TDS endpoint"**. Se estiver desligado, nada disto funciona.
- O TDS é só leitura e respeita as permissões do Dataverse — a conta do refresh precisa de leitura nas 11 entidades.
- Colunas de ficheiro/imagem não são legíveis por TDS (o modelo não usa nenhuma).

---

## 4. Validação contra sexta-feira, antes de publicar

Refresh completo em Desktop, com o `.pbix` de sexta aberto em paralelo. Comparar, por esta ordem:

**1. Os rótulos (secção 3.2) — antes de olhar para qualquer número.**
Query nova, descartável:
```m
let
    Neg = #"GetCDST_EntityTable"("go_opportunity"),
    Distintos = Table.Distinct(Table.SelectColumns(Neg, {"statuscode_display"}))
in
    Distintos
```
Têm de aparecer, em pt-BR, `Versionada`, `Versionamento Cancelado` e `Versionamento Reprovado`. Se vierem em inglês ou vazios, pára aqui.

**2. Contagem de linhas**, tabela a tabela: `Neg`, `Users`, `RLSFILTER`, `Activity`, `Briefings`, `Solicitacao`, `NucleoOport`. Diferenças de poucas linhas são registos criados entretanto; diferenças percentuais são sintoma.

**3. Somatórios do `Neg`:** `go_mn_valornegociado` e `go_mn_valormidiaapoio`. Um total inflado confirma o cenário 3.2.

**4. Datas (secção 3.3):** `Min` / `Max` de `createdon` no `Neg`, e contagem de negociações por dia nos últimos 7 dias. Um desvio sistemático de um dia é o fuso horário.

**5. Percentagens:** `go_fp_maiordescontodado`, `go_dc_descontoprogramas`, `go_dc_comissaoagencia` — os passos dividem por 100; se o TDS devolver a escala decimal em vez de inteira, ficam 100× menores.

**6. Booleano:** `Executivo Corporativo` na tabela `Users` só pode conter `Sim`, `Não` e `Não Definido`. Se aparecer `TRUE` / `FALSE`, o `Table.ReplaceValue` sobre `"true"` / `"false"` deixou de bater.

**7. RLS:** `Ver como` → cada role em `definition/roles/`, confirmando que `RLSFILTER` e `Posi` continuam a resolver os utilizadores certos.

---

## 5. Publicação

1. **Publish → workspace actual → Replace.** Substituir mantém o ID do dataset, e com ele os relatórios ligados, as apps, os favoritos e o agendamento de refresh. Criar um dataset novo obriga a repontar tudo.
2. **Reautenticar a origem nova.** O `CommonDataService.Database` é um tipo de origem diferente do `Cds.Entities`: aparece como credencial por configurar.
   *Definições do dataset → Credenciais da origem de dados → Editar credenciais* → método **OAuth2 / Conta organizacional**, nível de privacidade **Organizacional**.
   A origem `Sql.Database` do RDS AWS mantém as credenciais actuais — não lhe tocar.
3. **Refresh now.** Esperar por **Completed**. Se falhar, o histórico de refresh identifica a query e a tabela.
4. Confirmar que o agendamento continua activo e que a app publicada não pede republicação.

---

## 6. Plano B — `Web.Contents` + JSON, para as tabelas que o TDS não expõe

**Porque não `OData.Feed`:** o `OData.Feed` é a mesma biblioteca OData do conector que estamos a substituir e tropeça no mesmo `$metadata` — o documento de metadados do Dataverse é enorme, o conector puxa-o inteiro antes da primeira linha de dados e expira. Ir directo ao JSON contorna o `$metadata` por completo.

Adicionar como expressão nova no grupo `Config`, sem mexer no `GetCDST_EntityTable`:

```m
// Fallback para tabelas ausentes do TDS.
// ATENÇÃO: aqui o nome é o EntitySetName no PLURAL — o oposto do TDS.
//   TDS:  Item="go_opportunity_nucleo"
//   aqui: "go_opportunity_nucleos"
(entitySet as text, colunas as list) as table =>
let
    Base = Text.TrimEnd(#"@CRMOrgUrl", "/") & "/api/data/v9.2/",
    Cabecalhos = [
        Accept = "application/json",
        #"OData-Version" = "4.0",
        #"OData-MaxVersion" = "4.0",
        Prefer = "odata.include-annotations=""OData.Community.Display.V1.FormattedValue"",odata.maxpagesize=5000"
    ],
    // RelativePath obrigatório: com o URL concatenado, o serviço trata a origem
    // como dynamic data source e recusa agendar o refresh.
    Pagina = (relativo as text) as list =>
        let
            Resposta = Json.Document(Web.Contents(Base, [RelativePath = relativo, Headers = Cabecalhos])),
            Linhas = Resposta[value],
            Proxima = Record.FieldOrDefault(Resposta, "@odata.nextLink", null),
            Todas = if Proxima = null
                    then Linhas
                    else List.Combine({Linhas, @Pagina(Text.AfterDelimiter(Proxima, Base))})
        in
            Todas,
    Linhas = Pagina(entitySet & "?$select=" & Text.Combine(colunas, ",")),
    Tabela = Table.FromRecords(Linhas, null, MissingField.UseNull),
    // Rótulos: a Web API devolve-os em anotações irmãs. Converter para _display.
    Anotacao = "@OData.Community.Display.V1.FormattedValue",
    Formatadas = List.Select(Table.ColumnNames(Tabela), each Text.EndsWith(_, Anotacao)),
    Compat = Table.RenameColumns(Tabela,
        List.Transform(Formatadas, each {_, Text.BeforeDelimiter(_, Anotacao) & "_display"}))
in
    Compat
```

O `@Pagina(...)` recursivo segue o `@odata.nextLink` até ele desaparecer; `odata.maxpagesize=5000` fixa o tamanho de página.

Uso no `NucleoOport`, se `go_opportunity_nucleo` não aparecer no TDS — substituir só a primeira linha:

```m
// Accounts = #"GetCDST_EntityTable"("go_opportunity_nucleo"),
Accounts = GetWebAPI_EntityTable("go_opportunity_nucleos", {"go_opportunityid", "go_nucleoid"}),
```

### Duas armadilhas do Plano B

- **Os lookups mudam de nome outra vez.** Na Web API o GUID de um lookup é `_go_lk_clienteid_value`, não `go_lk_clienteid`. Se o Plano B for preciso numa tabela com lookups, acrescentar o `$select` com o nome sublinhado e renomear de volta.
- **Credencial separada no serviço.** A origem `Web` aparece como credencial distinta da origem Dataverse e também precisa de **OAuth2 / Organizacional**.

---

## 7. Rollback

Três níveis, do mais rápido ao mais completo:

1. **No serviço, imediato:** republicar o `.pbix` / `.pbip` anterior com **Replace** no mesmo workspace. O ID mantém-se, os relatórios não se apercebem. É o rollback a usar se o refresh falhar em produção.
2. **No ficheiro, sem git:** a linha original está comentada dentro de `#CDSTEntitySource`. Descomentar `Cds.Entities`, comentar o `CommonDataService.Database`, e devolver o `GetCDST_EntityTable` à navegação `{[Group="entities"]}` / `{[SchemaName=...]}`.
3. **No repositório:**
   ```
   git checkout HEAD~1 -- "SBT/AD/GODASHBOARD - SBT - GESTOR CONTA.SemanticModel/definition/expressions.tmdl"
   ```

---

## 8. Nota final

O conector Dataverse (TDS) é o **recomendado pela Microsoft** para leitura analítica, e o conector *Common Data Service (Legacy)* — o `Cds.Entities` que aqui estava — está **deprecado**. Isto não é um desvio temporário à espera de correcção: é o caminho suportado.

Não há, portanto, nada para reverter "quando a Microsoft corrigir". O código antigo fica comentado como rede de segurança operacional durante a janela de validação, não como intenção de regressar a ele. Passada essa janela, o comentário pode sair.

---

## Anexo — inventário das 11 entidades e dos 22 consumidores

| SchemaName (entrada) | `Item` no TDS | Queries que a consomem |
| --- | --- | --- |
| `Account` | `account` | `Account`, `Conta`, `EmpresaFaturamento`, `EmpresaVenda` |
| `SystemUser` | `systemuser` | `UsersMain`, `ExecutivoVenda`, `Search Users`, `RLSFILTER`, `Users` |
| `Position` | `position` | `Posi` |
| `ActivityPointer` | `activitypointer` | `Activity` |
| `go_opportunity` | `go_opportunity` | `Neg`, `OPTSCreated`, `OPTSModified`, `OPTSIntegrated`, `OPTSIntegrated_2` |
| `go_opportunity_nucleo` | `go_opportunity_nucleo` | `NucleoOport` |
| `go_nucleo` | `go_nucleo` | `Nucleos` |
| `go_tipomidia` | `go_tipomidia` | `Tipo Midia` |
| `go_briefing` | `go_briefing` | `Briefings` |
| `go_solicitaodeaprovacao` | `go_solicitaodeaprovacao` | `Solicitacao` |
| `go_site` | `go_site` | `Site` |

As origens `Sql.Database` (RDS AWS: `R0002`, `LY`, `Veiculacao_Segmento`, `VendaImportada`, `Forecast`, `Metas`, …) e `Web.Contents` (logos) **não são afectadas** por esta migração.
