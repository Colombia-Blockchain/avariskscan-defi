# Registro en Avalanche Mainnet

## ¿Por qué registrar en Mainnet?

El scanner ERC-8004 (https://www.erc-8004scan.xyz) probablemente indexa:
- ✅ Avalanche **Mainnet**
- ❌ Avalanche Fuji **Testnet** (donde estás ahora)

Para aparecer en el scanner, necesitas registrar en mainnet.

---

## Requisitos

1. **AVAX Real:**
   - ~0.05-0.1 AVAX para gas fees
   - Comprar en exchange y enviar a tu wallet

2. **Wallet:**
   - Mismo: 0x29a45b03F07D1207f2e3ca34c38e7BE5458CE71a
   - O crear una nueva para producción

3. **Mismo Código:**
   - Tu agente ya está funcionando
   - Mismo registration.json URL
   - Sin cambios necesarios

---

## Proceso de Registro

### Opción A: Usar el Skill erc8004-avalanche

```bash
cd /Users/jquiceva/agente_cyber/agent-skills/skills/erc8004-avalanche

# Configurar para Mainnet
export NETWORK=mainnet
export PRIVATE_KEY="tu_clave_privada"
export AVALANCHE_RPC_URL="https://api.avax.network/ext/bc/C/rpc"

# Registrar
./scripts/register.sh "https://avariskscan-defi-production.up.railway.app/registration.json"
```

### Opción B: Usar Cast (Foundry)

```bash
# 1. Configurar RPC
export RPC_URL="https://api.avax.network/ext/bc/C/rpc"

# 2. Registrar agente
cast send 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 \
  "register(string)" \
  "https://avariskscan-defi-production.up.railway.app/registration.json" \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

# 3. Obtener el agentId del evento
cast logs \
  --address 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 \
  --from-block latest \
  --rpc-url $RPC_URL
```

---

## Después del Registro

### 1. Actualizar registration.json

```json
{
  "registrations": [
    {
      "agentId": 15,
      "agentRegistry": "eip155:43113:0x8004A818BFB912233c491871b3d84c89A494BD9e"
    },
    {
      "agentId": NEW_MAINNET_ID,
      "agentRegistry": "eip155:43114:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    }
  ]
}
```

### 2. Actualizar .well-known/agent-registration.json

```json
{
  "registrations": [
    {
      "agentId": NEW_MAINNET_ID,
      "agentRegistry": "eip155:43114:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    }
  ]
}
```

### 3. Desplegar cambios

```bash
git add registration.json .well-known/agent-registration.json
git commit -m "feat: add Avalanche Mainnet registration"
git push origin main
```

### 4. Verificar en Scanner

Esperar 5-10 minutos y buscar en:
https://www.erc-8004scan.xyz/scanner

Por:
- Agent ID: (el nuevo de mainnet)
- Nombre: AvaRisk DeFi
- Network: Avalanche Mainnet

---

## Costos Estimados

```
Registration TX: ~0.01-0.03 AVAX
Set metadata (opcional): ~0.005 AVAX
Buffer: ~0.02 AVAX

Total recomendado: 0.05-0.1 AVAX
```

---

## Ventajas de Mainnet

1. ✅ Visible en scanner ERC-8004
2. ✅ Producción real (no testnet)
3. ✅ Mayor credibilidad
4. ✅ Pagos x402 reales
5. ✅ Ecosistema más activo

---

## Mantener Ambos Registros

Puedes tener el agente registrado en **ambas redes**:

- **Fuji Testnet:** Para testing y desarrollo
- **Mainnet:** Para producción y visibilidad

Ambos apuntando al mismo endpoint:
```
https://avariskscan-defi-production.up.railway.app/
```

---

## Siguiente Paso

1. Obtener ~0.1 AVAX en mainnet
2. Ejecutar script de registro
3. Actualizar archivos JSON
4. Verificar en scanner

**¿Necesitas ayuda con algún paso específico?**
