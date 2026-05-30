import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad — Kora",
  description:
    "Política de privacidad de Kora. Cómo recopilamos, usamos y protegemos tus datos personales conforme a la LFPDPPP.",
  alternates: {
    canonical: "/privacidad",
  },
};

const WA_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}`;

export default function PrivacidadPage() {
  return (
    <main className="pt-16">
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text mb-2">
            Política de privacidad
          </h1>
          <p className="text-kora-muted text-sm mb-10">
            Última actualización: mayo de 2026
          </p>

          <div className="space-y-10 text-kora-text text-sm sm:text-base leading-relaxed">
            <section aria-labelledby="responsable">
              <h2
                id="responsable"
                className="text-xl font-bold text-kora-text mb-3"
              >
                1. Responsable del tratamiento
              </h2>
              <p>
                Kora (en adelante &ldquo;Kora&rdquo;, &ldquo;nosotros&rdquo; o
                &ldquo;la empresa&rdquo;), con domicilio en Xilitla, San Luis
                Potosí, México, es responsable del tratamiento de sus datos
                personales conforme a la Ley Federal de Protección de Datos
                Personales en Posesión de los Particulares (LFPDPPP) y su
                Reglamento.
              </p>
              <p className="mt-2 text-kora-muted text-sm">
                TODO: Agregar nombre legal de la persona moral o física, RFC y
                domicilio fiscal.
              </p>
            </section>

            <section aria-labelledby="datos">
              <h2 id="datos" className="text-xl font-bold text-kora-text mb-3">
                2. Datos personales que recopilamos
              </h2>
              <p>Recopilamos los siguientes datos personales:</p>
              <ul className="mt-3 space-y-1.5 list-disc list-inside text-kora-muted">
                <li>Nombre completo del titular de la cuenta</li>
                <li>Nombre y ubicación del hotel</li>
                <li>Número de teléfono y WhatsApp</li>
                <li>Correo electrónico</li>
                <li>Número de habitaciones del establecimiento</li>
                <li>Datos de facturación para emisión de CFDI</li>
                <li>
                  Datos de uso del sistema (actividad, métricas de ocupación)
                </li>
              </ul>
              <p className="mt-3">
                No recopilamos datos sensibles según lo define la LFPDPPP, como
                datos biométricos, de salud o de origen racial.
              </p>
            </section>

            <section aria-labelledby="finalidad">
              <h2
                id="finalidad"
                className="text-xl font-bold text-kora-text mb-3"
              >
                3. Finalidad del tratamiento
              </h2>
              <p>Sus datos son utilizados para:</p>
              <ul className="mt-3 space-y-1.5 list-disc list-inside text-kora-muted">
                <li>Prestar y operar el servicio de Kora</li>
                <li>Generar comprobantes fiscales (CFDI 4.0)</li>
                <li>
                  Comunicarnos para soporte técnico y capacitación por WhatsApp
                </li>
                <li>
                  Enviarte información sobre actualizaciones del sistema
                  (finalidad secundaria - puede revocar su consentimiento)
                </li>
                <li>Mejorar el servicio mediante análisis de uso agregado</li>
              </ul>
            </section>

            <section aria-labelledby="terceros">
              <h2
                id="terceros"
                className="text-xl font-bold text-kora-text mb-3"
              >
                4. Transferencia de datos a terceros
              </h2>
              <p>
                Sus datos podrán ser compartidos con proveedores tecnológicos
                necesarios para operar el servicio, bajo contratos de
                confidencialidad que garantizan el mismo nivel de protección que
                esta política. No vendemos ni compartimos sus datos personales
                con terceros con fines de mercadotecnia sin su consentimiento
                expreso.
              </p>
              <p className="mt-2">
                Los proveedores incluyen servicios de hospedaje en la nube,
                plataformas de comunicación y el Servicio de Administración
                Tributaria (SAT) para la timbración de CFDI.
              </p>
            </section>

            <section aria-labelledby="arco">
              <h2 id="arco" className="text-xl font-bold text-kora-text mb-3">
                5. Derechos ARCO
              </h2>
              <p>
                Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse
                al tratamiento de sus datos personales (derechos ARCO). Para
                ejercerlos, puede enviar una solicitud por escrito a:
              </p>
              <div className="mt-3 bg-kora-bg rounded-xl p-4 text-kora-muted">
                <p>
                  Correo electrónico:{" "}
                  <a
                    href="mailto:privacidad@korahotel.mx"
                    className="text-kora-primary underline"
                  >
                    privacidad@korahotel.mx
                  </a>
                </p>
                <p className="text-xs mt-1">
                  TODO: Confirmar correo de contacto para solicitudes ARCO.
                </p>
              </div>
              <p className="mt-3">
                Atenderemos su solicitud en un plazo máximo de 20 días hábiles
                conforme a lo establecido en la LFPDPPP.
              </p>
            </section>

            <section aria-labelledby="cookies">
              <h2
                id="cookies"
                className="text-xl font-bold text-kora-text mb-3"
              >
                6. Cookies y tecnologías similares
              </h2>
              <p>
                Kora utiliza cookies propias y de terceros para mejorar la
                experiencia de usuario, analizar el tráfico del sitio y
                personalizar el contenido. Puede configurar su navegador para
                rechazar cookies; sin embargo, algunas funciones del sistema
                pueden verse afectadas.
              </p>
              <p className="mt-2">
                Las cookies de análisis (como Google Analytics) recopilan datos
                de forma anónima y agregada. No contienen información personal
                identificable.
              </p>
            </section>

            <section aria-labelledby="modificaciones">
              <h2
                id="modificaciones"
                className="text-xl font-bold text-kora-text mb-3"
              >
                7. Modificaciones a esta política
              </h2>
              <p>
                Nos reservamos el derecho de actualizar esta política en
                cualquier momento. Cualquier cambio relevante será notificado a
                través del correo electrónico registrado en su cuenta con al
                menos 30 días de anticipación.
              </p>
            </section>

            <section aria-labelledby="contacto-privacidad">
              <h2
                id="contacto-privacidad"
                className="text-xl font-bold text-kora-text mb-3"
              >
                8. Contacto
              </h2>
              <p>
                Si tiene dudas sobre esta política o el tratamiento de sus
                datos, escríbenos a{" "}
                <a
                  href="mailto:privacidad@korahotel.mx"
                  className="text-kora-primary underline"
                >
                  privacidad@korahotel.mx
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
