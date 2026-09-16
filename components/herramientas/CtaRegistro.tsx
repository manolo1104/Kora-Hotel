import { ArrowRight } from "lucide-react";
import { CtaLink } from "@/components/shared/CtaLink";
import { GARANTIA, RUTA_REGISTRO } from "@/lib/oferta";

// El botón con el que cada herramienta gratis lleva a Kora.
//
// POR QUÉ EXISTE: hasta el 15 sep 2026 los 14 bloques «el puente a Kora»
// decían «Ver cómo funciona Kora» y llevaban a /contacto, a un formulario que
// promete que te escribimos por WhatsApp. El botón no hacía lo que decía, y el
// hotelero que acababa de calcular cuánto le cuesta Booking terminaba esperando
// a que alguien le contestara en vez de probarlo. Decisión de Manolo: el camino
// principal de todo el sitio es registrarse y probar Kora por dentro.
//
// Vive en un solo componente para que el texto, la ruta y los días de prueba no
// se vuelvan a copiar a mano en 14 archivos (así fue como se quedaron todos
// apuntando a /contacto a la vez). Los días salen de `GARANTIA.diasPrueba`,
// que `tests/prueba-14-dias.test.ts` obliga a coincidir con lo que aplica el
// sistema.
//
// `origen` es el nombre de la herramienta: viaja a GA4 como `cta_click` para
// saber qué calculadora trae registros. Antes esa pista iba en un
// `?utm_source=` hacia /contacto; a /panel/onboarding no sirve (la página
// redirige y la pierde), así que se mide con el evento.
export function CtaRegistroHerramienta({ origen }: { origen: string }) {
  return (
    <>
      <CtaLink
        href={RUTA_REGISTRO}
        ctaName={`herramienta_registro:${origen}`}
        className="btn-press btn-arrow btn-fill mt-6 inline-flex items-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
      >
        Pruébalo gratis con tu hotel
        <ArrowRight size={16} aria-hidden="true" />
      </CtaLink>
      <p className="mt-3 text-xs text-white/60 leading-relaxed">
        Creas tu cuenta y tienes {GARANTIA.diasPrueba} días gratis, sin tarjeta.
        Lo configuras tú y te ayudamos si quieres.
      </p>
    </>
  );
}
