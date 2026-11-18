"use client";

// Todo lo que la asistente contesta, en UN lugar. Antes esta pestaña era una
// lista de chequeo de sólo lectura con links a otra pantalla (algunos rotos, y
// con palomitas verdes en secciones vacías), y las respuestas se escribían en
// tres sitios distintos sin saber cuál ganaba.

import { Plus, Trash2, Clock, BookOpen, ListChecks, Lightbulb, ExternalLink, Check, AlertTriangle, MapPin } from "lucide-react";
import { Aviso, Campo, Chips, Tarjeta, btnSuave } from "@/components/panel/ui";
import { FORMAS_PAGO, IDIOMAS } from "@/lib/mini";
import type { DiagnosticoHotel, DiagnosticoItem } from "@/lib/panel/diagnostico";
import { claveFaq } from "@/lib/bot/faqs";
import type { Camila } from "../useCamila";
import type { Faq } from "../tipos";

/** Lo que más preguntan los huéspedes y no tiene un campo propio en el sitio. */
export const PREGUNTAS_COMUNES = [
  { q: "¿Tienen estacionamiento?", ph: "Ej.: Sí, gratis dentro del hotel, 1 auto por cuarto." },
  { q: "¿El desayuno está incluido?", ph: "Ej.: No, se agrega por $180 por persona, de 8 a 11 am." },
  { q: "¿Cómo llego al hotel?", ph: "Ej.: Desde el centro son 10 min por la carretera a Tamasopo; hay letrero a la derecha." },
  { q: "¿Puedo llegar antes o irme más tarde?", ph: "Ej.: Si el cuarto está listo, sin costo. Salida tarde hasta las 2 pm por $300." },
  { q: "¿Puedo facturar mi estancia?", ph: "Ej.: Sí, manda tu constancia fiscal a facturas@tuhotel.com." },
  { q: "¿Hacen descuento a grupos?", ph: "Ej.: Desde 4 cuartos, 10% de descuento. Escríbenos para armarlo." },
] as const;
const COMUNES = new Set<string>(PREGUNTAS_COMUNES.map((p) => p.q));

const EJEMPLOS_INDICACIONES = [
  "Cuando alguien cotice, recomienda nuestro tour más popular.",
  "Si preguntan por eventos o bodas, pásalos con una persona del hotel.",
  "Menciona que el desayuno se sirve en la terraza con vista al río.",
  "No ofrezcas la Suite a familias con niños pequeños.",
];

