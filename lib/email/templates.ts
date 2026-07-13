// Plantillas HTML de los correos transaccionales de Kora.
// HTML simple con estilos inline (máxima compatibilidad entre clientes de correo).

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const VERDE = "#1B4332";
const ACENTO = "#D8F3DC";

function layout(contenido: string): string {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f4f6f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:18px;">
      <span style="font-size:22px;font-weight:800;color:${VERDE};letter-spacing:-0.5px;">Kora</span>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e7ebe9;">
      ${contenido}
    </div>
    <p style="text-align:center;color:#8a948f;font-size:12px;margin-top:18px;">
      Kora · Sistema hotelero para hoteles boutique en México · <a href="${SITE}" style="color:#8a948f;">kora-hotel.com</a>
    </p>
  </div>
</body>
</html>`;
}

function boton(href: string, texto: string): string {
  return `<a href="${href}" style="display:inline-block;background:${VERDE};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:999px;">${texto}</a>`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ─── Bienvenida tras el pago ──────────────────────────────────────────────────
export function emailBienvenida({ plan, precio }: { plan: string; precio: number }) {
  return {
    subject: "¡Bienvenido a Kora! Tu plan ya está activo 🎉",
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:20px;color:#1f2823;">Tu plan <span style="color:${VERDE};">${esc(plan)}</span> ya está activo</h1>
      <p style="color:#5a645f;font-size:14px;line-height:1.6;margin:0 0 8px;">
        Gracias por confiar en Kora. Tu suscripción de $${precio.toLocaleString("es-MX")} MXN al mes quedó activa
        y tu recibo te llega por separado.
      </p>
      <p style="color:#5a645f;font-size:14px;line-height:1.6;margin:0 0 20px;">
        El siguiente paso es configurar tu hotel: te toma unos 5 minutos y tu página queda lista para recibir reservas.
      </p>
      <div style="text-align:center;margin:8px 0 14px;">${boton(`${SITE}/panel`, "Configurar mi hotel")}</div>
      <p style="color:#8a948f;font-size:13px;line-height:1.6;margin:14px 0 0;">
        ¿Dudas? Responde este correo o escríbenos por WhatsApp. Soy Manolo, el fundador, y te contesto yo.
      </p>
    `),
  };
}

