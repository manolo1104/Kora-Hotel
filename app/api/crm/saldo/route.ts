import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmAuth } from "@/lib/crm/auth";
import { requireCrmMutacion } from "@/lib/crm/guardas";
import { registrarAccion } from "@/lib/crm/bitacora";
import { adminEnvReady } from "@/lib/supabase/admin";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { limitado, ipDe } from "@/lib/api/rate-limit";
import { fasesSaldo, guardarFasesSaldo, invalidarCacheFases } from "@/lib/saldo/fases";
import {
  aplicarRegaloATodos,
  cargarPrepago,
  comprobarSeguridad,
  hotelesConRef,
  leerHoteles,
  leerSaldosCrudos,
} from "@/lib/saldo/prepago-crm";
import {
  ETIQUETA_SEGURIDAD,
  MENSAJES_TODOS_MAX,
  efectivas,
  enciendeSinVerlo,
  etiquetaValida,
  evaluarCambioFases,
  mensajesMinimos,
  mensajesTodosValidos,
  planRegaloATodos,
  refDeRegalo,
  type EnsayoRegalo,
} from "@/lib/saldo/candados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// `maxDuration` es del archivo, no de cada método, y aquí los dos lo necesitan:
// el GET rehace lo mismo que /crm/prepago (un conteo de consumo por hotel) y el
// regalo a todos acredita hotel por hotel, de 5 en 5, con un apunte de bitácora
// cada uno. Con el tope corto por defecto, un regalo a muchos hoteles se cortaría
// A MEDIAS: la mitad acreditada, sin respuesta y sin resumen en la bitácora.
// Mismo número que /crm.
export const maxDuration = 60;

// El prepago de Camila, operado desde /crm/prepago.
//
// GET  → todo lo que pinta la pantalla (fases, saldos, recarga de seguridad).
// POST → una acción por petición:
//   { accion: 'fases', recarga, bloqueo, vistos? }
//   { accion: 'regalar_todos', mensajes, etiqueta, ensayo }
//
// Hasta el 15 sep 2026 esto era `node scripts/regalar-saldo.mjs` en la terminal
// y dos variables de entorno en Vercel (con redespliegue). Manolo pidió
// operarlo con botones. Lo que se movió aquí tiene que ser, como mínimo, igual
// de difícil de equivocar que el script:
//
//   · Los CANDADOS de los interruptores se aplican AQUÍ (lib/saldo/candados.ts).
//     La pantalla apaga el botón con el mismo motivo, pero esconder un botón no
//     impide mandar el POST a mano.
//   · El regalo a todos tiene ensayo, que no escribe nada, y usa el MISMO `ref`
//     que el script: repetirlo no suma dos veces, venga de donde venga.
//   · Todo queda en la bitácora con el antes y el después.
//   · Nunca se devuelve el mensaje crudo de Postgres: va al log.

const ESQUEMA = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("fases"),
    recarga: z.boolean(),
    bloqueo: z.boolean(),
    // Lo que la pantalla enseñaba al abrir el diálogo. Opcional para no romper a
    // quien llame sin él, pero la pantalla del CRM siempre lo manda.
    vistos: z.object({ recarga: z.boolean(), bloqueo: z.boolean() }).optional(),
  }),
  z.object({
    accion: z.literal("regalar_todos"),
    mensajes: z.number().int().min(1).max(MENSAJES_TODOS_MAX),
    // Sin `trim` ni minúsculas aquí: la pantalla normaliza lo que se teclea y lo
    // enseña antes de mandar. Si el servidor lo cambiara en silencio, el `ref`
    // acreditado no sería el que Manolo vio en el ensayo.
    etiqueta: z.string().refine((v) => etiquetaValida(v)),
    ensayo: z.boolean(),
  }),
]);

type Cuerpo = z.infer<typeof ESQUEMA>;

const NO_SE_CAMBIO = "No se cambió nada.";
const TARDA = "Tarda hasta un minuto en llegar a todos los hoteles.";

function error(status: number, texto: string): NextResponse {
  return NextResponse.json({ error: texto }, { status });
}

