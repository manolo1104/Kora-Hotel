// El tope que de verdad limita cuántos hoteles caben: los PROCESOS.
//
// 🔴 EL INCIDENTE (21 sep 2026). El contenedor llegó a 1.001 procesos con un
// límite de 1.000 —medido dentro: `/sys/fs/cgroup/pids.max` = 1000 y
// `pids.current` = 1001— y dejó de poder abrir el navegador del segundo hotel.
// El hotel que PAGA se quedó sin Camila durante horas. No fue memoria: había
// 8 GB y se usaban 0,3. Nadie miraba este número, así que nadie lo vio venir, y
// cada arranque fallido dejaba restos que acercaban el siguiente al tope.
//
// Cada Chromium se lleva más de cien procesos entre hilos y ayudantes, así que
// la pregunta antes de abrir uno nuevo no es «¿hay RAM?» sino «¿quedan
// procesos?».
//
// Vive aparte de index.js para poder probarlo: importar index.js abre Chromium.

import { readFileSync } from "node:fs";

/**
 * Cuántos procesos hay que dejar libres para no dejar al contenedor sin aire.
 *
 * Un Chromium de whatsapp-web.js ronda el centenar largo; el resto es margen
 * para que el propio Node, el servidor HTTP y las tareas de fondo no se queden
 * sin poder crear un hilo — que es cuando el contenedor deja de responder hasta
 * para abrir una consola (pasó el 21 sep: `crun: fork: Resource temporarily
 * unavailable`).
 */
export const RESERVA_PIDS = Number(process.env.CAMILA_RESERVA_PIDS || 250);

/** Lee un número de un archivo del cgroup. `null` si no se puede. */
function leerNumero(ruta, leer) {
  try {
    const txt = String(leer(ruta, "utf8")).trim();
    if (txt === "max") return Infinity;
    const n = Number(txt);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Procesos usados y libres del contenedor, o `null` cuando no se puede saber
 * (fuera de un contenedor, en cgroup v1, o sin límite). `null` significa «no
 * estorbes»: el runtime se comporta como siempre.
 *
 * `leer` es inyectable sólo para las pruebas.
 */
export function procesosDelContenedor(leer = readFileSync) {
  const max = leerNumero("/sys/fs/cgroup/pids.max", leer);
  const usados = leerNumero("/sys/fs/cgroup/pids.current", leer);
  if (max === null || usados === null || max === Infinity) return null;
  return { max, usados, libres: max - usados };
}

/**
 * ¿Cabe otro navegador?
 *
 * Devuelve `{ ok: true }` cuando sí (o cuando no se puede medir) y, cuando no,
 * el motivo YA ESCRITO para enseñárselo a una persona. Es la diferencia entre
 * «el hotel espera su turno» y «el hotel se estrella y deja basura».
 */
export function haySitioParaOtroNavegador(leer = readFileSync) {
  const p = procesosDelContenedor(leer);
  if (!p) return { ok: true };
  if (p.libres >= RESERVA_PIDS) return { ok: true, ...p };
  return {
    ok: false,
    ...p,
    motivo: `el servidor está al tope (${p.usados} de ${p.max} procesos; hacen falta ${RESERVA_PIDS} libres)`,
  };
}
