#!/bin/bash

echo "=================================================="
echo "  REGISTRO DE AGENTE EN AVALANCHE MAINNET"
echo "=================================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración
REGISTRY_MAINNET="0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
RPC_MAINNET="https://api.avax.network/ext/bc/C/rpc"
AGENT_URI="https://avariskscan-defi-production.up.railway.app/registration.json"

echo -e "${YELLOW}📋 INFORMACIÓN DEL REGISTRO${NC}"
echo "Registry Contract: $REGISTRY_MAINNET"
echo "RPC URL: $RPC_MAINNET"
echo "Agent URI: $AGENT_URI"
echo ""

# Verificar que existe PRIVATE_KEY
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}❌ ERROR: PRIVATE_KEY no está configurada${NC}"
    echo ""
    echo "Configúrala así:"
    echo "  export PRIVATE_KEY=\"tu_clave_privada_sin_0x\""
    echo ""
    exit 1
fi

echo -e "${YELLOW}🔑 Private Key: Configurada ✓${NC}"
echo ""

# Verificar que existe cast (Foundry)
if ! command -v cast &> /dev/null; then
    echo -e "${RED}❌ ERROR: 'cast' (Foundry) no está instalado${NC}"
    echo ""
    echo "Instálalo así:"
    echo "  curl -L https://foundry.paradigm.xyz | bash"
    echo "  foundryup"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Foundry (cast) instalado${NC}"
echo ""

# Verificar balance de AVAX
echo -e "${YELLOW}💰 Verificando balance de AVAX...${NC}"
WALLET_ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)
BALANCE=$(cast balance $WALLET_ADDRESS --rpc-url $RPC_MAINNET)
BALANCE_AVAX=$(cast --to-unit $BALANCE ether)

echo "Wallet: $WALLET_ADDRESS"
echo "Balance: $BALANCE_AVAX AVAX"
echo ""

# Verificar que tiene suficiente AVAX (mínimo 0.05)
MIN_BALANCE="50000000000000000" # 0.05 AVAX en wei
if [ "$BALANCE" -lt "$MIN_BALANCE" ]; then
    echo -e "${RED}❌ ERROR: Balance insuficiente${NC}"
    echo "Necesitas al menos 0.05 AVAX para el registro"
    echo "Balance actual: $BALANCE_AVAX AVAX"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Balance suficiente${NC}"
echo ""

# Confirmar antes de proceder
echo -e "${YELLOW}⚠️  CONFIRMACIÓN REQUERIDA${NC}"
echo ""
echo "Estás a punto de registrar en MAINNET (red de producción)"
echo "Esto costará ~0.01-0.03 AVAX en gas fees"
echo ""
read -p "¿Deseas continuar? (sí/no): " CONFIRM

if [ "$CONFIRM" != "sí" ] && [ "$CONFIRM" != "si" ]; then
    echo ""
    echo "❌ Registro cancelado"
    exit 0
fi

echo ""
echo -e "${YELLOW}🚀 Registrando agente en mainnet...${NC}"
echo ""

# Ejecutar registro
TX_HASH=$(cast send $REGISTRY_MAINNET \
    "register(string)" \
    "$AGENT_URI" \
    --private-key $PRIVATE_KEY \
    --rpc-url $RPC_MAINNET \
    --json | jq -r '.transactionHash')

if [ -z "$TX_HASH" ] || [ "$TX_HASH" = "null" ]; then
    echo -e "${RED}❌ ERROR: Registro falló${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Transacción enviada${NC}"
echo "TX Hash: $TX_HASH"
echo ""

echo -e "${YELLOW}⏳ Esperando confirmación...${NC}"
sleep 10

# Obtener el agentId del evento
echo -e "${YELLOW}🔍 Obteniendo Agent ID...${NC}"

# Obtener el receipt de la transacción
RECEIPT=$(cast receipt $TX_HASH --rpc-url $RPC_MAINNET --json)
AGENT_ID_HEX=$(echo $RECEIPT | jq -r '.logs[0].topics[3]')
AGENT_ID=$(printf "%d" $AGENT_ID_HEX)

echo ""
echo -e "${GREEN}=================================================="
echo "  ✅ REGISTRO EXITOSO"
echo "==================================================${NC}"
echo ""
echo "Agent ID: $AGENT_ID"
echo "Registry: $REGISTRY_MAINNET"
echo "TX Hash: $TX_HASH"
echo ""
echo "Snowtrace:"
echo "  https://snowtrace.io/tx/$TX_HASH"
echo ""
echo -e "${YELLOW}📝 PRÓXIMOS PASOS:${NC}"
echo ""
echo "1. Actualiza registration.json con el nuevo agentId"
echo "2. Actualiza .well-known/agent-registration.json"
echo "3. Haz commit y push a GitHub"
echo "4. Espera 5-10 minutos"
echo "5. Busca en https://www.erc-8004scan.xyz/scanner"
echo ""
echo -e "${GREEN}¡Tu agente está ahora en MAINNET!${NC}"
echo ""
