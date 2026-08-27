# Kora · Manual de operación (1 persona)

Este es el runbook de Manolo. Todo lo de abajo pasa solo; aquí dice qué te llega,
qué hacer en cada caso y los pocos comandos que existen.

## Qué te llega al correo (NOTIFY_EMAIL)

| Correo | Cuándo | Qué hacer |
|---|---|---|
| 🔔 Lead nuevo | Al instante, cuando alguien deja sus datos en el sitio | Tocar el botón "Escribirle por WhatsApp" (mensaje ya redactado). Idealmente en los primeros 5 minutos. |
| 💳 Nueva suscripción | Cuando alguien paga un plan | Nada. El cliente ya recibió su bienvenida y su recibo. Saludarlo es buen detalle. |
| ⚠️ Suscripción cancelada | Cuando un cliente cancela (o Stripe agota reintentos) | Escribirle para entender por qué (está en el CRM/Stripe). |
| ☀️ Resumen de Kora | Diario 8:00 AM (solo si hay algo) | Revisar: leads sin contactar, seguimientos vencidos, pagos con problema, chats escalados, MRR. |

El cliente con pago vencido recibe solo hasta 3 recordatorios automáticos para
actualizar su tarjeta (cron de dunning); Stripe reintenta el cobro por su lado.

## Tareas que sí son tuyas

- **Responder leads** (botón del correo o desde /crm).
- **Llamadas de venta** con leads calientes.
- **Chats escalados**: el bot de /ayuda escala a tu WhatsApp lo que no puede resolver.
- **Facturas CFDI**: si un cliente la pide, emitirla (por ahora manual).

## Cómo hacer cosas puntuales

**Dar de alta un hotel fundador en cortesía (sin cobrarle por Stripe):**
en Supabase → SQL Editor:
```sql
-- el uuid sale de Authentication → Users
insert into public.suscripciones (user_id, plan, estado)
values ('<uuid-del-usuario>', 'kora', 'cortesia')
on conflict (user_id) do update set plan = excluded.plan, estado = 'cortesia';
```

**Reembolsar un pago:** Stripe Dashboard → Payments → el pago → Refund.

**Cambiar precios:** 1) `lib/oferta.ts` (lo que ve el sitio y sabe el bot),
2) crear el precio nuevo en Stripe (`node scripts/stripe-setup.mjs` tras editar
los montos ahí) y actualizar los `STRIPE_PRICE_*` en Vercel. Los clientes
existentes conservan su precio anterior.

**Ver conversaciones del chat de soporte:** Supabase → Table Editor →
`soporte_conversaciones` (las escaladas tienen `escalado = true`).

**Ver/exportar leads:** kora-hotel.com/crm (botón CSV).

## Si algo falla

- **No llegan correos:** revisar RESEND_API_KEY en Vercel y el dominio verificado en resend.com.
- **Un pago no activó el plan:** Stripe Dashboard → Webhooks → ver si el evento
  falló y reenviarlo (botón "Resend"). Verificar STRIPE_WEBHOOK_SECRET en Vercel.
- **El chat no responde:** revisar ANTHROPIC_API_KEY en Vercel.

## Variables de entorno (Vercel → Settings → Environment Variables)

`STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_KORA`,
`RESEND_API_KEY`, `RESEND_FROM`,
`NOTIFY_EMAIL`, `CRON_SECRET`, más las que ya existían (Supabase, Anthropic, GA…).
