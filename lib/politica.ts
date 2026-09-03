// La política de cancelación. UNA, y de ella sale todo lo demás.
//
// 🔴 POR QUÉ EXISTE ESTE ARCHIVO. Hasta el 2 sep 2026 no había tres políticas
// contradictorias: había CUATRO MODELOS DE DATOS distintos, y ninguno era el
// bueno.
//
//   A · `extras.reglas.cancelacionDias` — un número, por defecto 2. Es el ÚNICO
//       que el código aplicaba de verdad al cancelar.
//   B · `extras.politicas.cancelacion` — texto libre, sin validar. Es lo que el
//       huésped LEÍA en la página, en el motor y en boca de Camila.
//   C · «7 días» QUEMADO en `lib/docs/templates.ts` — igual para todos los
//       hoteles, y el hotelero no podía corregirlo ni desde el editor, porque
//       no era un campo.
//   D · `components/herramientas/DocumentosLegales.tsx` — el único modelo con
//       escalones de verdad… y era un lead magnet de marketing que no se
//       guardaba en ninguna parte.
//
// Y una quinta regla no escrita: cancelar desde el panel reembolsaba el 100 %
// siempre, sin mirar tarifa ni antelación.
//
// LO QUE DECIDIÓ EL DISEÑO: en el motor, el texto libre GANABA sobre la regla
// para lo que el huésped leía y aceptaba, mientras que el enforcement aplicaba
// sólo la regla. **El huésped aceptaba una cosa y el sistema hacía otra.** Un
// huésped que cancela a 5 días y ve negado su reembolso tiene la política del
// propio hotel por escrito a su favor: eso es un contracargo perdido.
//
// Por eso aquí el texto se DERIVA de la estructura y nunca la sustituye. El
// campo libre de antes pasa a ser una nota adicional.
//
// `lib/glosario.ts` ya tenía escrita la especificación editorial de esta misma
// entidad (plazo gratis, qué pasa con el anticipo, no-show); esto la implementa.
//
// SOLO lógica: sin red, sin base, sin React. Por eso se puede probar.

/** Un escalón: «hasta N días antes de llegar, se devuelve X %». */
export interface EscalonPolitica {
  /** Días de antelación al check-in, inclusive. */
  diasAntes: number;
  /** Qué porcentaje del total se devuelve si cancela con esa antelación. */
  reembolsoPct: number;
}

export interface Politica {
  /**
   * De más antelación a menos. El primero que cubra la antelación real manda.
   * Vacío = no hay cancelación gratuita en ningún plazo.
   */
  escalones: EscalonPolitica[];
  /** Qué se devuelve si no llega y no avisa. Casi siempre 0. */
  noShowPct: number;
  /** Nota del hotelero, si quiere añadir algo. NO sustituye a los escalones. */
  nota?: string;
}

/** Lo que devuelve una decisión de cancelación. */
export interface Reembolso {
  /** Porcentaje del total que le toca al huésped. */
  pct: number;
  /** Por qué salió ese número, en una frase para el huésped. */
  motivo: string;
  /** Regla que decidió: útil para el panel y para el log. */
  regla: "escalon" | "sin-plazo" | "no-reembolsable" | "no-show" | "cancela-el-hotel";
}

/** El plazo por defecto cuando un hotel no ha configurado nada. */
export const DIAS_GRATIS_POR_DEFECTO = 2;

/**
 * Construye la política desde lo que el hotel tenga guardado.
 *
 * COMPATIBILIDAD: un hotel que sólo tenga `cancelacionDias` —que son todos los
 * de hoy— obtiene una política equivalente: reembolso total hasta ese día, nada
 * después. Ninguno se queda sin política el día del despliegue, y ninguno ve
 * cambiar sus condiciones sin tocarlas.
 */
export function politicaDe(raw: {
  escalones?: unknown;
  noShowPct?: unknown;
  nota?: unknown;
  cancelacionDias?: number;
}): Politica {
  const escalones = saneaEscalones(raw.escalones);
  if (escalones.length > 0) {
    return {
      escalones,
      noShowPct: clampPct(raw.noShowPct, 0),
      ...(typeof raw.nota === "string" && raw.nota.trim() ? { nota: raw.nota.trim() } : {}),
    };
  }
  // Derivada de la regla vieja.
  const dias = Number.isFinite(Number(raw.cancelacionDias))
    ? Math.max(0, Math.min(30, Math.round(Number(raw.cancelacionDias))))
    : DIAS_GRATIS_POR_DEFECTO;
  return {
    escalones: dias > 0 ? [{ diasAntes: dias, reembolsoPct: 100 }] : [],
    noShowPct: 0,
    ...(typeof raw.nota === "string" && raw.nota.trim() ? { nota: raw.nota.trim() } : {}),
  };
}

