# UNIVERSAL AI TERMINAL TOOLS
## Documentação Mestra + Plano de Evolução v3.0

Data de referência: **08/04/2026**

## 1. Objetivo
Transformar o projeto em uma plataforma **confiável, auditável e fácil de integrar** com múltiplos CLIs de IA (Gemini, Claude, Copilot, OpenAI/Codex), mantendo:

- núcleo agnóstico de ferramentas;
- setup inicial rápido e atrativo;
- compartilhamento padronizado;
- compatibilidade contínua com skills, apps, plugins e servidores MCP.

## 2. Estrutura Atual (AS-IS)
Diagnóstico validado no estado real do repositório.

### 2.1 Núcleo (`core-scripts/`)
- `context/`: descoberta de projetos e memória local (`project_context.js`)
- `data/`: análise de CSV (`csv_analyzer.py`)
- `devops/`: Docker e Dokploy/Multipass (`docker_clean.py`, `dokploy_manager.py`)
- `deploy/`: orquestração de deploy com confirmação (`deploy_orchestrator.py`)
- `git/`: resumo de mudanças (`git_analyzer.py`)
- `tools/`: reviewer, test mapper, browser, Postman, DBeaver, UI helper
- `web/`: scaffold React (`react_scaffold.js`)

### 2.2 Adaptação (`wrappers/`)
- `gemini-skills/`: skills especializadas e equipe virtual
- `gemini-skills/deploy-specialist/`: especialista de deploy com protocolo obrigatório
- `activation-profiles/`: perfis de ativação cross-CLI (`/deploy`, `/review`, etc.)
- `claude-mcp/`: servidor MCP para expor ferramentas do core
- `copilot-extensions/`: extensão local baseada em slash commands
- `codex-plugins/`: manifesto `ai-plugin.json` legado

### 2.3 Interface de Entrada
- `ai.ps1` e `ai.sh`: dispatcher de prompt para CLI alvo
- `setup.js`: bootstrap interativo/não interativo + `doctor` + configuração opcional de PATH global

### 2.4 Contratos e Qualidade
- `contracts/`: manifesto e schema de contrato (`tools.manifest.json`, `tool-contract.schema.json`)
- `wrappers/shared/tool_runtime.mjs`: runtime único para resolver e executar ferramentas por contrato
- `automation/`: validação de contratos e smoke checks (`validate_tool_contracts.mjs`, `smoke_core.mjs`)
- `.github/workflows/ci.yml`: pipeline matriz para validação contínua
- `scripts/doctor.mjs`: diagnóstico reutilizável de ambiente
- `prompts/`: pré-prompts por domínio para padronização operacional

## 3. Lacunas Críticas (Histórico e Status Atual)

| Categoria | Lacuna original | Impacto | Status |
|---|---|---|---|
| Confiabilidade | Sem testes de contrato entre tool e wrapper | Quebras silenciosas entre camadas | Mitigado com `contracts/` + validação + smoke |
| Integração | Estratégias diferentes por CLI, sem contrato único | Alto custo de manutenção | Mitigado com runtime compartilhado por contrato |
| Setup | Fluxo dependente de caminhos locais e decisões manuais | Onboarding inconsistente | Mitigado com perfis, modo não interativo e `doctor` |
| Compatibilidade | Ausência de matriz oficial de suporte por runtime/OS | Regressões em ambientes reais | Mitigado com CI matriz (`windows`, `ubuntu`, `macos`) |
| Segurança | Ferramentas poderosas sem política uniforme de permissão | Risco operacional | Parcial: contratos e hardening aplicados, governança contínua necessária |
| Entrega | Sem pipeline de release com provas de integridade | Menor confiança para compartilhamento | Parcial: CI base entregue, assinatura/attestation pendentes |

## 4. Arquitetura Alvo (TO-BE): MCP-First + Contrato Único

### 4.1 Princípios
1. **Core First**: toda lógica de negócio fica no núcleo.
2. **Adapter Thin Layer**: wrappers apenas traduzem protocolo/UX.
3. **Contract-Driven**: toda ferramenta possui contrato versionado.
4. **MCP-First**: protocolo preferencial para interoperabilidade entre CLIs.
5. **Human-in-the-loop**: confirmações explícitas para operações sensíveis.

