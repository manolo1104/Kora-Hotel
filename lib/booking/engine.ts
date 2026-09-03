// ============================================================
// MOTOR DE RESERVAS — tipos, precios y lógica de carrito (PURO)
// Portado de mi-hotel/lib/booking.ts. Diferencia multi-tenant: ya NO hay un
// arreglo global de cuartos; las funciones que necesitan la lista de cuartos la
// reciben por parámetro (cada hotel trae los suyos desde lib/booking/rooms.ts).
// Sin dependencias de datos/IO: solo cálculo.
// ============================================================

export interface BookingRoom {
  id: number | string;
  name: string; // nombre del TIPO (y, si cantidad=1, también su única unidad)
  description?: string;
  price: number;
  priceTiers: Record<number, number>;
  maxGuests: number;
  image?: string;
  images?: string[];
  features?: string[];
  camas?: { tipo: string; cantidad: number }[]; // camas del tipo (tipo + cuántas)
  // Inventario: un tipo puede tener N unidades físicas. cantidad=1 (default) =
  // comportamiento previo. `unidades` son los nombres reales que usan blocks/iCal.
  cantidad: number;
  unidades: string[];
  accesibilidad?: string; // cómo se llega: escalones, planta baja, elevador…
}

// ── Precios ──────────────────────────────────────────────
export function getRoomBasePrice(room: BookingRoom, guests: number): number {
  const tiers = room.priceTiers || {};
  const g = Math.max(1, Math.min(guests, room.maxGuests || guests));
  if (tiers[g] !== undefined) return tiers[g];
  for (let i = g - 1; i >= 1; i--) {
    if (tiers[i] !== undefined) return tiers[i];
  }
  return room.price;
}

/**
 * Ajuste de precio de una temporada o del recargo de fin de semana:
 * "porcentaje" (+40 / -20 sobre la base) o "fijo" (precio exacto por noche).
 */
export interface SeasonAdjustment {
  tipo: "porcentaje" | "fijo";
  valor: number;
}

/**
 * Temporada de tarifa por rango de fechas. El precio de esas noches sube/baja
 * según el ajuste que le toque a CADA tipo de habitación.
 *
 * 🔴 POR QUÉ HAY DOS CAMPOS. Hasta el 2 sep 2026 sólo existía `ajuste`, y se
 * aplicaba IGUAL a todos los cuartos. Con un porcentaje eso es razonable (un
 * +40% sube todo), pero con un PRECIO FIJO es una trampa: el mismo número
 * aplasta por igual la cabaña de $1,500 y la suite de $8,000. Un hotelero que
 * teclee "150" pensando en su cuarto más barato regala las suites de la semana
 * de mayor demanda del año, automáticamente, 24/7, por el motor y por WhatsApp,
 * sin que nada se lo diga.
 *
 *   • `porTipo` — el ajuste de cada tipo, INDEXADO POR NOMBRE. Es lo que
 *                 escribe el editor cuando eliges precio fijo.
 *   • `ajuste`  — el respaldo global. SE QUEDA a propósito: es lo que tienen
 *                 las temporadas ya guardadas, y sin él se romperían el día del
 *                 despliegue. Un porcentaje sigue siendo global y está bien.
 *
 * Al abrir una temporada vieja, el editor precarga su fijo global en todos los
 * tipos, así que se migra sola al guardar. No hace falta ningún SQL.
 */
export interface Temporada {
  id: string;
  nombre: string;
  desde: string; // 'YYYY-MM-DD' inclusive
  hasta: string; // 'YYYY-MM-DD' inclusive
  ajuste: SeasonAdjustment;
  /**
   * Ajuste por tipo de habitación, indexado por el NOMBRE del cuarto.
   *
   * 🔴 POR NOMBRE Y NO POR ID, a propósito. `hotelRooms` asigna
   * `id: h.id ?? i + 1`: el id es el ÍNDICE en el jsonb, y el editor no escribe
   * ninguno. Con claves por id, borrar o reordenar un cuarto le pasaría el
   * precio de temporada al cuarto equivocado sin decir nada — el peor fallo
   * posible aquí, porque nadie lo ve hasta que llega el estado de cuenta.
   *
   * Con el nombre, renombrar un cuarto sólo hace que esa entrada quede huérfana
   * y ese cuarto caiga al ajuste global. Es un fallo VISIBLE (el hotelero ve el
   * precio distinto al abrir el editor) y además está protegido por el piso.
   */
  porTipo?: Record<string, SeasonAdjustment>;
  minNoches?: number; // mín. de noches si la estancia LLEGA en esta temporada
}

