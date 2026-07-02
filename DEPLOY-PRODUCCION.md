# Checklist — subir Kora (plataforma multi-tenant) a producción

> Estado: PR #1 (rama `feat/plataforma-multitenant`). La **base de datos ya está aplicada** en la Supabase de producción (`kora-multitenant-fase0.sql` + `kora-db-final.sql`) — **PERO faltan los SQL nuevos del motor: `kora-motor-fase2.sql` y `kora-pagos-fase3.sql` (paso 0)**. Stripe está en modo **LIVE** (los pagos son reales). Sin las envs, todo **degrada con gracia** (reservas por WhatsApp, etc.) — nada truena.

## 0) SQL nuevo en Supabase (SQL Editor, en este orden)
- [ ] `sql/kora-motor-fase2.sql` — rate plans (`bookings.rate_plan` + RPC actualizado) y captura de abandono (`booking_intents`).
- [ ] `sql/kora-pagos-fase3.sql` — estado de Stripe Connect por hotel (`hotel_stripe_accounts`) y reservas `REEMBOLSADA`.

## 1) Envs en Vercel (proyecto Kora → Settings → Environment Variables → **Production**)

**Ya deberían estar** (de antes): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` (sk_live), `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SITE_URL` (= `https://kora-hotel.com`), `CRON_SECRET`, `RESEND_FROM`, `STRIPE_PRICE_*`.

**Agregar (nuevas):**
- [ ] `STRIPE_WEBHOOK_SECRET_RESERVAS` — secreto del webhook de **reservas** (endpoint de cuenta propia, paso 2b). **Es DISTINTO** del `STRIPE_WEBHOOK_SECRET` de suscripciones.
- [ ] `STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT` — secreto del webhook de reservas para **cuentas conectadas** (paso 2b-bis). Con *direct charges* los pagos de reservas viven en la cuenta de cada hotel, así que Stripe manda esos eventos por un endpoint de tipo "connected accounts".
- [ ] `RESEND_API_KEY` — para correos de confirmación + las 5 secuencias *(recomendado; opcional)*.
- [ ] `FACTURAMA_*` (`FACTURAMA_USER`, `FACTURAMA_PASSWORD`, …) — solo si activarás facturación CFDI *(opcional)*.
- [ ] `STRIPE_WEBHOOK_SECRET` — si vas a usar **suscripciones**, el secreto del webhook de suscripciones (paso 2c).

## 2) Stripe Dashboard (modo LIVE — ⚠️ es real)
- [ ] **a. Habilitar Connect:** Settings → Connect → activar (Express). (Para que cada hotel cobre a su cuenta.)
- [ ] **b. Webhook de RESERVAS (cuenta propia):** Developers → Webhooks → Add endpoint
  - URL: `https://kora-hotel.com/api/h/webhooks/stripe`
  - Escuchar: **"Events on your account"**
  - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
  - Copiar el *Signing secret* (`whsec_…`) → Vercel como **`STRIPE_WEBHOOK_SECRET_RESERVAS`**.
- [ ] **b-bis. Webhook de RESERVAS (cuentas conectadas — direct charges):** OTRO endpoint con la MISMA URL
  - URL: `https://kora-hotel.com/api/h/webhooks/stripe`
  - Escuchar: **"Events on connected accounts"**
  - Eventos: los 5 de arriba **+ `account.updated`**
  - Copiar su *Signing secret* → Vercel como **`STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT`**.
- [ ] **c. (Si usas suscripciones) Webhook de SUSCRIPCIONES:** otro endpoint → `https://kora-hotel.com/api/stripe/webhook` → su secreto va en `STRIPE_WEBHOOK_SECRET`.

## 3) Revisar el preview
- [ ] En el PR #1, abrir el **preview deploy** de Vercel y confirmar que compiló sin error.

## 4) Merge → producción
- [ ] Merge del PR #1 a `main` → Vercel despliega a **kora-hotel.com** automáticamente.

