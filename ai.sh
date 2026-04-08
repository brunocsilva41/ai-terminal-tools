#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_SCRIPT="$SCRIPT_DIR/wrappers/activation-profiles/compose_prompt.mjs"

show_usage() {
  cat <<'EOF'
Uso:
  ./ai.sh "prompt" --gemini
  ./ai.sh "/deploy" "fazer deploy da API" --claude
  ./ai.sh --activation /review "revisar mudanças" --copilot
  ./ai.sh --list-activations
  ./ai.sh --cli-cmd <comando> "prompt"
EOF
}

if [ "$#" -eq 0 ]; then
  show_usage
  exit 1
fi

CLI="--gemini"
ACTIVATION=""
CUSTOM_CLI_CMD=""
LIST_ACTIVATIONS=false
POSITIONALS=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --gemini|--claude|--copilot|--codex|--opencloud)
      CLI="$1"
      shift
      ;;
    --activation)
      if [ "$#" -lt 2 ]; then
        echo "Missing value for --activation"
        exit 1
      fi
      ACTIVATION="$2"
      shift 2
      ;;
    --cli-cmd)
      if [ "$#" -lt 2 ]; then
        echo "Missing value for --cli-cmd"
        exit 1
      fi
      CUSTOM_CLI_CMD="$2"
      shift 2
      ;;
    --list-activations)
      LIST_ACTIVATIONS=true
      shift
      ;;
    *)
      POSITIONALS+=("$1")
      shift
      ;;
  esac
done

if [ "$LIST_ACTIVATIONS" = true ]; then
  node "$COMPOSE_SCRIPT" --list
  exit $?
fi

PROMPT=""
if [ -n "$ACTIVATION" ]; then
  if [ "${#POSITIONALS[@]}" -lt 1 ]; then
    echo "Missing prompt when using --activation"
    exit 1
  fi
  PROMPT="${POSITIONALS[0]}"
elif [ "${#POSITIONALS[@]}" -ge 2 ] && [[ "${POSITIONALS[0]}" == /* ]]; then
  ACTIVATION="${POSITIONALS[0]}"
  PROMPT="${POSITIONALS[1]}"
elif [ "${#POSITIONALS[@]}" -ge 1 ]; then
  PROMPT="${POSITIONALS[0]}"
fi

if [ -z "$PROMPT" ]; then
  show_usage
  exit 1
fi

FINAL_PROMPT="$PROMPT"
if [ -n "$ACTIVATION" ]; then
  FINAL_PROMPT="$(node "$COMPOSE_SCRIPT" --activation "$ACTIVATION" --prompt "$PROMPT")"
fi

echo -e "\033[0;36m🚀 Dispatching prompt to $CLI...\033[0m"

if [ -n "$CUSTOM_CLI_CMD" ]; then
  "$CUSTOM_CLI_CMD" -p "$FINAL_PROMPT"
  exit $?
fi

case "$CLI" in
  --gemini)
    gemini -p "$FINAL_PROMPT"
    ;;
  --claude)
    claude -p "$FINAL_PROMPT"
    ;;
  --copilot)
    copilot -p "$FINAL_PROMPT"
    ;;
  --codex)
    openai -p "$FINAL_PROMPT"
    ;;
  --opencloud)
    opencloud -p "$FINAL_PROMPT"
    ;;
  *)
    echo "CLI desconhecido: $CLI. Use --gemini, --claude, --copilot, --codex, --opencloud."
    exit 1
    ;;
esac
