// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE DISEÑO DE CORREOS DE KORA — fuente única de verdad.
//
// TODOS los correos que salen de Kora (al huésped, al hotelero y los internos)
// usan esta tipografía y esta paleta. Antes había tres estilos distintos
// conviviendo (Plus Jakarta verde, Cormorant café y HTML pelón) y el mismo
// huésped recibía correos que parecían de empresas diferentes.
//
// Reglas de la casa:
//   · Tipografía: Plus Jakarta Sans (con caída a system-ui). Nada de serif.
//   · Paleta: verde Kora sobre crema. Los acentos de estado (rojo/ámbar) solo
//     para alertas, nunca como color de marca.
//   · Todo con estilos en línea y tablas: es lo único que respetan Gmail,
//     Outlook y Apple Mail por igual.
//   · Ancho fijo de 600 px, que es lo que cabe en el panel de lectura.
//
// SOLO servidor (genera strings; no toca BD ni env).
// ─────────────────────────────────────────────────────────────────────────────

export type Lang = "es" | "en";

// ── Tokens ───────────────────────────────────────────────────────────────────

export const T = {
  // Marca
  verde: "#1B4332",
  verdeClaro: "#52B788",
  verdeTinta: "#0f2e21", // texto sobre verdeClaro

  // Superficies
  fondo: "#e7e4dc", // lienzo detrás de la tarjeta
  tarjeta: "#faf8f5", // cuerpo del correo
  panel: "#fdfbf7", // cajas internas (fechas, totales)
  pie: "#efe9df", // franja del pie
  borde: "#eee6d8",
  bordeFuerte: "#d9cdb6",

  // Texto
  tinta: "#2a2218", // titulares
  cuerpo: "#5a5142", // párrafos
  suave: "#8a7d6b", // etiquetas
  tenue: "#a99a82", // pies de foto, metadatos

  // Estado
  exito: "#2d7a54",
  alerta: "#b45309",
  error: "#b91c1c",
} as const;

export const FONT =
  "'Plus Jakarta Sans','Segoe UI',system-ui,-apple-system,Arial,sans-serif";

const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

// ── QUIÉN ESCAPA QUÉ ─────────────────────────────────────────────────────────
//
// Este archivo mezcla dos clases de función y confundirlas es como se cuela una
// inyección o un «J&amp;J» visible. La regla, explícita:
//
//   ESCAPAN su argumento (pásales TEXTO PLANO, nunca HTML, y NO les hagas esc()
//   antes — sería doble escapado):
//     · cabecera({ nombre, eyebrow })
//     · saludo(hola, nombre, …)   ← sólo `hola` y `nombre`
//     · tablaDatos([{ k, … }])    ← sólo la clave `k`
//     · lista(titulo, …)          ← sólo el título
//     · pieHotel({ nombre, ubicacion })
//     · doc(titulo, preheader, …) ← los dos primeros
//
//   ESPERAN HTML ya montado (si metes texto de un usuario, escápalo TÚ):
//     · parrafo(html), caja(html), pieKora(nota)
//     · titulo(texto, sub)
//     · saludo(…, intro)          ← el TERCER argumento va crudo
//     · tablaDatos([{ v }])       ← el VALOR va crudo
//     · lista(…, items)
//
// El nombre no basta para adivinarlo, por eso está escrito. Si añades una pieza
// nueva, apúntala aquí.

// ── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Escapa texto para meterlo en HTML. Incluye las COMILLAS a propósito: `esc()`
 * se usa dentro de atributos (`href="mailto:${esc(email)}"`, el `mapsUrl` del
 * hotel), y ahí una comilla doble suelta cierra el atributo y deja al que
 * escribió ese texto poner los suyos. En un multi-tenant eso importa: el nombre
 * del hotel, su correo y sus URLs los teclea el hotelero en su onboarding, y
 * salen en el correo que recibe el huésped de OTRO.
 */
