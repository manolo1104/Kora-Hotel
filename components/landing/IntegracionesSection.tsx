import { Reveal } from "@/components/shared/Reveal";
import { INTEGRACIONES } from "@/lib/integraciones";

// La lista NO vive aquí: vive en `lib/integraciones.ts`, que explica por qué.
// Hasta el 2 sep 2026 estaba escrita a mano en este archivo y decía «Airbnb —
// Activo» y «Expedia — Activo» con la pestaña de canales retirada del panel
// desde el 26 de agosto. Esta sección sólo la pinta.

export function IntegracionesSection() {
  return (
    <section className="section-divider py-14 sm:py-16 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-kora-muted uppercase tracking-widest mb-2">
              Integraciones
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-kora-text">
              Se conecta con lo que ya usas
            </h2>
            {/* Decía «Tus reservas de Booking […] y tu contabilidad fiscal,
                todo sincronizado». Ninguna de las dos existe: los canales OTA
                están retirados del panel (CANALES_OTA_DISPONIBLES) y la
                facturación CFDI no está conectada a ningún PAC. Ahora dice lo
                que Kora sí hace, que además es lo que la distingue. */}
            <p className="mt-3 text-kora-muted text-sm max-w-xl mx-auto">
              Kora no te pide cambiar de herramientas: contesta el WhatsApp por
              el que ya te escriben tus huéspedes y cobra por donde ya cobras.
            </p>
          </div>
        </Reveal>

        <div className="marquee-viewport mt-2">
          <div className="marquee-track" aria-hidden="true">
            {[...INTEGRACIONES, ...INTEGRACIONES].map((int, i) => (
              <div
                key={`${int.name}-${i}`}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border flex-shrink-0 ${
                  int.status === "active"
                    ? "bg-white border-gray-200 shadow-sm"
                    : "bg-gray-50 border-gray-100 opacity-60"
                }`}
              >
                {int.logo ? (
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white border border-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={int.logo}
                      alt=""
                      className="w-5 h-5 object-contain"
                      aria-hidden="true"
                    />
                  </div>
                ) : (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: int.color }}
                    aria-hidden="true"
                  >
                    <span className="text-white text-[10px] font-bold">
                      {int.abbr}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-kora-text leading-none">
                    {int.name}
                  </p>
                  <p className="text-[10px] mt-0.5 font-medium leading-none">
                    {int.status === "active" ? (
                      <span className="text-kora-accent">Activo</span>
                    ) : (
                      <span className="text-kora-muted">Próximamente</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Accessible static list for screen readers */}
        <ul className="sr-only" aria-label="Integraciones disponibles">
          {INTEGRACIONES.map((int) => (
            <li key={int.name}>{int.name} — {int.status === "active" ? "Activo" : "Próximamente"}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
