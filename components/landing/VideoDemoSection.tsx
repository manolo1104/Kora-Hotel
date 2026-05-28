import { Reveal } from "@/components/shared/Reveal";

// ─── Configuración del video ──────────────────────────────────────────────────
//
// Cuando tengas el video listo (Loom, YouTube u otro), pega aquí la URL de
// EMBED (no la URL normal para compartir).
//
// Loom:    graba en loom.com → Share → "Embed" → copia la URL de src del iframe
//          Formato: "https://www.loom.com/embed/TU_VIDEO_ID"
//
// YouTube: en el video → Compartir → Insertar → copia solo la URL del src
//          Formato: "https://www.youtube.com/embed/TU_VIDEO_ID"
//
const VIDEO_EMBED_URL = "https://www.youtube.com/embed/IE5NTgS74rY";

const VIDEO_DURATION = "90 segundos";

// ─────────────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-16 h-16"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="32" fill="white" fillOpacity="0.15" />
      <circle cx="32" cy="32" r="24" fill="white" fillOpacity="0.2" />
      <path d="M26 20L48 32L26 44V20Z" fill="white" />
    </svg>
  );
}

export function VideoDemoSection() {
  return (
    <section className="py-14 sm:py-20 bg-kora-bg border-t border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-8">
            <p className="text-xs font-bold text-kora-muted uppercase tracking-widest mb-2">
              Demo en vivo
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-kora-text">
              Míralo en {VIDEO_DURATION}
            </h2>
            <p className="mt-3 text-kora-muted text-sm max-w-lg mx-auto">
              Un recorrido completo del sistema: desde el mensaje de WhatsApp del
              huésped hasta la reserva confirmada en el PMS.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="rounded-2xl overflow-hidden shadow-xl shadow-kora-primary/10 aspect-video bg-kora-primary relative">
            {VIDEO_EMBED_URL ? (
              <iframe
                src={VIDEO_EMBED_URL}
                title="Demo de Kora"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 select-none">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(82,183,136,.4) 39px,rgba(82,183,136,.4) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(82,183,136,.4) 39px,rgba(82,183,136,.4) 40px)",
                  }}
                  aria-hidden="true"
                />
                <PlayIcon />
                <div className="text-center z-10 px-4">
                  <p className="text-white font-bold text-lg">
                    Video demo próximamente
                  </p>
                  <p className="text-kora-accent/80 text-sm mt-1">
                    Recorrido del sistema en {VIDEO_DURATION}
                  </p>
                </div>
                <div className="absolute bottom-5 right-5 bg-white/10 text-white/60 text-xs px-3 py-1.5 rounded-full">
                  Loom · {VIDEO_DURATION}
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
