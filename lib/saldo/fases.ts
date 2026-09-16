// Los dos interruptores del prepago de Camila, leídos de la base. SOLO servidor.
//
// Hasta el 15 sep 2026 eran variables de entorno (`SALDO_RECARGA`,
// `SALDO_BLOQUEO`, ver lib/saldo/paquetes.ts): moverlos exigía entrar a Vercel y
// redesplegar, que es justo lo que Manolo pidió dejar de hacer. Ahora viven en
// `kora_ajustes`, fila `saldo_fases`, y se mueven con un botón del CRM.
//
// ── LA DIRECCIÓN DEL FALLO ES «QUE CAMILA SIGA HABLANDO» ─────────────────────
//
// Es la doctrina de lib/db/saldo.ts, aplicada al interruptor:
//
//   · La tabla o la fila NO EXISTEN → mandan las variables de siempre. Es el
//     estado legítimo de «el SQL aún no se corrió» o «nadie ha tocado el botón»,
//     y tiene que comportarse EXACTAMENTE como hoy (si en Vercel está
//     SALDO_BLOQUEO=1, el bloqueo sigue puesto).
//   · La lectura FALLA (red, base caída, fila con basura) → las variables para
//     la recarga, pero el bloqueo SIEMPRE apagado. Un hipo de Supabase no puede
//     dejar mudo el WhatsApp de todos los hoteles a la vez; regalar unos
//     mensajes mientras dura cuesta céntimos.
//
// ── EL CANDADO DE LECTURA ────────────────────────────────────────────────────
//
// `bloqueoEncendido()` sólo es true si la recarga TAMBIÉN está abierta. Callar a
// un hotel sin darle forma de recargar lo deja mudo y sin salida. La API del CRM
// ya impide guardar esa combinación; esto es la segunda red, por si la fila se
// escribe a mano o la variable de entorno quedó mal puesta.
//
// ── LA CACHÉ ─────────────────────────────────────────────────────────────────
//
// Esto se consulta en CADA mensaje de Camila (`/api/agent`). Sin caché serían
// miles de lecturas al día de una fila que cambia dos veces en la vida. Con 60 s,
// un cambio desde el CRM tarda hasta un minuto en llegar a todas las instancias
// de Vercel; la pantalla del CRM tiene que decirlo así.

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

export type FasesSaldo = {
  /** Se puede recargar saldo pagando. */
  recarga: boolean;
  /** Sin saldo, Camila se calla. (Crudo: para decidir, usa `bloqueoEncendido()`.) */
  bloqueo: boolean;
  /** 'base' = sale de kora_ajustes; 'entorno' = de las variables de Vercel (o de un fallo). */
  fuente: "base" | "entorno";
  /** ISO de la última vez que se guardó desde el CRM. null si fuente = 'entorno'. */
  actualizado: string | null;
};

const CLAVE = "saldo_fases";
const TTL_MS = 60_000;
// Tras un FALLO de lectura se reintenta antes: la respuesta de respaldo apaga el
// bloqueo, y no conviene que eso dure un minuto entero si fue un parpadeo.
const TTL_FALLO_MS = 10_000;

const TABLA_AUSENTE = new Set(["42P01", "PGRST205"]);

// Tope de espera de la lectura. Esto corre DENTRO de cada latido de Camila
// (`/api/agent`), y una base colgada —que no falla, simplemente no contesta— se
// llevaría por delante la petición entera hasta que Vercel la mate. Pasado el
// tope se responde como un fallo: mandan las variables de entorno y el bloqueo
// queda apagado.
const TOPE_MS = 2_500;

/**
 * La promesa, o `null` si tardó más de `TOPE_MS`. Nunca lanza por el tope.
 *
 * Recibe `PromiseLike` y no `Promise`: la consulta de Supabase no es una promesa
 * de verdad, es un constructor con `.then()` que sólo se dispara al esperarlo.
 */
async function conTope<T>(promesa: PromiseLike<T>): Promise<T | null> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promesa,
      new Promise<null>((resolver) => {
        reloj = setTimeout(() => resolver(null), TOPE_MS);
      }),
    ]);
  } finally {
    if (reloj) clearTimeout(reloj);
  }
}

let cache: { hasta: number; fases: FasesSaldo } | null = null;
let yaAvisadoSinTabla = false;

function desdeEntorno(bloqueoPermitido: boolean): FasesSaldo {
  return {
    recarga: process.env.SALDO_RECARGA === "1",
    bloqueo: bloqueoPermitido && process.env.SALDO_BLOQUEO === "1",
    fuente: "entorno",
    actualizado: null,
  };
}

