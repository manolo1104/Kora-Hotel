// Checklist "Primeros pasos" del Inicio: refleja el estado real del hotel
// (mismo diagnóstico que la página de Camila) y enlaza a dónde completar cada
// cosa. Incluye el botón para relanzar el tour guiado. Se colapsa cuando todo
// está listo.
//
// Es un componente de SERVIDOR a propósito (antes era de cliente). Las dos
// casillas que mentían necesitaban datos que el navegador no puede leer:
// «cobros conectados» tiene que mirar `charges_enabled` real (service-role) y
// no sólo que exista un `stripe_account_id`, y la tarea «haz una reserva de
// prueba» sólo se puede ofrecer si el motor de verdad simula el pago. La parte
// interactiva vive en `PrimerosPasosLista`. La firma no cambia: quien la monta
// sigue pasando `slug` y `diagnostico`.

import type { DiagnosticoHotel } from "@/lib/panel/diagnostico";
import { getHotelMember } from "@/lib/tenant";
import { puedeCtx } from "@/lib/panel/permisos";
import { motivoCierre } from "@/lib/panel/pantallas";
import { accesoDelHotel } from "@/lib/suscripcion";
import { cobrosListosDelHotel } from "@/lib/motor/modo-prueba";
import {
  estadoDelMotor,
  progresoPrimerosPasos,
  tareasPrimerosPasos,
  type EstadoMotor,
} from "@/lib/panel/primeros-pasos";
import PrimerosPasosLista from "./PrimerosPasosLista";

export default async function PrimerosPasos({
  slug,
  diagnostico,
}: {
  slug: string;
  diagnostico: DiagnosticoHotel;
}) {
  // `getHotelMember` va envuelta en `cache()`: la pantalla ya la resolvió en sus
  // layouts, así que aquí no cuesta otra consulta.
  const ctx = await getHotelMember(slug);
  const hotel = ctx?.hotel ?? null;

  let estadoMotor: EstadoMotor = "sin-cobros";
  let cobrosListos = false;
  if (hotel) {
    const extras = (hotel.extras ?? {}) as Record<string, unknown>;
    // Ninguna de las dos lanza. Sin cuenta de Stripe, `cobrosListosDelHotel`
    // responde false sin llamar a nadie.
    const [acceso, listos] = await Promise.all([
      accesoDelHotel(hotel),
      cobrosListosDelHotel(hotel.id, hotel.stripe_account_id),
    ]);
    cobrosListos = listos;
    estadoMotor = estadoDelMotor({ acceso, cobrosListos, demo: extras.demo === true });
  }

  const bot = ((hotel?.extras ?? {}) as { bot?: { probadoAt?: unknown } }).bot;
  const tareas = tareasPrimerosPasos({
    slug,
    diagnostico,
    estadoMotor,
    cobrosListos,
    camilaProbada: Boolean(bot?.probadoAt),
    // Sin contexto (no debería pasar: la página ya exigió membresía) no se
    // enlaza a nada que pueda terminar en «no tienes permiso».
    puedeVerPagos: ctx ? puedeCtx(ctx, "pagos:ver") : false,
    puedeProbarCamila: ctx
      ? motivoCierre(ctx.rol, ctx.pantallas, "camila") === null && puedeCtx(ctx, "bot:leer")
      : false,
    puedeVincular: ctx
      ? motivoCierre(ctx.rol, ctx.pantallas, "camila") === null && puedeCtx(ctx, "bot:vincular")
      : false,
  });
  const { hechas, total, completo } = progresoPrimerosPasos(tareas);

  return (
    <PrimerosPasosLista
      tareas={tareas}
      hechas={hechas}
      total={total}
      completo={completo}
      sinPublicar={hotel?.publicado === false}
      editorHref={`/panel/${slug}/sitio`}
      temporadas={
        diagnostico.temporadas.estado !== "ok"
          ? { mensaje: diagnostico.temporadas.mensaje, href: `/panel/${slug}/sitio?tab=avanzado` }
          : null
      }
    />
  );
}
