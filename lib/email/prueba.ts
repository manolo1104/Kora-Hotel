// Correos del ciclo de la prueba de 30 días sin tarjeta. SOLO servidor.
// Los manda el cron diario /api/cron/prueba a los hoteleros sin plan activo.

import { enviarEmail } from "@/lib/email/resend";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";
const ACTIVAR_URL = `${SITE}/pago/iniciar?plan=kora`;

export interface PruebaEmailArgs {
  hotelNombre: string;
  diasRestantes: number;
}

const pie = `<p style="font-size:12px;color:#667;margin-top:16px;">Mes a mes, sin permanencia:
  cancelas tú mismo en un clic desde tu panel. Tus datos siempre son tuyos.</p>`;

const boton = (texto: string) => `<p style="margin-top:18px;"><a href="${ACTIVAR_URL}"
  style="background:#1B4332;color:#fff;padding:12px 22px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:14px;">${texto}</a></p>`;

export function buildRecordatorioPruebaHtml(a: PruebaEmailArgs): string {
  const dias = a.diasRestantes;
  const urgencia =
    dias === 1
      ? "Mañana termina tu prueba gratis"
      : `Te quedan ${dias} días de tu prueba gratis`;
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;padding:24px;">
    <h2 style="color:#1B4332;">${urgencia}</h2>
    <p>Tu hotel <b>${a.hotelNombre}</b> sigue funcionando en Kora: motor de reservas
    directo (0% comisión), panel completo y todo lo que ya configuraste.</p>
    <p>Al terminar la prueba, <b>el motor de reservas se pausa</b> y tu panel queda
    en espera — no se borra nada, pero tampoco entran reservas. Para que no se
    detenga, activa tu plan: <b>$550 MXN/mes, todo incluido y habitaciones
    ilimitadas</b>. Se respeta el tiempo que te quede de prueba.</p>
    ${boton("Activar mi plan")}
    ${pie}
  </div>`;
}

export function buildPruebaPausadaHtml(a: { hotelNombre: string }): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;padding:24px;">
    <h2 style="color:#b45309;">Tu prueba terminó: el motor de ${a.hotelNombre} está en pausa</h2>
    <p>Las reservas en línea de tu hotel dejaron de recibirse y tu panel quedó en
    espera. <b>Tus datos están a salvo</b>: reservas, huéspedes, fotos y
    configuración se conservan íntegros, tal como los dejaste.</p>
    <p>Activa tu plan y todo vuelve a funcionar al instante: <b>$550 MXN/mes</b>,
    todo incluido, habitaciones ilimitadas.</p>
    ${boton("Reactivar mi hotel")}
    ${pie}
  </div>`;
}

export async function sendRecordatorioPrueba(to: string, args: PruebaEmailArgs): Promise<boolean> {
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

export async function sendPruebaPausada(to: string, hotelNombre: string): Promise<boolean> {
  return enviarEmail({
    to,
    subject: `Tu motor de reservas está en pausa — ${hotelNombre}`,
    html: buildPruebaPausadaHtml({ hotelNombre }),
  });
}