async function leerDeLaBase(): Promise<{ fases: FasesSaldo; fallo: boolean }> {
  // Sin service-role no hay base que leer: es configuración, no un fallo pasajero,
  // así que se comporta como siempre.
  if (!adminEnvReady) return { fases: desdeEntorno(true), fallo: false };
  try {
    const respuesta = await conTope(
      createAdminClient()
        .from("kora_ajustes")
        .select("valor, updated_at")
        .eq("clave", CLAVE)
        .maybeSingle(),
    );
    if (!respuesta) {
      console.error("[saldo/fases] la base no contestó a tiempo; el bloqueo queda APAGADO");
      return { fases: desdeEntorno(false), fallo: true };
    }
    const { data, error } = respuesta;

    if (error) {
      const ausente =
        (error.code && TABLA_AUSENTE.has(error.code)) ||
        /Could not find the table|relation .* does not exist/i.test(error.message ?? "");
      if (ausente) {
        if (!yaAvisadoSinTabla) {
          yaAvisadoSinTabla = true;
          console.warn(
            "[saldo/fases] la tabla kora_ajustes no existe: el prepago sigue mandado por " +
              "SALDO_RECARGA / SALDO_BLOQUEO. Corre sql/kora-crm-mando.sql para moverlo desde el CRM.",
          );
        }
        return { fases: desdeEntorno(true), fallo: false };
      }
      console.error("[saldo/fases] no se pudieron leer las fases; el bloqueo queda APAGADO:", error.message);
      return { fases: desdeEntorno(false), fallo: true };
    }

    // Nadie ha tocado el botón todavía: manda lo de siempre.
    if (!data) return { fases: desdeEntorno(true), fallo: false };

    const fila = data as { valor: unknown; updated_at: string | null };
    const valor = fila.valor;
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
      console.error("[saldo/fases] la fila saldo_fases no tiene la forma esperada; el bloqueo queda APAGADO:", valor);
      return { fases: desdeEntorno(false), fallo: true };
    }
    const v = valor as Record<string, unknown>;
    return {
      fases: {
        // `=== true` y no `Boolean()`: un "false" escrito como texto, un 1 o
        // cualquier cosa rara NO enciende nada.
        recarga: v.recarga === true,
        bloqueo: v.bloqueo === true,
        fuente: "base",
        actualizado: typeof fila.updated_at === "string" ? fila.updated_at : null,
      },
      fallo: false,
    };
  } catch (e) {
    console.error("[saldo/fases] error leyendo las fases; el bloqueo queda APAGADO:", e);
    return { fases: desdeEntorno(false), fallo: true };
  }
}

/** Las fases del prepago, con caché de 60 s. NUNCA lanza. */
export async function fasesSaldo(): Promise<FasesSaldo> {
  const ahora = Date.now();
  if (cache && ahora < cache.hasta) return cache.fases;
  const { fases, fallo } = await leerDeLaBase();
  cache = { hasta: ahora + (fallo ? TTL_FALLO_MS : TTL_MS), fases };
  return fases;
}

/** ¿Se puede recargar pagando? */
export async function recargaAbierta(): Promise<boolean> {
  return (await fasesSaldo()).recarga;
}

/**
 * ¿Un hotel sin saldo se queda mudo? Sólo si el bloqueo está encendido Y la
 * recarga abierta: nunca se calla a nadie que no tenga cómo recargar.
 */
export async function bloqueoEncendido(): Promise<boolean> {
  const f = await fasesSaldo();
  return f.recarga && f.bloqueo;
}

/** Olvida la caché de ESTA instancia (las demás tardan hasta 60 s). */
export function invalidarCacheFases(): void {
  cache = null;
}

/**
 * Guarda las fases. NO aplica los candados de negocio (bloqueo sin recarga, sin
 * recarga de seguridad…): eso es de la API del CRM, que es la que sabe explicar
 * al fundador por qué no. Aquí sólo se escribe lo que llega, validado de forma.
 *
 * Errores posibles: 'datos-invalidos' | 'sin-base' | 'falta-sql' | 'no-guardado'.
 */
export async function guardarFasesSaldo(f: {
  recarga: boolean;
  bloqueo: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (typeof f?.recarga !== "boolean" || typeof f?.bloqueo !== "boolean") {
    return { ok: false, error: "datos-invalidos" };
  }
  if (!adminEnvReady) return { ok: false, error: "sin-base" };
  try {
    const { error } = await createAdminClient()
      .from("kora_ajustes")
      .upsert(
        {
          clave: CLAVE,
          valor: { recarga: f.recarga, bloqueo: f.bloqueo },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clave" },
      );
    if (error) {
      const ausente =
        (error.code && TABLA_AUSENTE.has(error.code)) ||
        /Could not find the table|relation .* does not exist/i.test(error.message ?? "");
      if (ausente) return { ok: false, error: "falta-sql" };
      console.error("[saldo/fases] no se pudieron guardar las fases:", error.message);
      return { ok: false, error: "no-guardado" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[saldo/fases] error guardando las fases:", e);
    return { ok: false, error: "no-guardado" };
  } finally {
    // Aunque falle: la próxima lectura va a la base y enseña la verdad.
    invalidarCacheFases();
  }
}
