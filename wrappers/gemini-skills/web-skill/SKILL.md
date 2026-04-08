---
name: web-skill
description: Use esta skill para gerar rapidamente componentes React completos (com TSX, CSS e Index) a partir do terminal.
---

# Web Component Scaffolder

Quando o usuário pedir para criar um componente React (ex: "crie um componente Button" ou "faça um scaffold de uma Navbar"):

1. Identifique o nome do componente solicitado (deve ser em PascalCase).
2. Execute o script Node.js associado: `node <absolute_path_to_core_scripts>/web/react_scaffold.js NomeDoComponente ./src/components` via `run_shell_command`.
3. Verifique o JSON de sucesso retornado.
4. O script criará a pasta do componente com o `.tsx`, `.css` e `index.ts`. Informe ao usuário que os arquivos foram gerados.
