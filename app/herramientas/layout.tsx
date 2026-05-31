import { HerramientasRelacionadas } from "@/components/herramientas/HerramientasRelacionadas";

// Inyecta el bloque de "herramientas relacionadas" al final de cada herramienta.
// El componente se oculta solo en el índice y en la landing de mini-página.
export default function HerramientasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <HerramientasRelacionadas />
    </>
  );
}
