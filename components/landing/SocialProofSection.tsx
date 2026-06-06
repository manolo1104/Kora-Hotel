import { Reveal } from "@/components/shared/Reveal";

// Video demo (embed). YouTube: Compartir → Insertar → copia la URL del src.
const VIDEO_EMBED_URL = "https://www.youtube.com/embed/IE5NTgS74rY";

// Cifras verificables (no estimaciones). El costo de apps separadas ($5,300) vive
// en la comparativa pegada al pricing, así que aquí no se duplica.
const stats = [
  { value: "0%", label: "Comisión en reservas directas" },
  { value: "Segundos", label: "Respuesta en WhatsApp con IA" },
];

// Sitios reales que hemos creado (prueba del servicio de página).
const sitiosCreados = [
  { logo: "/portfolio/paraiso-encantado.png", nombre: "Hotel Paraíso Encantado", url: "https://paraisoencantado.com" },
  { logo: "/portfolio/huasteca-tours.png", nombre: "Huasteca Potosina Tours", url: "https://www.huasteca-potosina.com" },
];

export function SocialProofSection() {
  return (
    <section id="demo" className="py-20 sm:py-24 bg-white scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-8">
            <p className="text-xs font-bold text-kora-muted uppercase tracking-widest mb-2">
              Demo en vivo
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text">
              Míralo funcionando en 90 segundos
            </h2>
            <p className="mt-3 text-kora-muted text-sm max-w-lg mx-auto">
              Del mensaje de WhatsApp del huésped a la reserva confirmada en el PMS.
            </p>
          </div>
        </Reveal>

        {/* Video */}
        <Reveal delay={0.1}>
          <div className="rounded-2xl overflow-hidden shadow-xl shadow-kora-primary/10 aspect-video bg-kora-primary">
            <iframe
              src={VIDEO_EMBED_URL}
              title="Demo de Kora"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </Reveal>

        {/* Stats verificables */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={0.16 + i * 0.08}>
              <div className="bg-kora-bg rounded-2xl p-5 border border-gray-100 text-center">
                <p className="text-3xl font-bold text-kora-primary">{s.value}</p>
                <p className="text-sm text-kora-muted mt-1 leading-snug">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Sitios reales que hemos creado */}
        <Reveal delay={0.2}>
          <div className="mt-14 pt-12 border-t border-gray-100">
            <p className="text-center text-sm font-semibold text-kora-muted uppercase tracking-widest">
              Sitios reales que hemos creado
            </p>
            <p className="mt-2 text-center text-kora-muted text-sm max-w-xl mx-auto">
              Páginas profesionales que diseñamos y publicamos para negocios reales.
              Si eres de los primeros 10 hoteles,{" "}
              <span className="font-semibold text-kora-primary">la tuya va incluida gratis</span>.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 max-w-md mx-auto">
              {sitiosCreados.map((s) => (
                <a
                  key={s.nombre}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver el sitio de ${s.nombre}`}
                  className="group block"
                >
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-28 flex items-center justify-center p-5 transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.logo}
                      alt={s.nombre}
                      className="max-h-16 max-w-full w-auto object-contain"
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-kora-muted group-hover:text-kora-primary transition-colors">
                    {s.nombre}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
