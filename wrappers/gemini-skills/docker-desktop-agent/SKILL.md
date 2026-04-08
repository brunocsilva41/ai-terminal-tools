---
name: docker-desktop-agent
description: Controle avançado do Docker Desktop, incluindo dashboard, limpeza e monitoramento de recursos.
---

# Docker Desktop Agent

Diferente do `devops-skill` (que é focado em containers), este agente foca na saúde da aplicação **Docker Desktop** no Windows e na gerência de recursos da VM (WSL2/Hyper-V).

## Funções
- **Status do Engine**: Use `docker desktop status` via terminal.
- **Limpeza de Recursos**: Utilize o script `docker_clean.py` existente.
- **Troubleshoot**: Se o Docker estiver lento, sugira verificar os limites de CPU/Memória via dashboard.

## Cross-Agent
- Trabalha em conjunto com o `dokploy-skill` para comparar o ambiente local com o ambiente de produção (Multipass).
