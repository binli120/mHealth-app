#!/usr/bin/env bash
# Recovery script for HealthCompass VPS
# Run from the app directory: sudo bash scripts/recover.sh

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/.env.production.local"
OO_DIR="/root/openobserver"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; exit 1; }

echo "========================================"
echo " HealthCompass VPS Recovery"
echo "========================================"

# ── 1. Verify env file ────────────────────────────────────────────────────────
[ -f "$ENV_FILE" ] || fail ".env.production.local not found at $APP_DIR"
ok "Env file found"

cd "$APP_DIR"

# ── 2. Stop services that conflict with ports 80/443 ─────────────────────────
for svc in caddy nginx apache2; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    warn "$svc is running on ports 80/443 — stopping and disabling..."
    systemctl stop "$svc"
    systemctl disable "$svc"
    ok "$svc stopped"
  fi
done

# ── 3. Check if ports 80/443 are still occupied by a non-Docker process ───────
for port in 80 443; do
  occupant=$(ss -tlnp | awk -F'[, "]+' "/\:$port / && !/docker-proxy/ {print \$NF}" | head -1)
  if [ -n "$occupant" ]; then
    fail "Port $port is still held by: $occupant — free it manually and re-run"
  fi
done
ok "Ports 80 and 443 are free"

# ── 4. Restart Docker if ports 80/443 have no docker-proxy yet ───────────────
ports_bound=$(ss -tlnp | grep -cE ':(80|443).*docker-proxy' || true)
if [ "$ports_bound" -lt 2 ]; then
  warn "Docker port proxy not running — restarting Docker daemon (briefly stops all containers)..."
  systemctl restart docker
  sleep 5
  ok "Docker restarted"
else
  ok "Docker port proxy already running"
fi

# ── 5. Start OpenObserve ─────────────────────────────────────────────────────
if [ -d "$OO_DIR" ]; then
  echo "▶ Starting OpenObserve..."
  docker compose -f "$OO_DIR/docker-compose.yml" up -d --remove-orphans
  # Wait briefly and verify it's listening on 5080
  sleep 3
  if ss -tlnp | grep -q ":5080"; then
    ok "OpenObserve is up on port 5080"
  else
    warn "OpenObserve may not be listening on 5080 — check: docker logs openobserve"
  fi
else
  warn "OpenObserve directory not found at $OO_DIR — skipping"
fi

# ── 6. Bring up all core services ────────────────────────────────────────────
echo "▶ Starting core services..."
docker compose --env-file "$ENV_FILE" up -d --remove-orphans
ok "Core services started"

# ── 7. Bring up analysis service ─────────────────────────────────────────────
echo "▶ Starting analysis service..."
docker compose --env-file "$ENV_FILE" --profile analysis up -d masshealth-analysis
ok "Analysis service started"

# ── 8. Verify Vector env vars are populated ───────────────────────────────────
if docker ps --format '{{.Names}}' | grep -q "healthcompass-vector"; then
  oo_url=$(docker exec healthcompass-vector env 2>/dev/null | grep "^OPENOBSERVE_URL=" | cut -d= -f2)
  if [ -z "$oo_url" ]; then
    warn "Vector OPENOBSERVE_URL is empty — check OPENOBSERVE_* vars in $ENV_FILE"
  else
    ok "Vector is configured to ship logs to $oo_url"
  fi
fi

# ── 9. Verify ports 80/443 are now listening ─────────────────────────────────
sleep 3
for port in 80 443; do
  ss -tlnp | grep -q ":$port" || fail "Port $port still not listening after startup"
done
ok "Ports 80 and 443 are listening"

# ── 10. Health check ─────────────────────────────────────────────────────────
echo "⏳ Waiting for app to be healthy (up to 2 min)..."
for i in $(seq 1 24); do
  if docker exec healthcompass-app node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    > /dev/null 2>&1; then
    ok "App is healthy after $((i * 5))s"
    break
  fi
  echo "  attempt $i/24..."
  if [ "$i" = "24" ]; then
    echo "Last 50 app log lines:" >&2
    docker compose --env-file "$ENV_FILE" logs --tail=50 app >&2
    fail "App did not become healthy in time"
  fi
  sleep 5
done

# ── 11. Summary ──────────────────────────────────────────────────────────────
echo ""
echo "========================================"
docker compose --env-file "$ENV_FILE" ps
echo "========================================"
ok "Recovery complete — https://healthcompass.cloud should be up"
echo ""
echo "  OpenObserve: http://healthcompass.cloud:5080"
echo "  App logs stream: containers-prod"
echo "  App traces stream: mhealth-app"
