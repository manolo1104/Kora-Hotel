// La marca del hotel para un correo, y desde qué buzón sale.
//
// Vivía dentro de `app/api/admin/send-offer/route.ts`, que era el único sitio
// que mandaba un correo escrito desde el panel. Al aparecer el segundo
// (`enviar-correo`), copiarlo habría dejado dos versiones de «cómo se firma un
// correo de este hotel» — y la que se olvidara de actualizar sería la que
// mandara el código promocional muerto, o el `reply-to` al buzón de Kora en vez
// de al del hotelero. Un ayudante, en un solo sitio.

import { promosDe } from "@/lib/booking/rooms";
import { EMAIL_FROM } from "@/lib/contacto";
import type { HotelBrand } from "@/lib/email-sequences";
import type { HotelRow } from "@/lib/tenant";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/**
 * La promo del hotel para el correo. Misma fuente que el motor: si el hotelero
 * no encendió ninguna, el correo no reparte un código que la caja va a rechazar.
 */
function promoParaCorreo(h: HotelRow): { promoCode?: string; promoDiscount?: string } {
  const promo = promosDe(h as Parameters<typeof promosDe>[0])[0];
  if (!promo) return {};
  return {
    promoCode: promo.code,
    promoDiscount:
      promo.tipo === "porcentaje"
        ? `${promo.valor}%`
        : `$${Math.round(promo.valor).toLocaleString("es-MX")} MXN`,
  };
}

/** Fila `hoteles` → `HotelBrand` (espejo de `brandFromHotel` del cron de secuencias). */
export function brandFromHotel(h: HotelRow): HotelBrand {
  const config = (h.config ?? {}) as Record<string, unknown>;
  // reviewUrl/mapsUrl: primero lo editable del panel (extras); config.* legado.
  const extras = (h.extras ?? {}) as Record<string, unknown>;
  return {
    nombre: h.nombre || "el hotel",
    baseUrl: str(config.base_url) || (h.slug ? `https://kora-hotel.com/h/${h.slug}` : undefined),
    ubicacion: h.ubicacion || str(config.ubicacion),
    telefono: str(config.telefono) || (h.whatsapp ?? undefined),
    whatsapp: (h.whatsapp ?? undefined) || str(config.whatsapp),
    email: str(config.email_from) || str(config.email),
    reviewUrl: str(extras.reviewUrl) || str(config.review_url),
    mapsUrl: str(extras.mapsUrl) || str(config.maps_url),
    ...promoParaCorreo(h),
  };
}

/**
 * Remitente del hotel: `config.email_from` → `RESEND_FROM` → el de Kora.
 *
 * El `from` casi siempre acaba siendo el dominio de Kora (es el único
 * verificado en Resend); por eso el `replyTo` con el correo del hotel importa
 * tanto: si el huésped contesta, tiene que llegarle al hotelero.
 */
export function fromForHotel(h: HotelRow): string {
  const config = (h.config ?? {}) as Record<string, unknown>;
  const fromCfg = typeof config.email_from === "string" ? config.email_from : "";
  return fromCfg || process.env.RESEND_FROM || EMAIL_FROM;
}
