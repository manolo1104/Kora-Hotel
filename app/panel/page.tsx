import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  CalendarCheck,
  Pencil,
  Plus,
  Building2,
  ArrowRight,
  CircleDashed,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { LogoutButton } from "@/components/panel/LogoutButton";
import { SuscripcionCard } from "@/components/panel/SuscripcionCard";
import { EliminarHotelButton } from "@/components/panel/EliminarHotelButton";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnvReady } from "@/lib/supabase/env";
import { getSuscripcion } from "@/lib/suscripcion";
import {
  getHotelesDelUsuario,
  MAX_HOTELES_POR_CUENTA,
  type HotelRow,
  type RolHotel,
} from "@/lib/tenant";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi panel | Kora",
  robots: { index: false },
};

const ROL_LABEL: Record<RolHotel, string> = {
  dueno: "Dueño",
  encargada: "Encargada",
  recepcion: "Recepción",
  limpieza: "Limpieza",
  cocina: "Cocina",
};

// ¿Le falta configuración al hotel? Solo con datos de la fila (sin llamadas a
// Stripe: el hub debe cargar rápido). Un wizard empezado y no terminado siempre
// cuenta; hoteles previos al asistente solo si les falta lo esencial.
function setupPendiente(hotel: HotelRow): boolean {
  const ob = (hotel.extras as { onboarding?: { completado?: boolean } } | null)?.onboarding;
  if (ob?.completado === true) return false;
  if (ob && typeof ob === "object") return true;
  const sinHabitaciones = !Array.isArray(hotel.habitaciones) || hotel.habitaciones.length === 0;
  const sinFotos = !Array.isArray(hotel.fotos) || hotel.fotos.length === 0;
  return sinHabitaciones || sinFotos || hotel.publicado === false;
}

