import { Reveal } from "@/components/shared/Reveal";

// Logos reales en /public/integraciones (color de marca oficial).
// Conekta no tiene logo en la librería: usa insignia de color (abbr).
// Duplicated for seamless CSS marquee loop
type Integracion = {
  name: string;
  status: "active" | "soon";
  logo?: string;
  color?: string;
  abbr?: string;
};

const integraciones: Integracion[] = [
  {
    name: "WhatsApp Business",
    status: "active",
    logo: "/integraciones/whatsapp.svg",
  },
  {
    name: "Booking.com",
    status: "soon",
    logo: "/integraciones/bookingdotcom.svg",
  },
  {
    name: "Airbnb",
    status: "active",
    logo: "/integraciones/airbnb.svg",
  },
  {
    name: "Expedia",
    status: "active",
    logo: "/integraciones/expedia.svg",
  },
  {
    name: "Stripe",
    status: "active",
    logo: "/integraciones/stripe.svg",
  },
  {
    name: "Mercado Pago",
    status: "soon",
    logo: "/integraciones/mercadopago.svg",
  },
  {
    name: "Conekta",
    status: "soon",
    color: "#1A1A2E",
    abbr: "CK",
  },
  {
    name: "Google Calendar",
    status: "soon",
    logo: "/integraciones/googlecalendar.svg",
  },
  {
    name: "Gmail",
    status: "soon",
    logo: "/integraciones/gmail.svg",
  },
];

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
          {integraciones.map((int) => (
            <li key={int.name}>{int.name} — {int.status === "active" ? "Activo" : "Próximamente"}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
