#!/usr/bin/env bash
set -euo pipefail

# Script de prueba para AvaRisk DeFi Agent

AGENT_URL="${AGENT_URL:-https://avariskscan-defi-production.up.railway.app}"

echo "==================================================================="
echo "  AvaRisk DeFi - Test Suite"
echo "==================================================================="
echo ""
echo "Agent URL: $AGENT_URL"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="$4"

  echo -e "${YELLOW}Testing: $name${NC}"

  if [ "$method" = "GET" ]; then
    response=$(curl -s -o /dev/null -w "%{http_code}" "$AGENT_URL$path")
  else
    response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$AGENT_URL$path" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  if [ "$response" -eq 200 ] || [ "$response" -eq 402 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
  fi
  echo ""
}

# Test 1: Health Check
test_endpoint "Health Check" "GET" "/" ""

# Test 2: Registration JSON
test_endpoint "Registration JSON" "GET" "/registration.json" ""

# Test 3: A2A Agent Card
test_endpoint "A2A Agent Card" "GET" "/.well-known/agent-card.json" ""

# Test 4: x402 Protected Endpoint (debería dar 402 sin pago)
test_endpoint "x402 Protected Endpoint" "POST" "/a2a/research" '{"type":"token","address":"0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"}'

echo "==================================================================="
echo "  Detailed Response Tests"
echo "==================================================================="
echo ""

# Health Check Response
echo -e "${YELLOW}1. Health Check Response:${NC}"
curl -s "$AGENT_URL/" | jq '.'
echo ""

# Registration JSON Response
echo -e "${YELLOW}2. Registration JSON (first 10 lines):${NC}"
curl -s "$AGENT_URL/registration.json" | jq '.' | head -20
echo ""

# A2A Agent Card Response
echo -e "${YELLOW}3. A2A Agent Card:${NC}"
curl -s "$AGENT_URL/.well-known/agent-card.json" | jq '.name, .description' | head -5
echo ""

echo "==================================================================="
echo "  Test Complete"
echo "==================================================================="
echo ""
echo "🔗 Links:"
echo "   • Agent URL: $AGENT_URL"
echo "   • Scanner: https://www.erc-8004scan.xyz/scanner"
echo "   • Repo: https://github.com/Colombia-Blockchain/avariskscan-defi"
echo "   • TX: https://testnet.snowtrace.io/tx/0x2967a4574eb72b6742c72a1fb815a958492c392663e7db9c56b671afb6e7f02e"
echo ""
