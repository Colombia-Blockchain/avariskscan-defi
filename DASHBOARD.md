# Dashboard Web - AvaRisk DeFi

Dashboard interactivo para visualizar análisis de riesgo DeFi en Avalanche.

## 🎨 Características

- ✅ **Métricas en Tiempo Real**: TVL de Avalanche, número de protocolos
- ✅ **Análisis de Riesgo**: Tokens, pools, contratos, protocolos
- ✅ **Rankings**: Top 10 protocolos por TVL
- ✅ **Visualización Clara**: Badges de riesgo con colores
- ✅ **Responsive**: Funciona en desktop y mobile
- ✅ **Sin Frameworks**: HTML/CSS/JS puro, fácil de hospedar

---

## 🚀 Uso Rápido

### Opción 1: Abrir Directamente

```bash
# Abrir en el navegador
open dashboard.html
```

### Opción 2: Servidor Local

```bash
# Con Python
python3 -m http.server 8000

# Con Node.js
npx http-server

# Con PHP
php -S localhost:8000
```

Luego abre: `http://localhost:8000/dashboard.html`

---

## 📊 Funcionalidades

### 1. Métricas de Avalanche

Al cargar la página, el dashboard muestra automáticamente:
- **TVL Total** de Avalanche
- **Número de Protocolos** activos
- **Estado del Agente** (Online/Offline)

### 2. Analizador de Riesgo

Analiza diferentes tipos de activos:

**Tokens ERC-20:**
- Supply y decimales
- Concentración de holders
- Riesgo de rug pull
- Análisis con IA

**Pools de Liquidez:**
- Reservas de tokens
- Liquidez total
- Riesgo por baja liquidez
- DEX soportado (Trader Joe, Pangolin, Uniswap)

**Contratos:**
- Tamaño del bytecode
- Código verificado
- Detección de proxies

**Protocolos:**
- TVL actual
- Cambios 24h/7d
- Ranking en Avalanche

### 3. Top Protocolos

Lista de los 10 protocolos con mayor TVL en Avalanche, actualizada en tiempo real.

---

## 🎯 Ejemplos de Uso

### Analizar Wrapped AVAX

1. Selecciona "Token ERC-20"
2. Ingresa: `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7`
3. Click en "Analizar Riesgo"

### Analizar Pool de Trader Joe

1. Selecciona "Pool de Liquidez"
2. Ingresa la dirección del par
3. Selecciona DEX: "Trader Joe"
4. Click en "Analizar Riesgo"

### Ver Info de Trader Joe

1. Selecciona "Protocolo DeFi"
2. Ingresa: `traderjoe`
3. Click en "Analizar Riesgo"

---

## 🌐 Deployment

### GitHub Pages

```bash
# 1. Crea un repo en GitHub
# 2. Sube dashboard.html
# 3. Ve a Settings → Pages
# 4. Selecciona la rama main
# 5. Listo! URL: https://tu-usuario.github.io/repo/dashboard.html
```

### Vercel

```bash
# 1. Instala Vercel CLI
npm i -g vercel

# 2. Deploy
vercel dashboard.html

# 3. Obtendrás una URL: https://dashboard-xxx.vercel.app
```

### Netlify

1. Arrastra `dashboard.html` a https://app.netlify.com/drop
2. Obtén una URL al instante

---

## ⚙️ Configuración

### Cambiar URL del API

Edita `dashboard.html` línea 299:

```javascript
// Cambiar de:
const API_URL = 'https://avariskscan-defi-production.up.railway.app';

// A tu URL:
const API_URL = 'https://tu-dominio.com';
```

### Personalizar Estilos

Los estilos están en `<style>` (líneas 7-205). Puedes cambiar:

```css
/* Colores principales */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Cambiar a otro gradiente */
background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
```

---

## 🎨 Screenshots

### Vista Principal
```
┌─────────────────────────────────────┐
│     🛡️ AvaRisk DeFi                │
│  Evaluador de riesgo DeFi           │
├───────────┬───────────┬─────────────┤
│ TVL       │ Protocolos│ Estado      │
│ $850.5M   │ 156       │ ✅ Online   │
├─────────────────────────────────────┤
│ 🔍 Analizar Riesgo                  │
│                                     │
│ Tipo: [Token ERC-20 ▼]             │
│ Dirección: [0x...]                 │
│                                     │
│ [ Analizar Riesgo ]                │
└─────────────────────────────────────┘
```

### Resultado de Análisis
```
┌─────────────────────────────────────┐
│ Resultado del Análisis              │
│ Riesgo: Bajo (25/100) 🟢           │
├─────────────────────────────────────┤
│ Hallazgos:                          │
│ • Token: Wrapped AVAX (WAVAX)       │
│ • Supply total: 1,000,000          │
│ • ✓ Liquidez adecuada              │
├─────────────────────────────────────┤
│ Recomendaciones:                    │
│ • Riesgo aceptable                 │
│ • Verificar fuentes adicionales    │
└─────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Dashboard no carga datos

**Problema:** "Loading..." no cambia

**Solución:**
1. Verifica que el agente esté online: https://avariskscan-defi-production.up.railway.app/
2. Abre la consola del navegador (F12) y revisa errores
3. Verifica CORS en el servidor

### Error 402 en análisis

**Problema:** "Payment Required"

**Causa:** El endpoint `/a2a/research` requiere pago x402

**Solución temporal:**
- Usa los endpoints públicos: `/defi/token/:address`
- O configura un payment header x402

### Protocolos no aparecen

**Problema:** Lista de protocolos vacía

**Solución:**
1. Verifica que DeFiLlama API esté funcionando
2. Espera unos segundos (la API puede tardar)
3. Refresca la página

---

## 🚀 Mejoras Futuras

Ideas para extender el dashboard:

1. **Gráficos:**
   - Integrar Chart.js para visualizar TVL histórico
   - Gráficos de concentración de holders

2. **Filtros:**
   - Filtrar protocolos por categoría
   - Búsqueda de protocolos

3. **Comparación:**
   - Comparar múltiples tokens lado a lado
   - Benchmarking contra promedios del mercado

4. **Alertas:**
   - Sistema de alertas para tokens riesgosos
   - Notificaciones de cambios en TVL

5. **Historial:**
   - Guardar análisis anteriores en LocalStorage
   - Exportar resultados a PDF/CSV

6. **Autenticación:**
   - Login con wallet (MetaMask)
   - Pagos x402 integrados

---

## 📚 Recursos

- **API Docs:** Ver `DEFI_APIS.md`
- **Agent Docs:** Ver `README.md`
- **A2A Communication:** Ver `AGENT_COMMUNICATION.md`
- **Repo:** https://github.com/Colombia-Blockchain/avariskscan-defi

---

## 🤝 Contribuir

Para contribuir al dashboard:

1. Fork el repo
2. Crea una branch: `git checkout -b feature/mi-mejora`
3. Haz tus cambios en `dashboard.html`
4. Commit: `git commit -m "feat: mi mejora"`
5. Push: `git push origin feature/mi-mejora`
6. Abre un Pull Request

---

## 📄 Licencia

El dashboard es parte del proyecto AvaRisk DeFi y está disponible para uso libre.
