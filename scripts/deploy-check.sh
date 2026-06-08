#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo -e "  ${GREEN}PASS${NC} ${name}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} ${name}"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== AniMatch Deployment Check ==="
echo ""

# 1. Check .env.production
echo "[1] Environment"
check ".env.production exists" test -f /opt/Animatch/animatch/.env.production

# 2. Check docker / docker compose
check "docker available" docker --version > /dev/null 2>&1
check "docker compose available" docker compose version > /dev/null 2>&1

# 3. Check compose ps
echo ""
echo "[2] Containers"
cd /opt/Animatch/animatch
COMPOSE_CMD="docker compose --env-file .env.production -f docker-compose.prod.yml"

check "postgres running" $COMPOSE_CMD ps postgres 2>/dev/null | grep -q "Up\|healthy"
check "app running" $COMPOSE_CMD ps app 2>/dev/null | grep -q "Up"

# 4. Check prisma migrate status
echo ""
echo "[3] Database"
check "prisma migrate status" $COMPOSE_CMD exec -T app pnpm prisma migrate status 2>/dev/null | grep -q "Database schema is up to date"

# 5. Check /api/health
echo ""
echo "[4] Health check"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  check "/api/health (HTTP $HTTP_CODE)" true
else
  check "/api/health (HTTP $HTTP_CODE)" false
fi

# 6. Check /api/pools
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/pools 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  check "/api/pools (HTTP $HTTP_CODE)" true
else
  check "/api/pools (HTTP $HTTP_CODE)" false
fi

echo ""
echo "=== Summary: ${PASS} passed, ${FAIL} failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