export default async function PanelPage() {
  if (!supabaseEnvReady) {
    return (
      <main className="pt-16">
        <section className="py-20 bg-kora-bg min-h-[60vh]">
          <div className="max-w-md mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold text-kora-text">Configuración pendiente</h1>
            <p className="mt-3 text-kora-muted text-sm leading-relaxed">
              El panel se activará en cuanto se configure la base de datos.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const [suscripcion, hoteles] = await Promise.all([
    getSuscripcion(user.id),
    getHotelesDelUsuario(),
  ]);

  // Tope de hoteles por cuenta: solo cuentan los que el usuario es dueño.
  const hotelesPropios = hoteles.filter(({ rol }) => rol === "dueno").length;
  const alcanzoTope = hotelesPropios >= MAX_HOTELES_POR_CUENTA;

  const card = "bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm";

  return (
    <main className="pt-16">
      <section className="py-16 sm:py-20 bg-kora-bg min-h-[60vh]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                  Mis hoteles
                </h1>
                <p className="mt-1 text-sm text-kora-muted">{user.email}</p>
              </div>
              <LogoutButton />
            </div>
          </Reveal>

          <SuscripcionCard
            plan={suscripcion?.plan ?? null}
            estado={suscripcion?.estado ?? null}
            esStripe={Boolean(suscripcion?.stripe_customer_id)}
            sinHoteles={hoteles.length === 0}
          />

          {/* Sin hoteles → bienvenida */}
          {hoteles.length === 0 ? (
            <Reveal delay={0.1}>
              <div className={`${card} mt-6 text-center`}>
                <div className="w-14 h-14 rounded-full bg-kora-accent/15 flex items-center justify-center mx-auto mb-4">
                  <Building2 size={28} className="text-kora-primary" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-bold text-kora-text">
                  Da de alta tu primer hotel
                </h2>
                <p className="mt-2 text-sm text-kora-muted leading-relaxed max-w-md mx-auto">
                  En un par de minutos tendrás tu página de reservas directas, lista para
                  recibir huéspedes sin comisiones de Booking ni Airbnb.
                </p>
                <Link
                  href="/panel/onboarding"
                  className="btn-press btn-fill mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
                >
                  <Plus size={16} /> Crear mi hotel
                </Link>
              </div>
            </Reveal>
          ) : (
            <div className="mt-6 space-y-4">
              {hoteles.map(({ hotel, rol }, i) => (
                <Reveal key={hotel.id} delay={0.05 * i}>
                  <div className={card}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold text-kora-text truncate">
                          {hotel.nombre}
                        </h2>
                        <p className="mt-0.5 text-xs text-kora-muted break-all">
                          kora-hotel.com/h/{hotel.slug}
                        </p>
                      </div>
                      <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-kora-bg text-[11px] font-bold text-kora-muted">
                        {ROL_LABEL[rol] ?? rol}
                      </span>
                    </div>

                    {/* Configuración a medias → retomar el asistente (resumable) */}
                    {setupPendiente(hotel) && (
                      <Link
                        href={`/panel/${hotel.slug}/onboarding`}
                        className="btn-press mt-4 flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 hover:border-amber-300 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                          <CircleDashed size={15} aria-hidden="true" />
                          Configuración incompleta
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-900">
                          Terminar de configurar <ArrowRight size={13} aria-hidden="true" />
                        </span>
                      </Link>
                    )}

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Link
                        href={`/panel/${hotel.slug}/insights`}
                        className="btn-press inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-kora-primary text-white font-semibold text-xs sm:text-sm hover:bg-kora-primary-dark transition-colors"
                      >
                        <LayoutDashboard size={15} aria-hidden="true" /> Panel
                      </Link>
                      <Link
                        href={`/h/${hotel.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-press inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-kora-text font-semibold text-xs sm:text-sm hover:border-kora-accent transition-colors"
                      >
                        <Globe size={15} aria-hidden="true" /> Ver sitio
                      </Link>
                      <Link
                        href={`/h/${hotel.slug}/reservar`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-press inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-kora-text font-semibold text-xs sm:text-sm hover:border-kora-accent transition-colors"
                      >
                        <CalendarCheck size={15} aria-hidden="true" /> Reservas
                      </Link>
                      <Link
                        href={`/panel/${hotel.slug}/sitio`}
                        className="btn-press inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-kora-text font-semibold text-xs sm:text-sm hover:border-kora-accent transition-colors"
                      >
                        <Pencil size={15} aria-hidden="true" /> Editar sitio
                      </Link>
                    </div>

                    {/* Zona de peligro: eliminar hotel (solo dueño, con contraseña) */}
                    {rol === "dueno" && (
                      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                        <EliminarHotelButton slug={hotel.slug} nombre={hotel.nombre} />
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}

              <Reveal delay={0.05 * hoteles.length}>
                {alcanzoTope ? (
                  <div className="flex flex-col items-center gap-1 w-full px-5 py-4 rounded-2xl border border-gray-100 bg-white text-center">
                    <p className="text-sm font-semibold text-kora-text">
                      Llegaste al máximo de {MAX_HOTELES_POR_CUENTA} hoteles por cuenta.
                    </p>
                    <p className="text-xs text-kora-muted">
                      ¿Necesitas más? Escríbenos y lo habilitamos.
                    </p>
                  </div>
                ) : (
                  <Link
                    href="/panel/onboarding"
                    className="btn-press group flex items-center justify-center gap-2 w-full px-5 py-4 rounded-2xl border-2 border-dashed border-gray-200 text-kora-muted font-semibold text-sm hover:border-kora-accent hover:text-kora-primary transition-colors"
                  >
                    <Plus size={16} /> Agregar otro hotel
                    <ArrowRight
                      size={15}
                      className="opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all"
                    />
                  </Link>
                )}
              </Reveal>
            </div>
          )}

          {/* Herramientas rápidas con IA (incluidas en el plan) */}
          {hoteles.length > 0 && (
            <Reveal delay={0.1}>
              <Link
                href="/panel/herramientas"
                className="btn-press group mt-6 flex items-center gap-4 rounded-2xl bg-kora-primary p-5 sm:p-6 text-white hover:bg-kora-primary-dark transition-colors"
              >
                <div className="w-11 h-11 shrink-0 rounded-full bg-kora-accent/20 flex items-center justify-center">
                  <Sparkles size={22} className="text-kora-accent" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-bold">Herramientas con IA</h2>
                  <p className="mt-0.5 text-sm text-white/75 leading-snug">
                    Responde reseñas de Google, escribe mensajes de WhatsApp y descripciones en
                    segundos.
                  </p>
                </div>
                <ArrowRight
                  size={18}
                  className="shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform"
                  aria-hidden="true"
                />
              </Link>
            </Reveal>
          )}
        </div>
      </section>
    </main>
  );
}
