#!/usr/bin/env bash
# deploy/check-services.sh
# Run on the VPS to verify all HealthCompass services are up and responding.
# Usage: bash deploy/check-services.sh

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

FAILURES=0
WARNINGS=0

pass() { printf "  ${GREEN}✓${NC}  %-40s ${GREEN}OK${NC}  — %s\n" "$1" "$2"; }
fail() { printf "  ${RED}✗${NC}  %-40s ${RED}DOWN${NC}  — %s\n" "$1" "$2"; FAILURES=$((FAILURES + 1)); }
warn() { printf "  ${YELLOW}⚠${NC}  %-40s ${YELLOW}WARN${NC}  — %s\n" "$1" "$2"; WARNINGS=$((WARNINGS + 1)); }
header() { echo -e "\n${BOLD}── $1 ──${NC}"; }

container_running() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^$1$"
}

container_uptime() {
  docker ps --filter "name=^$1$" --format '{{.Status}}' 2>/dev/null
}

restart_count() {
  docker inspect --format='{{.RestartCount}}' "$1" 2>/dev/null || echo "0"
}

# Get first IP of a container across all its networks — reachable from the host
container_ip() {
  docker inspect -f \
    '{{range .NetworkSettings.Networks}}{{if .IPAddress}}{{.IPAddress}} {{end}}{{end}}' \
    "$1" 2>/dev/null | awk '{print $1}'
}

# HTTP check from host using container's bridge IP — no exec into container needed
http_check() {
  local container=$1 port=$2 path=${3:-/}
  local ip
  ip=$(container_ip "$container") || true
  [[ -z "$ip" ]] && return 1
  curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://${ip}:${port}${path}" 2>/dev/null
}

echo ""
echo -e "${BOLD}HealthCompass Service Health Check${NC}"
echo "$(date '+%Y-%m-%d %H:%M:%S %Z')"

# ── Container Status ──────────────────────────────────────────────────────────
header "Container Status"

declare -A SERVICES=(
  ["healthcompass-proxy"]="Traefik (reverse proxy)"
  ["healthcompass-app"]="Next.js App"
  ["healthcompass-ollama"]="Ollama (AI inference)"
  ["healthcompass-whisper"]="Whisper ASR (voice)"
  ["openobserve"]="OpenObserve (logs/metrics)"
  ["healthcompass-vector"]="Vector (log collector)"
  ["healthcompass-mcp"]="MCP Server"
)

CONTAINER_ORDER=(
  healthcompass-proxy
  healthcompass-app
  healthcompass-ollama
  healthcompass-whisper
  openobserve
  healthcompass-vector
  healthcompass-mcp
)

for name in "${CONTAINER_ORDER[@]}"; do
  label="${SERVICES[$name]}"
  if container_running "$name"; then
    uptime=$(container_uptime "$name")
    restarts=$(restart_count "$name")
    if [[ "$restarts" -ge 5 ]]; then
      warn "$label ($name)" "$uptime — restarts: $restarts"
    else
      pass "$label ($name)" "$uptime"
    fi
  else
    if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
      state=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null)
      exit_code=$(docker inspect --format='{{.State.ExitCode}}' "$name" 2>/dev/null)
      fail "$label ($name)" "state=$state exit_code=$exit_code"
    else
      fail "$label ($name)" "container not found"
    fi
  fi
done

# ── Functional Checks ─────────────────────────────────────────────────────────
header "Functional Checks"

