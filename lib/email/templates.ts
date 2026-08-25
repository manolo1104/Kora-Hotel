// Correos de la cuenta de Kora: al hotelero como cliente (bienvenida tras el
// pago, dunning) y los internos del fundador (lead nuevo, hotel nuevo, digest).
// También la secuencia de seguimiento a leads del sitio.
//
// Todos con el sistema de diseño único de lib/email/design.ts: la misma
// tipografía y los mismos colores que los correos del huésped.

import {
  T as TOK,
  FONT,
  doc,
  esc,
  cabecera,
  titulo,
  saludo,
  parrafo,
  boton,
  botonOscuro,
  tablaDatos,
  caja,
  lista,
  pieKora,
  respiro,
  waLink,
  etiqueta,
} from "@/lib/email/design";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

// ─── Bienvenida tras el pago ──────────────────────────────────────────────────

export function emailBienvenida({ plan, precio }: { plan: string; precio: number }) {
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Plan activo", check: true }) +
    titulo(`Tu plan ${esc(plan)} ya está activo`) +
    parrafo(
      `Gracias por confiar en Kora. Tu suscripción de <strong style="color:${TOK.tinta};">$${precio.toLocaleString("es-MX")} MXN al mes</strong> quedó activa y tu recibo te llega por separado.`,
    ) +
    parrafo(
      `El siguiente paso es dejar tu hotel listo: te toma unos 5 minutos y tu página queda recibiendo reservas.`,
    ) +
    boton(`${SITE}/panel`, "Ir a mi panel") +
    parrafo(
      `¿Dudas? Responde este correo o escríbenos por WhatsApp. Soy Manolo, el fundador, y te contesto yo.`,
    ) +
    respiro +
    pieKora("Mes a mes, sin permanencia: cancelas tú mismo en un clic desde tu panel.");

  return {
    subject: "¡Bienvenido a Kora! Tu plan ya está activo 🎉",
    html: doc("Tu plan de Kora está activo", `Tu plan ${plan} quedó activo. Este es el siguiente paso.`, inner),
  };
}

// ─── Aviso interno: hotel nuevo registrado ───────────────────────────────────

export function emailHotelNuevo({
  hotel,
  ubicacion,
  whatsapp,
  email,
  slug,
  usuario,
  count,
}: {
  hotel: string;
  ubicacion?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  slug: string;
  usuario?: string | null;
  count?: number | null;
}) {
  const nombre = (usuario && usuario.trim()) || (email ? email.split("@")[0] : "") || "Un hotelero";
  const contactoWa = waLink(
    whatsapp ?? undefined,
    `Hola ${nombre}, soy Manolo, fundador de Kora. Vi que acabas de crear ${hotel} — ¿te ayudo a dejarlo listo para recibir reservas?`,
  );

  const check = (txt: string, ok: boolean) =>
    `<div style="font-family:${FONT};font-size:13.5px;color:${ok ? TOK.tinta : "#9aa0a6"};margin:0 0 9px;"><span style="display:inline-block;width:19px;height:19px;border-radius:50%;${ok ? `background:${TOK.verdeClaro};color:#fff;` : "background:#fff;border:1.5px solid #d3d8d6;"}font-size:11px;line-height:19px;text-align:center;vertical-align:middle;margin-right:9px;">${ok ? "✓" : ""}</span>${esc(txt)}</div>`;

  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Notificación interna" }) +
    titulo(
      "Nuevo hotel activado 🎉",
      count && count > 0 ? `<strong style="color:${TOK.verde};">#${count}</strong> hotel en Kora` : undefined,
    ) +
    parrafo(
      `<strong style="color:${TOK.tinta};">${esc(nombre)}</strong> acaba de crear su cuenta y configuró su primer hotel. Aún no recibe reservas — buen momento para darle la bienvenida.`,
    ) +
    tablaDatos([
      ...(email ? [{ k: "Email", v: esc(email) }] : []),
      ...(whatsapp ? [{ k: "WhatsApp", v: esc(whatsapp) }] : []),
      { k: "Hotel", v: esc(hotel) },
      ...(ubicacion ? [{ k: "Ubicación", v: esc(ubicacion) }] : []),
      { k: "Plan", v: "Prueba gratis · 30 días" },
    ]) +
    `<tr><td style="padding:20px 40px 0;">
      <div style="background:${TOK.panel};border:1px solid ${TOK.borde};border-radius:12px;padding:16px 18px;">
        ${etiqueta("Onboarding")}
        ${check("Cuenta creada", true)}
        ${check("Primer hotel configurado", true)}
        ${check("Primera reserva recibida", false)}
      </div>
    </td></tr>` +
    (contactoWa ? boton(contactoWa, "Darle la bienvenida por WhatsApp") : "") +
    parrafo(
      `<a href="${SITE}/h/${esc(slug)}/reservar" style="color:${TOK.verde};font-weight:600;text-decoration:none;">Ver su página →</a>`,
      "text-align:center;",
    ) +
    respiro +
    pieKora("🔒 Este aviso solo llega a ti, el fundador.");

  return {
    subject: `🏨 Hotel nuevo en Kora: ${hotel}`,
    html: doc(`Hotel nuevo: ${hotel}`, `${nombre} creó ${hotel} en Kora`, inner),
  };
}

