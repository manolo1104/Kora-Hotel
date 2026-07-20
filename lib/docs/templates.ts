// Plantillas de DOCUMENTO branded (imprimibles / exportables a PDF), tomadas
// de las plantillas HTML de Manolo. Variables {{ var }} y bloque {{#conceptos}}.
// El <img src="kora-icono-K.png"> lo reemplaza el builder por el data URI del ícono.
// Inline como string (no fs) para ser seguro en Vercel serverless.
/* eslint-disable */

export const COTIZACION_TPL = `<!DOCTYPE html>
<!--
  ============================================================================
  KORA · Plantilla de COTIZACIÓN (imprimible / exportable a PDF)
  ----------------------------------------------------------------------------
  Sintaxis de variables: {{ variable }}  (compatible con Handlebars / Mustache
  y con reemplazo simple de cadenas). Los conceptos son un bloque repetible:
  {{#conceptos}} ... {{/conceptos}}

  VARIABLES DISPONIBLES
  ── Hotel ───────────────────────────────────────────────
    hotel_nombre, hotel_ubicacion, hotel_email, hotel_telefono
  ── Documento ───────────────────────────────────────────
    folio, fecha_emision, valida_hasta
  ── Cliente ─────────────────────────────────────────────
    cliente_nombre, cliente_email, cliente_telefono
  ── Estancia ────────────────────────────────────────────
    habitacion, huespedes, noches
    entrada_dia, entrada_detalle       (ej. "25" / "Vie · Jul 2026")
    salida_dia,  salida_detalle        (ej. "27" / "Dom · Jul 2026")
  ── Conceptos (repetible) ───────────────────────────────
    conceptos[] -> { nombre, descripcion, cantidad, precio_unitario, importe }
  ── Totales ─────────────────────────────────────────────
    subtotal, total, moneda            (ej. "$6,400.00" / "MXN")
    anticipo_pct, anticipo, saldo
  ── Contacto de cierre ──────────────────────────────────
    whatsapp
  ============================================================================
-->
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cotización {{ folio }} · {{ hotel_nombre }}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: letter; margin: 0.4in; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin:0; background:#e7e4dc; font-family:'Plus Jakarta Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; color:#1f2823; }
  .sheet { width:7.7in; margin:28px auto; background:#fff; padding:0.4in; box-shadow:0 24px 60px rgba(27,67,50,.16); }
  table { border-collapse:collapse; }
  @media print {
    body { background:#fff; }
    .sheet { width:auto; margin:0; padding:0; box-shadow:none; }
  }
</style>
</head>
<body>
<div class="sheet">

  <!-- Encabezado -->
  <div style="background:#1B4332;border-radius:18px;padding:20px 34px;color:#fff;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:24px;">
      <div>
        <div style="font-weight:800;font-size:26px;letter-spacing:-.6px;line-height:1;">{{ hotel_nombre }}<span style="color:#52B788;">.</span></div>
        <div style="font-weight:500;font-size:12px;color:rgba(255,255,255,.62);margin-top:9px;">{{ hotel_ubicacion }}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <span style="display:inline-block;background:rgba(82,183,136,.16);border:1px solid rgba(82,183,136,.4);color:#7fd3a8;font-weight:700;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;padding:6px 14px;border-radius:999px;">Cotización</span>
        <div style="font-weight:700;font-size:15px;color:#fff;margin-top:14px;letter-spacing:.5px;">{{ folio }}</div>
        <div style="font-weight:500;font-size:11.5px;color:rgba(255,255,255,.58);margin-top:3px;">Emitida {{ fecha_emision }}</div>
      </div>
    </div>
  </div>

  <!-- Válida hasta -->
  <div style="display:flex;align-items:center;gap:9px;background:#f4efe6;border-radius:11px;padding:12px 18px;margin-top:14px;">
    <span style="font-size:14px;">⏳</span>
    <span style="font-weight:500;font-size:12.5px;color:#7a6f5c;">Esta cotización es válida hasta el <strong style="color:#5a5142;">{{ valida_hasta }}</strong>. Después, la tarifa y la disponibilidad pueden cambiar.</span>
  </div>

  <!-- Para / De -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:18px;">
    <div>
      <div style="font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#a3aaa4;margin-bottom:10px;">Cotización para</div>
      <div style="font-weight:700;font-size:16px;color:#1f2823;">{{ cliente_nombre }}</div>
      <div style="font-weight:500;font-size:12.5px;color:#6b746e;line-height:1.7;margin-top:4px;">{{ cliente_email }}<br>{{ cliente_telefono }}</div>
    </div>
    <div>
      <div style="font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#a3aaa4;margin-bottom:10px;">Atendido por</div>
      <div style="font-weight:700;font-size:16px;color:#1f2823;">{{ hotel_nombre }}</div>
      <div style="font-weight:500;font-size:12.5px;color:#6b746e;line-height:1.7;margin-top:4px;">{{ hotel_email }}<br>{{ hotel_telefono }}</div>
    </div>
  </div>

  <!-- Resumen de estancia -->
  <div style="border:1px solid #eceae2;border-radius:16px;padding:16px 24px;margin-top:14px;background:#fcfbf8;">
    <div style="font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#a3aaa4;margin-bottom:14px;">Detalle de la estancia</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;">
      <div>
        <div style="font-weight:700;font-size:19px;color:#1f2823;">{{ habitacion }}</div>
        <div style="font-weight:500;font-size:12.5px;color:#6b746e;margin-top:4px;">{{ huespedes }} huéspedes · {{ noches }} noches</div>
      </div>
      <div style="display:flex;align-items:center;gap:22px;">
        <div style="text-align:center;">
          <div style="font-weight:700;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:#a99a82;margin-bottom:4px;">Entrada</div>
          <div style="font-weight:800;font-size:22px;color:#1f2823;line-height:1;">{{ entrada_dia }}</div>
          <div style="font-weight:500;font-size:11px;color:#8a7d6b;margin-top:3px;">{{ entrada_detalle }}</div>
        </div>
        <span style="font-weight:600;font-size:11px;color:#c2b79f;">&rarr;</span>
        <div style="text-align:center;">
          <div style="font-weight:700;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:#a99a82;margin-bottom:4px;">Salida</div>
          <div style="font-weight:800;font-size:22px;color:#1f2823;line-height:1;">{{ salida_dia }}</div>
          <div style="font-weight:500;font-size:11px;color:#8a7d6b;margin-top:3px;">{{ salida_detalle }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Conceptos -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
    <thead>
      <tr style="border-bottom:2px solid #1B4332;">
        <th style="text-align:left;padding:0 0 10px;font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a938c;">Concepto</th>
        <th style="text-align:center;padding:0 0 10px;font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a938c;">Cantidad</th>
        <th style="text-align:right;padding:0 0 10px;font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a938c;">Precio unit.</th>
        <th style="text-align:right;padding:0 0 10px;font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a938c;">Importe</th>
      </tr>
    </thead>
    <tbody>
      {{#conceptos}}
      <tr style="border-bottom:1px solid #f0efe8;">
        <td style="padding:10px 0;font-weight:600;font-size:14px;color:#1f2823;">{{ nombre }}<div style="font-weight:500;font-size:11.5px;color:#9aa39d;margin-top:2px;">{{ descripcion }}</div></td>
        <td style="padding:10px 0;text-align:center;font-weight:500;font-size:13px;color:#5a645f;">{{ cantidad }}</td>
        <td style="padding:10px 0;text-align:right;font-weight:500;font-size:13px;color:#5a645f;">{{ precio_unitario }}</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;font-size:14px;color:#1f2823;">{{ importe }}</td>
      </tr>
      {{/conceptos}}
    </tbody>
  </table>

  <!-- Totales -->
  <div style="display:flex;justify-content:flex-end;margin-top:14px;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:290px;">
      <tr><td style="padding:6px 0;font-weight:500;font-size:13px;color:#6b746e;">Subtotal</td><td style="padding:6px 0;text-align:right;font-weight:500;font-size:13px;color:#5a645f;">{{ subtotal }}</td></tr>
      <tr><td style="padding:6px 0;font-weight:500;font-size:13px;color:#6b746e;">Impuestos (IVA + ISH)</td><td style="padding:6px 0;text-align:right;font-weight:500;font-size:13px;color:#9aa39d;">Incluidos</td></tr>
      <tr><td colspan="2" style="border-top:2px solid #1B4332;padding-top:4px;"></td></tr>
      <tr><td style="padding:8px 0 0;font-weight:800;font-size:16px;color:#1f2823;">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:800;font-size:20px;color:#1B4332;">{{ total }} <span style="font-size:12px;font-weight:600;color:#9aa39d;">{{ moneda }}</span></td></tr>
    </table>
  </div>

  <!-- Anticipo -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
    <div style="background:#e4f3ea;border-radius:14px;padding:14px 20px;">
      <div style="font-weight:600;font-size:11px;letter-spacing:.5px;color:#2d7a54;">Anticipo requerido ({{ anticipo_pct }})</div>
      <div style="font-weight:800;font-size:22px;color:#1B4332;margin-top:6px;">{{ anticipo }}</div>
      <div style="font-weight:500;font-size:11px;color:#5c8a73;margin-top:3px;">Para confirmar tu reserva</div>
    </div>
    <div style="background:#f4efe6;border-radius:14px;padding:14px 20px;">
      <div style="font-weight:600;font-size:11px;letter-spacing:.5px;color:#8a7d6b;">Saldo al llegar</div>
      <div style="font-weight:800;font-size:22px;color:#5a5142;margin-top:6px;">{{ saldo }}</div>
      <div style="font-weight:500;font-size:11px;color:#a99a82;margin-top:3px;">Pagadero en el check-in</div>
    </div>
  </div>

  <!-- Condiciones -->
  <div style="margin-top:16px;padding-top:14px;border-top:1px solid #eceae2;">
    <div style="font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#a3aaa4;margin-bottom:12px;">Condiciones</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 26px;">
      <div style="font-weight:500;font-size:12px;color:#6b746e;line-height:1.55;"><strong style="color:#1f2823;">Check-in:</strong> desde 3:00 PM · <strong style="color:#1f2823;">Check-out:</strong> antes de 12:00 PM</div>
      <div style="font-weight:500;font-size:12px;color:#6b746e;line-height:1.55;"><strong style="color:#1f2823;">Cancelación gratuita</strong> hasta 7 días antes de la llegada.</div>
      <div style="font-weight:500;font-size:12px;color:#6b746e;line-height:1.55;">El anticipo confirma la reserva y se descuenta del total.</div>
      <div style="font-weight:500;font-size:12px;color:#6b746e;line-height:1.55;">Precios en pesos mexicanos (MXN) con impuestos incluidos.</div>
    </div>
  </div>

  <div style="text-align:center;margin-top:8px;padding-top:14px;">
    <div style="font-weight:600;font-size:13px;color:#1f2823;">¿Listo para confirmar?</div>
    <div style="font-weight:500;font-size:12px;color:#8a938c;margin-top:4px;">Responde este correo o escríbenos por WhatsApp al {{ whatsapp }} y aseguramos tu habitación.</div>
  </div>

  <!-- Pie Kora -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 4px 0;margin-top:16px;border-top:1px solid #ecebe4;">
    <div style="display:flex;align-items:center;gap:7px;">
      <img src="kora-icono-K.png" width="18" height="18" alt="Kora" style="border-radius:5px;display:block;">
      <span style="font-weight:500;font-size:10px;color:#9aa39d;">Documento generado con <strong style="color:#1B4332;font-weight:700;">Kora</strong> · sistema de reservas para hoteles</span>
    </div>
    <span style="font-weight:500;font-size:10px;color:#b6bcb6;letter-spacing:.3px;">{{ folio }}</span>
  </div>

</div>
</body>
</html>
`;

