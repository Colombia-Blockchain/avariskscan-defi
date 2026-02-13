# 🔧 Railway Deployment Troubleshooting

**Problema identificado:** Railway muestra "GitHub Repo not found" y no está desplegando los nuevos commits.

---

## ✅ Pasos para Resolver

### 1. Reconectar el Repositorio de GitHub

**En Railway Dashboard:**
1. Ve a tu proyecto: https://railway.app/project/[tu-proyecto]
2. Click en tu servicio "avariskscan-defi"
3. Ve a la pestaña **"Settings"** → **"Source"**
4. Click en **"Check for updates"** primero
   - Si esto resuelve el problema, espera 2-3 minutos y verifica el deployment
5. Si no funciona, click en **"Disconnect"**
6. Luego click en **"Connect to GitHub"**
7. Selecciona el repositorio: `Colombia-Blockchain/avariskscan-defi`
8. Autoriza los permisos necesarios

### 2. Configurar Variables de Entorno

**Verifica que tienes configuradas:**

```
WALLET_ADDRESS=0x29a45b03F07D1207f2e3ca34c38e7BE5458CE71a
PORT=8080
```

**Para añadir/verificar en Railway:**
1. Settings → Variables
2. Add Variable (si no existe)
3. Save

**⚠️ IMPORTANTE:** No agregues `PRIVATE_KEY` ni `ANTHROPIC_API_KEY` en Railway si no las necesitas en producción.

### 3. Verificar Configuración de Red

**En Railway Dashboard:**
1. Settings → Networking → Public Networking
2. **Puerto debe ser:** 8080 (o cambiar variable PORT a 3000)
3. **Dominio:** avariskscan-defi-production.up.railway.app

### 4. Triggear Deployment Manual

**Si después de reconectar no se despliega automáticamente:**

**Opción A - Desde Railway Dashboard:**
1. Ve a "Deployments"
2. Click en "Deploy Now" o "Redeploy"

**Opción B - Desde CLI:**
```bash
cd /Users/jquiceva/agente_cyber/erc8004-agent
railway login
railway link
railway up
```

**Opción C - Forzar con commit vacío:**
```bash
git commit --allow-empty -m "trigger: force Railway deployment"
git push origin main
```

---

## 🧪 Verificación Post-Deployment

Una vez que Railway muestre "Deployment Successful", verifica:

**1. Health Check:**
```bash
curl https://avariskscan-defi-production.up.railway.app/
```
Debería devolver:
```json
{
  "status": "ok",
  "agent": "AvaRisk DeFi",
  "version": "0.1.0",
  "x402": true
}
```

**2. Dashboard:**
```bash
curl -I https://avariskscan-defi-production.up.railway.app/dashboard
```
Debería devolver: `HTTP/2 200`

**3. DeFi Endpoints:**
```bash
curl https://avariskscan-defi-production.up.railway.app/defi/avalanche
```
Debería devolver métricas de Avalanche DeFi.

**4. Token Analysis:**
```bash
curl -X POST https://avariskscan-defi-production.up.railway.app/defi/analyze \
  -H "Content-Type: application/json" \
  -d '{"type":"token","address":"0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7","network":"mainnet"}'
```
Debería devolver análisis de WAVAX.

---

## 🚨 Si el Problema Persiste

### Verificar Logs de Railway

1. Railway Dashboard → Deployments
2. Click en el último deployment
3. Ve a "View Logs"
4. Busca errores en:
   - Build phase (compilación)
   - Deploy phase (inicio del servidor)

### Errores Comunes

**Error: "Cannot find module"**
- Verifica que `package-lock.json` esté commiteado
- Railway usa `npm ci` que requiere el lock file

**Error: "Port already in use"**
- Verifica que `PORT` esté configurado en variables de entorno
- Railway inyecta automáticamente, pero puedes override a 8080

**Error: "ECONNREFUSED" en APIs**
- Verifica que las URLs de DeFi APIs sean accesibles desde Railway
- Algunas APIs pueden bloquear IPs de servidores cloud

**Build falla:**
- Verifica que el Dockerfile esté correcto
- Railway debe poder ejecutar `npm ci` y `npm run build`

---

## 📋 Checklist Completo

Marca cada item cuando lo completes:

- [ ] Repositorio de GitHub reconectado (no muestra "not found")
- [ ] Variables de entorno configuradas (al menos `WALLET_ADDRESS` y `PORT`)
- [ ] Deployment triggeado (manual o automático)
- [ ] Logs de build sin errores
- [ ] Logs de deploy muestran "ERC-8004 agent listening at..."
- [ ] Health check responde OK
- [ ] Dashboard accesible (HTTP 200)
- [ ] Endpoints DeFi funcionando
- [ ] Token analysis sin errores "could not decode"

---

## 💡 Mejoras Opcionales Post-Deployment

Una vez que todo funcione:

1. **Configurar API Keys (opcional):**
   ```
   ANTHROPIC_API_KEY=sk-ant-... (para análisis IA)
   COVALENT_API_KEY=... (para holder analysis)
   SNOWTRACE_API_KEY=... (para contratos verificados)
   ```

2. **Configurar Custom Domain (opcional):**
   - Settings → Networking → Custom Domain
   - Ejemplo: `api.avariskscan.io`

3. **Configurar Monitoring:**
   - Railway tiene métricas básicas built-in
   - Para alertas avanzadas, considera integrar Sentry o similar

4. **Migrar a Mainnet:**
   - Actualizar variables de entorno
   - Cambiar registry address en código
   - Re-registrar agente en mainnet

---

## 📞 Soporte

- **Railway Docs:** https://docs.railway.app/
- **Railway Discord:** https://discord.gg/railway
- **Issue Tracker:** https://github.com/Colombia-Blockchain/avariskscan-defi/issues

---

**Última actualización:** 2026-02-13
**Commits pendientes de deployment:**
- `2443b87` - fix: improve token analysis error handling and network support
- `443dc94` - Add public endpoint for dashboard and modernize UI
- `f333de9` - fix: include dashboard.html in Docker build
- `dfd10a1` - feat: add dashboard endpoint to serve HTML UI