export default function LoQueSabe({
  c,
  nombreBot,
  slug,
  diagnostico,
}: {
  c: Camila;
  nombreBot: string;
  slug: string;
  diagnostico: DiagnosticoHotel;
}) {
  const { bot, datos, cambiarDatos, cambiarFaqs, cambiarBot, puedeEditarSitio, faqsSitio, errores } = c;
  const sitio = (tab?: string) => `/panel/${slug}/sitio${tab ? `?tab=${tab}` : ""}`;

  const respuesta = (q: string) => bot.faqs.find((f) => f.q === q)?.a ?? "";
  const setRespuesta = (q: string, a: string) => {
    const faqs = [...bot.faqs];
    const i = faqs.findIndex((f) => f.q === q);
    if (i >= 0) {
      if (a.trim() || a.length) faqs[i] = { q, a };
      if (!a) faqs.splice(i, 1);
    } else if (a) faqs.push({ q, a });
    cambiarFaqs(faqs);
  };
  const propias = bot.faqs.map((f, i) => ({ f, i })).filter(({ f }) => !COMUNES.has(f.q));
  // Una pregunta común que tu PÁGINA ya contesta se enseña con esa respuesta (y
  // su link), en vez de aparecer vacía arriba y respondida abajo.
  const delSitio = new Map(faqsSitio.map((f) => [claveFaq(f.q), f]));
  const comunesEnSitio = new Set(PREGUNTAS_COMUNES.map((p) => claveFaq(p.q)).filter((k) => delSitio.has(k)));
  const sitioRestantes = faqsSitio.filter((f) => !comunesEnSitio.has(claveFaq(f.q)));
  const setPropia = (i: number, campo: keyof Faq, v: string) => {
    const faqs = [...bot.faqs];
    faqs[i] = { ...faqs[i], [campo]: v };
    cambiarFaqs(faqs);
  };

  const tambienSabe: (DiagnosticoItem & { titulo: string })[] = [
    { ...diagnostico.habitaciones, titulo: "Habitaciones" },
    { ...diagnostico.precios, titulo: "Precios por noche" },
    { ...diagnostico.reglas, titulo: "Anticipo, cancelación y códigos de descuento" },
    { ...diagnostico.experiencias, titulo: "Tours, extras y experiencias" },
    { ...diagnostico.accesibilidad, titulo: "Accesibilidad" },
    { ...diagnostico.guia, titulo: "Guía y recomendaciones de la zona" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Datos rápidos ── */}
      <Tarjeta
        icono={<Clock size={18} />}
        titulo="Lo básico de tu hotel"
        descripcion={
          <>
            Lo que más preguntan. Son los mismos datos de tu página: si los cambias aquí, se cambian allá también.
          </>
        }
      >
        {!puedeEditarSitio && (
          <div className="mb-4">
            <Aviso tono="info">Estos datos los cambia el dueño o la encargada del hotel.</Aviso>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo label="Dirección" ayuda="Calle, número, colonia y ciudad." max={300} valor={datos.ubicacion} error={errores.ubicacion}>
              {(p) => (
                <input
                  {...p}
                  value={datos.ubicacion}
                  disabled={!puedeEditarSitio}
                  onChange={(e) => cambiarDatos({ ubicacion: e.target.value.slice(0, 300) })}
                  className="input-kora"
                />
              )}
            </Campo>
            {datos.mapsUrl ? (
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-kora-muted">
                <MapPin size={12} aria-hidden="true" /> Cuando pidan la ubicación, manda tu link de Google Maps.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-kora-muted">
                <a href={sitio("contenido")} className="font-semibold text-kora-primary hover:underline">
                  Agrega tu link de Google Maps
                </a>{" "}
                para que pueda mandarlo cuando pidan la ubicación.
              </p>
            )}
          </div>
          <Campo label="Hora de entrada (check-in)" error={errores.checkin}>
            {(p) => (
              <input
                {...p}
                type="time"
                value={datos.checkin}
                disabled={!puedeEditarSitio}
                onChange={(e) => cambiarDatos({ checkin: e.target.value })}
                className="input-kora max-w-[10rem]"
              />
            )}
          </Campo>
          <Campo label="Hora de salida (check-out)" error={errores.checkout}>
            {(p) => (
              <input
                {...p}
                type="time"
                value={datos.checkout}
                disabled={!puedeEditarSitio}
                onChange={(e) => cambiarDatos({ checkout: e.target.value })}
                className="input-kora max-w-[10rem]"
              />
            )}
          </Campo>
          <Campo label="¿Aceptan mascotas?" max={600} valor={datos.mascotas}>
            {(p) => (
              <textarea
                {...p}
                rows={2}
                value={datos.mascotas}
                disabled={!puedeEditarSitio}
                onChange={(e) => cambiarDatos({ mascotas: e.target.value.slice(0, 600) })}
                placeholder="Ej.: Sí, perros pequeños con cargo de $200 por noche."
                className="input-kora"
              />
            )}
          </Campo>
          <Campo label="¿Y con niños?" max={600} valor={datos.ninos}>
            {(p) => (
              <textarea
                {...p}
                rows={2}
                value={datos.ninos}
                disabled={!puedeEditarSitio}
                onChange={(e) => cambiarDatos({ ninos: e.target.value.slice(0, 600) })}
                placeholder="Ej.: Bienvenidos. Menores de 5 años no pagan."
                className="input-kora"
              />
            )}
          </Campo>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-semibold text-kora-text">¿Cómo se puede pagar?</p>
            <Chips
              etiqueta="Formas de pago"
              multiple
              disabled={!puedeEditarSitio}
              opciones={FORMAS_PAGO.map((f) => ({ valor: f, label: f }))}
              seleccion={datos.formasPago}
              onChange={(v) => cambiarDatos({ formasPago: v })}
            />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-semibold text-kora-text">Idiomas que habla tu equipo</p>
            <Chips
              etiqueta="Idiomas"
              multiple
              disabled={!puedeEditarSitio}
              opciones={IDIOMAS.map((f) => ({ valor: f, label: f }))}
              seleccion={datos.idiomas}
              onChange={(v) => cambiarDatos({ idiomas: v })}
            />
          </div>
        </div>
      </Tarjeta>

      {/* ── Preguntas comunes ── */}
      <Tarjeta
        icono={<ListChecks size={18} />}
        titulo="Lo que más preguntan"
        descripcion={`Contesta las que apliquen. Lo que dejes vacío, ${nombreBot} dirá que lo confirma con alguien del hotel (nunca lo inventa).`}
      >
        <div className="space-y-4">
          {PREGUNTAS_COMUNES.map(({ q, ph }) => {
            const enSitio = delSitio.get(claveFaq(q));
            if (enSitio && !respuesta(q))
              return (
                <div key={q}>
                  <p className="mb-1.5 text-sm font-semibold text-kora-text">{q}</p>
                  <div className="flex items-start justify-between gap-2 rounded-xl bg-kora-bg px-3 py-2.5">
                    <p className="text-sm text-kora-text">{enSitio.a}</p>
                    <a
                      href={sitio("resenas")}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--chip-neutro-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--chip-neutro-text)] hover:underline"
                      title="Esta respuesta sale de tu página web; se cambia en Mi sitio"
                    >
                      De tu página <ExternalLink size={10} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              );
            return (
            <Campo key={q} label={q} max={1000} valor={respuesta(q)}>
              {(p) => (
                <textarea
                  {...p}
                  rows={2}
                  value={respuesta(q)}
                  onChange={(e) => setRespuesta(q, e.target.value.slice(0, 1000))}
                  placeholder={ph}
                  className="input-kora"
                />
              )}
            </Campo>
            );
          })}
        </div>
      </Tarjeta>

      {/* ── Preguntas propias ── */}
      <Tarjeta
        icono={<BookOpen size={18} />}
        titulo="Tus preguntas y respuestas"
        descripcion="Cualquier otra cosa que te pregunten seguido. También aparecen aquí las que le enseñas con «Corregir» desde las conversaciones."
        accion={
          <button
            type="button"
            onClick={() => cambiarFaqs([...bot.faqs, { q: "", a: "" }])}
            disabled={bot.faqs.length >= 40}
            className={btnSuave}
          >
            <Plus size={14} aria-hidden="true" /> Agregar
          </button>
        }
      >
        {propias.length === 0 && sitioRestantes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-panel-border px-4 py-6 text-center text-sm text-kora-muted">
            Todavía no hay. Toca «Agregar» para enseñarle algo nuevo.
          </p>
        ) : (
          <ul className="space-y-3">
            {propias.map(({ f, i }) => (
              <li key={i} className="rounded-xl border border-panel-border-soft p-3">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2">
                    <label className="sr-only" htmlFor={`faq-q-${i}`}>
                      Pregunta
                    </label>
                    <input
                      id={`faq-q-${i}`}
                      value={f.q}
                      onChange={(e) => setPropia(i, "q", e.target.value.slice(0, 200))}
                      placeholder="Cuando pregunten…"
                      className="input-kora font-semibold"
                    />
                    <label className="sr-only" htmlFor={`faq-a-${i}`}>
                      Respuesta
                    </label>
                    <textarea
                      id={`faq-a-${i}`}
                      rows={2}
                      value={f.a}
                      onChange={(e) => setPropia(i, "a", e.target.value.slice(0, 1000))}
                      placeholder="…contesta esto"
                      className="input-kora"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => cambiarFaqs(bot.faqs.filter((_, j) => j !== i))}
                    className="rounded-full p-2 text-kora-muted hover:bg-[var(--chip-mal-bg)] hover:text-[var(--chip-mal-text)]"
                    aria-label={`Quitar la pregunta ${f.q || "vacía"}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
            {sitioRestantes.map((f) => (
              <li key={`sitio-${f.q}`} className="rounded-xl bg-kora-bg px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-kora-text">{f.q}</p>
                    <p className="mt-0.5 text-sm text-kora-muted">{f.a}</p>
                  </div>
                  <a
                    href={sitio("resenas")}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--chip-neutro-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--chip-neutro-text)] hover:underline"
                    title="Esta pregunta también sale en tu página web; se cambia en Mi sitio"
                  >
                    En tu página <ExternalLink size={10} aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {/* ── Indicaciones ── */}
      <Tarjeta
        icono={<Lightbulb size={18} />}
        titulo={`Indicaciones para ${nombreBot}`}
        descripcion="Cosas que quieres que haga o evite. Escríbelas como se las dirías a alguien nuevo en recepción."
      >
        <Campo
          label="Indicaciones"
          opcional
          max={4000}
          valor={bot.instrucciones}
          ayuda="Los precios, la disponibilidad y las reglas de reserva no se cambian aquí: siempre salen del sistema."
        >
          {(p) => (
            <textarea
              {...p}
              rows={5}
              value={bot.instrucciones}
              onChange={(e) => cambiarBot({ instrucciones: e.target.value.slice(0, 4000) })}
              className="input-kora"
            />
          )}
        </Campo>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-xs text-kora-muted">Ideas:</span>
          {EJEMPLOS_INDICACIONES.filter((e) => !bot.instrucciones.includes(e)).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() =>
                cambiarBot({ instrucciones: `${bot.instrucciones.trim()}${bot.instrucciones.trim() ? "\n" : ""}- ${e}`.slice(0, 4000) })
              }
              className="inline-flex items-center gap-1 rounded-full border border-panel-border px-2.5 py-1 text-xs text-kora-muted transition-colors hover:border-kora-primary/50 hover:text-kora-text"
            >
              <Plus size={11} aria-hidden="true" /> {e}
            </button>
          ))}
        </div>
      </Tarjeta>

      {/* ── También sabe ── */}
      <Tarjeta
        titulo="También sabe, de tu página"
        descripcion="Esto se cambia en Mi sitio y ella lo usa al momento. Revisa lo que tenga un aviso."
      >
        <ul className="divide-y divide-panel-border-soft">
          {tambienSabe.map((it) => (
            <li key={it.titulo} className="flex items-start justify-between gap-3 py-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                    it.ok ? "bg-[var(--chip-ok-bg)] text-[var(--chip-ok-text)]" : "bg-[var(--chip-aviso-bg)] text-[var(--chip-aviso-text)]"
                  }`}
                  aria-label={it.ok ? "Listo" : "Le falta algo"}
                >
                  {it.ok ? <Check size={12} aria-hidden="true" /> : <AlertTriangle size={11} aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-kora-text">{it.titulo}</p>
                  {!it.ok && it.aviso && <p className="mt-0.5 text-xs leading-relaxed text-kora-muted">{it.aviso}</p>}
                </div>
              </div>
              <a href={sitio(it.tab)} className="shrink-0 text-xs font-semibold text-kora-primary hover:underline">
                {it.ok ? "Ver" : "Completar"}
              </a>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}
