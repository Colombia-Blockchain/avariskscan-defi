#!/usr/bin/env bash
set -euo pipefail

# Script de validación completa del agente AvaRisk DeFi

AGENT_URL="${AGENT_URL:-https://avariskscan-defi-production.up.railway.app}"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     AvaRisk DeFi - Validación Completa del Agente        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}URL del agente:${NC} $AGENT_URL"
echo ""

# Contador de tests
PASSED=0
FAILED=0
TOTAL=0

test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_code="$4"
  local data="${5:-}"

  TOTAL=$((TOTAL + 1))
  echo -n "[$TOTAL] $name ... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s -o /dev/null -w "%{http_code}" "$AGENT_URL$path" 2>/dev/null)
  else
    response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$AGENT_URL$path" \
      -H "Content-Type: application/json" \
      -d "$data" 2>/dev/null)
  fi

  if [ "$response" -eq "$expected_code" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $response, esperado $expected_code)"
    FAILED=$((FAILED + 1))
  fi
}

echo -e "${BLUE}═══ Endpoints Core ═══${NC}"
test_endpoint "Health Check" "GET" "/" 200
test_endpoint "Registration JSON" "GET" "/registration.json" 200
test_endpoint "A2A Agent Card" "GET" "/.well-known/agent-card.json" 200
test_endpoint "Discover Agents" "GET" "/agents/discover" 200
test_endpoint "x402 Info" "GET" "/x402/info" 200
echo ""

echo -e "${BLUE}═══ Endpoints DeFi ═══${NC}"
test_endpoint "Dashboard HTML" "GET" "/dashboard" 200
test_endpoint "Avalanche Metrics" "GET" "/defi/avalanche" 200
test_endpoint "Token Analysis" "GET" "/defi/token/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7?network=mainnet" 200
test_endpoint "Protocol Analysis" "GET" "/defi/protocol/aave-v3" 200
echo ""

echo -e "${BLUE}═══ Endpoints Protegidos ═══${NC}"
test_endpoint "x402 Protected Endpoint" "POST" "/a2a/research" 402 '{"type":"token","address":"0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"}'
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Resultados:${NC}"
echo -e "  ${GREEN}✓ Pasaron:${NC} $PASSED/$TOTAL"
echo -e "  ${RED}✗ Fallaron:${NC} $FAILED/$TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 ¡Todos los tests pasaron! El agente está completamente funcional.${NC}"
  EXIT_CODE=0
else
  echo -e "${YELLOW}⚠️  Algunos tests fallaron. Verifica el deployment en Railway.${NC}"
  EXIT_CODE=1
fi

echo ""
echo -e "${BLUE}═══ Datos de Ejemplo ═══${NC}"
echo ""

echo -e "${YELLOW}Health Check:${NC}"
curl -s "$AGENT_URL/" | jq '.' 2>/dev/null || echo "Error al obtener datos"
echo ""

echo -e "${YELLOW}Métricas de Avalanche:${NC}"
curl -s "$AGENT_URL/defi/avalanche" 2>/dev/null | jq '.metrics | {totalTVL, protocolCount, topProtocols: .topProtocols[:3]}' 2>/dev/null || echo "⚠️  Endpoint no disponible aún"
echo ""

echo -e "${YELLOW}x402 Info:${NC}"
curl -s "$AGENT_URL/x402/info" | jq '.facilitator, .agent' 2>/dev/null || echo "Error al obtener datos"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}🔗 Links importantes:${NC}"
echo "  • Agente: $AGENT_URL"
echo "  • Dashboard: $AGENT_URL/dashboard"
echo "  • Scanner ERC-8004: https://www.erc-8004scan.xyz/scanner"
echo "  • TX Registro: https://testnet.snowtrace.io/tx/0x2967a4574eb72b6742c72a1fb815a958492c392663e7db9c56b671afb6e7f02e"
echo "  • Repositorio: https://github.com/Colombia-Blockchain/avariskscan-defi"
echo ""

exit $EXIT_CODE