// ─── Aviso interno: lead nuevo ────────────────────────────────────────────────

export function emailLeadNuevo({
  nombre,
  whatsapp,
  email,
  hotel,
  origen,
  detalles,
}: {
  nombre: string;
  whatsapp: string;
  email?: string;
  hotel?: string;
  origen: string;
  detalles?: string;
}) {
  const wa = waLink(
    whatsapp,
    `Hola ${nombre}, soy Manolo, fundador de Kora. Vi que nos dejaste tus datos${
      hotel ? ` para ${hotel}` : ""
    } — ¿te platico cómo te ayudamos a vender más reservas directas?`,
  );

  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Lead nuevo" }) +
    titulo("Alguien quiere hablar contigo") +
    tablaDatos([
      { k: "Nombre", v: esc(nombre) },
      { k: "WhatsApp", v: esc(whatsapp) },
      ...(email ? [{ k: "Correo", v: esc(email) }] : []),
      ...(hotel ? [{ k: "Hotel", v: esc(hotel) }] : []),
      { k: "Origen", v: esc(origen) },
    ]) +
    (detalles ? caja(esc(detalles).replace(/\n/g, "<br>")) : "") +
    caja("Contéstale en los primeros minutos: ahí se gana la venta.", "alerta") +
    (wa ? boton(wa, "Escribirle por WhatsApp") : "") +
    parrafo(
      `<a href="${SITE}/crm" style="color:${TOK.verde};font-weight:600;text-decoration:none;">Ver en el CRM →</a>`,
      "text-align:center;",
    ) +
    respiro +
    pieKora("🔒 Este aviso solo llega a ti, el fundador.");

  return {
    subject: `🔔 Lead nuevo: ${hotel || nombre} (${origen})`,
    html: doc(`Lead nuevo: ${hotel || nombre}`, `${nombre} dejó sus datos vía ${origen}`, inner),
  };
}

// ─── Secuencia de seguimiento al LEAD (hotelero interesado) ───────────────────
// Tres toques automáticos: el mismo día, al día 3 y al día 7. Antes no existía
// ninguno — el formulario no pedía correo y el único seguimiento posible era
// que Manolo se acordara de escribir por WhatsApp.

export type LeadSecuencia = "lead_day0" | "lead_day3" | "lead_day7";

const WA_KORA = process.env.NEXT_PUBLIC_WHATSAPP_KORA || "";

function ctaKora(texto: string, nombre: string): string {
  const wa = waLink(WA_KORA, `Hola Manolo, soy ${nombre}. Vi tu correo de Kora y quiero saber más.`);
  return wa ? boton(wa, texto) : botonOscuro(`${SITE}/contacto`, texto);
}