export const RESERVA_TPL = `<!DOCTYPE html>
<!--
  ============================================================================
  KORA · Plantilla de COMPROBANTE DE RESERVA (imprimible / exportable a PDF)
  ----------------------------------------------------------------------------
  Sintaxis de variables: {{ variable }}  (compatible con Handlebars / Mustache
  y con reemplazo simple de cadenas). Los conceptos son un bloque repetible:
  {{#conceptos}} ... {{/conceptos}}

  VARIABLES DISPONIBLES
  ── Hotel ───────────────────────────────────────────────
    hotel_nombre, hotel_ubicacion, hotel_email, hotel_telefono
  ── Documento ───────────────────────────────────────────
    folio, fecha_reserva
  ── Cliente ─────────────────────────────────────────────
    cliente_nombre, cliente_email, cliente_telefono
  ── Estancia ────────────────────────────────────────────
    habitacion, huespedes, noches
    entrada_dia, entrada_detalle       (ej. "25" / "Vie · desde 3:00 PM")
    salida_dia,  salida_detalle        (ej. "27" / "Dom · antes 12 PM")
  ── Conceptos (repetible) ───────────────────────────────
    conceptos[] -> { nombre, descripcion, cantidad, precio_unitario, importe }
  ── Totales y pago ──────────────────────────────────────
    total_estancia, moneda
    anticipo_pagado, restante
    metodo_pago, fecha_pago            (ej. "Tarjeta ···· 4242" / "16 jul 2026")
  ── Contacto de cierre ──────────────────────────────────
    whatsapp
  ============================================================================
-->
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reserva {{ folio }} · {{ hotel_nombre }}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: letter; margin: 0.4in; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin:0; background:#e7e4dc; font-family:'Plus Jakarta Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; color:#1f2823; }
  .sheet { width:7.7in; margin:28px auto; background:#fff; padding:0.4in; box-shadow:0 24px 60px rgba(27,67,50,.16); }
  table { border-collapse:collapse; }
  @media print {
    body { background:#fff; }
    .sheet { width:auto; margin:0; padding:0; box-shadow:none; }
  }
</style>
</head>
<body>
<div class="sheet">

  <!-- Encabezado -->
  <div style="background:#1B4332;border-radius:18px;padding:20px 34px;color:#fff;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:24px;">
      <div>
        <div style="font-weight:800;font-size:26px;letter-spacing:-.6px;line-height:1;">{{ hotel_nombre }}<span style="color:#52B788;">.</span></div>
        <div style="font-weight:500;font-size:12px;color:rgba(255,255,255,.62);margin-top:9px;">{{ hotel_ubicacion }}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <span style="display:inline-flex;align-items:center;gap:6px;background:#52B788;color:#0f2e21;font-weight:700;font-size:11px;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:999px;">&#10003; Confirmada</span>
        <div style="font-weight:700;font-size:15px;color:#fff;margin-top:14px;letter-spacing:.5px;">Folio {{ folio }}</div>
        <div style="font-weight:500;font-size:11.5px;color:rgba(255,255,255,.58);margin-top:3px;">Reservado {{ fecha_reserva }}</div>
      </div>
    </div>
  </div>

  <!-- Aviso -->
  <div style="display:flex;align-items:center;gap:9px;background:#e4f3ea;border-radius:11px;padding:12px 18px;margin-top:14px;">
    <span style="font-size:14px;">🎉</span>
    <span style="font-weight:500;font-size:12.5px;color:#2d7a54;">Tu reserva está <strong style="color:#1B4332;">confirmada</strong>. Presenta este comprobante a tu llegada. ¡Te esperamos!</span>
  </div>

  <!-- Para / De -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:18px;">
    <div>
      <div style="font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#a3aaa4;margin-bottom:10px;">Huésped</div>
      <div style="font-weight:700;font-size:16px;color:#1f2823;">{{ cliente_nombre }}</div>
      <div style="font-weight:500;font-size:12.5px;color:#6b746e;line-height:1.7;margin-top:4px;">{{ cliente_email }}<br>{{ cliente_telefono }}</div>
    </div>
    <div>
      <div style="font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#a3aaa4;margin-bottom:10px;">Hotel</div>
      <div style="font-weight:700;font-size:16px;color:#1f2823;">{{ hotel_nombre }}</div>
      <div style="font-weight:500;font-size:12.5px;color:#6b746e;line-height:1.7;margin-top:4px;">{{ hotel_email }}<br>{{ hotel_telefono }}</div>
    </div>
  </div>

  <!-- Resumen de estancia -->
  <div style="border:1px solid #eceae2;border-radius:16px;padding:16px 24px;margin-top:14px;background:#fcfbf8;">
    <div style="font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#a3aaa4;margin-bottom:14px;">Detalle de la estancia</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;">
      <div>
        <div style="font-weight:700;font-size:19px;color:#1f2823;">{{ habitacion }}</div>
        <div style="font-weight:500;font-size:12.5px;color:#6b746e;margin-top:4px;">{{ huespedes }} huéspedes · {{ noches }} noches</div>
      </div>
      <div style="display:flex;align-items:center;gap:22px;">
        <div style="text-align:center;">
          <div style="font-weight:700;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:#a99a82;margin-bottom:4px;">Entrada</div>
          <div style="font-weight:800;font-size:22px;color:#1f2823;line-height:1;">{{ entrada_dia }}</div>
          <div style="font-weight:500;font-size:11px;color:#8a7d6b;margin-top:3px;">{{ entrada_detalle }}</div>
        </div>
        <span style="font-weight:600;font-size:11px;color:#c2b79f;">&rarr;</span>
        <div style="text-align:center;">
          <div style="font-weight:700;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:#a99a82;margin-bottom:4px;">Salida</div>
          <div style="font-weight:800;font-size:22px;color:#1f2823;line-height:1;">{{ salida_dia }}</div>
          <div style="font-weight:500;font-size:11px;color:#8a7d6b;margin-top:3px;">{{ salida_detalle }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Conceptos -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
    <thead>
      <tr style="border-bottom:2px solid #1B4332;">
        <th style="text-align:left;padding:0 0 10px;font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a938c;">Concepto</th>
        <th style="text-align:center;padding:0 0 10px;font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a938c;">Cantidad</th>
        <th style="text-align:right;padding:0 0 10px;font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a938c;">Precio unit.</th>
        <th style="text-align:right;padding:0 0 10px;font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a938c;">Importe</th>
      </tr>
    </thead>
    <tbody>
      {{#conceptos}}
      <tr style="border-bottom:1px solid #f0efe8;">
        <td style="padding:10px 0;font-weight:600;font-size:14px;color:#1f2823;">{{ nombre }}<div style="font-weight:500;font-size:11.5px;color:#9aa39d;margin-top:2px;">{{ descripcion }}</div></td>
        <td style="padding:10px 0;text-align:center;font-weight:500;font-size:13px;color:#5a645f;">{{ cantidad }}</td>
        <td style="padding:10px 0;text-align:right;font-weight:500;font-size:13px;color:#5a645f;">{{ precio_unitario }}</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;font-size:14px;color:#1f2823;">{{ importe }}</td>
      </tr>
      {{/conceptos}}
    </tbody>
  </table>

  <!-- Totales -->
  <div style="display:flex;justify-content:flex-end;margin-top:14px;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:290px;">
      <tr><td style="padding:6px 0;font-weight:500;font-size:13px;color:#6b746e;">Total de la estancia</td><td style="padding:6px 0;text-align:right;font-weight:500;font-size:13px;color:#5a645f;">{{ total_estancia }}</td></tr>
      <tr><td style="padding:6px 0;font-weight:500;font-size:13px;color:#6b746e;">Anticipo pagado</td><td style="padding:6px 0;text-align:right;font-weight:600;font-size:13px;color:#2d7a54;">&minus; {{ anticipo_pagado }}</td></tr>
      <tr><td colspan="2" style="border-top:2px solid #1B4332;padding-top:4px;"></td></tr>
      <tr><td style="padding:8px 0 0;font-weight:800;font-size:16px;color:#1f2823;">Restante al llegar</td><td style="padding:8px 0 0;text-align:right;font-weight:800;font-size:20px;color:#1B4332;">{{ restante }} <span style="font-size:12px;font-weight:600;color:#9aa39d;">{{ moneda }}</span></td></tr>
    </table>
  </div>

  <!-- Estado de pago -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
    <div style="background:#e4f3ea;border-radius:14px;padding:14px 20px;">
      <div style="font-weight:600;font-size:11px;letter-spacing:.5px;color:#2d7a54;">&#10003; Anticipo pagado</div>
      <div style="font-weight:800;font-size:22px;color:#1B4332;margin-top:6px;">{{ anticipo_pagado }}</div>
      <div style="font-weight:500;font-size:11px;color:#5c8a73;margin-top:3px;">{{ metodo_pago }} · {{ fecha_pago }}</div>
    </div>
    <div style="background:#f4efe6;border-radius:14px;padding:14px 20px;">
      <div style="font-weight:600;font-size:11px;letter-spacing:.5px;color:#8a7d6b;">Pendiente al llegar</div>
      <div style="font-weight:800;font-size:22px;color:#5a5142;margin-top:6px;">{{ restante }}</div>
      <div style="font-weight:500;font-size:11px;color:#a99a82;margin-top:3px;">Efectivo o tarjeta en recepción</div>
    </div>
  </div>

  <!-- Antes de tu llegada -->
  <div style="margin-top:16px;padding-top:14px;border-top:1px solid #eceae2;">
    <div style="font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#a3aaa4;margin-bottom:12px;">Antes de tu llegada</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 26px;">
      <div style="font-weight:500;font-size:12px;color:#6b746e;line-height:1.55;"><strong style="color:#1f2823;">Check-in:</strong> desde 3:00 PM · <strong style="color:#1f2823;">Check-out:</strong> antes de 12:00 PM</div>
      <div style="font-weight:500;font-size:12px;color:#6b746e;line-height:1.55;">Presenta este comprobante y una identificación oficial.</div>
      <div style="font-weight:500;font-size:12px;color:#6b746e;line-height:1.55;"><strong style="color:#1f2823;">Cancelación:</strong> el anticipo es reembolsable hasta 7 días antes.</div>
      <div style="font-weight:500;font-size:12px;color:#6b746e;line-height:1.55;">¿Llegas fuera de horario? Avísanos por WhatsApp y lo coordinamos.</div>
    </div>
  </div>

  <div style="text-align:center;margin-top:8px;padding-top:14px;">
    <div style="font-weight:700;font-size:14px;color:#1f2823;">¡Todo listo para tu llegada! 🌿</div>
    <div style="font-weight:500;font-size:12px;color:#8a938c;margin-top:4px;">Cualquier duda, escríbenos por WhatsApp al {{ whatsapp }}. Con gusto te ayudamos.</div>
  </div>

  <!-- Pie Kora -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 4px 0;margin-top:16px;border-top:1px solid #ecebe4;">
    <div style="display:flex;align-items:center;gap:7px;">
      <img src="kora-icono-K.png" width="18" height="18" alt="Kora" style="border-radius:5px;display:block;">
      <span style="font-weight:500;font-size:10px;color:#9aa39d;">Documento generado con <strong style="color:#1B4332;font-weight:700;">Kora</strong> · sistema de reservas para hoteles</span>
    </div>
    <span style="font-weight:500;font-size:10px;color:#b6bcb6;letter-spacing:.3px;">Folio {{ folio }}</span>
  </div>

</div>
</body>
</html>
`;