/** Recargo automático para ciertos días de la semana (p. ej. vie/sáb). */
export interface RecargoFinDeSemana {
  activo: boolean;
  dias: number[]; // getDay(): 0=Dom … 6=Sáb (default vie/sáb = [5,6])
  ajuste: SeasonAdjustment;
}

/**
 * Precio por noche. Por defecto es el precio base. Un hotel puede configurar
 * (vía `opts`): temporadas por fecha, recargo de fin de semana y/o el descuento
 * entre semana (lun–jue, comportamiento previo). Precedencia por noche:
 *   1) temporada que cubra la fecha (gana la primera de la lista),
 *   2) recargo de fin de semana,
 *   3) descuento entre semana,
 *   4) precio base.
 */
export interface NightPriceOpts {
  weekdayDiscount?: number; // MXN a restar lun–jue; 0 = sin descuento
  weekdayDiscountUntil?: string; // 'YYYY-MM-DD'; a partir de aquí no aplica
  temporadas?: Temporada[];
  recargoFinDeSemana?: RecargoFinDeSemana;
}

/**
 * EL PISO DE TARIFA. Ninguna temporada ni recargo puede dejar una noche por
 * debajo de este porcentaje de su tarifa base.
 *
 * 🔴 POR QUÉ EXISTE. El único piso que hubo hasta el 2 sep 2026 era CERO pesos:
 * `Math.max(0, …)`. Un precio fijo de $150 en una suite de $1,900 pasaba el
 * saneado sin una sola advertencia, y también lo pasaba un porcentaje de −90 %.
 * No es un caso teórico: es cómo se regala la semana de mayor demanda del año
 * por un número mal tecleado.
 *
 * POR QUÉ 25 % Y NO 70 %. Esto NO es la defensa principal —esa es el aviso del
 * editor, que enseña el efecto real y pide confirmar—. Esto es el último
 * cortafuegos, y tiene que dejar pasar una promoción agresiva de verdad (un 2x1
 * es −50 %; una liquidación de temporada baja puede ser −70 %). Lo que corta es
 * lo que ya no es una promoción sino un accidente: vender una suite de $8,000
 * en $150 es un 1.9 % de su tarifa.
 *
 * POR QUÉ VIVE AQUÍ Y NO EN EL EDITOR. `PanelEditor` escribe DIRECTO a Postgres
 * desde el navegador (`supabase.from("hoteles").update(...)`): no hay ruta de
 * API en medio, así que cualquier validación que viva sólo en el componente se
 * esquiva con la consola del navegador o con un jsonb editado a mano. Este es
 * el único punto por el que pasan sin excepción el motor, la caja, Camila y el
 * cron de abandono.
 */
export const PISO_TARIFA_PCT = 25;

/**
 * Aplica un ajuste (porcentaje o fijo) a un precio base.
 * Nunca baja del piso (ver `PISO_TARIFA_PCT`), ni de 0.
 */
export function applyAdjustment(base: number, adj: SeasonAdjustment): number {
  const bruto =
    adj.tipo === "fijo"
      ? Math.round(adj.valor)
      : Math.round(base * (1 + adj.valor / 100));
  // Un cuarto sin precio base (0) no tiene piso que aplicar: se deja como está.
  const piso = base > 0 ? Math.round((base * PISO_TARIFA_PCT) / 100) : 0;
  return Math.max(0, piso, bruto);
}

/**
 * ¿Qué ajuste le toca a este cuarto en esta temporada? El suyo si lo tiene, y
 * si no el global — que es lo que hace que las temporadas ya guardadas sigan
 * funcionando sin tocar la base.
 */
export function ajusteDeTemporada(
  t: Temporada,
  room: Pick<BookingRoom, "id" | "name">,
): SeasonAdjustment {
  const porTipo = t.porTipo;
  if (!porTipo) return t.ajuste;
  // El nombre manda. El id se sigue mirando por si alguna vez los cuartos
  // tienen id propio en el jsonb; hoy es el índice y no se escribe nunca.
  return porTipo[room.name] ?? porTipo[String(room.id)] ?? t.ajuste;
}