/** Toque 1 — el mismo día: agradece, aterriza qué es Kora y da un siguiente paso. */
export function emailLeadDay0({ nombre, hotel }: { nombre: string; hotel?: string }) {
  const first = (nombre || "").trim().split(/\s+/)[0] || "hotelero";
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Gracias por escribirnos" }) +
    titulo("Recibimos tus datos") +
    saludo(
      "Hola",
      esc(first),
      `Gracias por dejarnos tus datos${hotel ? ` para <strong>${esc(hotel)}</strong>` : ""}. Soy Manolo, fundador de Kora, y te voy a escribir personalmente por WhatsApp en las próximas horas.`,
    ) +
    parrafo(
      `Mientras tanto, en corto: <strong style="color:${TOK.tinta};">Kora es el motor de reservas directas de tu hotel</strong>. La reserva se paga en tu página, el dinero te llega a tu cuenta y no pagas comisión por venta a nadie.`,
    ) +
    lista("Lo que se resuelve el primer día", [
      "Tu página de reservas con tus cuartos, tus precios y tus fotos",
      "Cobro con tarjeta y OXXO, directo a tu cuenta de banco",
      "Correos automáticos al huésped: confirmación, llegada y post-estancia",
    ]) +
    ctaKora("Platicamos por WhatsApp", first) +
    parrafo(
      `Si prefieres verlo antes de hablar, aquí está todo: <a href="${SITE}" style="color:${TOK.verde};font-weight:600;text-decoration:none;">kora-hotel.com</a>`,
    ) +
    respiro +
    pieKora();

  return {
    subject: `${first}, recibimos tus datos — te escribo hoy`,
    html: doc("Recibimos tus datos — Kora", "Soy Manolo, fundador de Kora. Te escribo hoy por WhatsApp.", inner),
  };
}

/** Toque 2 — día 3: la objeción real (las comisiones) con números. */
export function emailLeadDay3({ nombre, hotel }: { nombre: string; hotel?: string }) {
  const first = (nombre || "").trim().split(/\s+/)[0] || "hotelero";
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "La cuenta que casi nadie hace" }) +
    titulo("¿Cuánto te cuesta cada reserva de OTA?") +
    saludo(
      "Hola",
      esc(first),
      `Te escribo otra vez porque esto es lo que más mueve la aguja en ${hotel ? `<strong>${esc(hotel)}</strong>` : "un hotel chico"}.`,
    ) +
    parrafo(
      `Las OTAs cobran entre <strong style="color:${TOK.tinta};">15% y 20%</strong> de cada reserva. En un hotel que factura $80,000 al mes por ese canal, son entre <strong style="color:${TOK.tinta};">$12,000 y $16,000 mensuales</strong> que se van en comisión.`,
    ) +
    caja(
      `Kora cuesta <strong>$550 MXN al mes</strong>, fijo, sin comisión por reserva. Con que le quites <strong>una sola reserva al mes</strong> a las OTAs, ya se pagó solo.`,
      "exito",
    ) +
    parrafo(
      `No se trata de salirte de Booking: se trata de que el huésped que ya te encontró en Instagram o en Google reserve directo contigo en vez de irse a buscarte a la OTA.`,
    ) +
    ctaKora("Quiero ver mis números", first) +
    respiro +
    pieKora();

  return {
    subject: `${first}, la cuenta de las comisiones (toma 2 minutos)`,
    html: doc(
      "Lo que te cuestan las comisiones — Kora",
      "$550 al mes fijo contra 15-20% por reserva. Con una reserva al mes ya se paga.",
      inner,
    ),
  };
}

