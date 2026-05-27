import { Reveal } from "@/components/shared/Reveal";

// Duplicated for seamless CSS marquee loop
const integraciones = [
  {
    name: "Booking.com",
    status: "active",
    color: "#003580",
    abbr: "BK",
  },
  {
    name: "Airbnb",
    status: "active",
    color: "#FF5A5F",
    abbr: "AB",
  },
  {
    name: "WhatsApp Business",
    status: "active",
    color: "#25D366",
    abbr: "WA",
  },
  {
    name: "Google Calendar",
    status: "active",
    color: "#4285F4",
    abbr: "GC",
  },
  {
    name: "SAT / CFDI 4.0",
    status: "active",
    color: "#C0392B",
    abbr: "SAT",
  },
  {
    name: "Stripe",
    status: "soon",
    color: "#635BFF",
    abbr: "ST",
  },
  {
    name: "Conekta",
    status: "soon",
    color: "#1A1A2E",
    abbr: "CK",
  },
];

export function IntegracionesSection() {
  return (
    <section className="py-14 sm:py-16 bg-white border-t border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-kora-muted uppercase tracking-widest mb-2">
              Integraciones
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-kora-text">
              Se conecta con lo que ya usas
            </h2>
            <p className="mt-3 text-kora-muted text-sm max-w-xl mx-auto">
              Kora no reemplaza tus canales: los une en un solo lugar. Tus
              reservas de Booking, tus mensajes de WhatsApp y tu contabilidad
              fiscal, todo sincronizado.
            </p>
          </div>
        </Reveal>

        <div className="marquee-viewport mt-2">
          <div className="marquee-track" aria-hidden="true">
            {[...integraciones, ...integraciones].map((int, i) => (
              <div
                key={`${int.name}-${i}`}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border flex-shrink-0 ${
                  int.status === "active"
                    ? "bg-white border-gray-200 shadow-sm"
                    : "bg-gray-50 border-gray-100 opacity-60"
                }`}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: int.color }}
                  aria-hidden="true"
                >
                  <span className="text-white text-[10px] font-bold">
                    {int.abbr}
                  </span>
                </div>
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
          {integraciones.map((int) => (
            <li key={int.name}>{int.name} — {int.status === "active" ? "Activo" : "Próximamente"}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
