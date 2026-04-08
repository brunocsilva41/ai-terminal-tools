# Setup Guide

Guia oficial de bootstrap do **Universal AI Terminal Tools**.

## 1. Pré-requisitos

Obrigatórios:

- `node` (>= 20)
- `python` (ou `python3` / `py`)
- `git`

Opcionais (habilitam integrações específicas):

- `gemini`
- `claude`
- `gh`
- `docker`

Valide com:

```bash
npm run doctor
```

## 2. Modos de setup

## 2.1 Interativo

```bash
npm run setup
```

Fluxo:

1. valida dependências;
2. coleta perfil de ferramentas/agentes;
3. gera `core-scripts/context/scan_config.json`;
4. atualiza mapa de projetos (`PROJECTS_MAP`);
5. cria launchers em `bin/`;
6. oferece configuração de PATH para comando global `ai`.

## 2.2 Não interativo

```bash
node setup.js --non-interactive --profile full --yes --configure-path
```

Perfis embutidos:

- `core`
- `mcp`
- `full`
- `enterprise`

Também é possível usar arquivo JSON próprio:

```bash
node setup.js --non-interactive --profile ./meu-perfil.json --yes
```

Exemplo de perfil:

```json
{
  "tools": ["devops", "git", "web", "data"],
  "agents": ["Architect", "Backend", "Data Specialist"],
  "paths": ["~/Desktop/Code", "~/Documents/Projetos"]
}
```

## 3. PATH global (`ai`)

## 3.1 Como funciona

O setup cria:

- `bin/ai`
- `bin/ai.ps1`
- `bin/ai.cmd`

Se `--configure-path` estiver ativo, o setup tenta persistir `bin/` no PATH do usuário.

## 3.2 Flags de PATH

```bash
--configure-path
--no-configure-path
```

Se não quiser PATH global, continue usando:

- Windows: `./ai.ps1 "prompt" --gemini`
- Bash: `./ai.sh "prompt" --gemini`

## 4. Doctor isolado

```bash
node setup.js doctor
# ou
node setup.js --doctor
```

Saída esperada:

- `OK` para dependências obrigatórias presentes;
- `FAIL` para obrigatórias ausentes;
- `SKIP` para CLIs opcionais não instalados.

## 5. Validação pós-setup

```bash
npm run validate:contracts
npm run smoke
```

`smoke` valida execução real de:

- scaffold React (`web_react_scaffold`);
- análise CSV (`data_csv_analyze`).

## 6. Integração por CLI

## 6.1 Claude (MCP)

```bash
cd wrappers/claude-mcp
npm install
npm start
```

Adicione no config MCP do Claude:

```json
{
  "mcpServers": {
    "universal-ai-tools": {
      "command": "node",
      "args": ["<ABSOLUTE_PATH>/wrappers/claude-mcp/mcp_server.js"]
    }
  }
}
```

## 6.2 Gemini

Instale as skills desejadas em `wrappers/gemini-skills/`.

## 6.3 Copilot CLI

Aponte para `wrappers/copilot-extensions/extension.mjs`.

## 6.4 OpenAI/Codex

Wrapper legado disponível em `wrappers/codex-plugins/`.

## 6.5 Deploy Specialist

Skill dedicada para deploy seguro com confirmação:

- `wrappers/gemini-skills/deploy-specialist/SKILL.md`
- `core-scripts/deploy/deploy_orchestrator.py`
- Guia completo: `DEPLOY_AGENT.md`
- Compatibilidade multi-CLI por ativação: `COMPATIBILITY.md`

## 7. Troubleshooting

- `Doctor encontrou dependências obrigatórias ausentes`: instale `node/python/git`.
- `Tool manifest is invalid`: rode `npm run validate:contracts` e corrija `contracts/tools.manifest.json`.
- `PATH não atualizado automaticamente`: rode setup com terminal administrativo, ou adicione manualmente `<repo>/bin` no PATH.
