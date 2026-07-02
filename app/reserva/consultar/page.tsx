import type { Metadata } from "next";
import ConsultarClient from "./ConsultarClient";

export const metadata: Metadata = {
  title: "Consulta tu reserva",
  description:
    "Consulta, gestiona o cancela tu reserva con tu folio y el correo con el que reservaste.",
  robots: { index: false },
};

// Portal del huésped (global, multi-hotel): consulta por folio + email.
// El folio identifica al hotel (prefijo), así que no depende del slug.
export default function ConsultarReservaPage() {
  return <ConsultarClient />;
}
