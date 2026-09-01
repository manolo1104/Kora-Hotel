"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { motion, AnimatePresence } from "motion/react";
import { trackLead } from "@/lib/analytics";
import { WHATSAPP } from "@/lib/contacto";

// Respaldo: si el envío falla, ofrecemos WhatsApp para no perder el lead.
const WA_FALLBACK_URL = `https://wa.me/${WHATSAPP.replace(/\D/g, "")}?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20de%20Kora`;

const benefits = [
  "Plan mes a mes de $550 MXN/mes, habitaciones ilimitadas — sin permanencia",
  "Te montamos todo y capacitamos a tu equipo en 24 horas",
  "Opcional: tu sitio web profesional con motor de reservas (servicio aparte)",
  "Soporte directo con el equipo fundador",
];

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  // Mensaje personalizado según el resultado que traiga el usuario desde una
  // herramienta (ej. /contacto?perdida=144000).
  const [personalizado, setPersonalizado] = useState<string | null>(null);
  // De qué herramienta llegó. Se captura al montar porque el `?utm_source` sólo
  // está en la URL de entrada: si el visitante navega por la landing antes de
  // bajar al formulario, para entonces ya se perdió.
  const [utmSource, setUtmSource] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setUtmSource((p.get("utm_source") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 40));
    const perdida = Number(p.get("perdida"));
    const puntaje = p.get("puntaje");
    const revpar = Number(p.get("revpar"));
    if (perdida > 0) {
      setPersonalizado(
        `Según tu cálculo, hoy entregas cerca de $${Math.round(perdida).toLocaleString("es-MX")} MXN al año en comisiones. Con Kora, ese dinero se queda contigo.`
      );
    } else if (puntaje) {
      setPersonalizado(
        `Tu diagnóstico dio ${puntaje}/100. Kora te ayuda a subir ese número y a depender menos de Booking.`
      );
    } else if (revpar > 0) {
      setPersonalizado(
        `Tu RevPAR es de $${Math.round(revpar).toLocaleString("es-MX")} MXN. Con las reservas directas de Kora puedes hacerlo crecer.`
      );
    }
  }, []);

  // 🟢 RESUELTO. Este componente vive en DOS sitios: al final de la landing
  // (con su `id="contacto"`, para quien baja leyendo) y solo, en `/contacto`.
  //
  // El ancla `#contacto` NO LLEVABA AQUÍ y no tenía arreglo desde el navegador:
  // la landing anima cada sección al entrar en pantalla, así que bajar hace
  // CRECER lo que queda arriba y el formulario se aleja más rápido de lo que uno
  // se acerca (medido el 31 ago 2026: 14.000 px después de ocho segundos
  // reintentando). Mientras el contenido mida distinto según lo que se haya
  // visto, es una carrera perdida.
  //
  // La salida fue de producto: los 30 enlaces que apuntaban al ancla —los 14
  // botones de las herramientas, los CTA del blog, el panel y el motor— ahora
  // van a `/contacto`, donde el formulario es lo primero que se ve. El
  // `?utm_source` viaja en la query de esa URL y se captura arriba, así que el
  // lead sigue llegando al CRM con su remite.

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(false);

    const data = new FormData(e.currentTarget);

    // Honeypot: si este campo oculto trae texto, es un bot. Fingimos éxito
    // (para que el bot no reintente) pero no enviamos nada.
    if (data.get("_gotcha")) {
      setSent(true);
      return;
    }

    setLoading(true);
    try {
      // El lead cae directo al CRM de Kora (y de ahí se avisa al fundador).
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      if (res.ok) {
        setSent(true);
        trackLead("form"); // conversión: lead por formulario
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="contacto" className="py-20 sm:py-24 bg-kora-primary">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

          <Reveal>
            <div>
              {personalizado && (
                <div className="mb-5 rounded-2xl bg-kora-accent/15 border border-kora-accent/30 p-4">
                  <p className="text-sm text-white leading-relaxed">
                    {personalizado}
                  </p>
                </div>
              )}
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                ¿Prefieres que te acompañemos?
              </h2>
              <p className="mt-4 text-kora-accent text-base leading-relaxed">
                Si aún tienes dudas, déjanos tus datos y te contactamos: te
                enseñamos Kora con tu hotel y te ayudamos a arrancar. Sin
                compromiso.
              </p>

              <ul className="mt-8 space-y-4" aria-label="Beneficios de Kora">
                {benefits.map((benefit, i) => (
                  <Reveal key={benefit} delay={0.15 + i * 0.08}>
                    <li className="flex items-start gap-3">
                      <div
                        className="w-5 h-5 rounded-full bg-kora-accent flex items-center justify-center flex-shrink-0 mt-0.5"
                        aria-hidden="true"
                      >
                        <Check size={11} className="text-kora-primary" />
                      </div>
                      <span className="text-white/90 text-sm">{benefit}</span>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="bg-white rounded-2xl p-6 sm:p-8">
              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                    className="text-center py-8"
                  >
                    <div className="w-14 h-14 rounded-full bg-kora-accent/15 flex items-center justify-center mx-auto mb-4">
                      <Check size={28} className="text-kora-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-kora-text mb-2">
                      ¡Recibido!
                    </h3>
                    <p className="text-kora-muted text-sm leading-relaxed">
                      Te llega un correo ahora mismo y te escribimos por
                      WhatsApp en menos de 24 horas.
                    </p>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleSubmit}
                    className="space-y-4"
                  >
                    {/* Honeypot anti-spam: oculto para personas, visible para bots */}
                    <input
                      type="text"
                      name="_gotcha"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="hidden"
                    />
                    {/* De dónde vino: viaja al CRM como el origen del lead. */}
                    <input type="hidden" name="utm_source" value={utmSource} readOnly />

                    <div>
                      <label
                        htmlFor="hotel"
                        className="block text-sm font-semibold text-kora-text mb-1.5"
                      >
                        Nombre del hotel
                      </label>
                      <input
                        id="hotel"
                        name="hotel"
                        type="text"
                        required
                        placeholder="Hotel Paraíso Encantado"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-semibold text-kora-text mb-1.5"
                      >
                        Tu nombre
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        placeholder="Manolo Covarrubias"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-semibold text-kora-text mb-1.5"
                      >
                        Tu correo
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        placeholder="tu@hotel.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="whatsapp"
                        className="block text-sm font-semibold text-kora-text mb-1.5"
                      >
                        WhatsApp
                      </label>
                      <input
                        id="whatsapp"
                        name="whatsapp"
                        type="tel"
                        required
                        placeholder="+52 489 123 4567"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="rooms"
                        className="block text-sm font-semibold text-kora-text mb-1.5"
                      >
                        Número de habitaciones
                      </label>
                      <select
                        id="rooms"
                        name="rooms"
                        required
                        defaultValue=""
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200 bg-white"
                      >
                        <option value="" disabled>
                          Selecciona...
                        </option>
                        <option value="5-10">5 a 10 habitaciones</option>
                        <option value="11-20">11 a 20 habitaciones</option>
                        <option value="21-40">21 a 40 habitaciones</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="location"
                        className="block text-sm font-semibold text-kora-text mb-1.5"
                      >
                        ¿Dónde está tu hotel?
                      </label>
                      <input
                        id="location"
                        name="location"
                        type="text"
                        required
                        placeholder="Xilitla, San Luis Potosí"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 leading-relaxed"
                      >
                        No pudimos enviar tu solicitud. Por favor escríbenos
                        directo por{" "}
                        <a
                          href={WA_FALLBACK_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackLead("whatsapp")}
                          className="font-bold underline hover:text-red-900"
                        >
                          WhatsApp
                        </a>{" "}
                        y te contestamos ahí mismo.
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-press btn-fill w-full py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-base hover:bg-kora-accent-dark transition-colors mt-2 disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                          Enviando...
                        </>
                      ) : (
                        "Quiero que me contacten"
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {!sent && (
                <>
                  <p className="mt-5 text-xs text-kora-muted text-center leading-relaxed">
                    Te contactamos por WhatsApp en menos de 24 horas.
                    <br />
                    Sin llamadas en frío. Sin vendedores.
                  </p>
                  <p className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-[11px] text-kora-muted">
                    <Lock size={11} className="text-kora-primary" aria-hidden="true" />
                    Tus datos están seguros. Solo los usamos para contactarte.
                  </p>
                </>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
