// Canal único de alerta para cuando se rompe algo del CAMINO DEL DINERO.
//
// Hasta ahora estos fallos sólo dejaban un `console.error` en Vercel, que nadie
// mira: un cobro perdido, un reembolso indebido o un webhook con firma inválida
// podían pasar semanas sin que nadie se enterara. El repo ya usaba NOTIFY_EMAIL
// suelto en cinco archivos con textos distintos; esto lo unifica.
//
// 15 sep 2026: además del correo, cada alerta se GUARDA en `alertas_fundador`
// para verla y marcarla como atendida en /crm/bandeja. Antes, si el correo se
// perdía (filtro de spam, Resend caído, NOTIFY_EMAIL sin poner en un despliegue)
// no quedaba rastro de que un cobro había caído en la cuenta de Kora. Guardarla
// es un añadido: sin la tabla (sql/kora-crm-mando.sql sin correr) el correo sale
// igual que siempre.
//
// A propósito NO se llama desde las rutas del panel: ahí el 500 ya se lo cuenta
// al hotelero en pantalla, y avisar de cada guardado fallido llenaría la bandeja.
import { enviarEmail, NOTIFY_EMAIL } from "@/lib/email/resend";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

// Filtro de repetidas, CON CADUCIDAD.
//
// Antes era un `Set` de asuntos sin caducidad, pensado para «una invocación».
// Pero en Vercel una instancia caliente atiende muchas invocaciones seguidas y
// conserva lo que vive a nivel de módulo durante horas: una alerta ya avisada no
// volvía a salir en toda la vida de la instancia. Con la bandeja eso es peor que
// un correo de menos: el fundador marca «atendida», el fallo vuelve, y no
// aparece nada — la bandeja dice «nada por atender» con el problema vivo. Y como
// iba por asunto, la misma alerta de OTRO hotel («no se pudo crear una reserva
// ya pagada», hotel B) se perdía entera.
//
// Ahora, por instancia y dentro de `VENTANA_REPETIDA_MS`:
//   · correo: uno por asunto (el anti-inundación de siempre);
//   · bandeja: una fila por asunto + detalle, con tope de `FILAS_POR_ASUNTO`
//     por asunto. El otro hotel sí queda guardado; un bucle que repite lo mismo
//     no llena la tabla (la bandeja agrupa las repetidas al leerlas).
export const VENTANA_REPETIDA_MS = 10 * 60_000;
export const FILAS_POR_ASUNTO = 20;
const MARCAS_MAX = 1_000;
// Para comparar detalles basta el principio: el hotel y el error van delante, y
// guardar 20.000 caracteres por marca haría crecer la memoria sin necesidad.
const DETALLE_EN_CLAVE = 500;

const vistos = new Map<string, { desde: number; veces: number }>();

/** ¿Cabe otra con esta clave en la ventana actual? Si cabe, la apunta. */
function cabe(clave: string, tope: number, ahora: number): boolean {
  const v = vistos.get(clave);
  if (!v || ahora - v.desde >= VENTANA_REPETIDA_MS) {
    if (vistos.size >= MARCAS_MAX) {
      for (const [k, marca] of vistos) if (ahora - marca.desde >= VENTANA_REPETIDA_MS) vistos.delete(k);
      // Cientos de asuntos distintos en 10 min: mejor repetir algún aviso que
      // crecer sin fin en una instancia que vive horas.
      if (vistos.size >= MARCAS_MAX) vistos.clear();
    }
    vistos.set(clave, { desde: ahora, veces: 1 });
    return true;
  }
  if (v.veces >= tope) return false;
  v.veces += 1;
  return true;
}

/**
 * Cuánto se espera a la base antes de dejar de esperar. El correo y el guardado
 * van en paralelo, así que la base lenta NUNCA retrasa el correo; esto sólo
 * acota cuánto tarda en volver `alertar()`, que se llama con `await` en medio de
 * un webhook de Stripe o del motor de reservas. Si se pasa, la fila puede
 * llegar igual (la petición no se cancela); lo que no se hace es esperarla.
 */
export const ESPERA_GUARDADO_MS = 2_500;

// Topes: `detalle` a veces lleva un stack entero. Sin tope, un error con un
// cuerpo de respuesta gigante acabaría pintado en cada carga de la bandeja.
const ASUNTO_MAX = 300;
const DETALLE_MAX = 20_000;

/** Códigos de PostgREST/Postgres para «esa tabla no existe aquí». */
const TABLA_AUSENTE = new Set(["42P01", "PGRST205"]);

