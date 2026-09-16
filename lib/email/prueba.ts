// Correos del ciclo de la prueba gratis sin tarjeta. SOLO servidor.
//  - Bienvenida el día que el hotelero crea su hotel (antes NO existía: el
//    primer correo de Kora le llegaba el día 20 de la prueba).
//  - Recordatorios en los días 7 / 3 / 1 restantes (cron /api/cron/prueba).
//  - Aviso de motor pausado al vencer.
//
// Mismo sistema de diseño que el resto de los correos (lib/email/design.ts).
//
// Ninguna cifra comercial va escrita a mano: los días salen de `PRUEBA_DIAS`
// (lo que el sistema aplica) y el precio de `PRECIO_DESDE`. La bienvenida
// llegó a decir «30 días gratis» a quien tenía 14: el valor por defecto era un
// 30 escrito aquí y `crear-hotel` no pasaba los días, así que el primer correo
// de Kora contradecía al panel el mismo día del alta.

import { enviarEmail, type ResultadoEmail } from "@/lib/email/resend";
import { PRUEBA_DIAS } from "@/lib/suscripcion";
import { PRECIO_DESDE, RUTA_ACTIVAR } from "@/lib/oferta";
import {
  T as TOK,
  doc,
  esc,
  cabecera,
  titulo,
  saludo,
  parrafo,
  boton,
  botonOscuro,
  lista,
  caja,
  pieKora,
  respiro,
} from "@/lib/email/design";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";
const ACTIVAR_URL = `${SITE}${RUTA_ACTIVAR}`;
const PRECIO = `$${PRECIO_DESDE.toLocaleString("es-MX")} MXN al mes`;

const PIE_NOTA =
  "Mes a mes, sin permanencia: cancelas tú mismo en un clic desde tu panel. Tus datos siempre son tuyos.";

export interface PruebaEmailArgs {
  hotelNombre: string;
  diasRestantes: number;
}

// ── Bienvenida al crear el hotel ─────────────────────────────────────────────

export interface BienvenidaHotelArgs {
  hotelNombre: string;
  slug: string;
  nombreUsuario?: string | null;
  /**
   * Días de prueba que LE QUEDAN a este dueño.
   *  - `undefined`: los de una prueba nueva (`PRUEBA_DIAS`).
   *  - `0`: ya la gastó con un hotel anterior (la prueba es por dueño y no se
   *    reinicia al volver a crear el hotel).
   *  - `null`: no aplica prueba (tiene plan o cortesía, o no se pudo leer): el
   *    correo no habla de días.
   */
  diasPrueba?: number | null;
}

const paso = (t: string, detalle: string) =>
  `<strong style="color:${TOK.tinta};">${t}</strong><br><span style="color:${TOK.suave};">${detalle}</span>`;

export function buildBienvenidaHotelHtml(a: BienvenidaHotelArgs): string {
  const dias = a.diasPrueba === undefined ? PRUEBA_DIAS : a.diasPrueba;
  const enPrueba = typeof dias === "number" && dias > 0;
  const primero = (a.nombreUsuario || "").trim().split(/\s+/)[0] || "";

  const intro = enPrueba
    ? `Tu hotel quedó creado y ${dias === 1 ? "te queda <strong>1 día gratis</strong>" : `tienes <strong>${dias} días gratis</strong>`}, sin tarjeta. Pruébalo por dentro con tus propios datos y, cuando conectes tus cobros, empieza a recibir reservas directas sin pagar comisión por reserva.`
    : dias === 0
      ? `Tu hotel quedó creado. Tu prueba gratis ya se usó con tu hotel anterior (es una por cuenta), así que tu motor de reservas queda en pausa hasta que actives tu plan: ${PRECIO}, todo incluido.`
      : "Tu hotel quedó creado. Termina de dejarlo listo a tu ritmo: tu avance se guarda solo.";

  // Los cuartos y los precios YA los cargó en el alta (sin ellos no se crea el
  // hotel): pedírselos otra vez como «paso 1» era decirle que no leímos nada.
  //
  // Con la prueba gastada (0) el paso 1 NO puede ser «pruébalo»: al vencer, el
  // chat de prueba de Camila responde «motor pausado» (`api/admin/bot-preview`),
  // el motor enseña la página de pausa y el panel operativo, la de «prueba
  // terminada». Invitarlo a probar era mandarlo a tres puertas cerradas.
  const pasos = [
    enPrueba
      ? paso(
          "1. Pruébalo por dentro",
          "Habla con Camila en el chat de prueba y haz una reserva de prueba en tu motor: mientras no conectes tus cobros, el pago se simula y no se cobra nada.",
        )
      : dias === 0
        ? paso(
            "1. Activa tu plan",
            `${PRECIO}, todo incluido. Tu motor de reservas y Camila vuelven a funcionar al instante, con todo lo que ya cargaste.`,
          )
        : paso(
            "1. Pruébalo por dentro",
            "Habla con Camila en el chat de prueba y recorre tu motor como lo verá tu huésped.",
          ),
    paso(
      "2. Sube tus fotos y conecta tus cobros",
      "Con Stripe, el dinero de cada reserva te llega directo a tu cuenta, no pasa por Kora.",
    ),
    paso(
      "3. Vincula tu WhatsApp y comparte tu página",
      "Escanea el código QR en la pantalla de Camila y pon el enlace de tu página en tu Instagram y tu WhatsApp.",
    ),
  ];

  const inner =
    cabecera({
      nombre: "Kora",
      eyebrow: enPrueba ? `Prueba gratis · ${dias} ${dias === 1 ? "día" : "días"}` : "Tu hotel en Kora",
      check: true,
    }) +
    titulo(`${esc(a.hotelNombre)} ya está en Kora`) +
    saludo("Hola", esc(primero) || "hotelero", intro) +
    lista("Los 3 pasos para quedar listo", pasos) +
    (dias === 0
      ? botonOscuro(ACTIVAR_URL, "Activar mi plan")
      : boton(`${SITE}/panel/${esc(a.slug)}/onboarding`, "Seguir con mi hotel")) +
    caja(
      `Tu página pública es <a href="${SITE}/h/${esc(a.slug)}" style="color:${TOK.verde};font-weight:600;">kora-hotel.com/h/${esc(a.slug)}</a>`,
    ) +
    parrafo(
      `Lo configuras tú y, si prefieres que te acompañemos, te ayudamos: responde este correo o escríbenos por WhatsApp. Soy Manolo, el fundador, y te contesto yo.`,
    ) +
    respiro +
    pieKora(PIE_NOTA);

  return doc(
    `Bienvenido a Kora — ${a.hotelNombre}`,
    `${a.hotelNombre} ya está en Kora. Estos son los 3 pasos para dejarlo listo.`,
    inner,
  );
}

