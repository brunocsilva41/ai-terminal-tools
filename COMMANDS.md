# Command Catalog

Catálogo oficial de comandos e exemplos do **Universal AI Terminal Tools**.

---

## Quick Menu

| Objetivo | Comando |
|---|---|
| Diagnóstico de ambiente | `npm run doctor` |
| Setup interativo | `npm run setup` |
| Setup automático | `npm run setup:non-interactive` |
| Listar ativações | `npm run activations:list` |
| Plano de deploy padrão | `npm run deploy:plan` |
| Template de confirmação | `npm run deploy:template` |
| Precheck de deploy padrão | `npm run deploy:precheck` |
| Validar contratos | `npm run validate:contracts` |
| Smoke checks | `npm run smoke` |
| Check completo local | `npm run ci:check` |

---

## 1) Bootstrap e Saúde

### 1.1 Setup

```bash
# interativo
npm run setup

# não interativo (perfil full + PATH global)
node setup.js --non-interactive --profile full --yes --configure-path

# não interativo sem PATH global
node setup.js --non-interactive --profile core --yes --no-configure-path
```

### 1.2 Doctor

```bash
npm run doctor
# equivalente
node setup.js doctor
```

---

## 2) Dispatcher Universal (`ai`)

### 2.1 PowerShell

```powershell
./ai.ps1 "Analise meu Docker" --gemini
./ai.ps1 "Revise este código" --claude
./ai.ps1 "Gere testes para este módulo" --copilot
./ai.ps1 "Refatore este arquivo" --codex
./ai.ps1 "/deploy" "publique a versão 3.1" --claude
./ai.ps1 --activation /review "avalie riscos desta PR" --copilot
```

### 2.2 Bash

```bash
./ai.sh "Analise meu Docker" --gemini
./ai.sh "Revise este código" --claude
./ai.sh "/security" "audite supply chain" --codex
```

### 2.3 Comando global (após PATH configurado)

```bash
ai "Crie um plano de release" --gemini
```

### 2.4 Perfis de ativação

```bash
# listar ativações
node wrappers/activation-profiles/compose_prompt.mjs --list

# usar CLI custom compatível com -p
./ai.ps1 --activation /deploy --cli-cmd mycli "fazer deploy em staging"
```

---

## 3) Qualidade e Contratos

### 3.1 Contratos

```bash
npm run validate:contracts
```

### 3.2 Smoke

```bash
npm run smoke
```

### 3.3 Check completo

```bash
npm run ci:check
```

---

## 4) Core Scripts (Execução Direta)

### 4.0 Deploy Orchestrator (Novo)

```bash
# plano
python core-scripts/deploy/deploy_orchestrator.py plan --mode artifact --cwd . --research-ref https://docs.github.com/en/actions

# template de confirmação
python core-scripts/deploy/deploy_orchestrator.py confirm-template --mode artifact --environment staging --dry-run

# precheck (pesquisa obrigatória)
python core-scripts/deploy/deploy_orchestrator.py precheck --mode artifact --cwd . --research-ref https://docs.github.com/en/actions

# execução (somente após confirmação)
python core-scripts/deploy/deploy_orchestrator.py execute --mode artifact --cwd . --confirm DEPLOY_NOW --research-ref https://docs.github.com/en/actions

# npm dry run
python core-scripts/deploy/deploy_orchestrator.py execute --mode npm --cwd . --confirm DEPLOY_NOW --dry-run --research-ref https://docs.npmjs.com/trusted-publishers/

# docker build e push
python core-scripts/deploy/deploy_orchestrator.py execute --mode docker --cwd . --image-tag ghcr.io/org/app:tag --confirm DEPLOY_NOW --push --research-ref https://docs.docker.com/
```

## 4.1 DevOps

```bash
# status docker
python core-scripts/devops/docker_clean.py

# limpeza docker
python core-scripts/devops/docker_clean.py --clean

# status dokploy/multipass
python core-scripts/devops/dokploy_manager.py status

# executar comando dentro da VM
python core-scripts/devops/dokploy_manager.py exec dokploy "docker service ls"
```

