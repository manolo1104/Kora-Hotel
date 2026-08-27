import { HerramientasRelacionadas } from "@/components/herramientas/HerramientasRelacionadas";
import { SuscripcionHerramienta } from "@/components/herramientas/SuscripcionHerramienta";

// Inyecta al final de cada herramienta la captura de correo y el bloque de
// "herramientas relacionadas". Ambos componentes se ocultan solos en el índice
// y en la landing de mini-página.
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