export const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * ¿Este color de marca es oscuro? Sólo entonces sirve para pintar una cabecera
 * con texto blanco encima sin romper el contraste. Un hotel con el color en
 * amarillo pastel se quedaría con su cabecera ilegible, así que ante la duda se
 * conserva el verde de Kora. Misma fórmula que usan los documentos imprimibles
 * (lib/docs/documento-branded.ts), de donde salió: era la única copia y hacía
 * que el PDF y el correo del mismo hotel no se parecieran.
 */
export function esColorOscuro(hex: string | undefined): boolean {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? "").trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const L = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return L < 0.5;
}

export const money = (n: number) => `$${Math.round(n || 0).toLocaleString("es-MX")} MXN`;

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DIAS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIAS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * "2026-09-10" → { dia:"10", mesAnio:"Sep 2026", diaSem:"Jue" }
 *
 * Con una cadena vacía o mal formada devuelve guiones. Antes los `|| 2026`,
 * `|| 1` y `|| 1` de los valores por defecto convertían `undefined` en una fecha
 * perfectamente válida, así que una cotización sin fecha de salida le llegaba al
 * huésped diciendo **"1 · Ene 2026"** — un dato inventado dentro de un correo
 * que parece oficial. Un guion se ve como lo que es: falta el dato.
 */
export function parteFecha(s: string, en = false): { dia: string; mesAnio: string; diaSem: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return { dia: "—", mesAnio: "—", diaSem: "" };
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return { dia: "—", mesAnio: "—", diaSem: "" };
  return {
    dia: String(dt.getDate()),
    mesAnio: `${(en ? MESES_EN : MESES_ES)[dt.getMonth()]} ${dt.getFullYear()}`,
    diaSem: (en ? DIAS_EN : DIAS_ES)[dt.getDay()],
  };
}

/** "2026-09-10" → "Jueves 10 de septiembre" / "Thursday, September 10". */
export function fechaLarga(s: string, en = false): string {
  if (!s) return "—";
  const d = new Date(s + "T12:00:00");
  if (en) {
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }
  const f = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return f.charAt(0).toUpperCase() + f.slice(1);
}