## 4.2 Git

```bash
# resumo completo
python core-scripts/git/git_analyzer.py analyze

# últimos commits
python core-scripts/git/git_analyzer.py log
```

## 4.3 Data

```bash
python core-scripts/data/csv_analyzer.py ./dados/clientes.csv
```

## 4.4 Web

```bash
node core-scripts/web/react_scaffold.js ButtonCard ./src/components
```

## 4.5 QA/Tools

```bash
# revisão estática
node core-scripts/tools/reviewer_tool.js .

# navegador (Playwright)
node core-scripts/tools/browser_tool.js "https://example.com" extract_text
node core-scripts/tools/browser_tool.js "https://example.com" links
node core-scripts/tools/browser_tool.js "https://example.com" screenshot

# postman/newman
python core-scripts/tools/postman_manager.py ./collection.json ./env.json

# dbeaver
python core-scripts/tools/dbeaver_manager.py list
python core-scripts/tools/dbeaver_manager.py run "MinhaConexao" "./scripts/query.sql"
```

---

## 5) MCP e Wrappers

## 5.1 Servidor MCP (Claude)

```bash
cd wrappers/claude-mcp
npm install
npm start
```

## 5.2 Extensão Copilot

Comandos disponíveis na extensão:

- `/devops`
- `/devops clean`
- `/scaffold ButtonCard`
- `/scaffold ButtonCard ./src/ui/components`

---

## 5.3 GitHub Actions (Deploy/Release/Security)

```bash
# disparar deploy manual (via GitHub CLI)
gh workflow run deploy-manual.yml \
  -f strategy=artifact \
  -f environment=staging \
  -f ref=main \
  -f dry_run=true

# deploy real (requer confirmação explícita)
gh workflow run deploy-manual.yml \
  -f strategy=npm \
  -f environment=production \
  -f ref=main \
  -f dry_run=false \
  -f confirm_phrase=DEPLOY
```

Workflows adicionados:

- `.github/workflows/ci.yml`
- `.github/workflows/security-dependency-review.yml`
- `.github/workflows/release.yml`
- `.github/workflows/deploy-manual.yml`

---

## 6) Tools publicadas no contrato (`contracts/tools.manifest.json`)

| Tool name | Finalidade |
|---|---|
| `devops_docker_clean` | status/clean do Docker |
| `devops_dokploy_status` | contexto dokploy/multipass |
| `devops_dokploy_exec` | comando remoto na VM |
| `git_analyzer` | resumo/log do git |
| `data_csv_analyze` | análise de CSV |
| `web_react_scaffold` | geração de componente React |
| `tools_browser` | automação web com Playwright |
| `tools_reviewer` | revisão estática |
| `tools_postman_run` | execução Newman |
| `tools_dbeaver_list` | listar conexões DBeaver |
| `tools_dbeaver_run` | executar SQL via DBeaver |
| `deploy_orchestrator` | plano/precheck/execução de deploy com confirmação |

---

## 7) Receitas Prontas

### Criar componente + validar

```bash
node core-scripts/web/react_scaffold.js ProductCard ./src/components
node core-scripts/tools/reviewer_tool.js .
```

### Verificar ambiente e consistência antes de publicar

```bash
npm run doctor
npm run validate:contracts
npm run smoke
```

### Rodar setup de bootstrap em máquina nova

```bash
node setup.js --non-interactive --profile full --yes --configure-path
```

### Fluxo do Deploy Specialist (pesquisa + confirmação + execução)

```bash
python core-scripts/deploy/deploy_orchestrator.py plan --mode artifact --cwd .
python core-scripts/deploy/deploy_orchestrator.py precheck --mode artifact --cwd .
# Executar somente quando o usuário confirmar
python core-scripts/deploy/deploy_orchestrator.py execute --mode artifact --cwd . --confirm DEPLOY_NOW
```
