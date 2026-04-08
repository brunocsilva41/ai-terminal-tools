# Universal AI Terminal Tools

Plataforma de automação para engenharia assistida por IA, com foco em:

- **confiabilidade de entrega** (contratos de tools + smoke checks);
- **integração multi-CLI** (Gemini, Claude/MCP, Copilot, OpenAI/Codex);
- **setup simples** (interativo e não interativo, com opção de PATH global);
- **núcleo agnóstico** (scripts Python/Node desacoplados dos wrappers).
- **agentes especializados** com prompts prontos por domínio.

## Visão Rápida

```text
core-scripts/      -> ferramentas reais (DevOps, Git, Data, Web, QA)
contracts/         -> manifesto e schema dos contratos de ferramentas
wrappers/          -> integrações por CLI (MCP, Copilot, skills)
prompts/           -> pré-prompts por domínio (arquitetura, deploy, review, etc.)
setup.js           -> bootstrap + doctor + configuração PATH
automation/        -> validação de contratos e smoke checks
```

## Primeiros Passos

### 1) Validar ambiente

```bash
npm run doctor
```

### 2) Rodar setup

```bash
npm run setup
```

Modo não interativo:

```bash
npm run setup:non-interactive
```

### 3) Validar consistência técnica

```bash
npm run validate:contracts
npm run smoke
```

## Configuração do comando global `ai`

O setup cria launchers em `bin/` (`ai`, `ai.ps1`, `ai.cmd`) e pode configurar PATH automaticamente.

- Se PATH foi configurado: use `ai "seu prompt" --gemini` de qualquer pasta.
- Se PATH não foi configurado: use `./ai.ps1` (Windows) ou `./ai.sh` (Bash).

Também é suportado o formato de ativação:

```powershell
./ai.ps1 "/deploy" "publique versão 3.1 no npm" --claude
```

```bash
./ai.sh "/review" "revise este plano de release" --copilot
```

## Integrações suportadas

| Ecossistema | Estratégia |
|---|---|
| Gemini CLI | skills + integração por ferramentas |
| Claude | servidor MCP (`wrappers/claude-mcp/mcp_server.js`) |
| Copilot CLI | extensão com comandos `/devops` e `/scaffold` |
| OpenAI/Codex | wrapper legado em `wrappers/codex-plugins/` |

Compatibilidade detalhada: [`COMPATIBILITY.md`](./COMPATIBILITY.md)

## Novo: Deploy Specialist

Foi adicionado um especialista dedicado para deploy:

- Skill: `wrappers/gemini-skills/deploy-specialist/SKILL.md`
- Tool core: `core-scripts/deploy/deploy_orchestrator.py`
- Guia: [`DEPLOY_AGENT.md`](./DEPLOY_AGENT.md)

Esse especialista opera por protocolo obrigatório:

1. pesquisa oficial;
2. plano técnico;
3. confirmação explícita do usuário;
4. execução controlada;
5. validação + confirmação final.

## Qualidade e Entrega

- `contracts/tools.manifest.json`: catálogo versionado das tools.
- `contracts/tool-contract.schema.json`: schema-base do contrato.
- `automation/validate_tool_contracts.mjs`: validação estrutural.
- `automation/smoke_core.mjs`: smoke real de scaffold + CSV analyzer.
- `.github/workflows/ci.yml`: CI matriz (Windows/Linux/macOS).
- `.github/workflows/security-dependency-review.yml`: revisão de dependências em PR.
- `.github/workflows/release.yml`: release por tag `v*`.
- `.github/workflows/deploy-manual.yml`: deploy manual com confirmação.

## Documentação

- [`setup.md`](./setup.md): instalação completa e troubleshooting.
- [`COMMANDS.md`](./COMMANDS.md): catálogo de comandos + exemplos.
- [`UNIVERSAL_SYSTEM.md`](./UNIVERSAL_SYSTEM.md): arquitetura e roadmap.
- [`DEPLOY_AGENT.md`](./DEPLOY_AGENT.md): operação do agente especialista em deploy.
- [`prompts/README.md`](./prompts/README.md): catálogo de pré-prompts.
- [`COMPATIBILITY.md`](./COMPATIBILITY.md): matriz e padrão de compatibilidade multi-CLI.

## Scripts NPM

```bash
npm run setup
npm run setup:non-interactive
npm run doctor
npm run activations:list
npm run deploy:plan
npm run deploy:template
npm run deploy:precheck
npm run validate:contracts
npm run smoke
npm run ci:check
```
