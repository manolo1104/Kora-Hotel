// Herramienta de disponibilidad de Camila. Fuente ÚNICA que usan /api/agent
// (bot vivo) y /api/admin/bot-preview (chat de prueba). SOLO servidor, lectura.
//
// Lo que devuelve está pensado para que el modelo NO tenga que calcular nada:
// noches, día de la semana de llegada y salida, total con las personas reales,
// anticipo, descuento del código y el link de reserva ya armado. Cada cosa que
// antes tenía que deducir "de cabeza" era un lugar donde se equivocaba.

import {
  hotelRooms,
  nightOpts,
  calcRoomStayTotal,
  calcNights,
  calcDepositAmount,
  calcPromoDiscount,
  validatePromo,
  bookingRules,
  seasonMinNoches,
  personasQuePagan,
  formatMXN,
} from "@/lib/booking";
import { freeUnitsByTypeResult } from "@/lib/db/availability";
import { linkReserva } from "@/lib/bot/links";
import type { HotelRow } from "@/lib/tenant";

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com").replace(/\/$/, "");
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Hoy en México, en el mismo formato que las fechas de la herramienta. */
function hoyMexico(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "martes 8 de diciembre de 2026" — para que Camila nunca diga un día equivocado. */
export function fechaLegible(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** El id del apartado de UNA conversación del bot. Mismo cálculo que agent-booking. */
export function sesionDelChat(conv: string | null | undefined): string | null {
  const limpio = (conv ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  return limpio ? `bot_c_${limpio}` : null;
}

export interface BotCuartoDisponible {
  id: string | number;
  nombre: string;
  maxHuespedes: number;
  /** Cuántos cuartos FÍSICOS de este tipo quedan libres. */
  unidadesLibres: number;
  /** Con cuántas personas se calculó el precio (las que pagan tarifa). */
  personasTarifa: number;
  /** Alias del anterior, para clientes viejos. */
  huespedesCotizados: number;
  total: number;
  totalTexto: string;
  /** Si el huésped dio un código válido: el total ya con el descuento. */
  totalConDescuentoTexto?: string;
  anticipo: number;
  anticipoTexto: string;
  pagaAlLlegarTexto: string;
  /** Link al motor con el cuarto, fechas, personas y código ya puestos. */
  linkReserva: string;
}

export interface BotAvailability {
  hotel: string;
  checkin: string;
  checkout: string;
  /** "martes 8 de diciembre de 2026" */
  llegada?: string;
  salida?: string;
  noches?: number;
  personas?: { adultos: number; ninos: number };
  hayDisponibilidad: boolean;
  /** Cuartos libres donde el grupo CABE en una sola unidad. */
  disponibles: BotCuartoDisponible[];
  /** Cuartos libres donde el grupo NO cabe en uno solo (se pueden combinar). */
  noCaben?: { id: string | number; nombre: string; maxHuespedes: number; unidadesLibres: number }[];
  /** Tipos de cuarto que ya no tienen lugar en esas fechas. */
  sinLugar?: string[];
  codigo?: { code: string; valido: boolean; descripcion?: string; motivo?: string };
  /** Link general al motor con fechas y personas (para que el huésped elija ahí). */
  linkReserva: string;
  /**
   * Sólo cuando la consulta NO se pudo responder tal cual. Existe para que Camila
   * no disfrace un fallo —o un mínimo de noches— de "no hay lugar".
   */
  error?: "fechas-invalidas" | "servicio-no-disponible" | "min-noches";
  minNoches?: number;
}

export interface OpcionesDisponibilidad {
  adultos?: number;
  ninos?: number;
  /** La conversación: su propio apartado no cuenta como ocupado. */
  conv?: string | null;
  codigo?: string | null;
}

/**
 * Disponibilidad real + precio total por tipo de cuarto para unas fechas.
 *
 * Las personas IMPORTAN: en un hotel con tarifas por número de personas el
 * precio de 2 no es el de 4. El runtime de WhatsApp nunca mandaba el dato, así
 * que en vivo Camila cotizaba siempre para 2 mientras el link de pago cobraba a
 * los reales (el chat de prueba del panel sí lo mandaba, por eso nadie lo veía).
 *
 * Acepta un número (clientes viejos: total de personas) o las opciones nuevas.
 */
export async function botAvailability(
  hotel: HotelRow,
  checkin: string,
  checkout: string,
  opciones: OpcionesDisponibilidad | number = {},
): Promise<BotAvailability> {
  const op: OpcionesDisponibilidad = typeof opciones === "number" ? { adultos: opciones } : opciones;
  const adultos = Math.max(1, Math.min(40, Math.floor(Number(op.adultos) || 2)));
  const ninos = Math.max(0, Math.min(40, Math.floor(Number(op.ninos) || 0)));
  const motor = `${SITE()}/h/${hotel.slug}/reservar`;
  const base: BotAvailability = {
    hotel: hotel.nombre,
    checkin,
    checkout,
    hayDisponibilidad: false,
    disponibles: [],
    linkReserva: motor,
  };

  // Una fecha que no se entendió NO es un hotel lleno, y una fecha ya pasada
  // tampoco se puede cotizar (se valida aquí y no sólo al cobrar: si no, Camila
  // confirmaba precio y lugar para unas fechas que `reservar` iba a rechazar).
  if (!FECHA.test(checkin) || !FECHA.test(checkout) || checkout <= checkin || checkin < hoyMexico()) {
    return { ...base, error: "fechas-invalidas" };
  }
  const noches = calcNights(checkin, checkout);
  const general = { ...base, llegada: fechaLegible(checkin), salida: fechaLegible(checkout), noches, personas: { adultos, ninos } };

  // El mínimo de noches se avisa AQUÍ, al cotizar. Antes sólo lo revisaba
  // `reservar`: Camila daba precio por una noche en temporada y el link fallaba.
  const reglas = bookingRules(hotel);
  const minNoches = Math.max(reglas.minNoches, seasonMinNoches(hotel, checkin));
  if (noches < minNoches) {
    return { ...general, error: "min-noches", minNoches };
  }

  // Se cuenta por UNIDAD física. El apartado de ESTA conversación no cuenta
  // como ocupado: si no, quien pedía otro link (se equivocó de correo) oía "ya
  // no hay ese cuarto" justo cuando iba a pagar.
  const { ok, types } = await freeUnitsByTypeResult(hotel.id, hotel, checkin, checkout, sesionDelChat(op.conv));
  if (!ok) return { ...general, error: "servicio-no-disponible" };

  const opts = nightOpts(hotel);
  const rooms = hotelRooms(hotel);
  const porId = new Map(rooms.map((r) => [String(r.id), r]));
  const grupo = adultos + ninos;
  const pagan = personasQuePagan(adultos, ninos, reglas.menoresPagan);

  // Código de descuento: se valida contra las promos REALES del hotel.
  const codigo = (op.codigo ?? "").trim().toUpperCase();
  const promo = codigo ? validatePromo(reglas.promos, codigo, noches, 1) : null;
  const infoCodigo = codigo
    ? promo?.valid && promo.rule
      ? {
          code: promo.rule.code,
          valido: true,
          descripcion:
            promo.rule.tipo === "porcentaje"
              ? `${promo.rule.valor}% de descuento`
              : promo.rule.tipo === "monto"
                ? `${formatMXN(promo.rule.valor)} de descuento`
                : `${promo.rule.valor} noche(s) gratis`,
        }
      : { code: codigo, valido: false, motivo: (promo?.error ?? "Código inválido").replace(/^❌\s*/, "") }
    : undefined;

  const disponibles: BotCuartoDisponible[] = [];
  const noCaben: NonNullable<BotAvailability["noCaben"]> = [];
  const sinLugar: string[] = [];
  for (const t of types) {
    const r = porId.get(String(t.id));
    if (!r) continue; // no debería pasar: ambos salen de hotelRooms(hotel)
    if (t.freeCount <= 0) {
      sinLugar.push(t.name);
      continue;
    }
    if (grupo > r.maxGuests) {
      noCaben.push({ id: t.id, nombre: t.name, maxHuespedes: r.maxGuests, unidadesLibres: t.freeCount });
      continue;
    }
    const personasTarifa = Math.max(1, Math.min(r.maxGuests, pagan));
    const total = calcRoomStayTotal(r, personasTarifa, checkin, checkout, opts);
    // Un cuarto SIN PRECIO no se ofrece: salía anunciado como «$0 MXN».
    if (total <= 0) continue;
    const descuento =
      promo?.valid && promo.rule
        ? calcPromoDiscount(rooms, promo.rule, [{ roomId: r.id, guestCount: personasTarifa, quantity: 1 }], checkin, checkout, noches, opts)
        : 0;
    const totalFinal = Math.max(0, total - descuento);
    const anticipo = calcDepositAmount(totalFinal, noches, { pct: reglas.anticipoPct, minNights: reglas.anticipoMinNoches });
    disponibles.push({
      id: t.id,
      nombre: t.name,
      maxHuespedes: r.maxGuests,
      unidadesLibres: t.freeCount,
      personasTarifa,
      huespedesCotizados: personasTarifa,
      total,
      totalTexto: formatMXN(total),
      ...(descuento > 0 ? { totalConDescuentoTexto: formatMXN(totalFinal) } : {}),
      anticipo,
      anticipoTexto: formatMXN(anticipo),
      pagaAlLlegarTexto: formatMXN(totalFinal - anticipo),
      linkReserva: linkReserva(motor, {
        habitacion: r.name,
        checkin,
        checkout,
        adultos,
        ninos,
        promo: infoCodigo?.valido ? infoCodigo.code : undefined,
      }),
    });
  }

  return {
    ...general,
    hayDisponibilidad: disponibles.length > 0,
    disponibles,
    ...(noCaben.length ? { noCaben } : {}),
    ...(sinLugar.length ? { sinLugar } : {}),
    ...(infoCodigo ? { codigo: infoCodigo } : {}),
    linkReserva: linkReserva(motor, {
      checkin,
      checkout,
      adultos,
      ninos,
      promo: infoCodigo?.valido ? infoCodigo.code : undefined,
    }),
  };
}
