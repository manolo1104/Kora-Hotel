// Links al motor de reservas que Camila le manda al huésped, YA ARMADOS.
//
// Antes el prompt le pedía al modelo que pegara "&checkin=…&checkout=…&adults=N"
// a mano. Salían links rotos (`/reservar&checkin=…`, sin `?`), sin niños (el
// motor mostraba otro precio a las familias), sin el código de descuento que el
// prompt prometía "se aplica en el link", y sin forma de saber que la venta vino
// de Camila. Armar una URL es trabajo de código, no de un modelo de lenguaje.
//
// Puro y sin dependencias: lo usan la herramienta de disponibilidad y las pruebas.

export interface ParamsLinkReserva {
  /** Nombre del TIPO de cuarto; el motor lo compara en minúsculas y lo mete al carrito. */
  habitacion?: string;
  checkin?: string;
  checkout?: string;
  adultos?: number;
  ninos?: number;
  /** Código de descuento: el motor lo precarga y lo aplica en cuanto hay cuarto. */
  promo?: string;
}

/** `base` es la URL absoluta del motor: https://kora-hotel.com/h/<slug>/reservar */
export function linkReserva(base: string, p: ParamsLinkReserva = {}): string {
  const q = new URLSearchParams();
  if (p.habitacion && p.habitacion.trim()) q.set("habitacion", p.habitacion.trim().toLowerCase());
  if (p.checkin) q.set("checkin", p.checkin);
  if (p.checkout) q.set("checkout", p.checkout);
  if (p.adultos && p.adultos > 0) q.set("adults", String(Math.floor(p.adultos)));
  if (p.ninos && p.ninos > 0) q.set("children", String(Math.floor(p.ninos)));
  if (p.promo && p.promo.trim()) q.set("promo", p.promo.trim().toUpperCase());
  // Atribución: el motor la reenvía al cobro y la reserva queda como de Camila.
  q.set("origen", "camila");
  return `${base.replace(/\/+$/, "")}?${q.toString()}`;
}
