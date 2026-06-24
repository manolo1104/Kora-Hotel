# Checklist — subir Kora (plataforma multi-tenant) a producción

> Estado: PR #1 (rama `feat/plataforma-multitenant`). La **base de datos ya está aplicada** en la Supabase de producción (`kora-multitenant-fase0.sql` + `kora-db-final.sql`). Stripe está en modo **LIVE** (los pagos son reales). Sin las envs, todo **degrada con gracia** (reservas por WhatsApp, etc.) — nada truena.

## 1) Envs en Vercel (proyecto Kora → Settings → Environment Variables → **Production**)

**Ya deberían estar** (de antes): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` (sk_live), `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SITE_URL` (= `https://kora-hotel.com`), `CRON_SECRET`, `RESEND_FROM`, `STRIPE_PRICE_*`.

**Agregar (nuevas):**
- [ ] `STRIPE_WEBHOOK_SECRET_RESERVAS` — secreto del webhook de **reservas** (lo obtienes en el paso 2b). **Es DISTINTO** del `STRIPE_WEBHOOK_SECRET` de suscripciones.
- [ ] `RESEND_API_KEY` — para correos de confirmación + las 5 secuencias *(recomendado; opcional)*.
- [ ] `FACTURAMA_*` (`FACTURAMA_USER`, `FACTURAMA_PASSWORD`, …) — solo si activarás facturación CFDI *(opcional)*.
- [ ] `STRIPE_WEBHOOK_SECRET` — si vas a usar **suscripciones**, el secreto del webhook de suscripciones (paso 2c).

## 2) Stripe Dashboard (modo LIVE — ⚠️ es real)
- [ ] **a. Habilitar Connect:** Settings → Connect → activar (Express). (Para que cada hotel cobre a su cuenta.)
- [ ] **b. Webhook de RESERVAS:** Developers → Webhooks → Add endpoint
  - URL: `https://kora-hotel.com/api/h/webhooks/stripe`
  - Evento: `checkout.session.completed`
  - Copiar el *Signing secret* (`whsec_…`) → ponerlo en Vercel como **`STRIPE_WEBHOOK_SECRET_RESERVAS`**.
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
- [ ] `/panel/onboarding` → crear un hotel nuevo de prueba.

## Notas / gotchas
- **DB:** ya aplicada (no falta SQL).
- **2 webhooks de Stripe = 2 secretos distintos** (reservas `STRIPE_WEBHOOK_SECRET_RESERVAS` vs suscripciones `STRIPE_WEBHOOK_SECRET`).
- **Stripe LIVE:** cualquier pago es real; para probar sin cobrar usa llaves test temporalmente o monto mínimo + reembolso.
- **Crons** (en `vercel.json`: digest, dunning, email-sequences, ical-sync) requieren `CRON_SECRET` + plan Vercel **Pro**.
- **Referencia de envs:** `.env.example` (en el repo) lista TODAS las variables con comentarios.
- **Reconciliación (caso raro):** si un huésped paga pero el cuarto quedó ocupado justo antes (carrera), el webhook responde 200 con `warning` y NO crea la reserva (evita overbooking). Revisa el log del webhook, **reembolsa en Stripe** e informa al huésped. Es muy poco frecuente (el hold de 30 min lo previene casi siempre).
- **Único stub pendiente:** Redes (métricas sociales). Suscripción aún a nivel cuenta (cobro por hotel = refinamiento futuro). Bot WhatsApp = solo la API (`/api/agent`); el despliegue del bot es aparte (Railway, un número por hotel).
