# 📊 Relatórios Power BI — GOINSIDE

Repositório centralizado para **versionamento e desenvolvimento de relatórios Power BI** da GOINSIDE.

---

## 📁 Estrutura do Repositório

```
relatorios_pbi/
├── Bauer/               # Relatórios do cliente / projeto Bauer (Order Projections)
├── Dazn/                # Relatórios do cliente / projeto DAZN
│   └── TX/              # TX (.pbip, Report, SemanticModel)
├── MediaLivre/          # Relatórios do cliente / projeto Media Livre
│   └── ...              # Arquivos .pbix, SemanticModels e recursos relacionados
├── Mega/                # Relatórios do cliente / projeto MEGA
│   └── AD/              # AD e AD - Resumo (.pbip, Report, SemanticModel)
├── RTP/                 # Relatórios do cliente / projeto RTP
│   └── AD/              # AD - 5 anos + YUMMI 2 anos (.pbip, Report, SemanticModel)
├── SBT/                 # Relatórios do cliente / projeto SBT
│   └── AD/              # GODASHBOARD - Gestor Conta e Funil de Vendas (.pbip, Report, SemanticModel)
├── Soico/               # Relatórios do cliente / projeto SOICO
│   ├── AD/              # AD e AD - Operação Comercial (.pbip, Report, SemanticModel)
│   ├── TX/              # TX (.pbip, Report, SemanticModel)
│   ├── PLAN/            # PLAN (.pbip, Report, SemanticModel)
│   └── INCIDENTES/      # INCIDENTES (.pbip, Report, SemanticModel)
└── README.md
```

---

## 🎯 Objetivo

Este repositório tem como finalidade:

- **Versionar** todos os arquivos de desenvolvimento Power BI (`.pbix`, `.SemanticModel`, relatórios, etc.)
- **Rastrear alterações** feitas nos relatórios ao longo do tempo
- **Colaborar** entre membros da equipe de dados e analytics
- **Garantir histórico** de modificações com controle de versão via Git

---

## ⚙️ Boas Práticas

### Arquivos ignorados (.gitignore)
Arquivos de cache gerados automaticamente pelo Power BI **não são versionados**, pois podem ser muito grandes e são recriados automaticamente:

```
**/.pbi/cache.abf
**/.pbi/*.abf
```

Estado local de ferramentas (worktrees, sessões) também fica de fora:

```
.claude/
```

### Commits
Utilize mensagens de commit descritivas, por exemplo:
```
feat: adiciona visual de funil no relatório de negociações
fix: corrige filtro de data no relatório de audiências
update: atualiza fonte de dados do SemanticModel MediaLivre
```

---

## 🚀 Como Utilizar

### Clonar o repositório
```bash
git clone https://github.com/gwebergoinside/main_repo_project.git
```

### Fluxo de trabalho sugerido
```bash
# 1. Atualizar sua cópia local antes de começar
git pull origin master

# 2. Fazer alterações nos arquivos .pbix no Power BI Desktop

# 3. Adicionar as alterações
git add .

# 4. Commitar com mensagem descritiva
git commit -m "update: descrição da alteração"

# 5. Enviar para o repositório remoto
git push origin master
```

---

## 👥 Equipe

| Nome     | Papel                        |
| -------- | ---------------------------- |
| GOINSIDE | Agência de mídia e analytics |

---

## 📅 Histórico

| Data       | Descrição                                              |
| ---------- | ------------------------------------------------------ |
| 27/08/2026 | Criação do repositório — versão inicial com MediaLivre |
| 28/08/2026 | Adiciona projeto SOICO (AD, TX, PLAN, INCIDENTES) — modelos repontados da instância RDS `gmedia-soico` (desativada) para `gmedia-saas-sql`, com bases renomeadas (prefixo `SOICO_`) |
| 31/08/2026 | Adiciona projetos DAZN (TX) e MEGA (AD e AD - Resumo); atualizações nos modelos SOICO — `Ocupacao` (AD) passa a formatar a faixa horária em SQL puro, `Contratos` (TX) migrada para query SQL parametrizada e nova coluna `LogoBase64` em `images` (TX e INCIDENTES) |
| 09/09/2026 | Adiciona projeto RTP (AD - 5 anos + YUMMI 2 anos); MediaLivre passa a usar `dt_modified_on` como marca de água do refresh incremental (queries filtram por essa coluna e excluem-na do resultado) |
| 14/09/2026 | Adiciona projeto SBT (AD - GODASHBOARD Gestor Conta), com RLS já definido em `definition/roles/`; MediaLivre prepara RLS dinâmico pela tabela `pbi_tb_rls` e reescreve em `TREATAS` as medidas que usavam `USERELATIONSHIP`/`CROSSFILTER` (proibidos sob RLS) — ver `MediaLivre/Encomendas e Negociações/RLS.md` |
| 15/09/2026 | SBT (AD) migrado do conector Dataverse legacy (`Cds.Entities`) para o endpoint TDS (`CommonDataService.Database`) — troca centralizada nas expressões `#CDSTEntitySource` e `GetCDST_EntityTable`, com shim que mantém os nomes `<coluna>_display` e deixa as 22 queries a jusante intactas — ver `SBT/AD/MIGRACAO-TDS.md` |
| 15/09/2026 | SBT (AD) — refatoração do modelo: queries duplicadas unificadas (`EmpresaFaturamento`+`EmpresaVenda` → `AccountNome`; `OPTSCreated`+`OPTSModified`+`OPTSIntegrated` → `OPTSDatas`), lista de exceções SBT News e bloco `Tipo Governo` passam a partilhados (`Excecoes_SBTNEWS`, `Fn_TipoGoverno`), filtros e colunas calculadas empurrados para SQL e −498 linhas de código morto — ver `SBT/AD/REFATORACAO-MODELO.md` |
| 17/09/2026 | SBT (AD) — adiciona o modelo `GODASHBOARD - SBT - FUNIL DE VENDAS` e otimiza-o: as 10 queries `Sql.Database` passam a ter o SQL em texto multi-linha na primeira variável, transformações de M empurradas para SQL, `OPTSCreated`/`OPTSModified`/`OPTSIntegrated`/`Anotacoes`/`Programas_OPT` eliminadas (4 → 1 leituras de `go_opportunity` por refresh) e −64 colunas sem uso nos visuais — ver `SBT/AD/OTIMIZACAO-FUNIL-VENDAS.md` |

---

> 📌 **Atenção:** Arquivos `.pbix` podem ser grandes. Sempre verifique o tamanho antes de commitar e evite versionar arquivos de cache (`.abf`).