# Traefik — host-bound ports 80 and 443
if container_running "healthcompass-proxy"; then
  code=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" http://localhost:80/ 2>/dev/null || echo "000")
  if [[ "$code" =~ ^[23] ]]; then
    pass "Traefik HTTP :80" "HTTP $code (redirecting to HTTPS)"
  else
    fail "Traefik HTTP :80" "HTTP $code"
  fi

  # 404 is OK here — Traefik is up but 'localhost' doesn't match any router rule
  # (all routers are keyed on your domain name). Any non-000 response means TLS works.
  code=$(curl -sk --max-time 5 -o /dev/null -w "%{http_code}" https://localhost:443/ 2>/dev/null || echo "000")
  if [[ "$code" != "000" ]]; then
    pass "Traefik HTTPS :443" "HTTP $code (TLS active; 404 is normal for localhost)"
  else
    fail "Traefik HTTPS :443" "no response — TLS may be broken"
  fi
fi

# Next.js App — port 3000 via container IP
if container_running "healthcompass-app"; then
  code=$(http_check "healthcompass-app" 3000 "/" || echo "000")
  if [[ "$code" =~ ^[23] ]]; then
    pass "Next.js App :3000" "HTTP $code"
  else
    fail "Next.js App :3000" "HTTP $code"
  fi
fi

# Ollama — port 11434 via container IP + model count
if container_running "healthcompass-ollama"; then
  code=$(http_check "healthcompass-ollama" 11434 "/" || echo "000")
  if [[ "$code" =~ ^[2] ]]; then
    models=$(docker exec healthcompass-ollama ollama list 2>/dev/null | tail -n +2 | grep -c '.' || echo "0")
    if [[ "$models" -gt 0 ]]; then
      pass "Ollama :11434" "$models model(s) available"
    else
      warn "Ollama :11434" "port open but no models pulled yet"
    fi
  else
    fail "Ollama :11434" "HTTP $code"
  fi
fi

# Whisper ASR — port 9000 via container IP (root returns empty body — any response is OK)
if container_running "healthcompass-whisper"; then
  ip=$(container_ip "healthcompass-whisper") || true
  if [[ -n "$ip" ]]; then
    code=$(curl -s --max-time 8 -o /dev/null -w "%{http_code}" "http://${ip}:9000/" 2>/dev/null || echo "000")
    if [[ "$code" != "000" ]]; then
      pass "Whisper ASR :9000" "HTTP $code (model ready)"
    else
      warn "Whisper ASR :9000" "no response — may still be loading model (can take 2-3 min)"
    fi
  else
    fail "Whisper ASR :9000" "could not get container IP"
  fi
fi

# OpenObserve — /healthz via container IP
if container_running "openobserve"; then
  ip=$(container_ip "openobserve") || true
  if [[ -n "$ip" ]]; then
    healthz=$(curl -s --max-time 5 "http://${ip}:5080/healthz" 2>/dev/null || echo "")
    if [[ -n "$healthz" ]]; then
      pass "OpenObserve :5080" "$healthz"
    else
      code=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://${ip}:5080/" 2>/dev/null || echo "000")
      if [[ "$code" != "000" ]]; then
        pass "OpenObserve :5080" "HTTP $code"
      else
        fail "OpenObserve :5080" "no response"
      fi
    fi
  else
    fail "OpenObserve :5080" "could not get container IP"
  fi
fi

# Vector — no HTTP endpoint; check restarts + recent error lines in logs
if container_running "healthcompass-vector"; then
  restarts=$(restart_count "healthcompass-vector")
  recent_errors=$(docker logs healthcompass-vector --since 10m 2>&1 | grep -ci "error\|panic\|failed" || true)
  if [[ "$restarts" -ge 3 ]]; then
    warn "Vector log collector" "restart count: $restarts — run: docker logs healthcompass-vector"
  elif [[ "$recent_errors" -gt 5 ]]; then
    warn "Vector log collector" "$recent_errors error lines in last 10m"
  else
    pass "Vector log collector" "running, $recent_errors error lines in last 10m"
  fi
fi

# MCP Server — port 3001 via container IP
if container_running "healthcompass-mcp"; then
  code=$(http_check "healthcompass-mcp" 3001 "/" || echo "000")
  if [[ "$code" != "000" ]]; then
    pass "MCP Server :3001" "HTTP $code"
  else
    fail "MCP Server :3001" "no response"
  fi
fi

# ── Resource Usage ────────────────────────────────────────────────────────────
header "Resource Usage"

docker stats --no-stream \
  --format "  {{printf \"%-35s\" .Name}}  CPU: {{printf \"%6s\" .CPUPerc}}  RAM: {{.MemUsage}}" \
  "${CONTAINER_ORDER[@]}" 2>/dev/null || true

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}── Summary ──${NC}"

if [[ "$FAILURES" -eq 0 && "$WARNINGS" -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}All services healthy.${NC}"
elif [[ "$FAILURES" -eq 0 ]]; then
  echo -e "  ${YELLOW}${BOLD}$WARNINGS warning(s). No failures.${NC}"
else
  echo -e "  ${RED}${BOLD}$FAILURES failure(s), $WARNINGS warning(s).${NC}"
  echo ""
  echo "  Tip: docker logs <container-name> --tail 50"
  exit 1
fi

echo ""
