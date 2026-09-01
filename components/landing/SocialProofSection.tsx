import { Reveal } from "@/components/shared/Reveal";
import { TiltCard } from "@/components/shared/TiltCard";
import {
  CASO,
  OTA_ANTES,
  OTA_DESPUES,
  MESES,
  AHORRO_TRIMESTRE,
  DIRECTO_MOTOR_TRIMESTRE,
  mxn,
} from "@/lib/caso-paraiso";

// Video demo (embed). YouTube: Compartir → Insertar → copia la URL del src.
const VIDEO_EMBED_URL = "https://www.youtube.com/embed/IE5NTgS74rY";

// Caso real verificable: el hotel del fundador operando con Kora (no estimaciones).
// El costo de apps separadas ($5,300) vive en la comparativa pegada al pricing.
// 🔴 LAS CIFRAS SALEN DE lib/caso-paraiso.ts, NO SE ESCRIBEN AQUÍ.
// Esta sección publicaba "~25% menos en comisiones (≈$30,000 que se queda en el
// hotel)" mientras /casos/paraiso-encantado publicaba "$8,400 MXN/mes" para el
// MISMO ahorro. Son $30,000 contra $25,200: la misma afirmación con dos números,
// a un scroll de distancia. Además el "~25%" era la dependencia de OTAs que
// QUEDÓ, no la reducción — se leía como si la comisión hubiera bajado un cuarto.
const caso = {
  hotel: CASO.hotel,
  contexto: `El hotel del fundador, operando con Kora desde hace ${MESES} meses.`,
  metricas: [
    {
      value: mxn(DIRECTO_MOTOR_TRIMESTRE),
      label: `en reservas directas cobradas por el motor en sus primeros ${MESES} meses`,
    },
    {
      value: `${OTA_ANTES}% → ${OTA_DESPUES}%`,
      label: `de dependencia de las OTAs (${mxn(AHORRO_TRIMESTRE)} en comisiones que no se pagaron)`,
    },
    {
      value: "24/7",
      label: "Camila contesta al instante y reúne lo necesario para cerrar la reserva",
    },
  ],
  quote: `En ${MESES} meses, Kora nos trajo ${mxn(DIRECTO_MOTOR_TRIMESTRE)} en reservas directas. Camila contesta al instante y nos deja todo listo para cerrar — ya no perdemos al huésped que escribe de noche.`,
  autor: `${CASO.duenoNombre} · dueño del ${CASO.hotel}`,
};

// Negocios reales en línea con Kora: hoteles operando con el motor/sitio
// y páginas que diseñamos y publicamos (prueba del servicio de página).
const sitiosCreados = [
  { logo: "/portfolio/paraiso-encantado.png", nombre: "Hotel Paraíso Encantado", url: "https://paraisoencantado.com" },
  { logo: "/portfolio/alma-nativa.png", nombre: "Alma Nativa · Suites Campestres", url: "/h/hotel-alma-nativa" },
  { logo: "/portfolio/magic-collinn.png", nombre: "Hotel Magic Collinn", url: "https://www.hotelmagicollinn.com" },
  { logo: "/portfolio/huasteca-tours.png", nombre: "Huasteca Potosina Tours", url: "https://www.huasteca-potosina.com" },
];

export function SocialProofSection() {
  return (
    <section id="demo" className="py-20 sm:py-24 bg-white scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Negocios reales EN LÍNEA — hasta arriba: la primera señal tras el
            hero es que esto ya lo usan hoteles de verdad. */}
        <Reveal>
          <div className="mb-14 pb-12 border-b border-gray-100">
            <p className="text-center text-sm font-semibold text-kora-muted uppercase tracking-widest">
              Negocios reales que ya están en línea con nosotros
            </p>
            <p className="mt-2 text-center text-kora-muted text-sm max-w-xl mx-auto">
              Hoteles que reciben reservas con Kora y páginas que diseñamos y publicamos.{" "}
              <span className="font-semibold text-kora-primary">La de tu hotel puede ser la siguiente.</span>
            </p>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {sitiosCreados.map((s) => (
                <a
                  key={s.nombre}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver el sitio de ${s.nombre}`}
                  className="group block"
                >
                  <TiltCard max={6} className="rounded-2xl">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-28 flex items-center justify-center p-5 transition-shadow duration-300 group-hover:shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.logo}
                        alt={s.nombre}
                        className="max-h-16 max-w-full w-auto object-contain"
                      />
                    </div>
                  </TiltCard>
                  <p className="mt-2 text-center text-xs text-kora-muted group-hover:text-kora-primary transition-colors">
                    {s.nombre}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="text-center mb-8">
            <p className="text-xs font-bold text-kora-muted uppercase tracking-widest mb-2">
              Demo en vivo
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text">
              Míralo funcionando en 90 segundos
            </h2>
            <p className="mt-3 text-kora-muted text-sm max-w-lg mx-auto">
              Del primer WhatsApp del huésped a la reserva capturada en tu PMS.
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

        {/* Caso real: el hotel del fundador, operando con Kora */}
        <Reveal delay={0.16}>
          <div className="mt-6 rounded-2xl border border-kora-primary/15 bg-kora-bg p-6 sm:p-8">
            <p className="text-xs font-bold text-kora-muted uppercase tracking-widest">
              Caso real · {caso.hotel}
            </p>
            <p className="mt-1 text-sm text-kora-muted">{caso.contexto}</p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
              {caso.metricas.map((m) => (
                <div key={m.label}>
                  <p className="text-2xl sm:text-3xl font-bold text-kora-primary tabular-nums">
                    {m.value}
                  </p>
                  <p className="text-xs text-kora-muted mt-1 leading-snug">{m.label}</p>
                </div>
              ))}
            </div>
            <blockquote className="mt-6 border-l-2 border-kora-accent pl-4">
              <p className="text-sm text-kora-text italic leading-relaxed">
                &ldquo;{caso.quote}&rdquo;
              </p>
              <footer className="mt-2 text-xs text-kora-muted not-italic">— {caso.autor}</footer>
            </blockquote>
            {/* Autoridad honesta: admitir una limitación aumenta la confianza + framing miembro fundador */}
            <p className="mt-5 text-xs text-kora-muted leading-relaxed border-t border-kora-primary/10 pt-4">
              Seamos claros: Kora no es para cadenas de 200 cuartos. Es para hoteles
              independientes como el tuyo — y apenas estamos abriéndolo a más hoteles.{" "}
              <span className="font-semibold text-kora-primary">Estás a tiempo de ser de los primeros de la Huasteca.</span>
            </p>
          </div>
        </Reveal>

      </div>
    </section>
  );
}
