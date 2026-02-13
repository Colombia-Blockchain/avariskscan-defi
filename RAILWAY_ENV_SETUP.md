# Configuración de Variables de Entorno en Railway

## Pasos para configurar

1. Ve a tu proyecto en Railway: https://railway.app
2. Selecciona el servicio `avariskscan-defi`
3. Ve a la pestaña **Variables**
4. Añade las siguientes variables:

## Variables Requeridas

```bash
# Avalanche RPC
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# Wallet (para x402 payments)
PRIVATE_KEY=your_private_key_here
WALLET_ADDRESS=your_wallet_address_here

# Anthropic API (para análisis de IA con Claude)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# APIs DeFi (opcional, para análisis profundo)
# COVALENT_API_KEY=tu_covalent_key_aqui
# SNOWTRACE_API_KEY=tu_snowtrace_key_aqui
```

## ⚠️ IMPORTANTE - Seguridad

**DESPUÉS de añadir estas variables a Railway:**

1. **ROTA la ANTHROPIC_API_KEY**:
   - Ve a https://console.anthropic.com/settings/keys
   - Elimina la key actual
   - Crea una nueva key
   - Actualiza Railway con la nueva key

2. **ROTA la PRIVATE_KEY** (recomendado para producción):
   - Crea una nueva wallet en Avalanche Fuji
   - Fondea la nueva wallet con AVAX de https://faucet.avax.network/
   - Actualiza las variables en Railway

3. **Nunca compartas** estas keys en texto plano

## Después de configurar

1. Railway automáticamente re-desplegará el servicio
2. Espera 1-2 minutos a que el deployment termine
3. Verifica que todo funcione:

```bash
# Test x402 info (debe mostrar wallet info, no error)
curl https://avariskscan-defi-production.up.railway.app/x402/info

# Test health check
curl https://avariskscan-defi-production.up.railway.app/
```

## Siguiente paso

Una vez configurado y verificado, proceder con:
- **Paso 2**: Probar el agente localmente
- **Paso 3**: Registrar el agente en ERC-8004
