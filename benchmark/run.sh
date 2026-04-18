#!/usr/bin/env bash
# Usage:
#   ./benchmark/run.sh smoke
#   ./benchmark/run.sh load
#   ./benchmark/run.sh ollama

set -euo pipefail

SCRIPT="${1:-smoke}"
BASE_URL="${BASE_URL:-https://healthcompass.cloud}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$DIR/results"

RESULT_FILE="$DIR/results/${SCRIPT}-$(date +%Y%m%d-%H%M%S).json"

echo "▶ Running: $SCRIPT  →  $BASE_URL"
echo "  Results: $RESULT_FILE"
echo ""

k6 run \
  -e BASE_URL="$BASE_URL" \
  -e OLLAMA_URL="$OLLAMA_URL" \
  -e OLLAMA_MODEL="$OLLAMA_MODEL" \
  --out "json=$RESULT_FILE" \
  "$DIR/${SCRIPT}.js"
