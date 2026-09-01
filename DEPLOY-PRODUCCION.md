# Kora en producción — puesta a punto y despliegue

> **Esto NO es la lista de un despliegue normal.** Un despliegue normal es
> `git push` a `main`: Vercel construye y publica en kora-hotel.com solo, en
> ~4 minutos. Este documento es la puesta a punto de la cuenta —envs, webhooks
> de Stripe, SQL— y la verificación de que quedó bien.
>
> **Al 1 sep 2026 la plataforma lleva meses en producción y todo lo de aquí está
> hecho.** Sirve para: montar un entorno desde cero, revisar por qué algo del
> camino del dinero no responde, o saber qué tocar al añadir una pieza.
>
> ⚠️ **Stripe está en modo LIVE: cualquier pago es real.** Sin las envs, casi
> todo degrada con gracia (se apaga y avisa) en vez de tronar.

## 0) SQL en Supabase (SQL Editor)

Los archivos de `sql/` son **idempotentes** (`if not exists`), así que **correrlos
ES la comprobación**: no hace falta consultar antes y decidir después. Si el
esquema ya está, no hacen nada.

En un entorno desde cero van en orden de fase: `kora-multitenant-fase0.sql` →
`kora-db-final.sql` → `kora-motor-fase2/3/4.sql` → `kora-pagos-fase3.sql`, y
después los sueltos de cada función (`kora-e3-apartado-atomico.sql`,
`kora-e9-limitador-ip.sql`, `kora-equipo-pantallas.sql`…).

## 1) Envs en Vercel (proyecto Kora → Settings → Environment Variables → **Production**)

**Ya deberían estar** (de antes): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` (sk_live), `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SITE_URL` (= `https://kora-hotel.com`), `CRON_SECRET`, `RESEND_FROM`, `STRIPE_PRICE_KORA`. (Es UNO: hay un solo plan.)

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

## 3) Antes de subir
- [ ] `npm run verificar` en verde (lint · tsc · pruebas · inventario · permisos).
- [ ] `npm run build` en verde. **No basta `tsc`**: un `route.ts` sólo puede
      exportar sus verbos HTTP, y eso únicamente lo caza el build.
- [ ] Lo que cambiaste, visto **en el navegador** sobre `npm run dev`.

## 4) Subir → producción
- [ ] `git push` a `main` → Vercel despliega a **kora-hotel.com** automáticamente.
- [ ] **Tarda ~4 minutos.** Si al comprobar da 404, no es que fallara: es que aún
      no termina.

## 5) Verificación post-merge (en kora-hotel.com)
- [ ] `/entrar` → login → `/panel` muestra tus hoteles.
- [ ] `/h/<slug>/reservar` → reserva de prueba → pago. *(Stripe LIVE: usa monto chico real y reembolsa, o cambia temporalmente a llaves test.)*
- [ ] La reserva pagada aparece en `/panel/<slug>/reservas` (confirma que el **webhook** funciona).
- [ ] `/panel/<slug>/pagos` → conectar Stripe del hotel (Connect).
- [ ] Pegar el **snippet** (`<script src=".../embed.js" data-hotel="slug">`) en una página HTML y confirmar que el **iframe carga** (ya se arregló `X-Frame-Options` para `/h/*`).
- [ ] `/panel/onboarding` → crear un hotel de prueba y recorrer el asistente de 6 pasos (fotos → cobros → reglas → publicar). Es **resumable**: salir a la mitad y volver a entrar desde el aviso "Terminar de configurar" del hub debe retomar en el mismo paso.

## Notas / gotchas
- **DB:** los SQL de `sql/` son idempotentes; correrlos es la comprobación. Si un SQL de fase no está aplicado, el código degrada con gracia (la reserva se crea con la firma vieja del RPC) pero rate plans, portal del huésped, abandono y estado Connect persistido dejan de funcionar.
- **3 webhooks de Stripe = 3 secretos distintos**: reservas cuenta propia (`STRIPE_WEBHOOK_SECRET_RESERVAS`), reservas de cuentas conectadas (`STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT`, requerido por direct charges) y suscripciones (`STRIPE_WEBHOOK_SECRET`).
- **Direct charges:** el dinero de cada reserva entra DIRECTO a la cuenta Stripe del hotel (él absorbe la comisión de Stripe); Kora no pone `application_fee`. OXXO se ofrece solo (capability `oxxo_payments`) cuando la cuenta del hotel lo tiene activo y el monto ≤ $10,000 MXN.
- **Stripe LIVE:** cualquier pago es real; para probar sin cobrar usa llaves test temporalmente o monto mínimo + reembolso.
- **Crons** (en `vercel.json` hay **8**: digest, dunning, email-sequences, ical-sync, abandono, prueba, leads y suscriptores) requieren `CRON_SECRET`. En plan **Hobby (gratis)** Vercel permite hasta 100 crons pero **todos deben correr máximo 1 vez al día** (expresiones sub-diarias hacen fallar el deploy). Por eso `abandono` quedó **diario** (`0 16 * * *`) en vez de por hora. Para frecuencias más finas (abandono por hora, ical-sync cada 15 min) → **Vercel Pro** o mover esos crons a **GitHub Actions** (gratis, como en Paraíso).
- **Recuperación de abandono:** `/api/cron/abandono` manda UN recordatorio a quien dejó su correo en el checkout y no terminó (ventana 2–48 h). Necesita `booking_intents` (SQL fase 2) + `RESEND_API_KEY`; sin ellos no manda nada y no truena. Cada hotel puede apagarlo en Panel → Avanzado → "Avisos por correo".
- **Avisos al hotel:** con cada reserva nueva (webhook) y cada cancelación del huésped (portal) se le manda un correo al hotel al instante. Destinatario: el correo configurado en Panel → Avanzado → "Avisos por correo" → si está vacío, el correo de la cuenta del dueño. Requiere `RESEND_API_KEY`.
- **Referencia de envs:** `.env.example` (en el repo) lista TODAS las variables con comentarios.
- **Reconciliación (caso raro):** si un huésped paga pero el cuarto quedó ocupado justo antes (carrera), el webhook responde 200 con `warning` y NO crea la reserva (evita overbooking). Revisa el log del webhook, **reembolsa en Stripe** e informa al huésped. Es muy poco frecuente (el hold de 30 min lo previene casi siempre).
- **Bot de WhatsApp:** este repo trae la API (`/api/agent`) y el runtime en `agentes/camila/`, pero el runtime **se despliega aparte, a Railway**, con un número por hotel. Que un hotel entre a la flota depende del fleet (`/api/bots/fleet`), que lo relee cada ≤5 min.
- **Correo entrante:** ⚠️ `kora-hotel.com` **manda pero no recibe** — el apex no tiene registro MX. Todo lo que se escriba a `hola@` o `reservas@` rebota hasta que se añada uno en el DNS de Vercel. Ver la cabecera de `lib/contacto.ts`.
- **Pendiente conocido:** Redes (métricas sociales) sigue siendo un stub, y la suscripción es a nivel cuenta (cobro por hotel = refinamiento futuro).
