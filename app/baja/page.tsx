import type { Metadata } from "next";
import Link from "next/link";
import { darDeBaja } from "@/lib/suscriptores-db";
import { SuscripcionForm } from "@/components/shared/SuscripcionForm";
import { EMAIL_CONTACTO } from "@/lib/contacto";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Darte de baja | Kora",
  description: "Deja de recibir los correos de la lista de Kora.",
  robots: { index: false, follow: false },
};

// La baja con cara para humanos: el link del pie de cada correo llega aquí.
//
// Da de baja AL ABRIR, sin pedir confirmación. Es a propósito: obligar a dar un
// segundo clic es exactamente lo que hace que la gente use el botón de spam en
// vez del de baja, y eso castiga al dominio entero — del que también salen las
// confirmaciones de reserva de los hoteles clientes. El seguro contra el clic
// accidental es el botón de volver a suscribirse que está aquí abajo.

interface Props {
  searchParams: Promise<{ t?: string }>;
}

export default async function BajaPage({ searchParams }: Props) {
  const { t } = await searchParams;
  const r = await darDeBaja(t ?? "", "link");

  const exito = r.ok;

  return (
    <main className="min-h-[70vh] bg-kora-bg px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-lg text-center">
        {exito ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-kora-text sm:text-4xl">
              Listo, te di de baja
            </h1>
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-kora-muted">
              No vas a recibir más correos de la lista de Kora
              {r.email ? (
                <>
                  {" "}
                  en <strong className="font-semibold text-kora-text">{r.email}</strong>
                </>
              ) : null}
              . Tampoco los de seguimiento, si es que estabas en los dos lados.
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-kora-muted">
              La guía que te mandé se queda contigo. Gracias por haberla leído.
            </p>

            <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 text-left">
              <p className="text-sm font-bold text-kora-text">¿Fue sin querer?</p>
              <p className="mb-4 mt-1 text-xs leading-relaxed text-kora-muted">
                Escribe tu correo y vuelves a la lista al instante.
              </p>
              <SuscripcionForm
                origen="reactivacion"
                textoBoton="Volver a suscribirme"
                nota={null}
              />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-kora-text sm:text-4xl">
              No encontramos ese enlace
            </h1>
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-kora-muted">
              {r.ok === false && r.motivo === "sin-bd"
                ? "Tuvimos un problema técnico. Escríbenos y te damos de baja a mano."
                : "El enlace está incompleto o ya no es válido. Abre el que viene al final del correo más reciente, o escríbenos y lo hacemos a mano."}
            </p>
            <a
              href={`mailto:${EMAIL_CONTACTO}?subject=Darme%20de%20baja`}
              className="btn-press mt-8 inline-flex items-center gap-2 rounded-full bg-kora-primary px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-kora-primary-dark"
            >
              Escribir a {EMAIL_CONTACTO}
            </a>
          </>
        )}

        <p className="mt-12 text-xs text-kora-muted">
          <Link href="/" className="underline hover:text-kora-primary">
            Volver a kora-hotel.com
          </Link>
        </p>
      </div>
    </main>
  );
}
