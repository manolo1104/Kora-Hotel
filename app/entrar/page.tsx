import type { Metadata } from "next";
import { Reveal } from "@/components/shared/Reveal";
import { AuthForm, type TextosAuth } from "@/components/panel/AuthForm";
import { planPorClave, RUTA_REGISTRO } from "@/lib/oferta";
import { PRUEBA_DIAS } from "@/lib/suscripcion";
import { destinoSeguro } from "@/lib/destino-seguro";

// El título de la pestaña sigue a la intención: casi todo el sitio llega aquí
// con `?registro=1` a CREAR una cuenta, y la pestaña decía «Entrar», que es lo
// contrario de lo que la persona está haciendo. No se indexa (robots: false),
// así que esto es para quien tiene cinco pestañas abiertas, no para Google.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ registro?: string }>;
}): Promise<Metadata> {
  const { registro } = await searchParams;
  const creando = registro === "1";
  return {
    title: creando ? "Crear mi cuenta | Kora" : "Entrar | Kora",
    description: "Entra a tu panel de Kora o crea tu cuenta para cargar tu hotel.",
    robots: { index: false },
    alternates: { canonical: "/entrar" },
  };
}

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; next?: string; registro?: string; error?: string }>;
}) {
  const { plan: planParam, next: nextParam, registro: registroParam, error } = await searchParams;
  const plan = planPorClave(planParam);
  // `?registro=1` abre el formulario en «Crear mi cuenta». Lo mandan el alta
  // (`/panel/onboarding` sin sesión) y el pago sin sesión: decisión de Manolo del
  // 15 sep 2026, el registro es el botón principal de todo el sitio.
  const registro = registroParam === "1";
  // Prioridad del destino tras entrar: 1) plan (va al pago), 2) ?next= seguro
  // (ej. el onboarding), 3) si viene a registrarse, a cargar su hotel —una cuenta
  // nueva no tiene nada que ver en el panel vacío—, 4) el panel.
  const next = plan
    ? `/pago/iniciar?plan=${plan.clave}`
    : destinoSeguro(nextParam) ?? (registro ? RUTA_REGISTRO : "/panel");

  // El título y el texto siguen la intención con la que llegó la persona
  // (activar el plan, cargar su hotel o entrar al panel) Y el modo del
  // formulario: por eso van los dos juegos y `AuthForm` elige.
  //
  // Los días salen de `PRUEBA_DIAS`, el número que aplica el sistema: aquí
  // estaban escritos a mano («14 días») en dos textos.
  const vaAlOnboarding = next.startsWith(RUTA_REGISTRO);
  const precio = plan ? `$${plan.precio.toLocaleString("es-MX")} MXN/mes` : "";
  const textos: TextosAuth = plan
    ? {
        registro: {
          titulo: `Activa tus ${PRUEBA_DIAS} días gratis`,
          detalle: `Crea tu cuenta para activar tu ${plan.nombre} (${precio}). Se respeta el tiempo que te quede de tu prueba gratis, y cancelas cuando quieras desde tu panel.`,
        },
        entrar: {
          titulo: `Activa tu ${plan.nombre}`,
          detalle: `Entra para activar tu ${plan.nombre} (${precio}). Se respeta el tiempo que te quede de tu prueba gratis, y cancelas cuando quieras desde tu panel.`,
        },
      }
    : vaAlOnboarding
      ? {
          registro: {
            titulo: "Crea tu cuenta y prueba Kora",
            detalle: `Solo con tu correo y sin tarjeta. Luego cargas tu hotel y lo pruebas por dentro: tus ${PRUEBA_DIAS} días gratis empiezan cuando creas tu primer hotel.`,
          },
          entrar: {
            titulo: "Empieza a cargar tu hotel",
            detalle: "Entra con tu cuenta para cargar tus cuartos, precios y fotos.",
          },
        }
      : {
          registro: {
            titulo: "Crea tu cuenta",
            detalle: `Prueba Kora ${PRUEBA_DIAS} días gratis con tu propio hotel, sin tarjeta.`,
          },
          entrar: {
            titulo: "Entra a tu panel",
            detalle: "Administra tu hotel y tu página de reservas directas.",
          },
        };

  return (
    <main className="pt-16">
      <section className="py-16 sm:py-24 bg-kora-bg min-h-[70vh]">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            {/* `?error=enlace` lo pone `app/auth/callback` cuando el enlace del
                correo no se pudo canjear. Antes esta página no lo leía: la
                persona volvía al formulario vacío, sin saber qué pasó, y volvía
                a pedir enlaces contra el tope de correos del proyecto. */}
            <AuthForm
              next={next}
              registroInicial={registro}
              textos={textos}
              avisoEnlace={error === "enlace"}
            />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
