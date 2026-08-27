# 📊 Relatórios Power BI — GOINSIDE

Repositório centralizado para **versionamento e desenvolvimento de relatórios Power BI** da GOINSIDE.

---

## 📁 Estrutura do Repositório

```
relatorios_pbi/
├── MediaLivre/          # Relatórios do cliente / projeto Media Livre
│   └── ...              # Arquivos .pbix, SemanticModels e recursos relacionados
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

| Nome | Papel |
|------|-------|
| GOINSIDE | Agência de mídia e analytics |

---

## 📅 Histórico

| Data | Descrição |
|------|-----------|
| 27/08/2026 | Criação do repositório — versão inicial com MediaLivre |

---

> 📌 **Atenção:** Arquivos `.pbix` podem ser grandes. Sempre verifique o tamanho antes de commitar e evite versionar arquivos de cache (`.abf`).
