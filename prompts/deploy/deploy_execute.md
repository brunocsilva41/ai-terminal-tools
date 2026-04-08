# PRE-PROMPT: Deploy Execute

Execute somente após confirmação explícita.

## Regras de execução

1. Rodar precheck e reportar resultado.
2. Executar em etapas pequenas.
3. Reportar saída de cada etapa.
4. Se falhar, interromper e acionar plano de rollback.
5. Registrar evidências objetivas.
