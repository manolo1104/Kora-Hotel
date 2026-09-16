import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CtaLink } from "@/components/shared/CtaLink";
import { GARANTIA, PRECIO_DESDE, RUTA_ACTIVAR, RUTA_REGISTRO } from "@/lib/oferta";

// La barra de cierre de ~35 páginas. Es la llamada a la acción que más se ve de
// todo el sitio, y por eso fue la primera en desincronizarse: tenía el «14» y el
// «$550» escritos a mano mientras las constantes vivían en lib/oferta.ts. Ahora
// todo sale de ahí: si cambia la prueba o el precio, cambia en 35 páginas a la vez.
//
// Decisión de Manolo (15 sep 2026): el botón principal es CREAR LA CUENTA y
// probar Kora por dentro; activar el plan queda como enlace para quien ya lo probó.
export function BarraCTA() {
  const precio = PRECIO_DESDE.toLocaleString("es-MX");
  return (
    <section className="py-16 sm:py-20 bg-kora-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Reveal>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Crea tu cuenta y prueba Kora con tu hotel
          </h2>
          <p className="mt-3 text-kora-accent text-base leading-relaxed">
            {GARANTIA.diasPrueba} días gratis y sin tarjeta: cargas tu hotel y lo
            pruebas por dentro. Si te convence, un solo plan de ${precio} MXN/mes
            con habitaciones ilimitadas y sin permanencia.
          </p>
          <CtaLink
            href={RUTA_REGISTRO}
            ctaName="barra_onboarding"
            className="btn-press btn-arrow mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white text-kora-primary font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            Crear mi cuenta gratis
            <ArrowRight size={16} aria-hidden="true" />
          </CtaLink>
          <div className="mt-4">
            <CtaLink
              href={RUTA_ACTIVAR}
              ctaName="barra_pago"
              className="text-sm font-semibold text-kora-accent underline decoration-white/30 underline-offset-4 hover:text-white transition-colors"
            >
              ¿Ya lo probaste? Activa tu plan
            </CtaLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
