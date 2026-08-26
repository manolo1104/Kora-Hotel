// Correos del ciclo de la prueba de 30 días sin tarjeta. SOLO servidor.
//  - Bienvenida el día que el hotelero crea su hotel (antes NO existía: el
//    primer correo de Kora le llegaba el día 20 de la prueba).
//  - Recordatorios en los días 10 / 3 / 1 restantes (cron /api/cron/prueba).
//  - Aviso de motor pausado al vencer.
//
// Mismo sistema de diseño que el resto de los correos (lib/email/design.ts).

import { enviarEmail, type ResultadoEmail } from "@/lib/email/resend";
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
const ACTIVAR_URL = `${SITE}/pago/iniciar?plan=kora`;

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
  diasPrueba?: number;
}

export function buildBienvenidaHotelHtml(a: BienvenidaHotelArgs): string {
  const dias = a.diasPrueba ?? 30;
  const primero = (a.nombreUsuario || "").trim().split(/\s+/)[0] || "";
  const inner =
    cabecera({ nombre: "Kora", eyebrow: `Prueba gratis · ${dias} días`, check: true }) +
    titulo(`${esc(a.hotelNombre)} ya está en Kora`) +
    saludo(
      "Hola",
      esc(primero) || "hotelero",
      `Tu hotel quedó creado y tienes <strong>${dias} días gratis</strong>, sin tarjeta. Desde hoy puedes recibir reservas directas sin pagar comisión a nadie.`,
    ) +
    lista("Los 3 pasos para quedar listo", [
      `<strong style="color:${TOK.tinta};">1. Sube tus habitaciones y precios</strong><br><span style="color:${TOK.suave};">Es lo único imprescindible: sin cuartos, el motor no puede vender.</span>`,
      `<strong style="color:${TOK.tinta};">2. Conecta tu Stripe para cobrar</strong><br><span style="color:${TOK.suave};">El dinero de las reservas te llega directo a ti, no pasa por Kora.</span>`,
      `<strong style="color:${TOK.tinta};">3. Pon el enlace de tu página en tu Instagram y WhatsApp</strong><br><span style="color:${TOK.suave};">Ahí es donde ya te están preguntando precios todos los días.</span>`,
    ]) +
    boton(`${SITE}/panel/${esc(a.slug)}/onboarding`, "Configurar mi hotel") +
    caja(
      `Cuando termines, tu página pública vive en <a href="${SITE}/h/${esc(a.slug)}" style="color:${TOK.verde};font-weight:600;">kora-hotel.com/h/${esc(a.slug)}</a>`,
    ) +
    parrafo(
      `¿Te trabas en algo? Responde este correo o escríbenos por WhatsApp. Soy Manolo, el fundador, y te contesto yo.`,
    ) +
    respiro +
    pieKora(PIE_NOTA);

  return doc(
    `Bienvenido a Kora — ${a.hotelNombre}`,
    `${a.hotelNombre} ya está en Kora. Estos son los 3 pasos para empezar a recibir reservas.`,
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
      `Para que no se detenga, activa tu plan: <strong style="color:${TOK.tinta};">$550 MXN al mes, todo incluido y habitaciones ilimitadas</strong>. Se respeta el tiempo que te quede de prueba.`,
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
      `Activa tu plan y todo vuelve a funcionar al instante: <strong style="color:${TOK.tinta};">$550 MXN al mes</strong>, todo incluido, habitaciones ilimitadas.`,
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
