import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de servicio — Kora",
  description:
    "Términos y condiciones de uso del sistema Kora para hoteles boutique en México.",
};

const WA_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}`;

export default function TerminosPage() {
  return (
    <main className="pt-16">
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text mb-2">
            Términos de servicio
          </h1>
          <p className="text-kora-muted text-sm mb-10">
            Última actualización: mayo de 2026
          </p>

          <div className="space-y-10 text-kora-text text-sm sm:text-base leading-relaxed">
            <section aria-labelledby="descripcion">
              <h2
                id="descripcion"
                className="text-xl font-bold text-kora-text mb-3"
              >
                1. Descripción del servicio
              </h2>
              <p>
                Kora es un sistema de gestión hotelera todo-en-uno que incluye
                motor de reservas directo, agente de WhatsApp con inteligencia
                artificial, sistema de gestión de propiedades (PMS), agente de
                llamadas con IA, pricing dinámico, CRM de huéspedes, blog
                automático y dashboard de métricas. El servicio se presta de
                forma exclusiva a hoteles boutique e independientes con 5 a 40
                habitaciones en México.
              </p>
            </section>

            <section aria-labelledby="registro">
              <h2
                id="registro"
                className="text-xl font-bold text-kora-text mb-3"
              >
                2. Registro y acceso
              </h2>
              <p>
                Al registrarse en Kora, el usuario declara ser mayor de edad y
                tener autoridad legal para contratar en nombre del establecimiento
                hotelero. El usuario es responsable de mantener la
                confidencialidad de sus credenciales de acceso y de todas las
                actividades que ocurran bajo su cuenta.
              </p>
            </section>

            <section aria-labelledby="pagos">
              <h2 id="pagos" className="text-xl font-bold text-kora-text mb-3">
                3. Pagos y cancelación
              </h2>
              <p>
                El servicio se factura mensualmente. El precio de acceso
                anticipado garantizado a hoteles fundadores es de $2,990 MXN al
                mes (más IVA) y se mantiene vigente mientras la suscripción esté
                activa.
              </p>
              <ul className="mt-3 space-y-1.5 list-disc list-inside text-kora-muted">
                <li>No se requiere contrato anual</li>
                <li>
                  El usuario puede cancelar en cualquier momento desde su panel
                  de control o por WhatsApp
                </li>
                <li>
                  La cancelación es efectiva al final del período de facturación
                  en curso; no se realizan reembolsos proporcionales
                </li>
                <li>
                  En caso de impago, el acceso se suspenderá a los 7 días
                  calendario y se cancelará definitivamente a los 30 días
                </li>
              </ul>
            </section>

            <section aria-labelledby="uso">
              <h2
                id="uso"
                className="text-xl font-bold text-kora-text mb-3"
              >
                4. Uso aceptable
              </h2>
              <p>El usuario se compromete a no:</p>
              <ul className="mt-3 space-y-1.5 list-disc list-inside text-kora-muted">
                <li>
                  Utilizar el sistema para actividades ilícitas o que infrinjan
                  derechos de terceros
                </li>
                <li>
                  Intentar acceder sin autorización a sistemas o datos de otros
                  usuarios
                </li>
                <li>
                  Revender, sublicenciar o transferir el acceso al servicio a
                  terceros
                </li>
                <li>
                  Interferir con el funcionamiento normal del sistema
                </li>
              </ul>
            </section>

            <section aria-labelledby="propiedad">
              <h2
                id="propiedad"
                className="text-xl font-bold text-kora-text mb-3"
              >
                5. Propiedad intelectual
              </h2>
              <p>
                Kora y todos sus componentes (software, diseño, agentes de IA,
                algoritmos de pricing) son propiedad exclusiva de Kora. El
                usuario recibe una licencia limitada, no exclusiva e
                intransferible para usar el servicio durante la vigencia de su
                suscripción.
              </p>
              <p className="mt-2">
                Los datos del hotel (reservas, huéspedes, métricas) son
                propiedad del usuario. Kora los trata únicamente para prestar el
                servicio y no los vende a terceros.
              </p>
            </section>

            <section aria-labelledby="responsabilidad">
              <h2
                id="responsabilidad"
                className="text-xl font-bold text-kora-text mb-3"
              >
                6. Limitación de responsabilidad
              </h2>
              <p>
                Kora no garantiza resultados específicos en ocupación, ingresos
                o reservas. El sistema es una herramienta de gestión; el éxito
                depende también de factores externos como ubicación, calidad del
                servicio y condiciones del mercado.
              </p>
              <p className="mt-2">
                La responsabilidad máxima de Kora ante el usuario, por cualquier
                causa, se limita al monto pagado en los últimos tres meses de
                servicio.
              </p>
            </section>

            <section aria-labelledby="disponibilidad">
              <h2
                id="disponibilidad"
                className="text-xl font-bold text-kora-text mb-3"
              >
                7. Disponibilidad del servicio
              </h2>
              <p>
                Kora se compromete a mantener una disponibilidad del sistema
                superior al 99% mensual. El mantenimiento programado se notifica
                con al menos 24 horas de anticipación. En caso de interrupciones
                no programadas superiores a 4 horas en un mes calendario, el
                usuario recibirá un crédito equivalente a un día de servicio.
              </p>
            </section>

            <section aria-labelledby="ley">
              <h2 id="ley" className="text-xl font-bold text-kora-text mb-3">
                8. Ley aplicable y jurisdicción
              </h2>
              <p>
                Estos términos se rigen por las leyes vigentes de los Estados
                Unidos Mexicanos. Para cualquier controversia, las partes se
                someten a la jurisdicción de los tribunales competentes de la
                Ciudad de México, renunciando a cualquier otro fuero que pudiera
                corresponderles.
              </p>
            </section>

            <section aria-labelledby="contacto-terminos">
              <h2
                id="contacto-terminos"
                className="text-xl font-bold text-kora-text mb-3"
              >
                9. Contacto
              </h2>
              <p>
                Para cualquier consulta sobre estos términos, escríbenos a{" "}
                <a
                  href="mailto:hola@korahotel.mx"
                  className="text-kora-primary underline"
                >
                  hola@korahotel.mx
                </a>{" "}
                o por WhatsApp al{" "}
                <a
                  href={WA_URL}
                  className="text-kora-primary underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  +52 489 125 1458
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
