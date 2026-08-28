import { HerramientasRelacionadas } from "@/components/herramientas/HerramientasRelacionadas";
import { SuscripcionHerramienta } from "@/components/herramientas/SuscripcionHerramienta";

// Inyecta al final de cada herramienta la captura de correo y el bloque de
// "herramientas relacionadas". Ambos se ocultan solos en el índice y en la
// landing de mini-página.
//
// La firma de marca (FirmaKora) NO se inyecta aquí: va dentro de cada página,
// pegada a la herramienta. Aquí abajo quedaba después del <BarraCTA/>, y quien
// llega de Google usa la calculadora y se va sin bajar tanto — que es justo el
// problema que reportó un prospecto (usaba la de impuestos seguido y no sabía
// en qué sitio estaba).
export default function HerramientasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <SuscripcionHerramienta />
      <HerramientasRelacionadas />
    </>
  );
}