/** Link de "añadir al calendario" de Google para un rango de estancia. */
export function gcalUrl(titulo: string, checkin: string, checkout: string): string {
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    titulo,
  )}&dates=${checkin.replace(/-/g, "")}/${checkout.replace(/-/g, "")}`;
}

// ── Documento ────────────────────────────────────────────────────────────────

/**
 * Envoltura de TODO correo de Kora: cabeza con la fuente, lienzo crema,
 * preheader oculto (el texto gris que Gmail enseña junto al asunto) y la
 * tarjeta de 600 px. `inner` son <tr> de la tabla de la tarjeta.
 */
export function doc(titulo: string, preheader: string, inner: string, lang: "es" | "en" = "es"): string {
  // El `lang` del <html> no es cosmético: es lo que hace que Gmail no ofrezca
  // "traducir este correo" sobre un correo que YA está en el idioma del lector,
  // y lo que usa un lector de pantalla para elegir pronunciación. Estaba fijo en
  // "es" incluso en los correos que salen en inglés.
  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>${FONT_LINK}</head>
<body style="margin:0;padding:0;background:${T.fondo};-webkit-font-smoothing:antialiased;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.fondo};padding:26px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${T.tarjeta};border-radius:16px;overflow:hidden;">
      ${inner}
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Piezas ───────────────────────────────────────────────────────────────────

/**
 * Cabecera verde. `nombre` es quien firma el correo (el hotel en los correos
 * del huésped, "Kora" en los del hotelero). `eyebrow` es la línea chiquita en
 * mayúsculas. Con `check` aparece la palomita de confirmación.
 */
export function cabecera({
  nombre,
  eyebrow,
  check = false,
}: {
  nombre: string;
  eyebrow?: string;
  check?: boolean;
}): string {
  return `<tr><td style="background:${T.verde};padding:${check ? "34px 40px 30px" : "32px 40px"};text-align:center;">
    ${check ? `<div style="width:62px;height:62px;border-radius:50%;background:${T.verdeClaro};color:${T.verdeTinta};font-family:${FONT};font-size:32px;font-weight:700;line-height:62px;margin:0 auto 16px;">✓</div>` : ""}
    <div style="font-family:${FONT};font-weight:800;font-size:23px;color:#fff;letter-spacing:-.5px;">${esc(nombre)}<span style="color:${T.verdeClaro};">.</span></div>
    ${eyebrow ? `<div style="font-family:${FONT};font-weight:600;font-size:10.5px;letter-spacing:3.5px;text-transform:uppercase;color:rgba(255,255,255,.62);margin-top:9px;">${esc(eyebrow)}</div>` : ""}
  </td></tr>`;
}

/** Titular grande centrado, con una línea de folio/subtítulo opcional debajo. */
export function titulo(texto: string, sub?: string): string {
  return `<tr><td style="padding:34px 40px 0;text-align:center;">
    <h2 style="font-family:${FONT};font-size:28px;font-weight:800;letter-spacing:-1px;color:${T.tinta};line-height:1.15;margin:0 0 8px;">${texto}</h2>
    ${sub ? `<div style="font-family:${FONT};font-weight:400;font-size:13px;color:#9aa0a6;">${sub}</div>` : ""}
  </td></tr>`;
}

/** Saludo "Hola, Ana" + párrafo de entrada. */
export function saludo(hola: string, nombre: string, intro: string): string {
  return `<tr><td style="padding:22px 40px 0;">
    <p style="font-family:${FONT};font-weight:500;font-size:16px;color:${T.tinta};margin:0 0 6px;">${esc(hola)}, ${esc(nombre)}</p>
    <p style="font-family:${FONT};font-weight:400;font-size:14.5px;color:${T.cuerpo};line-height:1.75;margin:0;">${intro}</p>
  </td></tr>`;
}

/** Párrafo suelto del cuerpo (acepta HTML: <strong>, <a>…). */
export function parrafo(html: string, extra = ""): string {
  return `<tr><td style="padding:16px 40px 0;${extra}">
    <p style="font-family:${FONT};font-weight:400;font-size:14.5px;color:${T.cuerpo};line-height:1.75;margin:0;">${html}</p>
  </td></tr>`;
}

/** Etiqueta chiquita en mayúsculas que titula una sección. */
export function etiqueta(texto: string): string {
  return `<div style="font-family:${FONT};font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${T.tenue};margin-bottom:8px;">${esc(texto)}</div>`;
}

/** Botón principal (verde claro, píldora). */
export function boton(href: string, texto: string): string {
  return `<tr><td style="padding:26px 40px 0;text-align:center;">
    <a href="${href}" style="display:inline-block;background:${T.verdeClaro};color:${T.verdeTinta};font-family:${FONT};font-weight:700;font-size:14px;text-decoration:none;padding:15px 40px;border-radius:999px;">${texto}</a>
  </td></tr>`;
}

/** Botón secundario en verde oscuro (para correos internos y de cuenta). */
export function botonOscuro(href: string, texto: string): string {
  return `<tr><td style="padding:26px 40px 0;text-align:center;">
    <a href="${href}" style="display:inline-block;background:${T.verde};color:#fff;font-family:${FONT};font-weight:700;font-size:14px;text-decoration:none;padding:15px 40px;border-radius:999px;">${texto}</a>
  </td></tr>`;
}

/** Par de botones de contorno lado a lado (calendario / cómo llegar). */
export function botonesSecundarios(items: { href: string; texto: string }[]): string {
  const vivos = items.filter((i) => i.href);
  if (!vivos.length) return "";
  const ancho = Math.floor(100 / vivos.length);
  return `<tr><td style="padding:16px 40px 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${vivos
        .map(
          (i, n) =>
            `<td style="width:${ancho}%;padding-${n === 0 ? "right" : "left"}:6px;"><a href="${i.href}" style="display:block;text-align:center;border:1px solid ${T.bordeFuerte};border-radius:10px;padding:11px 0;font-family:${FONT};font-weight:600;font-size:12.5px;color:${T.cuerpo};text-decoration:none;">${i.texto}</a></td>`,
        )
        .join("")}
    </tr></table>
  </td></tr>`;
}

/** Caja de entrada → salida con los días grandes. */
export function bloqueFechas({
  checkin,
  checkout,
  noches,
  labelEntrada,
  labelSalida,
  labelNoches,
  horaEntrada,
  horaSalida,
  en = false,
}: {
  checkin: string;
  checkout: string;
  noches: number;
  labelEntrada: string;
  labelSalida: string;
  labelNoches: string;
  horaEntrada?: string;
  horaSalida?: string;
  en?: boolean;
}): string {
  const ci = parteFecha(checkin, en);
  const co = parteFecha(checkout, en);
  const col = (l: string, p: ReturnType<typeof parteFecha>, hora?: string) =>
    `<td style="text-align:center;width:42%;vertical-align:top;">
      <div style="font-family:${FONT};font-weight:600;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${T.tenue};margin-bottom:6px;">${esc(l)}</div>
      <div style="font-family:${FONT};font-size:26px;color:${T.tinta};line-height:1;">${p.dia}</div>
      <div style="font-family:${FONT};font-weight:500;font-size:12px;color:${T.suave};margin-top:4px;">${p.diaSem} · ${p.mesAnio}</div>
      ${hora ? `<div style="font-family:${FONT};font-weight:500;font-size:11px;color:${T.tenue};margin-top:2px;">${esc(hora)}</div>` : ""}
    </td>`;
  return `<tr><td style="padding:22px 40px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.panel};border:1px solid ${T.borde};border-radius:14px;">
      <tr><td style="padding:22px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${col(labelEntrada, ci, horaEntrada)}
          <td style="text-align:center;vertical-align:middle;font-family:${FONT};font-weight:600;font-size:11px;color:#b3a58c;white-space:nowrap;">${noches} ${esc(labelNoches)}<br>→</td>
          ${col(labelSalida, co, horaSalida)}
        </tr></table>
      </td></tr>
    </table>
  </td></tr>`;
}

/** Tabla de datos etiqueta → valor (avisos al hotel, resúmenes internos). */
export function tablaDatos(filas: { k: string; v: string }[]): string {
  if (!filas.length) return "";
  return `<tr><td style="padding:22px 40px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${filas
        .map(
          ({ k, v }) =>
            `<tr><td style="padding:9px 12px 9px 0;font-family:${FONT};font-weight:400;font-size:13.5px;color:${T.suave};white-space:nowrap;vertical-align:top;border-bottom:1px solid ${T.borde};">${esc(k)}</td><td style="padding:9px 0;font-family:${FONT};font-weight:600;font-size:13.5px;color:${T.tinta};border-bottom:1px solid ${T.borde};">${v}</td></tr>`,
        )
        .join("")}
    </table>
  </td></tr>`;
}

/** Caja neutra para notas, avisos y textos destacados. */
export function caja(html: string, tono: "neutro" | "alerta" | "error" | "exito" = "neutro"): string {
  const fondos = { neutro: "#f3efe7", alerta: "#fdf3e3", error: "#fceceb", exito: "#eaf5ef" };
  const bordes = { neutro: T.borde, alerta: "#f0d9ae", error: "#f3c9c6", exito: "#c2e2d1" };
  return `<tr><td style="padding:16px 40px 0;">
    <div style="background:${fondos[tono]};border:1px solid ${bordes[tono]};border-radius:12px;padding:14px 16px;font-family:${FONT};font-size:13.5px;color:${T.cuerpo};line-height:1.65;">${html}</div>
  </td></tr>`;
}

/** Lista de renglones con línea divisoria (experiencias, checklist…). */
export function lista(titulo: string, items: string[]): string {
  if (!items.length) return "";
  return `<tr><td style="padding:18px 40px 0;">
    ${etiqueta(titulo)}
    ${items
      .map(
        (h) =>
          `<div style="font-family:${FONT};font-weight:400;font-size:14px;color:${T.cuerpo};padding:6px 0;border-bottom:1px solid ${T.borde};">${h}</div>`,
      )
      .join("")}
  </td></tr>`;
}

/** Bloque de contacto del hotel: solo pinta las líneas que sí existen. */
export function contacto({
  telefono,
  email,
  whatsapp,
}: {
  telefono?: string;
  email?: string;
  whatsapp?: string;
}): string {
  const linea = (html: string) =>
    `<div style="font-family:${FONT};font-weight:400;font-size:13px;color:${T.cuerpo};padding:3px 0;">${html}</div>`;
  const filas: string[] = [];
  if (telefono) {
    filas.push(
      linea(
        `📞 <a href="tel:+${telefono.replace(/\D/g, "")}" style="color:${T.cuerpo};text-decoration:none;">${esc(telefono.replace(/^52/, "+52 "))}</a>`,
      ),
    );
  }
  if (email) {
    filas.push(
      linea(`📧 <a href="mailto:${esc(email)}" style="color:${T.cuerpo};text-decoration:none;">${esc(email)}</a>`),
    );
  }
  if (whatsapp) {
    filas.push(
      linea(
        `💬 <a href="https://wa.me/${whatsapp.replace(/\D/g, "")}" style="color:${T.cuerpo};text-decoration:none;">WhatsApp</a>`,
      ),
    );
  }
  if (!filas.length) return "";
  return `<tr><td style="padding:26px 40px 0;border-top:1px solid ${T.borde};">${filas.join("")}</td></tr>`;
}

/**
 * Pie de los correos que llegan al HUÉSPED: firma el hotel y Kora aparece
 * discreto abajo ("Enviado con Kora"). El huésped reservó con el hotel.
 */
export function pieHotel({ nombre, ubicacion }: { nombre: string; ubicacion?: string }): string {
  return `<tr><td style="background:${T.pie};padding:34px 40px;text-align:center;">
    <div style="font-family:${FONT};font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${T.suave};">${esc(nombre)}</div>
    ${ubicacion ? `<div style="font-family:${FONT};font-weight:400;font-size:11.5px;color:${T.tenue};margin-top:8px;">${esc(ubicacion)}</div>` : ""}
    <div style="font-family:${FONT};font-weight:400;font-size:10.5px;color:#b8aa9a;margin-top:14px;">Enviado con <a href="https://kora-hotel.com" style="color:${T.suave};font-weight:600;text-decoration:none;">Kora</a> · sistema de reservas para hoteles</div>
  </td></tr>`;
}

/** Pie de los correos de Kora al hotelero (y los internos del fundador). */
export function pieKora(nota?: string): string {
  return `<tr><td style="background:${T.pie};padding:30px 40px;text-align:center;">
    ${nota ? `<div style="font-family:${FONT};font-weight:400;font-size:11.5px;color:${T.tenue};margin-bottom:10px;line-height:1.6;">${nota}</div>` : ""}
    <div style="font-family:${FONT};font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${T.suave};">Kora</div>
    <div style="font-family:${FONT};font-weight:400;font-size:10.5px;color:#b8aa9a;margin-top:8px;">Sistema hotelero para hoteles boutique en México · <a href="https://kora-hotel.com" style="color:${T.suave};font-weight:600;text-decoration:none;">kora-hotel.com</a></div>
  </td></tr>`;
}

/** Aire al final del cuerpo, antes del pie. */
export const respiro = `<tr><td style="padding:20px 0 0;"></td></tr>`;

/** Link de WhatsApp con mensaje prellenado. Devuelve "" si no hay número. */
export function waLink(whatsapp: string | undefined, texto: string): string {
  const digitos = (whatsapp || "").replace(/\D/g, "");
  if (!digitos) return "";
  const numero = digitos.length === 10 ? `52${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
