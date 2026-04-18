#!/usr/bin/env bash
# Usage:
#   ./benchmark/run.sh smoke
#   ./benchmark/run.sh load
#   ./benchmark/run.sh ollama

set -uo pipefail   # removed -e so errors print instead of silently exit

SCRIPT="${1:-smoke}"
BASE_URL="${BASE_URL:-https://healthcompass.cloud}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check k6 is installed
if ! command -v k6 &>/dev/null; then
  echo "ERROR: k6 is not installed or not in PATH"
  echo "Install with:"
  echo "  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69"
  echo "  echo \"deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main\" | sudo tee /etc/apt/sources.list.d/k6.list"
  echo "  sudo apt-get update && sudo apt-get install k6 -y"
  exit 1
fi

# Check the script file exists
if [ ! -f "$DIR/${SCRIPT}.js" ]; then
  echo "ERROR: benchmark script not found: $DIR/${SCRIPT}.js"
  echo "Available scripts: $(ls "$DIR"/*.js 2>/dev/null | xargs -n1 basename | sed 's/.js//' | tr '\n' ' ')"
  exit 1
fi

mkdir -p "$DIR/results"
RESULT_FILE="$DIR/results/${SCRIPT}-$(date +%Y%m%d-%H%M%S).json"

echo "========================================"
echo " k6 benchmark: $SCRIPT"
echo " target:  $BASE_URL"
echo " results: $RESULT_FILE"
echo "========================================"
echo ""

k6 run \
  -e BASE_URL="$BASE_URL" \
  -e OLLAMA_URL="$OLLAMA_URL" \
  -e OLLAMA_MODEL="$OLLAMA_MODEL" \
  --out "json=$RESULT_FILE" \
  "$DIR/${SCRIPT}.js"

EXIT=$?
echo ""
if [ $EXIT -eq 0 ]; then
  echo "✓ Done. Results saved to: $RESULT_FILE"
else
  echo "✗ k6 exited with code $EXIT (thresholds may have failed — check output above)"
fi
exit $EXIT
