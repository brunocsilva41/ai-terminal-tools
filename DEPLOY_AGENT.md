# Deploy Specialist Agent

Guia do especialista de deploy do Universal AI Terminal Tools.

## Objetivo

Executar deploy com segurança operacional usando protocolo obrigatório:

1. pesquisa;
2. plano;
3. confirmação;
4. execução;
5. validação;
6. confirmação final.

## Skill principal

- `wrappers/gemini-skills/deploy-specialist/SKILL.md`
- Compatibilidade por ativação multi-CLI em `wrappers/activation-profiles/profiles.json`

## Ferramenta principal

- `core-scripts/deploy/deploy_orchestrator.py`

## Modos de deploy suportados

- `artifact`
- `npm`
- `docker`
- `script`

## Fluxo operacional

1. Discovery com `prompts/deploy/deploy_discovery.md`.
2. Plano com `prompts/deploy/deploy_plan.md`.
3. Confirmar explicitamente com o usuário.
4. Gerar template de confirmação:
   - `python core-scripts/deploy/deploy_orchestrator.py confirm-template --mode <mode> --environment <env>`
5. Executar precheck:
   - `python core-scripts/deploy/deploy_orchestrator.py precheck --mode <mode> --research-ref <url_oficial>`
5. Executar deploy (após confirmação):
   - `python core-scripts/deploy/deploy_orchestrator.py execute --mode <mode> --confirm DEPLOY_NOW --research-ref <url_oficial>`
6. Validar com `prompts/deploy/deploy_validate.md`.
7. Revisar relatório estruturado salvo em `.deploy-reports/deployment_report_*.json`.

## Exemplo rápido

```bash
python core-scripts/deploy/deploy_orchestrator.py plan --mode artifact --cwd . --research-ref https://docs.github.com/en/actions
python core-scripts/deploy/deploy_orchestrator.py confirm-template --mode artifact --environment staging --dry-run
python core-scripts/deploy/deploy_orchestrator.py precheck --mode artifact --cwd . --research-ref https://docs.github.com/en/actions
python core-scripts/deploy/deploy_orchestrator.py execute --mode artifact --cwd . --confirm DEPLOY_NOW --research-ref https://docs.github.com/en/actions
```

Ativação via dispatcher:

```powershell
./ai.ps1 "/deploy" "publique a versão atual" --claude
./ai.ps1 "/deploy" "publique a versão atual" --gemini
```

## Regras de segurança

- nunca executar sem confirmação explícita;
- nunca executar sem referências oficiais de pesquisa;
- sempre ter rollback definido antes de agir;
- interromper execução ao primeiro erro crítico;
- registrar evidências técnicas no resultado final (report JSON obrigatório).
