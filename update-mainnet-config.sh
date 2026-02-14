#!/bin/bash

# Script para actualizar configuración con el agentId de mainnet

if [ -z "$1" ]; then
    echo "❌ Error: Debes proporcionar el agentId"
    echo ""
    echo "Uso:"
    echo "  ./update-mainnet-config.sh <AGENT_ID>"
    echo ""
    echo "Ejemplo:"
    echo "  ./update-mainnet-config.sh 42"
    exit 1
fi

AGENT_ID=$1

echo "=================================================="
echo "  ACTUALIZANDO CONFIGURACIÓN CON MAINNET"
echo "=================================================="
echo ""
echo "Agent ID de Mainnet: $AGENT_ID"
echo ""

# Actualizar registration.json
echo "📝 Actualizando registration.json..."
sed "s/MAINNET_AGENT_ID/$AGENT_ID/g" registration.mainnet.json > registration.json

# Actualizar .well-known/agent-registration.json
echo "📝 Actualizando .well-known/agent-registration.json..."
sed "s/MAINNET_AGENT_ID/$AGENT_ID/g" .well-known/agent-registration.mainnet.json > .well-known/agent-registration.json

echo ""
echo "✅ Archivos actualizados:"
echo "  - registration.json"
echo "  - .well-known/agent-registration.json"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo ""
echo "1. Verifica los cambios:"
echo "   cat registration.json"
echo "   cat .well-known/agent-registration.json"
echo ""
echo "2. Haz commit y push:"
echo "   git add registration.json .well-known/agent-registration.json"
echo "   git commit -m \"feat: add Avalanche Mainnet registration (Agent ID: $AGENT_ID)\""
echo "   git push origin main"
echo ""
echo "3. Railway detectará y desplegará automáticamente"
echo ""
echo "4. Espera 5-10 minutos y verifica en:"
echo "   https://www.erc-8004scan.xyz/scanner"
echo ""
echo "🎉 ¡Listo para deployar a mainnet!"