function plural(n: number, uno: string, varios: string): string {
  return `${n.toLocaleString("es-MX")} ${n === 1 ? uno : varios}`;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const noAuth = await requireCrmAuth();
  if (noAuth) return noAuth;
  return NextResponse.json({ ok: true, prepago: await cargarPrepago() });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const no = await requireCrmMutacion(req);
  if (no) return no;
  if (!adminEnvReady) return error(503, "No hay conexión a la base de datos.");

  // Holgado: el fundador no da 60 clics en 10 minutos. Está para que una cookie
  // robada o un script en bucle no pueda mover interruptores ni regalar sin freno.
  if (await limitado("crm.saldo", ipDe(req), { max: 60, ventanaMs: 10 * 60_000 })) {
    return error(429, "Demasiadas acciones seguidas. Espera unos minutos.");
  }

  const c = await leerCuerpo(req, ESQUEMA);
  if (!c.ok) return c.respuesta;
  const cuerpo = c.datos;

  try {
    switch (cuerpo.accion) {
      case "fases":
        return await cambiarFases(cuerpo);
      case "regalar_todos":
        return await regalarATodos(cuerpo);
    }
    return error(400, "Esa acción no existe.");
  } catch (err) {
    console.error(`[crm/saldo] ${cuerpo.accion} falló:`, err);
    return error(500, "Algo falló a medio camino. Recarga la página para ver en qué quedó antes de repetirlo.");
  }
}

// ─── Los dos interruptores ───────────────────────────────────────────────────

async function cambiarFases(cuerpo: Extract<Cuerpo, { accion: "fases" }>): Promise<NextResponse> {
  const pedido = { recarga: cuerpo.recarga, bloqueo: cuerpo.bloqueo };

  // Lo guardado AHORA, no lo que esta instancia tenía en caché: los candados
  // sobre un dato de hace un minuto dejarían cerrar las recargas con el bloqueo
  // recién encendido desde otra pestaña.
  invalidarCacheFases();
  const actual = await fasesSaldo();

  if (actual.fuente === "base" && actual.recarga === pedido.recarga && actual.bloqueo === pedido.bloqueo) {
    return NextResponse.json({ ok: true, mensaje: "Ya estaba así: no hubo nada que cambiar." });
  }

  // Pantalla vieja: el pedido lleva los dos interruptores y el diálogo sólo
  // habló de uno. Si esto encendiera algo que Manolo creía ya encendido (p. ej.
  // reabrir las recargas que se cerraron desde otra pestaña), se para aquí.
  // Sólo con la lectura buena de la base: si la lectura falló, `actual` es el
  // respaldo del entorno y compararlo con la pantalla daría «cambió» por un
  // parpadeo, justo cuando alguien intenta apagar el bloqueo.
  if (cuerpo.vistos && actual.fuente === "base" && enciendeSinVerlo({ actual, vistos: cuerpo.vistos, pedido })) {
    return error(
      409,
      `Esto cambió desde que abriste la pantalla (quizá desde otra pestaña). Recarga la página, revisa cómo quedó y vuelve a intentarlo. ${NO_SE_CAMBIO}`,
    );
  }

  const antes = efectivas(actual);
  const enciende = (pedido.recarga && !antes.recarga) || (pedido.bloqueo && !antes.bloqueo);
  // Las lecturas del candado sólo hacen falta para ENCENDER. Apagar pasa siempre,
  // y no puede quedarse esperando a una base lenta justo cuando urge apagar el
  // bloqueo porque Camila se calló donde no debía.
  const comprobado = enciende ? await comprobarSeguridad() : null;

  const veredicto = evaluarCambioFases({
    actual,
    pedido,
    saldoInstalado: comprobado?.saldoInstalado ?? true,
    seguridad: comprobado
      ? { leida: comprobado.seguridad.leida, faltan: comprobado.seguridad.faltan.length }
      : { leida: true, faltan: 0 },
  });
  if (!veredicto.ok) return error(409, `${veredicto.motivo} ${NO_SE_CAMBIO}`);

  const guardado = await guardarFasesSaldo(pedido);
  if (!guardado.ok) {
    if (guardado.error === "falta-sql") {
      return error(409, `Falta correr sql/kora-crm-mando.sql en Supabase para guardar esto. ${NO_SE_CAMBIO}`);
    }
    if (guardado.error === "sin-base") return error(503, "No hay conexión a la base de datos.");
    return error(500, `No se pudo guardar. ${NO_SE_CAMBIO} Intenta de nuevo en un momento.`);
  }

  const partes: string[] = [];
  if (pedido.recarga !== antes.recarga) {
    partes.push(
      pedido.recarga
        ? "Recargas abiertas: los hoteleros ya pueden comprar saldo desde su panel."
        : "Recargas cerradas: el panel vuelve a decir «próximamente».",
    );
  }
  if (pedido.bloqueo !== antes.bloqueo) {
    partes.push(
      pedido.bloqueo
        ? "Listo: un hotel sin saldo deja de contestar con Camila hasta que recargue."
        : "Listo: Camila vuelve a contestar aunque un hotel se quede sin saldo.",
    );
  }
  if (partes.length === 0) partes.push("Guardado.");

  const mudos = comprobado?.mudosHoy ?? null;
  const avisoMudos =
    pedido.bloqueo && !antes.bloqueo && mudos
      ? mudos === 1
        ? "Ojo: ahora mismo 1 hotel está en cero y va a dejar de contestar."
        : `Ojo: ahora mismo ${plural(mudos, "hotel", "hoteles")} están en cero y van a dejar de contestar.`
      : undefined;

  const apuntado = await registrarAccion({
    accion: "saldo.fases",
    antes: { recarga: actual.recarga, bloqueo: actual.bloqueo, fuente: actual.fuente },
    despues: pedido,
    detalle: comprobado
      ? {
          seguridad: { total: comprobado.seguridad.total, faltan: comprobado.seguridad.faltan.length },
          mudosHoy: mudos,
        }
      : null,
  });

  const avisos = [avisoMudos, apuntado ? null : "Se hizo, pero no quedó apuntado en la bitácora."].filter(Boolean);
  return NextResponse.json({
    ok: true,
    mensaje: `${partes.join(" ")} ${TARDA}`,
    ...(avisos.length ? { aviso: avisos.join(" ") } : {}),
  });
}