### 4.2 Contrato Universal de Ferramentas (UTC)
Cada ferramenta deve declarar:

- `id`, `version`, `owner`, `stability`
- `inputSchema` (JSON Schema 2020-12)
- `outputSchema` (estruturado + fallback textual)
- `permissions` (filesystem, shell, network)
- `sideEffects` e `safetyLevel`
- `timeouts`, `retryPolicy`, `observabilityTags`

### 4.3 Camadas Alvo
1. **Core Tools Layer**: scripts Python/Node.
2. **Contract Layer**: manifesto de tools + schemas.
3. **Protocol Layer**: servidor MCP principal.
4. **CLI Adapter Layer**:
   - Gemini: skills + mcpServers
   - Claude: MCP local/project/user
   - Copilot: MCP + plugins/skills/agents
   - OpenAI: Responses API com tools/functions e MCP remoto
5. **Dispatcher Layer**: `ai.ps1` e `ai.sh` orientados a perfis.

## 5. Integração Facilitada com Todos os CLIs

### 5.1 Estratégia unificada
- **Um servidor MCP central** para expor o core.
- Adapters por CLI apenas para experiência nativa (comandos, prompts, UX).
- Fallback legados (skills/plugins antigos) ficam opcionais.

### 5.2 Matriz de integração recomendada

| CLI | Protocolo principal | Configuração alvo |
|---|---|---|
| Gemini CLI | MCP + settings | `~/.gemini/settings.json` |
| Claude Code/CLI | MCP | `.mcp.json` e `claude mcp add` |
| Copilot CLI | MCP + plugins | `~/.copilot/mcp-config.json` |
| OpenAI/Codex | Responses tools + MCP remoto | integração por API e ferramentas custom |

## 6. Confiabilidade de Entrega

### 6.1 Qualidade por níveis
1. **Validação de contrato**: schema de input/output obrigatório.
2. **Testes unitários**: core scripts isolados.
3. **Testes de integração**: wrapper -> core (por ferramenta).
4. **Smoke E2E por CLI**: ao menos 1 execução real por adapter.
5. **Testes de regressão de prompt**: cenários críticos versionados.

### 6.2 CI/CD mínimo obrigatório
- Matriz de execução: `windows-latest`, `ubuntu-latest`, `macos-latest`
- Matriz de runtime: Node LTS suportadas + Python suportadas
- Gates de merge:
  - lint + typecheck
  - contract tests
  - integration tests
  - smoke MCP
  - segurança (dependências e SAST)

### 6.3 Release confiável
- versionamento semântico (SemVer)
- convenção de commits (Conventional Commits)
- changelog automático
- atestação de artefatos e SBOM
- assinatura e verificação de releases

## 7. Segurança, Governança e Cadeia de Suprimentos

### 7.1 Segurança operacional
- política de permissões por tool (allowlist/denylist)
- confirmação de usuário para comandos sensíveis
- isolamento de contexto por workspace
- redaction de segredos em logs e outputs

### 7.2 Segurança de supply chain
- Dependabot para dependências e actions
- artifact attestations no pipeline
- assinatura/verificação com Sigstore Cosign
- SBOM em CycloneDX e/ou SPDX

## 8. Setup Inicial Fácil e Atrativo

### 8.1 Experiência de instalação
Adicionar dois modos oficiais:

1. `setup interativo` (UX guiada no terminal)
2. `setup não interativo` (automação CI/bootstrap)

### 8.2 Resultado esperado do setup
- valida pré-requisitos (Node/Python/CLI alvo)
- gera configuração base por CLI
- registra caminhos de projetos com fallback multiplataforma
- executa `doctor` final com checklist e próximos passos

### 8.3 Perfis sugeridos
- `core`: apenas tools locais
- `mcp`: core + servidor MCP
- `full`: core + wrappers + skills/plugins
- `enterprise`: com políticas restritivas por padrão

## 9. Compartilhamento e Distribuição

### 9.1 Canais
- NPM como distribuição principal do pacote CLI
- Homebrew Tap para macOS/Linux
- Winget para Windows
- Pipx opcional para utilitários Python isolados

### 9.2 Regras de publicação
- artefato reproduzível
- assinatura + attestation
- release notes com breaking changes explícitas
- política de suporte por versão (janela de manutenção)

## 10. Compatibilidade com Ferramentas, Apps e Skills

