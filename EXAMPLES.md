# AvaRisk DeFi - Ejemplos de Uso

## Endpoints Públicos

### 1. Health Check
```bash
curl https://avariskscan-defi-production.up.railway.app/
```

**Respuesta:**
```json
{
  "status": "ok",
  "agent": "AvaRisk DeFi",
  "version": "0.1.0",
  "x402": true
}
```

---

### 2. Registration JSON (ERC-8004)
```bash
curl https://avariskscan-defi-production.up.railway.app/registration.json
```

**Respuesta:**
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "AvaRisk DeFi",
  "description": "Evaluador de riesgo DeFi en Avalanche...",
  ...
}
```

---

### 3. A2A Agent Card
```bash
curl https://avariskscan-defi-production.up.railway.app/.well-known/agent-card.json
```

---

## Endpoint de Análisis de Riesgo (x402 protegido)

### POST /a2a/research

**Nota:** Este endpoint requiere pago x402 ($0.01 en Base Sepolia).

#### Ejemplo 1: Análisis de Token

```bash
curl -X POST https://avariskscan-defi-production.up.railway.app/a2a/research \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer x402_token_here" \
  -d '{
    "type": "token",
    "address": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    "network": "mainnet"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "agent": "AvaRisk DeFi",
  "timestamp": "2026-02-13T17:00:00.000Z",
  "request": {
    "type": "token",
    "address": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    "network": "mainnet"
  },
  "result": {
    "risk_score": 15,
    "risk_level": "low",
    "findings": [
      "Token: Wrapped AVAX (WAVAX)",
      "Decimales: 18",
      "Supply total: 1000000.0",
      "✓ Liquidez adecuada"
    ],
    "recommendations": [
      "Riesgo aceptable, pero siempre verificar por fuentes adicionales"
    ],
    "analysis": "Token bien establecido con liquidez adecuada..."
  }
}
```

---

#### Ejemplo 2: Análisis de Pool DEX

```bash
curl -X POST https://avariskscan-defi-production.up.railway.app/a2a/research \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer x402_token_here" \
  -d '{
    "type": "pool",
    "address": "0x...",
    "dex": "traderjoe",
    "network": "mainnet"
  }'
```

**Parámetros:**
- `type`: `"pool"`
- `address`: Dirección del par de liquidez
- `dex`: `"traderjoe"`, `"pangolin"`, o `"uniswap"`
- `network`: `"mainnet"` o `"fuji"`

---

#### Ejemplo 3: Análisis de Contrato

```bash
curl -X POST https://avariskscan-defi-production.up.railway.app/a2a/research \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer x402_token_here" \
  -d '{
    "type": "contract",
    "address": "0x...",
    "network": "mainnet"
  }'
```

---

#### Ejemplo 4: Análisis de Protocolo

```bash
curl -X POST https://avariskscan-defi-production.up.railway.app/a2a/research \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer x402_token_here" \
  -d '{
    "type": "protocol",
    "address": "0x...",
    "network": "mainnet"
  }'
```

---

## Tokens de Ejemplo en Avalanche

### Mainnet (Chain ID: 43114)

| Token | Address | Descripción |
|-------|---------|-------------|
| WAVAX | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` | Wrapped AVAX |
| USDC | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | USD Coin |
| USDT | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` | Tether USD |
| JOE | `0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd` | TraderJoe Token |

### Fuji Testnet (Chain ID: 43113)

Usa faucets para obtener tokens de prueba:
- https://core.app/tools/testnet-faucet/

---

## DEX Contracts en Avalanche

### Trader Joe (Principal DEX en Avalanche)
- Factory: `0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10`
- Router: `0x60aE616a2155Ee3d9A68541Ba4544862310933d4`

### Pangolin
- Factory: `0xefa94DE7a4656D787667C749f7E1223D71E9FD88`
- Router: `0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106`

---

## Integración con x402

Para interactuar con el endpoint `/a2a/research`, necesitas:

1. **Token x402** del facilitador de UltraVioleta DAO
2. **Pago de $0.01** en Base Sepolia
3. Header `Authorization: Bearer {x402_token}`

Más información: https://github.com/UltraVioletaDAO/x402

---

## Casos de Uso

### 1. Análisis antes de invertir
Verifica un token antes de comprarlo en un DEX:
```bash
curl -X POST .../a2a/research -d '{"type":"token","address":"0x..."}'
```

### 2. Verificación de pool de liquidez
Antes de añadir liquidez a un pool, verifica su seguridad:
```bash
curl -X POST .../a2a/research -d '{"type":"pool","address":"0x...","dex":"traderjoe"}'
```

### 3. Auditoría de contrato
Analiza un contrato inteligente para detectar riesgos:
```bash
curl -X POST .../a2a/research -d '{"type":"contract","address":"0x..."}'
```

---

## Niveles de Riesgo

| Risk Score | Risk Level | Descripción |
|------------|------------|-------------|
| 0-24 | `low` | Riesgo bajo, relativamente seguro |
| 25-49 | `medium` | Riesgo medio, proceder con precaución |
| 50-74 | `high` | Riesgo alto, investigar más |
| 75-100 | `critical` | Riesgo crítico, evitar |

---

## Soporte

- **Repo:** https://github.com/Colombia-Blockchain/avariskscan-defi
- **Scanner:** https://www.erc-8004scan.xyz/scanner
- **TX de registro:** https://testnet.snowtrace.io/tx/0x2967a4574eb72b6742c72a1fb815a958492c392663e7db9c56b671afb6e7f02e
