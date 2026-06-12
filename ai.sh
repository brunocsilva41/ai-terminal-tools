#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_SCRIPT="$SCRIPT_DIR/wrappers/activation-profiles/compose_prompt.mjs"

is_gemini_capacity_error() {
  local output="$1"
  [[ "$output" == *"MODEL_CAPACITY_EXHAUSTED"* ]] || [[ "$output" == *"RESOURCE_EXHAUSTED"* ]] || [[ "$output" == *"No capacity available for model"* ]]
}

invoke_gemini_with_fallback() {
  local prompt_text="$1"
  local preferred_model="${AI_GEMINI_MODEL:-}"
  local fallback_env="${AI_GEMINI_FALLBACK_MODELS:-}"
  local -a labels=()
  local -a models=()
  local -a fallback_models=()
  local last_capacity_output=""

  if [ -n "$fallback_env" ]; then
    IFS=',' read -r -a fallback_models <<< "$fallback_env"
  fi

  add_attempt() {
    local label="$1"
    local model="${2:-}"
    local i
    for i in "${!models[@]}"; do
      if [ "${models[$i]}" = "$model" ]; then
        return
      fi
    done
    labels+=("$label")
    models+=("$model")
  }

  if [ -n "$preferred_model" ]; then
    add_attempt "configured model $preferred_model" "$preferred_model"
  else
    add_attempt "Gemini CLI default model" ""
  fi

  local model
  for model in "${fallback_models[@]}"; do
    model="${model#"${model%%[![:space:]]*}"}"
    model="${model%"${model##*[![:space:]]}"}"
    if [ -n "$model" ]; then
      add_attempt "fallback model $model" "$model"
    fi
  done

  if [ -z "$preferred_model" ] && [ "${#fallback_models[@]}" -eq 0 ]; then
    add_attempt "fallback model gemini-2.5-pro" "gemini-2.5-pro"
    add_attempt "fallback model gemini-2.5-flash" "gemini-2.5-flash"
  fi

  local i
  for i in "${!models[@]}"; do
    local -a gemini_args=()
    if [ -n "${models[$i]}" ]; then
      printf 'Using Gemini model %s (%s/%s).\n' "${models[$i]}" "$((i + 1))" "${#models[@]}" >&2
      gemini_args+=(--model "${models[$i]}")
    fi
    gemini_args+=(--prompt "$prompt_text")

    local output
    output="$(gemini "${gemini_args[@]}" 2>&1)"
    local status=$?

    if [ "$status" -eq 0 ]; then
      [ -n "$output" ] && printf '%s\n' "$output"
      return 0
    fi

    if ! is_gemini_capacity_error "$output"; then
      [ -n "$output" ] && printf '%s\n' "$output" >&2
      return "$status"
    fi

    last_capacity_output="$output"
    if [ $((i + 1)) -lt "${#models[@]}" ]; then
      local next_label="${models[$((i + 1))]}"
      if [ -z "$next_label" ]; then
        next_label="Gemini CLI default model"
      fi
      printf 'Gemini returned 429/capacity exhaustion for %s. Retrying with %s.\n' "${labels[$i]}" "$next_label" >&2
    fi
  done

  printf 'Gemini is unavailable because all configured/default models are out of capacity.\n' >&2
  printf 'Set AI_GEMINI_MODEL or AI_GEMINI_FALLBACK_MODELS to override the retry order.\n' >&2

  if [ "${AI_GEMINI_DEBUG_ERRORS:-}" = "1" ] && [ -n "$last_capacity_output" ]; then
    printf '\n--- Gemini raw error ---\n%s\n' "$last_capacity_output" >&2
  fi

  return 1
}

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
    invoke_gemini_with_fallback "$FINAL_PROMPT"
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
