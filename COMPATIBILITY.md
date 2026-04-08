# CLI Compatibility

Este projeto tem dois níveis de compatibilidade:

1. **Compatibilidade por protocolo** (MCP / tools por contrato).
2. **Compatibilidade por prompt de ativação** (`/comando "prompt" --flagcli`) via dispatcher.

## Matriz

| CLI | Suporte atual | Como usar |
|---|---|---|
| Gemini | Skills + dispatcher | `./ai.ps1 "/deploy" "..." --gemini` |
| Claude | MCP + dispatcher | `./ai.ps1 "/deploy" "..." --claude` |
| Copilot CLI | Extensão + dispatcher | `./ai.ps1 "/review" "..." --copilot` |
| Codex/OpenAI CLI | Dispatcher | `./ai.ps1 "/security" "..." --codex` |
| OpenCloud (ou outro CLI com `-p`) | Dispatcher | `./ai.ps1 "/orchestrate" "..." --opencloud` ou `--cli-cmd` |

## Ativações disponíveis

Use:

```bash
node wrappers/activation-profiles/compose_prompt.mjs --list
```

Exemplos:

- `/deploy`
- `/review`
- `/architect`
- `/test`
- `/orchestrate`
- `/security`

## Padrão de comando universal

PowerShell:

```powershell
./ai.ps1 "/comando_ativacao" "prompt do usuário" --flagcli
```

Bash:

```bash
./ai.sh "/comando_ativacao" "prompt do usuário" --flagcli
```

Para CLI não mapeado explicitamente:

```powershell
./ai.ps1 --activation /deploy --cli-cmd mycli "faça deploy da API"
```

## Observação importante

As skills em `wrappers/gemini-skills/` são nativas para ecossistema Gemini.  
Para os demais CLIs, a compatibilidade é fornecida por:

- MCP (`wrappers/claude-mcp`) quando suportado;
- contratos (`contracts/tools.manifest.json`);
- perfis de ativação (`wrappers/activation-profiles/profiles.json`) via dispatcher.
