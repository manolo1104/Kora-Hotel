// ÚNICA fuente de verdad de "quién puede hacer qué" en Kora. SOLO servidor.
//
// La base define cinco roles (`dueno`, `encargada`, `recepcion`, `limpieza`,
// `cocina`) desde el primer día, pero 39 de las 45 rutas del panel no los
// miraban: bastaba ser MIEMBRO. En cuanto exista la pantalla de "invitar a
// alguien a mi hotel", esa recepcionista podría cancelar reservas, reescribir la
// CLABE que Camila le dicta a los huéspedes, vincular el WhatsApp del hotel a su
// propio teléfono y abrir el dashboard de Stripe del dueño.
//
// Por qué permisos y no listas de roles sueltas en cada ruta: con 45 listas
// escritas a mano, dentro de un año nadie podría contestar "¿qué puede hacer una
// recepcionista?" sin leer 45 archivos. Con este mapa la pregunta se responde
// abriendo un archivo.
//
// El reparto es deliberadamente GENEROSO HACIA ABAJO y ESTRICTO HACIA EL DINERO:
// leer casi todos, escribir en su área casi todos, y tocar dinero, identidad o
// el bot sólo el dueño.
import { NextResponse } from "next/server";
import type { RolHotel, TenantContext } from "@/lib/tenant";

export type Permiso =
  | "reservas:leer"
  | "reservas:escribir"
  | "reservas:cancelar"
  | "calendario:escribir"
  | "cotizaciones:leer"
  | "cotizaciones:escribir"
  | "clientes:leer"
  | "clientes:escribir"
  | "operaciones:leer"
  | "operaciones:escribir"
  | "canales:leer"
  | "canales:escribir"
  | "bot:leer"
  | "bot:entrenar"
  | "bot:configurar"
  | "bot:vincular"
  | "pagos:ver"
  | "pagos:conectar"
  | "facturacion:usar"
  | "marketing:enviar"
  | "sitio:leer"
  | "sitio:editar"
  | "ia:usar"
  | "equipo:gestionar"
  | "hotel:eliminar";

const TODOS: RolHotel[] = ["dueno", "encargada", "recepcion", "limpieza", "cocina"];
const MOSTRADOR: RolHotel[] = ["dueno", "encargada", "recepcion"];
const MANDO: RolHotel[] = ["dueno", "encargada"];
const SOLO_DUENO: RolHotel[] = ["dueno"];

export const PERMISOS: Record<Permiso, RolHotel[]> = {
  "reservas:leer": TODOS,
  "reservas:escribir": MOSTRADOR,
  "reservas:cancelar": MANDO, // limpieza YA NO cancela reservas
  "calendario:escribir": MOSTRADOR,
  "cotizaciones:leer": MOSTRADOR,
  "cotizaciones:escribir": MOSTRADOR,
  "clientes:leer": MOSTRADOR,
  "clientes:escribir": MOSTRADOR,
  "operaciones:leer": TODOS, // limpieza y cocina viven aquí
  "operaciones:escribir": ["dueno", "encargada", "recepcion", "limpieza"],
  "canales:leer": MANDO,
  "canales:escribir": MANDO,
  "bot:leer": MANDO,
  // Entrenar a Camila (FAQs, tono, encendido) NO es lo mismo que tocar su
  // dinero. La encargada debe poder afinar cómo responde el bot sin poder
  // cambiar la cuenta a la que un huésped va a transferir.
  "bot:entrenar": MANDO,
  "bot:configurar": SOLO_DUENO, // la CLABE que Camila le dicta a los huéspedes
  "bot:vincular": SOLO_DUENO, // QR de WhatsApp + token del bot
  "pagos:ver": SOLO_DUENO, // dashboard de Stripe del dueño
  "pagos:conectar": SOLO_DUENO,
  "facturacion:usar": MANDO,
  "marketing:enviar": MOSTRADOR,
  "sitio:leer": MANDO,
  "sitio:editar": MANDO,
  "ia:usar": MANDO,
  // Dar de alta a alguien en el hotel es tocar IDENTIDAD: quien puede invitar
  // puede darse a sí mismo cualquier rol. Por eso sólo el dueño, con el mismo
  // criterio que el dinero y el bot.
  "equipo:gestionar": SOLO_DUENO,
  "hotel:eliminar": SOLO_DUENO,
};

export function puede(rol: RolHotel, p: Permiso): boolean {
  return PERMISOS[p].includes(rol);
}

/**
 * Devuelve un 403 listo si el rol NO puede; null si sí puede.
 *
 *   const no = negar(ctx, "reservas:cancelar"); if (no) return no;
 *
 * Es un 403 de verdad y no un 401: con un 401 el panel parecería desconectado y
 * el empleado no entendería por qué dejó de funcionar su botón.
 */
export function negar(ctx: TenantContext, p: Permiso): NextResponse | null {
  if (puede(ctx.rol, p)) return null;
  return NextResponse.json(
    { error: `Tu rol (${ctx.rol}) no puede hacer esto.`, permiso: p },
    { status: 403 },
  );
}
