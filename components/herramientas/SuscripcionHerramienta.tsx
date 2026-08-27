"use client";

import { usePathname } from "next/navigation";
import { SuscripcionInline } from "@/components/shared/SuscripcionInline";

// La captura ligera al final de cada herramienta gratis.
//
// Va DESPUÉS del formulario fuerte de la herramienta (LeadCaptureTool, que pide
// nombre + WhatsApp para mandar el reporte), no en lugar de él. Son dos ofertas
// distintas para dos momentos distintos: quien ya decidió que quiere que le
// hablen usa el de arriba; a quien no, la alternativa de un solo campo le
// recupera un correo que de otro modo se perdía al cerrar la pestaña.
//
// Se calla en el índice y en la landing de mini-página, igual que
// HerramientasRelacionadas.

const MUDAS = new Set(["mini-pagina"]);

export function SuscripcionHerramienta() {
  const path = usePathname() ?? "";
  const slug = path.split("/").filter(Boolean)[1]; // /herramientas/<slug>

  if (!slug || MUDAS.has(slug)) return null;

  return (
    <section className="bg-white px-4 pb-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <SuscripcionInline
          origen={`herramienta:${slug}`}
          titulo="¿Y ahora qué hago con este número?"
          texto="Eso es exactamente lo que responde mi guía: el plan de 90 días con el que bajé la dependencia de OTAs de mi hotel del 40% al 25%. Gratis, por correo."
        />
      </div>
    </section>
  );
}