/** Toque 3 — día 7: cierre honesto. Deja la puerta abierta y no vuelve a insistir. */
export function emailLeadDay7({ nombre }: { nombre: string; hotel?: string }) {
  const first = (nombre || "").trim().split(/\s+/)[0] || "hotelero";
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Último correo" }) +
    titulo("¿Lo dejamos para después?") +
    saludo(
      "Hola",
      esc(first),
      `Es mi último correo, no te quiero llenar la bandeja. Si ahora no es el momento, con toda confianza ignóralo.`,
    ) +
    parrafo(
      `Si en algún momento quieres probarlo: son <strong style="color:${TOK.tinta};">30 días gratis, sin tarjeta</strong>. Dejas tu hotel montado, ves si te entran reservas y decides.`,
    ) +
    parrafo(
      `Y si lo que necesitas es otra cosa, respóndeme igual y te digo con honestidad si Kora te sirve o no. Prefiero eso a venderte algo que no te toca.`,
    ) +
    ctaKora("Probar 30 días gratis", first) +
    respiro +
    pieKora("Este es el último correo de esta secuencia. No recibirás más recordatorios.");

  return {
    subject: `${first}, ¿lo dejamos para después?`,
    html: doc("Último correo — Kora", "30 días gratis sin tarjeta, cuando tú quieras.", inner),
  };
}

export function emailLeadSecuencia(
  tipo: LeadSecuencia,
  datos: { nombre: string; hotel?: string },
): { subject: string; html: string } {
  if (tipo === "lead_day3") return emailLeadDay3(datos);
  if (tipo === "lead_day7") return emailLeadDay7(datos);
  return emailLeadDay0(datos);
}

// ─── Dunning: pago vencido (al cliente) ───────────────────────────────────────

export function emailPagoVencido({ intento }: { intento: number }) {
  const ultimo = intento >= 3;
  const inner =
    cabecera({ nombre: "Kora", eyebrow: ultimo ? "Último aviso" : "Problema con tu pago" }) +
    titulo("No pudimos procesar tu pago") +
    parrafo(
      `Tu banco rechazó el cargo de tu mensualidad de Kora. Es muy común (límite de la tarjeta, tarjeta vencida o un bloqueo del banco) y se arregla en un minuto actualizando tu método de pago.`,
    ) +
    caja(
      ultimo
        ? `Mientras tanto tu servicio sigue activo, pero <strong>si no se procesa pronto, tu suscripción se pausará automáticamente</strong>.`
        : `Mientras tanto tu servicio sigue activo. Reintentaremos el cobro automáticamente.`,
      ultimo ? "alerta" : "neutro",
    ) +
    botonOscuro(`${SITE}/panel`, "Actualizar mi tarjeta") +
    parrafo(
      `<span style="font-size:13px;color:${TOK.tenue};">En tu panel, toca "Administrar mi pago". ¿Necesitas ayuda? Responde este correo.</span>`,
    ) +
    respiro +
    pieKora();

  return {
    subject: ultimo
      ? "Último aviso: tu pago de Kora no ha podido procesarse"
      : "Tu pago de Kora no pasó — actualiza tu tarjeta",
    html: doc("Problema con tu pago — Kora", "Tu banco rechazó el cargo. Se arregla en un minuto.", inner),
  };
}

// ─── Digest diario para el fundador ──────────────────────────────────────────

export function emailDigest({
  titulo: asunto,
  secciones,
}: {
  titulo: string;
  secciones: { encabezado: string; lineas: string[] }[];
}) {
  const bloques = secciones
    .map(
      (s) => `<tr><td style="padding:22px 40px 0;">
        ${etiqueta(s.encabezado)}
        ${s.lineas
          .map(
            (l) =>
              `<div style="font-family:${FONT};font-weight:400;font-size:13.5px;color:${TOK.cuerpo};line-height:1.6;padding:7px 0;border-bottom:1px solid ${TOK.borde};">${l}</div>`,
          )
          .join("")}
      </td></tr>`,
    )
    .join("");

  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Resumen del día" }) +
    titulo("Esto necesita tu atención") +
    bloques +
    botonOscuro(`${SITE}/crm`, "Abrir el CRM") +
    respiro +
    pieKora("🔒 Este resumen solo llega a ti, el fundador.");

  return { subject: asunto, html: doc(asunto, "Leads, seguimientos y pagos que requieren tu atención.", inner) };
}
