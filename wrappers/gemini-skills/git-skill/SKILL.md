---
name: git-skill
description: Use esta skill para obter um resumo rápido do status atual do repositório Git, incluindo as últimas mudanças e o histórico recente, ideal para gerar mensagens de commit ou PRs.
---

# Git Analyzer Skill

Esta skill utiliza um script leve para buscar informações do repositório sem estourar o limite de contexto da IA.

## Como Usar

Quando o usuário pedir um resumo do repositório ou ajuda para criar um commit:
1. Execute `python <absolute_path_to_core_scripts>/git/git_analyzer.py analyze` via `run_shell_command`.
2. Analise o output gerado (que já vem sumarizado pelo script) e crie uma mensagem de commit detalhada ou apenas um resumo legível para o usuário.
3. Não use comandos Git diretamente com verbose alto; confie na saída resumida deste script.
