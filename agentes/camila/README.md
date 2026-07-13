# Camila — agente de WhatsApp con IA, multi-tenant (Kora)

Un solo servicio que le da a **cada hotel de Kora** su propia Camila: contesta a
los huéspedes por WhatsApp con datos reales y **cierra reservas con link de
pago**. El mismo código sirve a cualquier hotel porque todo lo específico
(cuartos, precios, disponibilidad, cobro) lo saca de la plataforma Kora vía
`/api/agent` con el token de ese hotel.

## Cómo encaja

```
Huésped (WhatsApp)
   │
   ▼
Camila runtime (este servicio, en Railway)      ── una sesión de WhatsApp por hotel
   │   brain.js  →  Claude (tool-use)
   ▼
Kora  /api/agent  (token del hotel)             ── conocimiento · disponibilidad · reservar
   │
   ▼
Stripe (link de pago)  →  webhook  →  reserva atómica + correos
```

- **`/api/bots/fleet`** (en Kora): lista los hoteles con bot activo + su token. Protegido con `BOT_FLEET_SECRET`.
- **`/api/agent`** (en Kora): el cerebro transaccional por hotel (ya en producción).

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.js` | Arranca una sesión de WhatsApp por hotel; debounce, "toma humana", página de estado/QR + `/health`. |
| `brain.js` | La conversación con Claude (tool-use). Genérico; el contexto del hotel se inyecta. |
| `kora.js` | Cliente de `/api/agent` para un hotel (knowledge / availability / reservar), con caché de conocimiento. |
| `fleet.js` | Carga la flota desde `/api/bots/fleet` (o `KORA_FLEET` para pruebas). |

## Correr en local

```bash
cd agentes/camila
cp .env.example .env      # pon ANTHROPIC_API_KEY y, para probar un solo hotel, KORA_FLEET
npm install
npm run check             # verifica sintaxis de todos los módulos
npm start                 # abre http://localhost:3001 y escanea el QR
```

Con `KORA_FLEET` puedes probar contra un hotel real de Kora sin exponer el
secreto de plataforma:

```
KORA_FLEET=[{"slug":"mi-hotel","nombre":"Mi Hotel","token":"kora_...","lang":"es"}]
```

(El token se genera en el panel del hotel → "Token del bot".)

## Desplegar en Railway

1. Servicio nuevo desde este subdirectorio (usa el `Dockerfile`).
2. **Volumen persistente** montado en `WWEBJS_DATA_PATH` (p. ej. `/data/.wwebjs_auth`)
   para no re-escanear el QR en cada redeploy.
3. Variables: `ANTHROPIC_API_KEY`, `KORA_BASE_URL`, `BOT_FLEET_SECRET`
   (igual que en Vercel), opcional `CAMILA_MODEL`.
4. Abre la URL pública del servicio: verás el estado de cada hotel y el QR pendiente.

## Notas y límites (honestas)

- **Número por hotel + QR:** whatsapp-web.js maneja un número de WhatsApp real vía
  QR (tecnología no oficial de Meta → riesgo de baneo). Es lo que Camila-Paraíso
  ya hace bien, viable para arrancar. El salto correcto al escalar es la **API
  oficial de WhatsApp Cloud**: se aísla en un solo módulo (un `kora.js`-equivalente
  del lado transporte), no un rewrite.
- **Costo de IA:** por defecto `claude-opus-4-8`. Para volumen, pon
  `CAMILA_MODEL=claude-sonnet-5` (o `claude-haiku-4-5`).
- **RAM:** cada hotel = un Chromium (~250–400 MB). Para muchas sesiones en un solo
  contenedor conviene subir el plan o repartir en varios servicios.
- **Historial** de conversación es en memoria (se pierde al reiniciar). Suficiente
  para el flujo de reserva; si se quiere memoria persistente, guardarla en Kora.