export function getRoomNightPrice(
  room: BookingRoom,
  guests: number,
  dateStr: string,
  opts: NightPriceOpts = {},
): number {
  const base = getRoomBasePrice(room, guests);
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return base;

  // 1) Temporada por rango de fechas (comparación de strings ISO: sin TZ).
  //    Gana la PRIMERA temporada de la lista que cubra la fecha.
  for (const t of opts.temporadas ?? []) {
    if (dateStr >= t.desde && dateStr <= t.hasta) {
      return applyAdjustment(base, ajusteDeTemporada(t, room));
    }
  }

  // 2) Recargo de fin de semana (solo si no cayó en temporada).
  const rfs = opts.recargoFinDeSemana;
  if (rfs?.activo && Array.isArray(rfs.dias) && rfs.dias.includes(d.getDay())) {
    return applyAdjustment(base, rfs.ajuste);
  }

  // 3) Descuento entre semana (lun–jue, comportamiento previo).
  const desc = opts.weekdayDiscount ?? 0;
  if (desc <= 0) return base;
  if (opts.weekdayDiscountUntil && d >= new Date(`${opts.weekdayDiscountUntil}T12:00:00`)) {
    return base;
  }
  const day = d.getDay(); // 0=Dom … 4=Jue
  const isWeekday = day >= 1 && day <= 4;
  return isWeekday ? Math.max(0, base - desc) : base;
}

