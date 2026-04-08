---
name: data-skill
description: Use esta skill para analisar rapidamente a estrutura, cabeçalhos e amostras de dados de um arquivo CSV grande, sem tentar ler o arquivo inteiro na memória ou no contexto da IA.
---

# CSV Analyzer Skill

Ler arquivos CSV grandes através de `cat` ou `read_file` gasta muitos tokens e pode travar a IA. Use esta skill para explorar dados de forma eficiente.

## Como Usar

Quando o usuário fornecer o caminho de um CSV e pedir para analisá-lo:
1. Execute o script em python: `python <absolute_path_to_core_scripts>/data/csv_analyzer.py <caminho_do_csv>` via `run_shell_command`.
2. O script lerá o CSV com eficiência e imprimirá no console um JSON sumarizado (contagem de linhas, cabeçalhos, 5 primeiras linhas).
3. Responda ao usuário com a sua interpretação desses metadados.
