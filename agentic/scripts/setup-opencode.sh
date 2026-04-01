#!/usr/bin/env bash
# Setup-OpenCode — macOS / Linux (mirrors agentic/powershell/workflow.ps1 Setup-OpenCode)
# Usage:
#   ./agentic/scripts/setup-opencode.sh
#   ZHIPU_API_KEY=xxx ./agentic/scripts/setup-opencode.sh   # non-interactive
#   ./agentic/scripts/setup-opencode.sh --force
#   ./agentic/scripts/setup-opencode.sh --base-url 'https://...'

set -euo pipefail

PROVIDER_ID="zai-coding-plan"
MODEL_NAME="glm-5"
MODEL_ID="${PROVIDER_ID}/${MODEL_NAME}"
ENV_VAR="ZHIPU_API_KEY"
BASE_URL="${BASE_URL:-https://open.bigmodel.cn/api/paas/v4}"
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=true; shift ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --api-key)
      export ZHIPU_API_KEY="$2"
      shift 2
      ;;
    -h | --help)
      echo "Usage: $0 [--force] [--base-url URL] [--api-key KEY]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

CONFIG_DIR="${HOME}/.config/opencode"
CONFIG_FILE="${CONFIG_DIR}/opencode.json"

echo ""
echo "=== Setup-OpenCode (macOS / Linux) ==="
echo ""

echo "[1/5] Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "  ERROR: Node.js not installed. Install from https://nodejs.org (LTS)" >&2
  exit 1
fi
echo "  OK  Node.js $(node --version)"

echo "[2/5] Checking OpenCode installation..."
if command -v opencode >/dev/null 2>&1 && [[ "$FORCE" != true ]]; then
  echo "  OK  opencode $(opencode --version 2>/dev/null | tr -d '\n') already installed (use --force to reinstall)"
else
  echo "  Installing opencode-ai via npm..."
  npm install -g opencode-ai@latest
  echo "  OK  opencode $(opencode --version 2>/dev/null | tr -d '\n') installed"
fi

echo "[3/5] Configuring API key (${ENV_VAR})..."
API_KEY="${ZHIPU_API_KEY:-}"
if [[ -z "$API_KEY" ]]; then
  read -r -s -p "  Enter your ZhipuAI API key (https://open.bigmodel.cn → API Keys): " API_KEY
  echo ""
fi
if [[ -z "$API_KEY" ]]; then
  echo "  ERROR: no API key." >&2
  exit 1
fi
export ZHIPU_API_KEY="$API_KEY"

SHELL_RC=""
if [[ -n "${ZSH_VERSION:-}" ]] && [[ -f "${HOME}/.zshrc" ]]; then
  SHELL_RC="${HOME}/.zshrc"
elif [[ -f "${HOME}/.zshrc" ]]; then
  SHELL_RC="${HOME}/.zshrc"
elif [[ -f "${HOME}/.bash_profile" ]]; then
  SHELL_RC="${HOME}/.bash_profile"
elif [[ -f "${HOME}/.bashrc" ]]; then
  SHELL_RC="${HOME}/.bashrc"
fi

if [[ -n "$SHELL_RC" ]] && ! grep -q "export ${ENV_VAR}=" "$SHELL_RC" 2>/dev/null; then
  read -r -p "  Append export ${ENV_VAR} to ${SHELL_RC}? [y/N] " ans
  if [[ "${ans:-}" =~ ^[yY]$ ]]; then
    {
      echo ""
      echo "# OpenCode / ZhipuAI (city-dao agentic workflow)"
      echo "export ${ENV_VAR}=\"${API_KEY}\""
    } >>"$SHELL_RC"
    echo "  OK  ${ENV_VAR} appended to ${SHELL_RC} (restart terminal or: source ${SHELL_RC})"
  else
    echo "  Add this line to your shell profile for new terminals:"
    echo "    export ${ENV_VAR}=\"<your-key>\""
  fi
else
  echo "  OK  ${ENV_VAR} is set for this session (already in profile or skipped)"
fi

echo "[4/5] Writing ${CONFIG_FILE}..."
mkdir -p "$CONFIG_DIR"

# shellcheck disable=SC2016
cat >"$CONFIG_FILE" <<EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "${MODEL_ID}",
  "provider": {
    "${PROVIDER_ID}": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "ZhipuAI GLM",
      "options": {
        "baseURL": "${BASE_URL}",
        "apiKey": "{env:${ENV_VAR}}"
      },
      "models": {
        "${MODEL_NAME}": {
          "name": "GLM-5",
          "limit": {
            "context": 128000,
            "output": 8192
          }
        }
      }
    }
  }
}
EOF
echo "  OK  config written"

echo "[5/5] Installing @ai-sdk/openai-compatible in config dir..."
(
  cd "$CONFIG_DIR"
  if command -v bun >/dev/null 2>&1; then
    bun add @ai-sdk/openai-compatible 2>/dev/null || npm install @ai-sdk/openai-compatible --save 2>/dev/null || true
  else
    npm install @ai-sdk/openai-compatible --save 2>/dev/null || true
  fi
)
echo "  OK  dependency step finished (warnings are OK if OpenCode bundles it)"

echo ""
echo "OpenCode is ready!"
echo "  Model:   ${MODEL_ID}"
echo "  API:     ${BASE_URL}"
echo "  API key: ${ENV_VAR}"
echo "  Config:  ${CONFIG_FILE}"
echo ""
echo "Test:  opencode run -m ${MODEL_ID} 'Say hello in one sentence'"
echo ""
