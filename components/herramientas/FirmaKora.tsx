"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { trackCta } from "@/lib/analytics";

// Firma de marca dentro de las herramientas gratis.
//
// POR QUÉ EXISTE: un prospecto contó que usaba la calculadora de impuestos
// seguido y no supo en qué sitio estaba hasta que quiso volver y tuvo que
// acordarse del nombre. Las herramientas traen visitas recurrentes desde Google
// y la marca no se registraba: el <h1> habla del tema fiscal, el logo vive en
// una barra que el visitante pasa de largo, y la única mención a Kora quedaba
// al final de la página, después de la calculadora que la persona ya usó.
//
// Esto va PEGADO a la herramienta (antes de la captura de correo), dice de quién
// es y qué es Kora en una línea. No es un banner: es una firma.
//
// Se calla en el índice y en la landing de mini-página, igual que los otros
// bloques inyectados por el layout de /herramientas.
const MUDAS = new Set(["mini-pagina"]);

export function FirmaKora() {
  const path = usePathname() ?? "";
  const slug = path.split("/").filter(Boolean)[1]; // /herramientas/<slug>

  if (!slug || MUDAS.has(slug)) return null;

  return (
    <section className="bg-white px-4 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-gray-100 bg-kora-bg p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-kora-primary">
                Una herramienta gratis de Kora
              </p>
              <p className="mt-2 text-sm leading-relaxed text-kora-muted">
                Kora contesta el WhatsApp de tu hotel las 24 horas con IA, cotiza
                con tu disponibilidad real y cierra la reserva con link de pago.
                Motor de reservas sin comisión, PMS y CRM incluidos.
              </p>
            </div>
            <Link
              href="/whatsapp"
              onClick={() => trackCta(`firma_herramienta:${slug}`)}
              className="btn-press inline-flex flex-shrink-0 items-center justify-center gap-2 self-start rounded-full bg-kora-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-kora-primary-dark sm:self-auto"
            >
              Ver qué es Kora
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
