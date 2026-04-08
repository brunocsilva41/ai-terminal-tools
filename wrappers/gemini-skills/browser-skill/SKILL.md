---
name: browser-skill
description: Permite que o agente acesse o navegador real para extrair informações de sites, ler documentações online ou capturar screenshots.
---

# Browser Skill (Playwright)

Quando você precisar de informações atualizadas da web que não estão no seu treinamento (ex: documentação de uma biblioteca nova, status de um site):

1. **Navegar e Extrair Texto**:
   - Execute: `node <path>/core-scripts/tools/browser_tool.js "https://site.com" extract_text`
   - Use o texto retornado para responder ao usuário.

2. **Listar Links**:
   - Execute: `node <path>/core-scripts/tools/browser_tool.js "https://site.com" links`

3. **Capturar Screenshot**:
   - Execute: `node <path>/core-scripts/tools/browser_tool.js "https://site.com" screenshot`

Nota: Esta ferramenta usa **Playwright**. Certifique-se de que o usuário tem as dependências instaladas (`npm install playwright`).