## 5) Verificación post-merge (en kora-hotel.com)
- [ ] `/entrar` → login → `/panel` muestra tus hoteles.
- [ ] `/h/<slug>/reservar` → reserva de prueba → pago. *(Stripe LIVE: usa monto chico real y reembolsa, o cambia temporalmente a llaves test.)*
- [ ] La reserva pagada aparece en `/panel/<slug>/reservas` (confirma que el **webhook** funciona).
- [ ] `/panel/<slug>/pagos` → conectar Stripe del hotel (Connect).
- [ ] Pegar el **snippet** (`<script src=".../embed.js" data-hotel="slug">`) en una página HTML y confirmar que el **iframe carga** (ya se arregló `X-Frame-Options` para `/h/*`).
- [ ] `/panel/onboarding` → crear un hotel de prueba y recorrer el asistente de 6 pasos (fotos → cobros → reglas → publicar). Es **resumable**: salir a la mitad y volver a entrar desde el aviso "Terminar de configurar" del hub debe retomar en el mismo paso.

## Notas / gotchas
- **DB:** falta aplicar `kora-motor-fase2.sql` + `kora-pagos-fase3.sql` (paso 0). El código degrada con gracia sin ellos (la reserva se crea con la firma vieja del RPC), pero rate plans, portal del huésped, abandono y estado Connect persistido los necesitan.
- **3 webhooks de Stripe = 3 secretos distintos**: reservas cuenta propia (`STRIPE_WEBHOOK_SECRET_RESERVAS`), reservas de cuentas conectadas (`STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT`, requerido por direct charges) y suscripciones (`STRIPE_WEBHOOK_SECRET`).
- **Direct charges:** el dinero de cada reserva entra DIRECTO a la cuenta Stripe del hotel (él absorbe la comisión de Stripe); Kora no pone `application_fee`. OXXO se ofrece solo (capability `oxxo_payments`) cuando la cuenta del hotel lo tiene activo y el monto ≤ $10,000 MXN.
- **Stripe LIVE:** cualquier pago es real; para probar sin cobrar usa llaves test temporalmente o monto mínimo + reembolso.
- **Crons** (en `vercel.json`: digest, dunning, email-sequences, ical-sync y **abandono**) requieren `CRON_SECRET`. En plan **Hobby (gratis)** Vercel permite hasta 100 crons pero **todos deben correr máximo 1 vez al día** (expresiones sub-diarias hacen fallar el deploy). Por eso `abandono` quedó **diario** (`0 16 * * *`) en vez de por hora. Para frecuencias más finas (abandono por hora, ical-sync cada 15 min) → **Vercel Pro** o mover esos crons a **GitHub Actions** (gratis, como en Paraíso).
- **Recuperación de abandono:** `/api/cron/abandono` manda UN recordatorio a quien dejó su correo en el checkout y no terminó (ventana 2–48 h). Necesita `booking_intents` (SQL fase 2) + `RESEND_API_KEY`; sin ellos no manda nada y no truena. Cada hotel puede apagarlo en Panel → Avanzado → "Avisos por correo".
- **Avisos al hotel:** con cada reserva nueva (webhook) y cada cancelación del huésped (portal) se le manda un correo al hotel al instante. Destinatario: el correo configurado en Panel → Avanzado → "Avisos por correo" → si está vacío, el correo de la cuenta del dueño. Requiere `RESEND_API_KEY`.
- **Referencia de envs:** `.env.example` (en el repo) lista TODAS las variables con comentarios.
- **Reconciliación (caso raro):** si un huésped paga pero el cuarto quedó ocupado justo antes (carrera), el webhook responde 200 con `warning` y NO crea la reserva (evita overbooking). Revisa el log del webhook, **reembolsa en Stripe** e informa al huésped. Es muy poco frecuente (el hold de 30 min lo previene casi siempre).
- **Único stub pendiente:** Redes (métricas sociales). Suscripción aún a nivel cuenta (cobro por hotel = refinamiento futuro). Bot WhatsApp = solo la API (`/api/agent`); el despliegue del bot es aparte (Railway, un número por hotel).
