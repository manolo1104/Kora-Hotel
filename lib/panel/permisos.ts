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
  | "reservas:dinero"
  | "calendario:escribir"
  | "cotizaciones:leer"
  | "cotizaciones:escribir"
  | "clientes:leer"
  | "clientes:escribir"
  | "ingresos:ver"
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
  | "datos:exportar"
  | "hotel:eliminar";

const TODOS: RolHotel[] = ["dueno", "encargada", "recepcion", "limpieza", "cocina"];
const MOSTRADOR: RolHotel[] = ["dueno", "encargada", "recepcion"];
const MANDO: RolHotel[] = ["dueno", "encargada"];
const SOLO_DUENO: RolHotel[] = ["dueno"];

export const PERMISOS: Record<Permiso, RolHotel[]> = {
  "reservas:leer": TODOS,
  "reservas:escribir": MOSTRADOR,
  "reservas:cancelar": MANDO, // limpieza YA NO cancela reservas
  // El IMPORTE de cada reserva (la columna "Total" de la lista, el globo del
  // calendario y el modal con su desglose). Es de MOSTRADOR y no de MANDO a
  // propósito: recepción cobra en la caja y necesita el número.
  //
  // Lo pidió el hotel de Nealtican al dar de alta a su camarista: *"no me
  // parece bien que pueda ver la parte de ganancias en reserva porque puede
  // empezar a especular"*. Limpieza y cocina siguen viendo QUIÉN llega y a qué
  // cuarto —que es su trabajo— sin ver por cuánto.
  //
  // Ojo: esto es el importe de UNA reserva. La suma del periodo y las gráficas
  // son `ingresos:ver`, que es de mando.
  "reservas:dinero": MOSTRADOR,
  "calendario:escribir": MOSTRADOR,
  "cotizaciones:leer": MOSTRADOR,
  "cotizaciones:escribir": MOSTRADOR,
  "clientes:leer": MOSTRADOR,
  "clientes:escribir": MOSTRADOR,
  // Las pantallas de DINERO (Inicio/insights e Ingresos): facturación del mes,
  // ADR, RevPAR y el histórico. No existía permiso que las cubriera, así que
  // cargaban sus datos para cualquier miembro — incluida la camarista.
  "ingresos:ver": MANDO,
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
  // Bajarse el hotel entero en un archivo: reservas, cotizaciones y la lista
  // completa de huéspedes con su correo y su teléfono. Es la promesa de "tus
  // datos son tuyos" —lo que permite irse de Kora sin pedir permiso— y por eso
  // mismo es la copia más valiosa que existe del negocio. Que la saque sólo
  // quien es dueño de ella; una recepcionista de paso no se lleva el fichero de
  // clientes en un clic.
  "datos:exportar": SOLO_DUENO,
  "hotel:eliminar": SOLO_DUENO,
};

/**
 * La matriz PURA: qué trae cada puesto de fábrica.
 *
 * Ojo: desde el 1 sep 2026 esto ya NO es la última palabra. Quien administra el
 * hotel puede marcarle pestañas extra a una persona, y esas pestañas conceden
 * sus permisos. Para preguntar "¿esta persona puede?" usa `puedeCtx(ctx, …)` o
 * `negar(ctx, …)`. `puede()` sigue sirviendo para lo que es una pregunta sobre
 * el PUESTO (la plantilla de casillas, los textos de ayuda).
 */
export function puede(rol: RolHotel, p: Permiso): boolean {
  return PERMISOS[p].includes(rol);
}

/**
 * ¿Esta persona, en ESTE hotel, puede? Mira su puesto Y las pestañas que le
 * marcaron. `ctx.permisos` lo calcula `permisosDe()` al resolver el tenant.
 */
export function puedeCtx(ctx: TenantContext, p: Permiso): boolean {
  return ctx.permisos.has(p);
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
  if (puedeCtx(ctx, p)) return null;
  return NextResponse.json(
    { error: `Tu rol (${ctx.rol}) no puede hacer esto.`, permiso: p },
    { status: 403 },
  );
}