function clampPct(v: unknown, porDefecto: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Sanea los escalones que vengan del jsonb. Se ordenan de MÁS antelación a
 * menos, que es como se evalúan: si llegaran desordenados, un escalón de 2 días
 * al principio se comería al de 7 y el huésped cobraría de menos.
 */
export function saneaEscalones(raw: unknown): EscalonPolitica[] {
  if (!Array.isArray(raw)) return [];
  const out: EscalonPolitica[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const dias = Number(o.diasAntes);
    const pct = Number(o.reembolsoPct);
    if (!Number.isFinite(dias) || !Number.isFinite(pct)) continue;
    out.push({
      diasAntes: Math.max(0, Math.min(365, Math.round(dias))),
      reembolsoPct: clampPct(pct, 0),
    });
  }
  // Un mismo plazo dos veces: gana el más generoso, que es el que el huésped
  // podría reclamar por escrito.
  const porDias = new Map<number, number>();
  for (const e of out) {
    const previo = porDias.get(e.diasAntes);
    if (previo === undefined || e.reembolsoPct > previo) porDias.set(e.diasAntes, e.reembolsoPct);
  }
  return [...porDias.entries()]
    .map(([diasAntes, reembolsoPct]) => ({ diasAntes, reembolsoPct }))
    .sort((a, b) => b.diasAntes - a.diasAntes);
}

/** Días completos entre `hoy` y el check-in. Negativo si el check-in ya pasó. */
export function diasDeAntelacion(checkin: string, hoy: string): number {
  const a = new Date(`${hoy}T12:00:00`).getTime();
  const b = new Date(`${checkin}T12:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Cuánto le toca al huésped. ES LA ÚNICA FUNCIÓN QUE DECIDE DINERO, y de ella
 * tienen que salir tanto el número como el texto que lee el huésped.
 *
 * `origen: "hotel"` es la quinta regla que estaba sin escribir: si cancela el
 * hotel, se devuelve todo, pase lo que pase. Es lo correcto —la culpa es del
 * hotel— pero hasta ahora no aparecía en ninguna parte, ni siquiera en el
 * código: estaba como un `reembolsable: true` suelto en dos rutas.
 */
export function reembolsoPorCancelar(opts: {
  politica: Politica;
  checkin: string;
  hoy: string;
  ratePlan?: string | null;
  origen?: "huesped" | "hotel";
  noShow?: boolean;
}): Reembolso {
  const { politica, checkin, hoy } = opts;

  if (opts.origen === "hotel") {
    return {
      pct: 100,
      motivo: "El hotel canceló la reserva, así que se devuelve el importe completo.",
      regla: "cancela-el-hotel",
    };
  }
  if (opts.noShow) {
    return {
      pct: politica.noShowPct,
      motivo:
        politica.noShowPct > 0
          ? `No se presentó: se devuelve el ${politica.noShowPct}%.`
          : "No se presentó y no avisó: no hay devolución.",
      regla: "no-show",
    };
  }
  if (opts.ratePlan === "nrf") {
    return {
      pct: 0,
      motivo: "Es una tarifa no reembolsable: se reservó a un precio menor a cambio de no poder cancelar.",
      regla: "no-reembolsable",
    };
  }

  const dias = diasDeAntelacion(checkin, hoy);
  for (const e of politica.escalones) {
    if (dias >= e.diasAntes) {
      return {
        pct: e.reembolsoPct,
        motivo:
          e.reembolsoPct >= 100
            ? `Cancelas con ${dias} día(s) de antelación: se devuelve todo.`
            : e.reembolsoPct > 0
              ? `Cancelas con ${dias} día(s) de antelación: se devuelve el ${e.reembolsoPct}%.`
              : `Cancelas con ${dias} día(s) de antelación: ya no hay devolución.`,
        regla: "escalon",
      };
    }
  }
  return {
    pct: 0,
    motivo:
      politica.escalones.length === 0
        ? "Esta reserva no admite cancelación con devolución."
        : `Cancelas con ${dias} día(s) de antelación: ya pasó el plazo para devolver.`,
    regla: "sin-plazo",
  };
}

/** La última fecha en la que todavía se devuelve algo. `null` si nunca. */
export function fechaLimiteDevolucion(politica: Politica, checkin: string): string | null {
  const conDevolucion = politica.escalones.filter((e) => e.reembolsoPct > 0);
  if (conDevolucion.length === 0) return null;
  const menosDias = Math.min(...conDevolucion.map((e) => e.diasAntes));
  const d = new Date(`${checkin}T12:00:00`);
  d.setDate(d.getDate() - menosDias);
  return d.toISOString().slice(0, 10);
}

/**
 * EL TEXTO. Se deriva de los escalones, no al revés — es lo que impide que la
 * página diga una cosa y el sistema haga otra.
 */
export function textoPolitica(politica: Politica, lang: "es" | "en" = "es"): string {
  const en = lang === "en";
  if (politica.escalones.length === 0) {
    const base = en
      ? "This booking cannot be cancelled for a refund."
      : "Esta reserva no admite cancelación con devolución.";
    return politica.nota ? `${base} ${politica.nota}` : base;
  }
  const partes = politica.escalones.map((e) => {
    const d = e.diasAntes;
    const dia = en ? (d === 1 ? "day" : "days") : d === 1 ? "día" : "días";
    if (e.reembolsoPct >= 100) {
      return en
        ? `free cancellation up to ${d} ${dia} before arrival`
        : `cancelación gratis hasta ${d} ${dia} antes de llegar`;
    }
    if (e.reembolsoPct > 0) {
      return en
        ? `${e.reembolsoPct}% refund up to ${d} ${dia} before`
        : `${e.reembolsoPct}% de devolución hasta ${d} ${dia} antes`;
    }
    return en ? `no refund from ${d} ${dia} before` : `sin devolución desde ${d} ${dia} antes`;
  });
  const ultimo = politica.escalones[politica.escalones.length - 1];
  const cola =
    ultimo.reembolsoPct > 0
      ? en
        ? "; after that, no refund"
        : "; después, sin devolución"
      : "";
  const noShow =
    politica.noShowPct === 0
      ? en
        ? " If you don't show up, there's no refund."
        : " Si no llegas y no avisas, no hay devolución."
      : "";
  const base = `${partes.join(en ? "; " : "; ")}${cola}.${noShow}`;
  const texto = en ? base : base.charAt(0).toUpperCase() + base.slice(1);
  return politica.nota ? `${texto} ${politica.nota}` : texto;
}