export function calcRoomStayTotal(
  room: BookingRoom,
  guests: number,
  checkin: string,
  checkout: string,
  opts: NightPriceOpts = {},
): number {
  const start = new Date(`${checkin}T12:00:00`);
  const end = new Date(`${checkout}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return getRoomBasePrice(room, guests);
  }
  let total = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    total += getRoomNightPrice(room, guests, `${y}-${m}-${d}`, opts);
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

export function calcNights(checkin: string, checkout: string): number {
  const start = new Date(`${checkin}T12:00:00`);
  const end = new Date(`${checkout}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

// ── Carrito ───────────────────────────────────────────────
export interface CartItem {
  roomId: number | string;
  guestCount: number;
  quantity?: number; // unidades del tipo (default 1); permite "2 Deluxe"
}

/** Resultado de comprobar si un carrito alcanza para la gente que llega. */
export interface CapacidadCarrito {
  ok: boolean;
  motivo?: "capacidad-insuficiente" | "ocupacion-declarada-insuficiente";
  /** Cuánta gente CABE en lo elegido: maxGuests × unidades. */
  capacidadFisica: number;
  /** Por cuánta gente se está PAGANDO: guestCount × unidades. */
  ocupacionPagada: number;
}

/**
 * ¿Alcanza el carrito para la gente que llega? Son DOS preguntas distintas y
 * antes sólo se hacía una (K-16):
 *
 *  1. ¿CABEN? — `maxGuests × unidades` contra adultos + menores. Los menores
 *     ocupan cama aunque no paguen tarifa (K-99), y esto no se miraba.
 *  2. ¿ESTÁN PAGANDO POR TODOS? — `guestCount × unidades` contra los adultos.
 *     Ésta faltaba entera. El precio sale de `getRoomBasePrice(room, guestCount)`
 *     y `guestCount` LO MANDA EL NAVEGADOR; como la única validación usaba
 *     `maxGuests`, que siempre es mayor o igual, pasaba siempre. Bastaba con
 *     pedir un cuarto de 4 con `guestCount: 1` y `adults: 4` para pagar la
 *     tarifa de una persona y llegar cuatro.
 *
 * Los menores NO suben la ocupación que se cobra, a propósito: hacerlo subiría
 * el precio de toda reserva con niños, que es otra cosa distinta de lo que este
 * arreglo persigue.
 *
 * Función pura: la usan igual el motor web, el checkout público y Camila, que
 * es lo que evita que los tres canales cobren distinto por la misma estancia.
 */
export function validarCapacidadCarrito(
  rooms: BookingRoom[],
  cart: CartItem[],
  adults: number,
  children = 0,
): CapacidadCarrito {
  let capacidadFisica = 0;
  let ocupacionPagada = 0;
  for (const item of cart) {
    const room = rooms.find((r) => String(r.id) === String(item.roomId));
    if (!room) continue; // un id inventado no aporta capacidad
    const qty = Math.max(1, Math.floor(item.quantity ?? 1));
    // Nadie paga por más gente de la que cabe en la unidad: si no, declarar
    // `guestCount: 99` sería una forma de pasar la comprobación sin pagarla.
    const porUnidad = Math.max(1, Math.min(Math.floor(item.guestCount) || 1, room.maxGuests));
    capacidadFisica += room.maxGuests * qty;
    ocupacionPagada += porUnidad * qty;
  }
  const personas = Math.max(0, adults) + Math.max(0, children);
  if (capacidadFisica < personas) {
    return { ok: false, motivo: "capacidad-insuficiente", capacidadFisica, ocupacionPagada };
  }
  if (ocupacionPagada < adults) {
    return { ok: false, motivo: "ocupacion-declarada-insuficiente", capacidadFisica, ocupacionPagada };
  }
  return { ok: true, capacidadFisica, ocupacionPagada };
}

/** Lo que el motor sabe de un TIPO al asignar: cuántas unidades libres y cuáles. */
export interface DisponibilidadTipo {
  id: number | string;
  name: string;
  freeCount: number;
  freeUnitNames: string[];
}

/**
 * Lo que se le manda al candado atómico: por cada TIPO del carrito, cuántas
 * unidades se quieren y cuáles son las CANDIDATAS. No se eligen aquí: elegir
 * fuera del candado es exactamente el defecto que se está arreglando.
 */
export interface CandidatasPorTipo {
  tipo: string;
  cantidad: number;
  unidades: string[];
}

/**
 * Agrupa el carrito por tipo (sumando cantidades) y le adjunta las unidades
 * candidatas de ese tipo. El orden de los tipos es el de su primera aparición
 * en el carrito, y ese mismo orden es el que devuelve el RPC: de ahí se pueden
 * volver a repartir los nombres entre las líneas.
 */
export function candidatasPorTipo(
  cart: CartItem[],
  tipos: DisponibilidadTipo[],
): CandidatasPorTipo[] {
  const porId = new Map(tipos.map((t) => [String(t.id), t]));
  const orden: string[] = [];
  const pedido = new Map<string, number>();
  for (const c of cart) {
    const k = String(c.roomId);
    if (!pedido.has(k)) orden.push(k);
    pedido.set(k, (pedido.get(k) ?? 0) + Math.max(1, Math.floor(c.quantity ?? 1)));
  }
  return orden.map((k) => {
    const t = porId.get(k);
    return {
      tipo: t?.name ?? String(k),
      cantidad: pedido.get(k) ?? 0,
      unidades: t?.freeUnitNames ?? [],
    };
  });
}

/**
 * El camino de vuelta: el candado devuelve un array PLANO de nombres, en el
 * orden de los tipos que se le pidieron. Se vuelve a partir por tipo para poder
 * repartirlo entre las líneas del carrito con `asignarUnidades`, que es la
 * misma función de siempre — así no hay dos reglas de reparto.
 */
export function tiposDesdeApartado(
  cart: CartItem[],
  candidatas: CandidatasPorTipo[],
  apartadas: string[],
): DisponibilidadTipo[] {
  const idPorTipo = new Map<string, number | string>();
  for (const c of cart) {
    const k = String(c.roomId);
    if (!idPorTipo.has(k)) idPorTipo.set(k, c.roomId);
  }
  const ids = [...idPorTipo.values()];
  let desde = 0;
  return candidatas.map((c, i) => {
    const trozo = apartadas.slice(desde, desde + c.cantidad);
    desde += c.cantidad;
    return { id: ids[i] ?? c.tipo, name: c.tipo, freeCount: trozo.length, freeUnitNames: trozo };
  });
}

/**
 * Cuántas unidades puede apartar UNA sesión del motor web de una sola vez.
 *
 * Hoy no hay tope (K-87): el carrito admite 10 líneas y `quantity` hasta el
 * total del tipo, así que una sola petición con nombre y correo inventados
 * aparta TODAS las unidades libres del hotel durante 35 minutos, sin pagar un
 * peso y sin dejar rastro de quién fue.
 *
 * El número sale de una tensión real: un grupo que reserva 6 cabañas para una
 * reunión familiar es un cliente, no un atacante, y rechazarlo es perder la
 * venta más grande del mes. Por eso el tope es RELATIVO al hotel —60 % de su
 * inventario, mínimo 4— en vez de un número fijo: deja pasar al grupo grande y
 * al mismo tiempo garantiza que ninguna sesión sola pueda cerrar el hotel.
 *
 * ⚠️ Esto acota lo que hace UNA sesión, no cuántas sesiones se pueden abrir.
 * El límite por IP es otra cosa y vive en el paso 9.9 del plan.
 */
export function topeUnidadesPorSesion(rooms: { cantidad: number }[]): number {
  const total = rooms.reduce((s, r) => s + Math.max(0, Math.floor(r.cantidad || 0)), 0);
  return Math.max(4, Math.ceil(total * 0.6));
}

/** Lugares que una reserva consume de una experiencia en un día concreto. */
export interface ConsumoExperiencia {
  experiencia: string;
  fecha: string;
  qty: number;
}

export type CupoExperiencias =
  | { ok: true }
  | { ok: false; experiencia: string; fecha: string; restante: number };

/**
 * ¿Caben en el cupo del día los lugares que pide esta reserva?
 *
 * EL DEFECTO (K-100): el bucle comparaba CADA línea contra lo ya vendido, sin
 * acumular lo que la propia reserva iba consumiendo. Dos líneas de la misma
 * experiencia el mismo día se comparaban las dos contra el mismo número y
 * pasaban las dos: un tour de 8 lugares se vendía dos veces a 5 personas en una
 * sola compra, y el hotelero se enteraba el día del tour.
 *
 * `cupoPorExperiencia` viene del catálogo del hotel; 0 o ausente = sin cupo (no
 * se comprueba nada). Función pura: se puede probar de verdad.
 */
export function validarCupoExperiencias(
  items: ConsumoExperiencia[],
  cupoPorExperiencia: Record<string, number>,
  yaVendidos: Record<string, Record<string, number>>,
): CupoExperiencias {
  const propio = new Map<string, number>();
  for (const v of items) {
    const cupo = cupoPorExperiencia[v.experiencia] ?? 0;
    if (cupo <= 0) continue;
    const clave = `${v.experiencia}|${v.fecha}`;
    const ya = (yaVendidos[v.experiencia]?.[v.fecha] ?? 0) + (propio.get(clave) ?? 0);
    if (ya + v.qty > cupo) {
      return { ok: false, experiencia: v.experiencia, fecha: v.fecha, restante: Math.max(0, cupo - ya) };
    }
    propio.set(clave, (propio.get(clave) ?? 0) + v.qty);
  }
  return { ok: true };
}

/** Una unidad física asignada, con la ocupación de SU línea del carrito. */
export interface UnidadAsignada {
  name: string;
  guestCount: number;
}

export type AsignacionUnidades =
  | { ok: true; unidades: UnidadAsignada[] }
  | { ok: false; tipoAgotado: string | null };

/**
 * Reparte unidades físicas concretas entre las líneas del carrito.
 *
 * El defecto que arregla (K-17): el checkout recorría el carrito línea por línea
 * y en cada una hacía `freeUnitNames.slice(0, qty)`. Dos líneas del MISMO tipo
 * cogían por tanto los MISMOS nombres. Con un carrito de `[{quantity:3},
 * {quantity:3}]` sobre un tipo de 3 unidades, las dos líneas pasaban la
 * comprobación (`freeCount >= qty` se miraba por línea, no en total), se
 * apartaban 3 unidades con los nombres repetidos… y `calcCartSubtotal`, que
 * cobra POR LÍNEA, le cobraba al huésped 6 cabañas.
 *
 * Dos líneas del mismo tipo son legítimas —"2 Deluxe para 2 personas y 1 Deluxe
 * para 4"— y por eso no se fusionan: cada una conserva SU `guestCount`, que es
 * de donde sale su precio. Lo que cambia es que la asignación lleva un cursor
 * por tipo, y que el total pedido de cada tipo se comprueba SUMADO.
 *
 * Función pura, sin base de datos: se puede probar de verdad.
 */
export function asignarUnidades(
  cart: CartItem[],
  tipos: DisponibilidadTipo[],
): AsignacionUnidades {
  const porId = new Map(tipos.map((t) => [String(t.id), t]));

  // 1) ¿Alcanza el inventario para el TOTAL de cada tipo? Antes se miraba línea
  //    por línea, y por eso 3 + 3 sobre 3 unidades pasaba.
  const pedido = new Map<string, number>();
  for (const c of cart) {
    const k = String(c.roomId);
    pedido.set(k, (pedido.get(k) ?? 0) + Math.max(1, Math.floor(c.quantity ?? 1)));
  }
  for (const [k, qty] of pedido) {
    const t = porId.get(k);
    // Manda `freeUnitNames`: es lo que de verdad se puede apartar. Si `freeCount`
    // dijera más de los nombres que trae, se estaría vendiendo aire.
    if (!t || Math.min(t.freeCount, t.freeUnitNames.length) < qty) {
      return { ok: false, tipoAgotado: t?.name ?? null };
    }
  }

  // 2) Repartir, sin repetir ninguna unidad.
  const cursor = new Map<string, number>();
  const unidades: UnidadAsignada[] = [];
  for (const c of cart) {
    const k = String(c.roomId);
    const t = porId.get(k)!;
    const desde = cursor.get(k) ?? 0;
    const qty = Math.max(1, Math.floor(c.quantity ?? 1));
    for (const name of t.freeUnitNames.slice(desde, desde + qty)) {
      unidades.push({ name, guestCount: c.guestCount });
    }
    cursor.set(k, desde + qty);
  }
  return { ok: true, unidades };
}

export function calcCartSubtotal(
  rooms: BookingRoom[],
  cart: CartItem[],
  checkin: string,
  checkout: string,
  opts: NightPriceOpts = {},
): number {
  return cart.reduce((sum, item) => {
    const room = rooms.find((r) => r.id === item.roomId);
    if (!room) return sum;
    const qty = Math.max(1, Math.floor(item.quantity ?? 1));
    return sum + calcRoomStayTotal(room, item.guestCount, checkin, checkout, opts) * qty;
  }, 0);
}

/**
 * Cuánto cobrar ahora. Por defecto 50% para 2+ noches y 100% para 1 noche
 * (comportamiento previo). El hotel puede configurar el % y el umbral de noches.
 */
export function calcDepositAmount(
  total: number,
  nights: number,
  opts: { pct?: number; minNights?: number } = {},
): number {
  const pct = opts.pct ?? 50;
  const minNights = opts.minNights ?? 2;
  return nights >= minNights ? Math.round(total * (pct / 100)) : Math.round(total);
}

// ── Rate plans ────────────────────────────────────────────
// Tarifa "No reembolsable": descuento % sobre el subtotal de habitaciones
// (no aplica a extras). El % viene de las reglas del hotel.
export type RatePlan = "flex" | "nrf";

export function calcNrfDiscount(roomsSubtotal: number, pct: number): number {
  const p = Math.max(0, Math.min(Number(pct) || 0, 50));
  return Math.round(Math.max(0, roomsSubtotal) * (p / 100));
}

// ── Desglose de impuestos ─────────────────────────────────
// Los precios del hotel son FINALES (impuestos incluidos). El desglose separa
// tarifa base + IVA 16% + ISH (% del estado, configurable) sin cambiar el total.
export const IVA_PCT = 16;

export interface TaxBreakdown {
  base: number;
  iva: number;
  ish: number;
  ishPct: number;
  total: number;
}

export function calcTaxBreakdown(total: number, ishPct = 0): TaxBreakdown {
  const t = Math.max(0, Math.round(total));
  const pct = Math.max(0, Math.min(Number(ishPct) || 0, 10));
  const factor = 1 + IVA_PCT / 100 + pct / 100;
  const iva = Math.round((t / factor) * (IVA_PCT / 100));
  // Sin ISH, el renglón de ISH no se muestra en la UI: el residuo de redondeo
  // se absorbe en la base para que lo VISIBLE siempre sume el total exacto.
  if (pct <= 0) return { base: t - iva, iva, ish: 0, ishPct: 0, total: t };
  const base = Math.round(t / factor);
  const ish = Math.max(0, t - base - iva); // residuo: el desglose siempre suma el total
  return { base, iva, ish, ishPct: pct, total: t };
}

// ── Extras vendibles (add-ons) ────────────────────────────────
export interface AddonRule {
  nombre: string;
  precio: number;
  tipo: "estancia" | "noche" | "persona";
  imagen?: string; // foto opcional para mostrar en el motor (no afecta el precio)
}

/** Total de los extras seleccionados (por índice en la lista del hotel). */
export function calcAddonsTotal(
  addons: AddonRule[],
  selected: number[],
  nights: number,
  guests: number,
): number {
  return selected.reduce((sum, i) => {
    const a = addons[i];
    if (!a) return sum;
    const p = Math.max(0, Number(a.precio) || 0);
    const mult =
      a.tipo === "noche" ? Math.max(1, nights) : a.tipo === "persona" ? Math.max(1, guests) : 1;
    return sum + p * mult;
  }, 0);
}

// ── Experiencias vendibles (tours, traslados, cena, spa) ──────
// Add-on "rico": igual que AddonRule pero con cobro por "unidad" (cantidad que
// elige el huésped, p. ej. 2 boletos) y un tope opcional. La versión de datos
// vive en lib/mini.ts (Experiencia); aquí el tipo es solo lo que el cálculo
// necesita, para mantener el engine sin dependencias.
export interface ExperienciaRule {
  nombre: string;
  precio: number;
  cobro: "estancia" | "noche" | "persona" | "unidad";
  cantidadMax?: number; // tope de unidades (solo cobro="unidad"); 0/undefined = sin tope
  // Agenda: metadatos de validación/anotación (el checkout revisa que la fecha
  // elegida caiga en un día permitido). NO participan en el cálculo del precio.
  dias?: number[]; // días de la semana en que se ofrece (0=Dom … 6=Sáb); vacío = todos
  horarios?: string[]; // horarios de salida; vacío = sin horario fijo
  cupoDia?: number; // lugares por día (0/undefined = sin límite); no aplica a cobro="noche"
}

/**
 * Lugares que una selección CONSUME del cupo diario de su experiencia:
 * unidad → cantidad de boletos, persona → huéspedes, estancia → 1.
 * cobro="noche" no elige día → no consume cupo (devuelve 0).
 */
export function experienciaCupoQty(
  e: Pick<ExperienciaRule, "cobro" | "cantidadMax">,
  qty: number,
  guests: number,
): number {
  if (e.cobro === "noche") return 0;
  if (e.cobro === "persona") return Math.max(1, guests);
  if (e.cobro === "estancia") return 1;
  const cap = e.cantidadMax && e.cantidadMax > 0 ? Math.floor(e.cantidadMax) : Infinity;
  return Math.min(cap, Math.max(1, Math.floor(Number(qty) || 1)));
}

/** Regla del descuento de paquete (extras.experienciasBundle). */
export interface ExperienciasBundleRule {
  min?: number; // mínimo de experiencias distintas (default 2)
  pct?: number; // % de descuento sobre el total de experiencias (0 = apagado)
}

/**
 * Descuento de paquete: si el huésped eligió `count` experiencias DISTINTAS
 * (count ≥ min, min mínimo 2 — un descuento por 1 sola no es paquete) se
 * descuenta pct% del total de experiencias. Redondeado a pesos. Puro.
 */
export function calcExperienciasBundleDiscount(
  experienciasTotal: number,
  count: number,
  rule?: ExperienciasBundleRule | null,
): number {
  const pct = Math.min(90, Math.max(0, Number(rule?.pct) || 0));
  const min = Math.max(2, Math.floor(Number(rule?.min) || 2));
  if (!pct || count < min || experienciasTotal <= 0) return 0;
  return Math.round(experienciasTotal * (pct / 100));
}

/** Una experiencia elegida: índice en el catálogo del hotel + cantidad.
 * fecha/hora (agenda) son anotaciones para el hotel; no cambian el precio. */
export interface ExperienciaSelection {
  i: number;
  qty: number; // solo relevante para cobro="unidad"; se ignora en los demás
  fecha?: string; // YYYY-MM-DD del día elegido dentro de la estancia
  hora?: string; // uno de los horarios del hotel
}

/**
 * Fechas (YYYY-MM-DD) en las que una experiencia puede tomarse dentro de la
 * estancia: del check-in al check-out INCLUSIVE (un traslado de salida ocurre el
 * día del check-out), filtradas por los días de semana en que se ofrece
 * (0=Dom … 6=Sáb; vacío = todos). Pura y sin zona horaria: las fechas se
 * descomponen a mano y el día de semana se calcula en UTC.
 */
export function experienciaFechasDisponibles(
  dias: number[] | undefined,
  checkin: string,
  checkout: string,
): string[] {
  const parse = (f: string) => {
    const [y, m, d] = f.split("-").map(Number);
    if (!y || !m || !d) return null;
    return Date.UTC(y, m - 1, d);
  };
  const ini = parse(checkin);
  const fin = parse(checkout);
  if (ini == null || fin == null || fin < ini) return [];
  const permitidos = Array.isArray(dias) && dias.length > 0 ? new Set(dias) : null;
  const out: string[] = [];
  const DIA_MS = 86_400_000;
  // Tope defensivo de 62 días: ninguna estancia real del motor dura más.
  for (let t = ini, n = 0; t <= fin && n < 62; t += DIA_MS, n++) {
    const dt = new Date(t);
    if (permitidos && !permitidos.has(dt.getUTCDay())) continue;
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Total de las experiencias seleccionadas. Multiplicador por cobro:
 *   estancia → ×1, noche → ×noches, persona → ×huéspedes, unidad → ×qty (topeada
 *   a cantidadMax). Índices inválidos se ignoran. Igual que en el resto del
 *   motor, el monto NUNCA se confía al cliente: solo el índice y la cantidad.
 */
export function calcExperienciasTotal(
  catalog: ExperienciaRule[],
  selections: ExperienciaSelection[],
  nights: number,
  guests: number,
): number {
  return selections.reduce((sum, sel) => {
    const e = catalog[sel?.i];
    if (!e) return sum;
    const price = Math.max(0, Number(e.precio) || 0);
    if (e.cobro === "unidad") {
      const cap = e.cantidadMax && e.cantidadMax > 0 ? Math.floor(e.cantidadMax) : Infinity;
      const qty = Math.min(cap, Math.max(1, Math.floor(Number(sel?.qty) || 1)));
      return sum + price * qty;
    }
    const mult =
      e.cobro === "noche"
        ? Math.max(1, nights)
        : e.cobro === "persona"
          ? Math.max(1, guests)
          : 1; // estancia
    return sum + price * mult;
  }, 0);
}

// ── Estado de reserva (se persiste en sessionStorage) ────────
export interface BookingState {
  checkin: string;
  checkout: string;
  nights: number;
  adults: number;
  children: number;
  cart: CartItem[];
  promoCode: string | null;
  promoDiscount: number;
  amountTotal?: number;
  amountPaid?: number;
  amountPending?: number;
  isDeposit?: boolean;
}

export const BOOKING_STATE_KEY = "kora_booking_state";

export function saveBookingState(state: BookingState): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(BOOKING_STATE_KEY, JSON.stringify(state));
  }
}

export function loadBookingState(): BookingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BOOKING_STATE_KEY);
    return raw ? (JSON.parse(raw) as BookingState) : null;
  } catch {
    return null;
  }
}