### 10.1 Compatibilidade por contrato
Toda integração nova deve declarar:
- capacidades (`read`, `write`, `network`, `shell`)
- limites (`timeout`, `max_output_tokens`, `max_file_size`)
- escopo (`workspace`, `user`, `project`)

### 10.2 Estratégia de evolução
- deprecar wrappers específicos quando MCP cobrir o caso
- manter compatibilidade por 2 versões menores
- publicar guia de migração por adapter

## 10.3 Pré-prompts por domínio

Biblioteca adicionada em `prompts/` para padronizar qualidade de resposta:

- `architecture/system_design.md`
- `implementation/feature_build.md`
- `review/code_review.md`
- `testing/test_strategy.md`
- `deploy/*` (discovery, plan, execute, validate)
- `security/supply_chain.md`
- `orchestration/multi_agent_flow.md`

## 11. Roadmap de Execução (Melhoria Completa)

### Fase 1 (0-30 dias) - Fundamentos
- definir contrato UTC e schemas
- padronizar manifesto de tools
- implementar testes de contrato
- configurar CI matriz básica

Critério de aceite:
- 100% das ferramentas core com schema versionado
- pipeline rodando em 3 sistemas operacionais

### Fase 2 (31-60 dias) - Integração universal
- consolidar servidor MCP como interface primária
- alinhar Gemini/Claude/Copilot para fluxo MCP-first
- revisar integração OpenAI para Responses/tools

Critério de aceite:
- smoke test verde em todos os adapters prioritários
- setup gera configuração mínima para os 4 ecossistemas

### Fase 3 (61-90 dias) - Confiabilidade avançada
- adicionar assinatura, SBOM, attestation e verificações
- SAST/dependency review obrigatórios
- observabilidade e métricas operacionais

Critério de aceite:
- releases assinados e verificáveis
- tempo de onboarding reduzido e medido

## 12. KPIs Operacionais
- Taxa de sucesso de setup inicial >= 95%
- Taxa de sucesso de integração por CLI >= 98%
- MTTR de falhas de integração < 24h
- Cobertura de testes de contrato das tools = 100%
- Zero release sem SBOM/attestation

## 13. Referências Oficiais (Base da evolução)

### Protocolos e IA
- MCP Specification: https://modelcontextprotocol.io/specification/latest
- MCP Tools: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- Claude MCP: https://docs.anthropic.com/en/docs/claude-code/mcp
- Gemini CLI Docs: https://google-gemini.github.io/gemini-cli/docs/
- Gemini MCP: https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html
- Gemini Trusted Folders: https://google-gemini.github.io/gemini-cli/docs/cli/trusted-folders.html
- Copilot CLI: https://docs.github.com/en/copilot/how-tos/copilot-cli
- Copilot MCP: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
- Copilot Plugins: https://docs.github.com/copilot/concepts/agents/copilot-cli/about-cli-plugins
- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses/create
- OpenAI Tools: https://platform.openai.com/docs/guides/tools?api-mode=responses
- OpenAI Function Calling: https://platform.openai.com/docs/guides/function-calling?api-mode=responses
- OpenAI Help (Agents/Function Calling): https://help.openai.com/en/articles/8555517-function-calling-in-the-openai-api

### Engenharia de entrega
- GitHub Actions Matrix: https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs
- Reusable Workflows: https://docs.github.com/actions/using-workflows/reusing-workflows
- Artifact Attestations: https://docs.github.com/en/actions/concepts/security/artifact-attestations
- Dependabot Version Updates: https://docs.github.com/en/code-security/concepts/supply-chain-security/about-dependabot-version-updates

### Versionamento e contratos
- Semantic Versioning: https://semver.org/
- Conventional Commits: https://www.conventionalcommits.org/en/v1.0.0/
- JSON Schema 2020-12: https://json-schema.org/draft/2020-12

### Integridade e SBOM
- Sigstore Cosign Quickstart: https://docs.sigstore.dev/quickstart/quickstart-cosign/
- Sigstore Verify: https://docs.sigstore.dev/cosign/verifying/verify/
- CycloneDX Specification: https://cyclonedx.org/specification/overview
- SPDX Specifications: https://spdx.dev/use/specifications/

---
*Fim da Documentação Mestra v3.0 - Atualizada em 08/04/2026*