// Sin la tabla, cada alerta volvería a escribir la misma advertencia en el log.
let yaAvisadoSinTabla = false;

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Deja `asunto` y `detalle` en texto ANTES de tocarlos.
 *
 * Los tipos dicen `string`, pero los dos se arman con valores que vienen de
 * fuera (`e.message` de un error ajeno, la metadata de una sesión de Stripe) y
 * en ejecución ahí puede llegar `undefined`. Antes daba igual: todo lo que
 * tocaba el detalle estaba dentro de un `try`. Ahora el filtro de repetidas le
 * hace `.slice()` en el cuerpo de `alertar()`, y un `.slice()` sobre `undefined`
 * lanzaría desde una función que se llama con `await` dentro del webhook de
 * Stripe — y si `alertar()` lanza, Stripe reintenta un pago YA cobrado.
 */
function comoTexto(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  try {
    return String(v);
  } catch {
    return "(dato ilegible)";
  }
}

async function enviarCorreo(asunto: string, detalle: string): Promise<void> {
  if (!NOTIFY_EMAIL) return;
  try {
    await enviarEmail({
      to: NOTIFY_EMAIL,
      subject: `🚨 Kora — ${asunto}`,
      html:
        `<p><b>${escapar(asunto)}</b></p>` +
        `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace">${escapar(detalle)}</pre>` +
        `<p style="color:#888">${new Date().toISOString()}</p>`,
    });
  } catch (e) {
    console.error("[ALERTA] tampoco se pudo enviar el correo:", e);
  }
}

async function insertarAlerta(asunto: string, detalle: string): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("alertas_fundador")
      .insert({ asunto: asunto.slice(0, ASUNTO_MAX), detalle: detalle.slice(0, DETALLE_MAX) });
    if (!error) return;
    const tablaAusente =
      (error.code && TABLA_AUSENTE.has(error.code)) ||
      /Could not find the table|relation .* does not exist/i.test(error.message ?? "");
    if (tablaAusente) {
      if (!yaAvisadoSinTabla) {
        yaAvisadoSinTabla = true;
        console.warn(
          "[ALERTA] la tabla alertas_fundador no existe todavía: las alertas salen por correo " +
            "pero no se ven en /crm/bandeja. Corre sql/kora-crm-mando.sql.",
        );
      }
      return;
    }
    console.error("[ALERTA] no se pudo guardar en la bandeja:", error.message);
  } catch (e) {
    console.error("[ALERTA] error guardando en la bandeja:", e);
  }
}

/** Guarda la alerta sin esperar más de `ESPERA_GUARDADO_MS`. Nunca lanza. */
async function guardarAlerta(asunto: string, detalle: string): Promise<void> {
  if (!adminEnvReady) return;
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<"tarde">((resolver) => {
    reloj = setTimeout(() => resolver("tarde"), ESPERA_GUARDADO_MS);
  });
  try {
    const r = await Promise.race([insertarAlerta(asunto, detalle), tope]);
    if (r === "tarde") {
      console.warn(`[ALERTA] la base tardó más de ${ESPERA_GUARDADO_MS} ms en guardar «${asunto}»; no se esperó.`);
    }
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Avisa de un fallo del camino del dinero: por correo y en la bandeja del CRM.
 * NUNCA lanza: si nada de eso sale, queda el console.error. El `await` es
 * obligatorio — en Vercel un envío lanzado sin esperar se pierde cuando la
 * función termina.
 */
export async function alertar(asunto: string, detalle: string): Promise<void> {
  const a = comoTexto(asunto);
  const d = comoTexto(detalle);
  console.error(`[ALERTA] ${a} — ${d}`);
  const ahora = Date.now();
  const mandarCorreo = cabe(`correo|${a}`, 1, ahora);
  // Primero «¿es la misma fila?» y sólo si es nueva se gasta el tope del asunto:
  // una repetida exacta no le quita hueco a la de otro hotel.
  const guardar =
    cabe(`fila|${a}\n${d.slice(0, DETALLE_EN_CLAVE)}`, 1, ahora) &&
    cabe(`filas|${a}`, FILAS_POR_ASUNTO, ahora);
  if (!mandarCorreo && !guardar) return;
  // En paralelo y con `allSettled`: una base lenta o caída no puede retrasar ni
  // impedir el correo, y un Resend caído no impide que quede en la bandeja.
  await Promise.allSettled([mandarCorreo ? enviarCorreo(a, d) : null, guardar ? guardarAlerta(a, d) : null]);
}