export function formatMXN(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")} MXN`;
}

// ── Promos (opcional, por hotel) ─────────────────────────────
// Un hotel puede definir promos en su config. Modelo simple por porcentaje o
// "n-ésima noche gratis". Sin promos configuradas, no hay descuento.
export interface PromoRule {
  code: string;
  tipo: "porcentaje" | "noche_gratis" | "monto";
  valor: number; // % (0..100), índice de noche (1-based) o monto fijo
  minNoches?: number;
  noches?: number; // si la promo exige exactamente N noches
}

export interface PromoValidation {
  valid: boolean;
  error?: string;
  rule?: PromoRule;
}

export function validatePromo(
  promos: PromoRule[],
  code: string,
  nights: number,
  cartLength: number,
): PromoValidation {
  const rule = promos.find((p) => p.code.toUpperCase() === code.toUpperCase());
  if (!rule) return { valid: false, error: "❌ Código inválido. Verifica e intenta de nuevo." };
  if (cartLength === 0) return { valid: false, error: "❌ Agrega al menos una habitación primero." };
  if (rule.minNoches && nights < rule.minNoches)
    return { valid: false, error: `❌ Aplica para ${rule.minNoches}+ noches.` };
  if (rule.noches && nights !== rule.noches)
    return { valid: false, error: `❌ Aplica únicamente para ${rule.noches} noches.` };
  return { valid: true, rule };
}

function nightByIndex(checkin: string, checkout: string, idx: number): string | null {
  const start = new Date(`${checkin}T12:00:00`);
  const end = new Date(`${checkout}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + idx);
  if (cursor >= end) return null;
  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, "0");
  const d = String(cursor.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function calcPromoDiscount(
  rooms: BookingRoom[],
  rule: PromoRule,
  cart: CartItem[],
  checkin: string,
  checkout: string,
  nights: number,
  opts: NightPriceOpts = {},
): number {
  const subtotal = calcCartSubtotal(rooms, cart, checkin, checkout, opts);
  if (rule.tipo === "monto") return Math.min(rule.valor, subtotal);
  if (rule.tipo === "porcentaje") return Math.round(subtotal * (rule.valor / 100));
  if (rule.tipo === "noche_gratis") {
    const nightDate = nightByIndex(checkin, checkout, Math.max(0, rule.valor - 1));
    if (!nightDate) return 0;
    return cart.reduce((sum, item) => {
      const room = rooms.find((r) => r.id === item.roomId);
      if (!room) return sum;
      return sum + getRoomNightPrice(room, item.guestCount, nightDate, opts);
    }, 0);
  }
  return 0;
}