// ─── Regalo a todos (y la recarga de seguridad) ──────────────────────────────

async function regalarATodos(cuerpo: Extract<Cuerpo, { accion: "regalar_todos" }>): Promise<NextResponse> {
  const { etiqueta, mensajes, ensayo } = cuerpo;
  const ref = refDeRegalo(etiqueta);
  const noSeRegalo = "No se regaló nada.";

  // El esquema ya acotó 1..MAX; la recarga de seguridad pide además su mínimo
  // (lib/saldo/candados.ts, `mensajesMinimos`): su `ref` no se puede repetir con
  // la cifra buena si sale corta.
  if (!mensajesTodosValidos(mensajes, etiqueta)) {
    return error(
      400,
      `La recarga de seguridad tiene que ser de al menos ${mensajesMinimos(etiqueta).toLocaleString("es-MX")} mensajes por hotel. ${noSeRegalo}`,
    );
  }

  const hoteles = await leerHoteles();
  if (!hoteles.ok) return error(503, `No se pudo leer la lista de hoteles. ${noSeRegalo}`);

  // Como `scripts/regalar-saldo.mjs --todos`: a TODOS los hoteles, estén o no ya
  // en el prepago. Sólo se salta a quien ya tiene este mismo `ref`.
  const ya = await hotelesConRef(
    hoteles.data.map((h) => h.id),
    ref,
  );
  if (!ya.ok) {
    return ya.faltaSql
      ? error(409, `Falta correr sql/kora-saldo-bot.sql en Supabase. ${noSeRegalo}`)
      : error(503, `No se pudo comprobar quién tenía ya este regalo. ${noSeRegalo} Intenta de nuevo.`);
  }
  const plan = planRegaloATodos(hoteles.data, ya.ids);

  if (ensayo) {
    // Lo que tiene cada uno hoy es sólo para enseñar «0 → 300» como el script;
    // si no se puede leer, el ensayo sigue valiendo (a quién le toca sí se sabe).
    const saldos = await leerSaldosCrudos();
    const respuesta: EnsayoRegalo = {
      etiqueta,
      ref,
      mensajes,
      saldosLeidos: saldos.ok,
      tocan: plan.tocan.map((h) => ({
        slug: h.slug,
        nombre: h.nombre,
        mensajes: saldos.ok ? (saldos.data.get(h.id) ?? null) : null,
      })),
      yaLoTenian: plan.yaLoTenian.map((h) => ({ slug: h.slug, nombre: h.nombre })),
    };
    return NextResponse.json({ ok: true, ensayo: respuesta });
  }

  if (plan.tocan.length === 0) {
    return NextResponse.json({
      ok: true,
      mensaje: `Todos los hoteles ya tenían el regalo «${etiqueta}»: no se sumó nada.`,
    });
  }

  const saldosAntes = await leerSaldosCrudos();
  const r = await aplicarRegaloATodos(plan.tocan, mensajes, ref);

  if (r.aplicados.length === 0 && r.fallidos.length > 0) {
    if (r.faltaSql) return error(409, `Falta correr sql/kora-saldo-bot.sql en Supabase. ${noSeRegalo}`);
    return error(
      500,
      "No se pudo confirmar ningún regalo. Vuelve a intentarlo: a quien ya lo haya recibido no se le suma dos veces.",
    );
  }
  if (r.aplicados.length === 0) {
    // Entre el ensayo y el clic alguien se adelantó (otra pestaña, el script):
    // la base no dejó sumar dos veces, que es justo lo que tenía que pasar.
    return NextResponse.json({
      ok: true,
      mensaje: `Todos los hoteles ya tenían el regalo «${etiqueta}»: no se sumó nada.`,
    });
  }

  const esSeguridad = etiqueta === ETIQUETA_SEGURIDAD;
  const motivo = esSeguridad
    ? "Recarga de seguridad antes de callar a Camila sin saldo"
    : `Regalo a todos los hoteles: «${etiqueta}»`;

  // Un apunte por hotel, para que salga en la bitácora de su ficha igual que un
  // regalo hecho desde allí, y uno con el resumen de la tanda.
  const apuntes = await Promise.all(
    r.aplicados.map(({ hotel, nuevo }) =>
      registrarAccion({
        accion: "saldo.regalar",
        hotelId: hotel.id,
        hotelSlug: hotel.slug,
        motivo,
        antes: { mensajes: saldosAntes.ok ? (saldosAntes.data.get(hotel.id) ?? null) : null, leido: saldosAntes.ok },
        despues: { mensajes: nuevo },
        detalle: { regalados: mensajes, ref, etiqueta, aTodos: true },
      }),
    ),
  );
  const resumenApuntado = await registrarAccion({
    accion: "saldo.regalar_todos",
    motivo,
    detalle: {
      etiqueta,
      ref,
      mensajes,
      aplicados: r.aplicados.map((a) => a.hotel.slug),
      repetidos: r.repetidos.map((h) => h.slug),
      fallidos: r.fallidos.map((h) => h.slug),
      yaLoTenian: plan.yaLoTenian.map((h) => h.slug),
    },
  });

  const repetidos = plan.yaLoTenian.length + r.repetidos.length;
  const mensaje =
    `Listo: le regalaste ${plural(mensajes, "mensaje", "mensajes")} a ${plural(r.aplicados.length, "hotel", "hoteles")}.` +
    (repetidos > 0
      ? ` ${plural(repetidos, "hotel ya lo tenía", "hoteles ya lo tenían")}, y ahí no se repitió.`
      : "");

  const avisos: string[] = [];
  if (r.fallidos.length > 0) {
    avisos.push(
      `No se pudo con: ${r.fallidos.map((h) => h.nombre).join(", ")}. Vuelve a hacer el regalo: a quien ya lo recibió no se le suma dos veces.`,
    );
  }
  if (!resumenApuntado || apuntes.some((ok) => !ok)) {
    avisos.push("Se hizo, pero no todo quedó apuntado en la bitácora.");
  }

  return NextResponse.json({ ok: true, mensaje, ...(avisos.length ? { aviso: avisos.join(" ") } : {}) });
}