export async function sendBienvenidaHotel(to: string, args: BienvenidaHotelArgs): Promise<ResultadoEmail> {
  return enviarEmail({
    to,
    subject: `${args.hotelNombre} ya está en Kora — así lo dejas listo`,
    html: buildBienvenidaHotelHtml(args),
  });
}

// ── Recordatorios de la prueba ───────────────────────────────────────────────

export function buildRecordatorioPruebaHtml(a: PruebaEmailArgs): string {
  const dias = a.diasRestantes;
  const urgente = dias <= 3;
  const encabezado =
    dias === 1 ? "Mañana termina tu prueba gratis" : `Te quedan ${dias} días de prueba gratis`;

  const inner =
    cabecera({ nombre: "Kora", eyebrow: urgente ? "Último aviso" : "Tu prueba gratis" }) +
    titulo(encabezado) +
    parrafo(
      `Tu hotel <strong style="color:${TOK.tinta};">${esc(a.hotelNombre)}</strong> sigue funcionando en Kora: motor de reservas directo con 0% de comisión, panel completo y todo lo que ya configuraste.`,
    ) +
    caja(
      `Al terminar la prueba, <strong>el motor de reservas se pausa</strong> y tu panel queda en espera. No se borra nada, pero tampoco entran reservas.`,
      urgente ? "alerta" : "neutro",
    ) +
    parrafo(
      `Para que no se detenga, activa tu plan: <strong style="color:${TOK.tinta};">${PRECIO}, todo incluido y habitaciones ilimitadas</strong>. Se respeta el tiempo que te quede de prueba.`,
    ) +
    boton(ACTIVAR_URL, "Activar mi plan") +
    respiro +
    pieKora(PIE_NOTA);

  return doc(
    `${encabezado} — ${a.hotelNombre}`,
    `${encabezado}. Activa tu plan para que el motor no se pause.`,
    inner,
  );
}

export function buildPruebaPausadaHtml(a: { hotelNombre: string }): string {
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Motor en pausa" }) +
    titulo(`El motor de ${esc(a.hotelNombre)} está en pausa`) +
    parrafo(
      `Tu prueba gratis terminó: las reservas en línea de tu hotel dejaron de recibirse y tu panel quedó en espera.`,
    ) +
    caja(
      `<strong>Tus datos están a salvo.</strong> Reservas, huéspedes, fotos y configuración se conservan íntegros, tal como los dejaste.`,
      "exito",
    ) +
    parrafo(
      `Activa tu plan y todo vuelve a funcionar al instante: <strong style="color:${TOK.tinta};">${PRECIO}</strong>, todo incluido, habitaciones ilimitadas.`,
    ) +
    botonOscuro(ACTIVAR_URL, "Reactivar mi hotel") +
    respiro +
    pieKora(PIE_NOTA);

  return doc(
    `Motor en pausa — ${a.hotelNombre}`,
    `Tu prueba terminó. Activa tu plan y el motor vuelve a recibir reservas al instante.`,
    inner,
  );
}

export async function sendRecordatorioPrueba(to: string, args: PruebaEmailArgs): Promise<ResultadoEmail> {
  const dias = args.diasRestantes;
  return enviarEmail({
    to,
    subject:
      dias === 1
        ? `Mañana termina tu prueba gratis — ${args.hotelNombre}`
        : `Te quedan ${dias} días de prueba gratis — ${args.hotelNombre}`,
    html: buildRecordatorioPruebaHtml(args),
  });
}

export async function sendPruebaPausada(to: string, hotelNombre: string): Promise<ResultadoEmail> {
  return enviarEmail({
    to,
    subject: `Tu motor de reservas está en pausa — ${hotelNombre}`,
    html: buildPruebaPausadaHtml({ hotelNombre }),
  });
}
