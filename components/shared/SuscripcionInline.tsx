import { SuscripcionForm } from "@/components/shared/SuscripcionForm";

// El bloque de suscripción que se intercala en el contenido. Dos formas:
//
//   "banda"   → ancho completo, a media lectura y al final de cada artículo.
//               Es la superficie que más capta: quien lleva medio artículo leído
//               ya demostró interés en el tema, que es justo el de la guía.
//   "tarjeta" → angosto, para la barra lateral pegajosa del blog. Acompaña toda
//               la lectura sin interrumpirla.
//
// Server Component: sólo el formulario de adentro es cliente.

interface Props {
  /** De dónde entró. Ej. "blog:como-aumentar-reservas-directas". */
  origen: string;
  variante?: "banda" | "tarjeta";
  titulo?: string;
  texto?: string;
}

const TITULO = "Del 40% al 25% de dependencia de Booking en 90 días";

export function SuscripcionInline({
  origen,
  variante = "banda",
  titulo = TITULO,
  texto,
}: Props) {
  if (variante === "tarjeta") {
    return (
      <div className="rounded-2xl border border-kora-primary/15 bg-kora-primary p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-kora-accent">
          Guía gratis
        </p>
        <p className="mt-2 text-sm font-bold leading-snug text-white">{titulo}</p>
        <p className="mt-2 text-xs leading-relaxed text-white/60">
          {texto ??
            "El plan que seguí en mi hotel, semana por semana. Te lo mando por correo."}
        </p>
        <div className="mt-4">
          <SuscripcionForm
            origen={origen}
            piel="popup"
            textoBoton="Mándamela"
            nota={null}
          />
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-white/35">
          Sin costo. Baja en un clic.
        </p>
      </div>
    );
  }

  return (
    <aside className="not-prose my-10 overflow-hidden rounded-2xl border border-gray-200 bg-kora-bg p-6 sm:p-7">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-kora-accent">
        Guía gratis
      </p>
      <p className="mt-2 text-lg font-bold leading-snug tracking-tight text-kora-text sm:text-xl">
        {titulo}
      </p>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-kora-muted">
        {texto ??
          "Soy Manolo, tengo un hotel en Xilitla y esto es lo que hice, semana por semana. Con las plantillas de WhatsApp que usé y los dos errores que me costaron el primer mes."}
      </p>
      <div className="mt-5 max-w-md">
        <SuscripcionForm origen={origen} textoBoton="Mándame la guía" />
      </div>
    </aside>
  );
}
