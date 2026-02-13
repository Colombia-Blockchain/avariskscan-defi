# APIs DeFi Integradas

AvaRisk DeFi integra múltiples APIs para análisis profundo de riesgo DeFi.

## APIs Soportadas

### 1. DeFiLlama (Sin API Key)

**Qué proporciona:**
- TVL de protocolos y cadenas
- Rankings de protocolos
- Cambios históricos de TVL
- Categorías de protocolos

**Endpoints que usan DeFiLlama:**
- `GET /defi/avalanche` - Métricas de Avalanche
- `GET /defi/protocol/:name` - Análisis de protocolo

**Ejemplo:**
```bash
# Métricas de Avalanche
curl https://avariskscan-defi-production.up.railway.app/defi/avalanche

# Analizar Trader Joe
curl https://avariskscan-defi-production.up.railway.app/defi/protocol/traderjoe
```

---

### 2. Covalent (Requiere API Key)

**Qué proporciona:**
- Lista de holders de tokens
- Balances de tokens
- Transacciones históricas
- NFTs y contratos

**Obtener API Key:**
1. Ve a https://www.covalenthq.com/
2. Crea una cuenta gratis
3. Obtén tu API key del dashboard
4. Añádela al `.env`: `COVALENT_API_KEY=tu_key`

**Endpoint que usa Covalent:**
- `GET /defi/token/:address` - Análisis profundo de token

**Ejemplo:**
```bash
# Analizar token con datos de holders
curl https://avariskscan-defi-production.up.railway.app/defi/token/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7?network=mainnet
```

---

### 3. Snowtrace (Requiere API Key)

**Qué proporciona:**
- Código fuente de contratos verificados
- ABI de contratos
- Información de compilación
- Detección de proxies

**Obtener API Key:**
1. Ve a https://snowtrace.io/myapikey
2. Inicia sesión con tu wallet
3. Crea un API key gratis
4. Añádela al `.env`: `SNOWTRACE_API_KEY=tu_key`

**Endpoint que usa Snowtrace:**
- `GET /defi/token/:address` - Verifica contratos

**Ejemplo:**
```bash
# Ver si un contrato está verificado
curl https://avariskscan-defi-production.up.railway.app/defi/token/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7
```

---

## Nuevos Endpoints

### GET /defi/avalanche

Obtiene métricas generales de Avalanche DeFi.

**Respuesta:**
```json
{
  "success": true,
  "network": "Avalanche",
  "metrics": {
    "totalTVL": "$850.5M",
    "protocolCount": 156,
    "topProtocols": [
      {
        "name": "Trader Joe",
        "tvl": "$120.5M",
        "category": "Dexes"
      },
      ...
    ]
  }
}
```

---

### GET /defi/token/:address

Análisis profundo de un token usando múltiples APIs.

**Parámetros:**
- `address` - Dirección del token (path)
- `network` - `mainnet` o `fuji` (query, default: mainnet)

**Respuesta:**
```json
{
  "success": true,
  "analysis": {
    "address": "0x...",
    "network": "mainnet",
    "verified": true,
    "contract": {
      "name": "WrappedAVAX",
      "compiler": "v0.8.0",
      "optimized": true,
      "license": "MIT",
      "isProxy": false
    },
    "holders": {
      "count": 1523,
      "top10": [...]
    },
    "concentration": {
      "top10Percentage": 45.2,
      "riskLevel": "low"
    }
  }
}
```

---

### GET /defi/protocol/:name

Analiza un protocolo DeFi en Avalanche.

**Parámetros:**
- `name` - Nombre del protocolo (ej: traderjoe, aave, curve)

**Respuesta:**
```json
{
  "success": true,
  "protocol": "traderjoe",
  "analysis": {
    "found": true,
    "tvl": 120500000,
    "chain": "Avalanche",
    "changes": {
      "1h": 0.5,
      "1d": -2.3,
      "7d": 5.1
    }
  }
}
```

---

## Configuración de API Keys

### Variables de Entorno

Añade en tu archivo `.env`:

```bash
# Opcional: Análisis avanzado de holders
COVALENT_API_KEY=cqt_...

# Opcional: Verificación de contratos
SNOWTRACE_API_KEY=...
```

**Nota:** DeFiLlama no requiere API key. Covalent y Snowtrace son opcionales pero recomendados para análisis más completos.

---

## Ejemplos de Uso

### Analizar Wrapped AVAX

```bash
curl https://avariskscan-defi-production.up.railway.app/defi/token/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7
```

### Ver TVL de Avalanche

```bash
curl https://avariskscan-defi-production.up.railway.app/defi/avalanche
```

### Analizar Trader Joe

```bash
curl https://avariskscan-defi-production.up.railway.app/defi/protocol/traderjoe
```

### Analizar con JavaScript

```javascript
async function analyzeToken(address) {
  const response = await fetch(
    `https://avariskscan-defi-production.up.railway.app/defi/token/${address}`
  );
  const data = await response.json();

  if (data.success) {
    console.log(`Token: ${data.analysis.contract.name}`);
    console.log(`Holders: ${data.analysis.holders.count}`);
    console.log(`Risk: ${data.analysis.concentration.riskLevel}`);
  }
}

analyzeToken('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7');
```

---

## Límites y Rate Limiting

| API | Rate Limit | Costo |
|-----|-----------|-------|
| **DeFiLlama** | Sin límite oficial | Gratis |
| **Covalent** | 100,000 req/mes (tier gratis) | Gratis |
| **Snowtrace** | 5 req/segundo | Gratis |

---

## Proxies Pasos

1. **Sin API keys**: Solo funcionan métricas de Avalanche y protocolos (DeFiLlama)
2. **Con Covalent**: Análisis de holders y concentración
3. **Con Snowtrace**: Verificación de contratos y código fuente
4. **Con ambos**: Análisis completo con todos los datos

---

## Troubleshooting

### "Token analysis incomplete"
- Falta Covalent API key
- Token no tiene holders suficientes
- Red incorrecta (usa `network=fuji` para testnet)

### "Contract not verified"
- El contrato no está verificado en Snowtrace
- Falta Snowtrace API key
- Dirección incorrecta

### "Protocol not found"
- El protocolo no está en DeFiLlama
- Nombre incorrecto (usa lowercase: traderjoe, no TraderJoe)
- El protocolo no tiene presencia en Avalanche
