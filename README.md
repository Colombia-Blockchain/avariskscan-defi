# AvaRisk DeFi (ERC-8004, Avalanche Fuji)

Evaluador de riesgo DeFi en Avalanche. Agente inteligente diseñado para ser **descubierto por el scanner ERC-8004 (Enigma)** y **comunicarse con otros agentes** usando:

- Skill `erc8004-avalanche` de `Colombia-Blockchain/agent-skills`
- Facilitador x402 de UltraVioleta DAO (`https://facilitator.ultravioletadao.xyz`)

---

## 1. Configuración de entorno

Copia `.env.example` a `.env` y rellena las variables:

```bash
cp .env.example .env
```

Edita `.env` y configura:

- `PRIVATE_KEY`: tu clave privada (para registrar el agente; **nunca subas este archivo a repos públicos**)
- `WALLET_ADDRESS`: dirección de la wallet (por defecto ya incluida)
- `AGENT_NAME`, `AGENT_DESCRIPTION`, `AGENT_IMAGE`: opcionales, para personalizar el agente

**Importante:** Añade `.env` a `.gitignore` (ya incluido) y no lo comitees nunca.

---

## 2. Skill de registro: `erc8004-avalanche`

### Instalación

**Opción 1 – CLI:**
```bash
npx skills add Colombia-Blockchain/agent-skills
```

**Opción 2 – Clonar repo:**
```bash
cd ..
git clone https://github.com/Colombia-Blockchain/agent-skills.git
cd erc8004-agent
```

### Funcionalidad del skill

- Registrar el agente en el **Identity Registry** ERC-8004 de Avalanche Fuji
- Leer/escribir reputación en el **Reputation Registry**
- Pedir validaciones (Validation Registry)

### Contratos en Avalanche Fuji (43113)

- Identity Registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Reputation Registry: consultar el skill para la dirección exacta

---

## 3. Despliegue en Railway (infra)

Arquitectura del proyecto:
- **Vercel** → frontend
- **Railway** → infraestructura (agente AvaRisk DeFi / API)

### Desplegar en Railway

1. Crea un proyecto en [Railway](https://railway.app).
2. Conecta el repositorio (GitHub). Si es monorepo, configura **Root Directory** = `erc8004-agent`.
3. Railway detecta `railway.toml` y usa:
   - Build: `npm run build`
   - Start: `npm start`
   - Healthcheck: `GET /`
4. Añade variables de entorno en Railway:
   - `WALLET_ADDRESS` (obligatorio para x402)
   - `PORT` (Railway lo inyecta automáticamente)
5. Genera dominio público: Settings → Networking → Generate Domain.
6. Sustituye `TU_DOMINIO` en `registration.json` por la URL de Railway (ej. `avariskscan.up.railway.app`).

### CLI

```bash
# Desde la raíz del repo
railway link   # vincular al proyecto
railway up     # deploy
```

---

## 4. Flujo de registro y verificación en Fuji

### Paso 1: Variables de entorno

```bash
# Cargar variables desde .env (o exportarlas manualmente)
export $(grep -v '^#' .env | xargs)
# O bien:
export AVALANCHE_RPC_URL="https://api.avax-test.network/ext/bc/C/rpc"
export PRIVATE_KEY="tu_clave_privada"
```

### Paso 2: Hospedar `registration.json`

Despliega el agente en **Railway** (ver sección 3). El servidor expone:
- `GET /registration.json` – archivo de registro ERC-8004
- `GET /.well-known/agent-card.json` – metadatos A2A
- `POST /a2a/research` – endpoint protegido con x402

Despliega el servicio a una URL pública (o IPFS) y sustituye `TU_DOMINIO` en `registration.json` por tu dominio real.

### Paso 3: Registrar el agente

```bash
# Desde la carpeta del skill erc8004-avalanche
cd agent-skills/skills/erc8004-avalanche
./scripts/register.sh "https://TU_DOMINIO/registration.json"
```

El contrato devolverá un `agentId`. Guárdalo.

### Paso 4: Obtener el `agentId`

Tras el registro, el contrato devuelve el `agentId` (token ID del NFT). Puedes:

- Consultarlo con la skill: `./scripts/check-agent.sh`
- Usar `cast` o `viem` para leer el registro on-chain

### Paso 5: Actualizar `registration.json` (opcional)

Edita `registration.json` y actualiza `registrations[0].agentId` con el valor obtenido.

### Paso 6: Verificar en el scanner Enigma

1. Ve a `https://www.erc-8004scan.xyz/scanner`
2. Filtra por **Avalanche Fuji** (si el scanner lo soporta) o por tu dirección de agente
3. Comprueba que el agente aparece correctamente

### Verificación extra

```bash
cd agent-skills/skills/erc8004-avalanche
./scripts/check-agent.sh
```

---

## 5. Servicio HTTP del agente

### Scripts

| Comando   | Descripción                    |
|----------|---------------------------------|
| `npm run dev`   | Desarrollo con hot-reload       |
| `npm run build` | Compilar TypeScript             |
| `npm run start` | Producción (requiere `build` previo) |

### Endpoints

| Método | Ruta                         | Descripción                         |
|--------|------------------------------|-------------------------------------|
| GET    | `/`                          | Health check                        |
| GET    | `/registration.json`         | Archivo de registro ERC-8004        |
| GET    | `/.well-known/agent-card.json` | Metadatos A2A                     |
| POST   | `/a2a/research`              | Investigación (protegido con x402)  |

### Integración x402 (UltraVioleta)

El endpoint `/a2a/research` está protegido con `paymentMiddleware` de `x402-hono`:

- **Facilitador**: `https://facilitator.ultravioletadao.xyz`
- **Precio**: $0.01 por consulta
- **Red**: base-sepolia (configurable según soporte del facilitador)

La dirección de cobro (`payTo`) usa `WALLET_ADDRESS` de las variables de entorno.

---

## 6. Comunicación y reputación entre agentes

Una vez registrado y visible en el scanner:

- **Otros agentes** pueden usar la skill `erc8004-avalanche` para dar feedback de reputación a tu `agentId`.
- **Tu agente** puede usar scripts o llamadas on-chain para dar reputación a otros agentes descubiertos en el scanner.

Comando de ejemplo (consultar la skill para sintaxis exacta):

```bash
./scripts/give-feedback.sh <agentId_destino> <puntuación>
```

---

## 7. Seguridad y siguientes pasos

### Seguridad

- **No comitees** `.env` ni la private key.
- **Rota la clave** si ya la compartiste en texto plano; usa una nueva para producción.
- Mantén las dependencias actualizadas (`npm audit`).

### Mejoras futuras

- Tests básicos (p. ej. Jest) para validar que `registration.json` cumple el esquema ERC-8004.
- Script Node/TS que llame a los contratos ERC-8004 directamente (viem/ethers) sin depender solo de los shell scripts del skill.
- Más servicios en `services[]` (WebSocket, gRPC) si el agente crece.
- Consulta de reputación on-chain y flujos de pago x402 hacia otros endpoints protegidos.
