# Comunicación entre Agentes (A2A)

## Arquitectura x402 en Fuji

Tu agente **AvaRisk DeFi** está configurado para comunicarse con otros agentes usando el protocolo x402.

### Componentes:

```
┌─────────────────┐                  ┌──────────────────┐
│  Tu Agente      │  ────x402───>    │  Otro Agente     │
│  AvaRisk DeFi   │  <───response─   │  (registrado)    │
└─────────────────┘                  └──────────────────┘
         │                                      │
         │ Firma EIP-712                       │ Verifica pago
         ├──────────────────┐                  │
         │                  ▼                  │
         │         ┌──────────────────┐        │
         │         │  Facilitador     │        │
         │         │  x402            │◄───────┘
         │         └──────────────────┘
         │                  │
         │         Ejecuta pago USDC
         ▼                  ▼
  ┌──────────────────────────────┐
  │  USDC Contract (Fuji)        │
  │  0x5425890298aed...           │
  └──────────────────────────────┘
```

---

## Configuración x402

### 1. USDC en Fuji

| Parámetro | Valor |
|-----------|-------|
| **Contrato USDC** | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| **Network** | Avalanche Fuji (Chain ID: 43113) |
| **Faucet** | https://faucet.circle.com/ |
| **Facilitador** | https://facilitator.ultravioletadao.xyz |

### 2. Obtener USDC de prueba

```bash
# 1. Ve al faucet
open https://faucet.circle.com/

# 2. Conecta tu wallet (0x29a45b03F07D1207f2e3ca34c38e7BE5458CE71a)
# 3. Selecciona "Avalanche Fuji"
# 4. Solicita USDC (recibirás 10 USDC testnet)
```

### 3. Verificar balance de USDC

```bash
curl -X POST https://api.avax-test.network/ext/bc/C/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x5425890298aed601595a70AB815c96711a31Bc65",
      "data":"0x70a082310000000000000000000000029a45b03F07D1207f2e3ca34c38e7BE5458CE71a"
    },"latest"],
    "id":1
  }'
```

---

## Descubrir Otros Agentes

### Endpoint público para descubrimiento

```bash
curl https://avariskscan-defi-production.up.railway.app/agents/discover
```

**Respuesta:**
```json
{
  "success": true,
  "registry": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  "network": "avalanche-fuji",
  "agents": 0,
  "agentsList": [],
  "info": "Descubriendo agentes registrados en ERC-8004"
}
```

### Verificar info de x402

```bash
curl https://avariskscan-defi-production.up.railway.app/x402/info
```

**Respuesta:**
```json
{
  "facilitator": {
    "url": "https://facilitator.ultravioletadao.xyz",
    "healthy": true
  },
  "usdc": {
    "url": "https://faucet.circle.com/",
    "usdc": "0x5425890298aed601595a70AB815c96711a31Bc65",
    "network": "Avalanche Fuji Testnet"
  },
  "payment": {
    "method": "EIP-712 TransferWithAuthorization",
    "offChain": true,
    "description": "El agente firma off-chain, el facilitador ejecuta el pago"
  }
}
```

---

## Llamar a Otro Agente (Programáticamente)

### Uso del cliente x402

```typescript
import { X402Client, callAgentResearch } from "./x402-client";

// Inicializar cliente con tu private key
const client = new X402Client(process.env.PRIVATE_KEY);

// Llamar endpoint protegido de otro agente
const result = await client.callProtectedEndpoint(
  "https://otro-agente.com/a2a/research",
  "POST",
  {
    type: "token",
    address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  },
  0.01 // $0.01 en USDC
);

console.log("Respuesta del otro agente:", result);
```

### Helper simplificado

```typescript
import { callAgentResearch } from "./x402-client";

const result = await callAgentResearch(
  "https://otro-agente.com",
  {
    type: "pool",
    address: "0x...",
    dex: "traderjoe",
  },
  process.env.PRIVATE_KEY
);
```

---

## Flujo de Pago x402

### 1. Tu agente firma un payment proof (off-chain)

```typescript
// EIP-712 TransferWithAuthorization
const payment = {
  x402Version: 1,
  payload: {
    signature: "<EIP-712 signature>",
    payload: {
      scheme: "exact",
      network: "avalanche-fuji",
      asset: "0x5425890298aed601595a70AB815c96711a31Bc65",
      from: "0x29a45b03F07D1207f2e3ca34c38e7BE5458CE71a", // Tu wallet
      to: "0x7C599af5Dce814B13CD0c66F9C783Dd1e4C69Ae8",   // Facilitador
      amount: "10000",    // $0.01 = 10,000 micro-USDC
      validAfter: 0,
      validBefore: 1738000000,
      nonce: "0x..."
    }
  },
  network: "avalanche-fuji",
  asset: "0x5425890298aed601595a70AB815c96711a31Bc65",
  amount: "10000"
};
```

### 2. Envías la petición con el payment proof

```bash
# El payment proof va en el header X-PAYMENT (base64)
curl -X POST https://otro-agente.com/a2a/research \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <base64(payment)>" \
  -d '{"type":"token","address":"0x..."}'
```

### 3. El facilitador verifica y ejecuta el pago on-chain

- Verifica la firma EIP-712
- Ejecuta `transferWithAuthorization()` en el contrato USDC
- El USDC se mueve de tu wallet al agente destino
- El agente responde con los resultados

**✅ Ventaja:** Tu agente solo firma, no gasta gas. El facilitador paga el gas.

---

## Recibir Pagos de Otros Agentes

Tu agente **YA está configurado** para recibir pagos:

```typescript
// En server.ts
app.use(
  paymentMiddleware(
    WALLET_ADDRESS as `0x${string}`,
    {
      "/a2a/research": {
        price: "$0.01",
        network: "base-sepolia",  // ⚠️ NOTA: Cambiar a avalanche-fuji
        config: {
          description: "Evaluación de riesgo DeFi en Avalanche",
        },
      },
    },
    {
      url: FACILITATOR_URL,
    }
  )
);
```

⚠️ **Actualización necesaria:** El middleware usa `base-sepolia`, debes cambiarlo a `avalanche-fuji`.

---

## Testing de Comunicación A2A

### 1. Crear un segundo agente de prueba

Para probar la comunicación, puedes:

1. Crear otro agente simple en tu localhost
2. Registrarlo en el mismo registry
3. Hacer que ambos agentes se llamen mutuamente

### 2. Verificar que el facilitador está activo

```bash
curl https://facilitator.ultravioletadao.xyz
# Debe responder HTTP 200
```

### 3. Verificar tu balance de USDC

```bash
# Usa el comando del paso 3 de "Obtener USDC de prueba"
# O verifica en Snowtrace:
open https://testnet.snowtrace.io/address/0x29a45b03F07D1207f2e3ca34c38e7BE5458CE71a
```

---

## Próximos Pasos

1. ✅ **Obtener USDC de prueba** del faucet
2. ✅ **Actualizar el middleware x402** para usar `avalanche-fuji`
3. ⏳ **Esperar a que otros agentes se registren** en Fuji
4. ⏳ **O crear un segundo agente** para probar A2A localmente
5. ⏳ **Migrar a mainnet** cuando estés listo

---

## Referencias

- **Facilitador:** https://facilitator.ultravioletadao.xyz
- **USDC Faucet:** https://faucet.circle.com/
- **x402 Docs:** https://github.com/coinbase/x402
- **Avalanche x402:** https://build.avax.network/academy/blockchain/x402-payment-infrastructure/04-x402-on-avalanche/02-network-setup
- **USDC Addresses:** https://developers.circle.com/stablecoins/usdc-contract-addresses