// ─── Aviso interno: hotel nuevo registrado ───────────────────────────────────
export function emailHotelNuevo({
  hotel,
  ubicacion,
  whatsapp,
  email,
  slug,
}: {
  hotel: string;
  ubicacion?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  slug: string;
}) {
  const wa = (whatsapp || "").replace(/\D/g, "");
  const fila = (k: string, v: string) =>
    `<tr><td style="padding:5px 12px 5px 0;color:#8a948f;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:5px 0;color:#1f2823;">${v}</td></tr>`;
  return {
    subject: `🏨 Hotel nuevo en Kora: ${esc(hotel)}`,
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:20px;color:#1f2823;">Se registró un hotel nuevo 🎉</h1>
      <p style="color:#5a645f;font-size:14px;line-height:1.6;margin:0 0 14px;">Alguien acaba de crear su hotel en Kora:</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        ${fila("Hotel", esc(hotel))}
        ${ubicacion ? fila("Ubicación", esc(ubicacion)) : ""}
        ${email ? fila("Cuenta", esc(email)) : ""}
        ${wa ? fila("WhatsApp", `<a href="https://wa.me/${wa}" style="color:${VERDE};">${esc(whatsapp || "")}</a>`) : ""}
      </table>
      <div style="text-align:center;margin:18px 0 6px;">${boton(`${SITE}/h/${esc(slug)}/reservar`, "Ver su página")}</div>
    `),
  };
}

// ─── Aviso interno: lead nuevo ────────────────────────────────────────────────
export function emailLeadNuevo({
  nombre,
  whatsapp,
  hotel,
  origen,
  detalles,
}: {
  nombre: string;
  whatsapp: string;
  hotel?: string;
  origen: string;
  detalles?: string;
}) {
  const digitos = whatsapp.replace(/\D/g, "");
  const numero = digitos.length === 10 ? `52${digitos}` : digitos;
  const mensaje = encodeURIComponent(
    `Hola ${nombre}, soy Manolo, fundador de Kora. Vi que nos dejaste tus datos${
      hotel ? ` para ${hotel}` : ""
    } — ¿te platico cómo te ayudamos a vender más reservas directas?`
  );
  return {
    subject: `🔔 Lead nuevo: ${hotel || nombre} (${origen})`,
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:19px;color:#1f2823;">Lead nuevo en el CRM</h1>
      <table style="width:100%;font-size:14px;color:#1f2823;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#8a948f;width:110px;">Nombre</td><td style="padding:6px 0;font-weight:600;">${esc(nombre)}</td></tr>
        <tr><td style="padding:6px 0;color:#8a948f;">WhatsApp</td><td style="padding:6px 0;font-weight:600;">${esc(whatsapp)}</td></tr>
        ${hotel ? `<tr><td style="padding:6px 0;color:#8a948f;">Hotel</td><td style="padding:6px 0;font-weight:600;">${esc(hotel)}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#8a948f;">Origen</td><td style="padding:6px 0;">${esc(origen)}</td></tr>
      </table>
      ${detalles ? `<div style="background:${ACENTO}40;border-radius:10px;padding:12px 14px;margin:12px 0;font-size:13px;color:#3a443f;white-space:pre-line;">${esc(detalles)}</div>` : ""}
      <p style="color:#5a645f;font-size:13px;margin:14px 0 16px;">
        Contéstale en los primeros minutos: ahí se gana la venta.
      </p>
      <div style="text-align:center;">
        ${numero ? boton(`https://wa.me/${numero}?text=${mensaje}`, "Escribirle por WhatsApp") : ""}
        <div style="margin-top:10px;"><a href="${SITE}/crm" style="color:${VERDE};font-size:13px;font-weight:600;">Ver en el CRM →</a></div>
      </div>
    `),
  };
}

// ─── Dunning: pago vencido (al cliente) ───────────────────────────────────────
export function emailPagoVencido({ intento }: { intento: number }) {
  return {
    subject:
      intento >= 3
        ? "Último aviso: tu pago de Kora no ha podido procesarse"
        : "Tu pago de Kora no pasó — actualiza tu tarjeta",
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:19px;color:#1f2823;">No pudimos procesar tu pago</h1>
      <p style="color:#5a645f;font-size:14px;line-height:1.6;margin:0 0 8px;">
        Tu banco rechazó el cargo de tu mensualidad de Kora. Es muy común (límite de la tarjeta,
        tarjeta vencida o un bloqueo del banco) y se arregla en 1 minuto actualizando tu método de pago.
      </p>
      <p style="color:#5a645f;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Mientras tanto tu servicio sigue activo. ${
          intento >= 3
            ? "Si no se procesa pronto, tu suscripción se pausará automáticamente."
            : "Reintentaremos el cobro automáticamente."
        }
      </p>
      <div style="text-align:center;margin:8px 0 14px;">${boton(`${SITE}/panel`, "Actualizar mi tarjeta")}</div>
      <p style="color:#8a948f;font-size:13px;line-height:1.6;margin:14px 0 0;">
        En tu panel, toca "Administrar mi pago". ¿Necesitas ayuda? Responde este correo.
      </p>
    `),
  };
}

// ─── Digest diario para el fundador ──────────────────────────────────────────
export function emailDigest({ titulo, secciones }: { titulo: string; secciones: { encabezado: string; lineas: string[] }[] }) {
  return {
    subject: titulo,
    html: layout(
      secciones
        .map(
          (s) => `
      <h2 style="margin:18px 0 8px;font-size:15px;color:${VERDE};">${esc(s.encabezado)}</h2>
      <ul style="margin:0;padding-left:18px;color:#3a443f;font-size:13px;line-height:1.7;">
        ${s.lineas.map((l) => `<li>${l}</li>`).join("")}
      </ul>`
        )
        .join("") +
        `<div style="text-align:center;margin-top:22px;">${boton(`${SITE}/crm`, "Abrir el CRM")}</div>`
    ),
  };
}
