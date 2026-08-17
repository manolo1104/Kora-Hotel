// Render completo de la mini-página del hotel, a partir de DATOS PUROS.
//
// Vive aparte de app/h/[slug]/page.tsx a propósito: ese archivo consulta la base
// y arma el JSON-LD (solo servidor), mientras que este componente no toca red ni
// base, así que también corre en el navegador. Eso es lo que permite que el
// editor visual del panel muestre la página REAL actualizándose mientras el
// hotelero escribe, en vez de una maqueta que se parece.
//
// Regla al tocar este archivo: nada de fetch, nada de `await`, nada de env vars.
// Si necesita un dato, se agrega a MiniDatos y lo llena quien lo llama.

import Image from "next/image";
import Link from "next/link";
import {
  BedDouble,
  CreditCard,
  Languages,
  MapPin,
  Navigation,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { HotelImage } from "@/components/HotelImage";
import { Reveal } from "@/components/shared/Reveal";
import { ReservaForm } from "@/components/mini/ReservaForm";
import { MiniNav, type MiniNavDatos } from "@/components/mini/MiniNav";
import { IconoBoton, IconoDe } from "@/components/mini/iconos";
import { AMENIDADES_MAP } from "@/lib/amenidades";
import {
  anclaBloque,
  avisoVigente,
  botonExterno,
  COLOR_DEFAULT,
  fontStack,
  hrefBoton,
  inkFor,
  resolverBloques,
  resolverBloquesPagina,
  resolverBotones,
  tituloBloque,
  vigenciaActiva,
  youtubeEmbed,
  type Bloque,
  type Boton,
  type BotonCtx,
  type BotonZona,
  type MiniExtras,
  type Pagina,
} from "@/lib/mini";

// ─── Datos de entrada ─────────────────────────────────────────────────────────

export interface MiniTarifa {
  personas?: string;
  precio?: string;
}
export interface MiniHabitacion {
  nombre?: string;
  precio?: string;
  descripcion?: string;
  capacidad?: string;
  fotos?: string[];
  tarifas?: MiniTarifa[];
  features?: string[];
  camas?: { tipo: string; cantidad: number }[];
}
export interface MiniResena {
  estrellas: number;
  texto: string;
  autor: string;
  fecha: string;
  verificada: boolean;
  respuesta: string | null;
}

export interface MiniDatos {
  slug: string;
  nombre: string;
  ubicacion?: string | null;
  descripcion?: string | null;
  whatsapp?: string | null;
  habitaciones: MiniHabitacion[];
  fotos: string[];
  extras: MiniExtras;
  resenas: MiniResena[];
  rating: number | null;
  totalResenas: number;
  motorActivo: boolean;
  marcaOculta: boolean;
  hoy: string; // fecha local de México (YYYY-MM-DD) para la vigencia del aviso
  nav?: MiniNavDatos; // pestañas del sitio; ausente o vacío = sin barra
}

// ─── Utilidades de formato ────────────────────────────────────────────────────

function aNumero(p?: string): number {
  return Number(String(p ?? "").replace(/[^0-9.]/g, ""));
}
function fmtPrecio(p?: string): string | null {
  if (!p) return null;
  const n = aNumero(p);
  if (!n) return p;
  return "$" + n.toLocaleString("es-MX") + " MXN";
}
function precioDesde(h: MiniHabitacion): { texto: string | null; desde: boolean } {
  const validas = (h.tarifas ?? []).filter((t) => aNumero(t.precio) > 0);
  if (validas.length > 0) {
    const min = Math.min(...validas.map((t) => aNumero(t.precio)));
    return { texto: "$" + min.toLocaleString("es-MX") + " MXN", desde: true };
  }
  return { texto: fmtPrecio(h.precio), desde: false };
}
const MESES_CORTOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
// "2026-09-15" → "15 de septiembre" (sin new Date: evita el corrimiento UTC).
function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d || !MESES_CORTOS[m - 1]) return iso;
  return `${d} de ${MESES_CORTOS[m - 1]}`;
}
// Precio de menú: "$120" limpio, sin el " MXN" de las habitaciones.
function precioMenu(p: string): string {
  const n = aNumero(p);
  return n ? "$" + n.toLocaleString("es-MX") : p;
}
export function urlRed(base: string, v?: string): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return base + s.replace(/^@/, "");
}

export function Estrellas({ valor, size = 15 }: { valor: number; size?: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(valor) ? "fill-current" : ""}
          style={{ color: "var(--brand)" }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

// ─── Botones ──────────────────────────────────────────────────────────────────

const ESTILO_CLS: Record<string, string> = {
  relleno: "font-bold text-sm",
  contorno:
    "border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors",
  discreto: "font-semibold text-sm",
};

function BotonUI({
  boton,
  ctx,
  ancho,
  grande,
  preview,
}: {
  boton: Boton;
  ctx: BotonCtx;
  ancho?: boolean;
  grande?: boolean;
  preview?: boolean;
}) {
  const href = hrefBoton(boton, ctx);
  // Sin destino (p. ej. un enlace al que todavía no le pegan la dirección) el
  // botón no se publica. Pero en el editor sí se dibuja, apagado y avisando qué
  // le falta: si desapareciera, el hotelero acaba de agregarlo y creería que el
  // editor está roto.
  if (!href) {
    if (!preview) return null;
    return (
      <span
        className={`${ancho ? "w-full " : ""}inline-flex items-center justify-center gap-2 rounded-full ${
          grande ? "px-7 py-4" : ancho ? "px-6 py-3.5" : "px-4 py-2"
        } border border-dashed border-gray-300 text-gray-400 font-semibold text-sm`}
      >
        {boton.texto || "Botón sin texto"}
        <span className="text-[10px] font-bold uppercase tracking-wide">falta el destino</span>
      </span>
    );
  }
  const estilo = boton.estilo ?? "contorno";
  const externo = botonExterno(boton, ctx);
  const pad = grande ? "px-7 py-4" : ancho ? "px-6 py-3.5" : "px-4 py-2";
  const style: React.CSSProperties =
    estilo === "relleno"
      ? { backgroundColor: "var(--brand)", color: "var(--brand-ink)" }
      : estilo === "discreto"
        ? { color: "var(--brand)" }
        : {};
  return (
    <a
      href={href}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`btn-press ${estilo === "relleno" ? "btn-fill " : ""}${
        ancho ? "w-full " : ""
      }inline-flex items-center justify-center gap-2 rounded-full ${pad} ${ESTILO_CLS[estilo]}`}
      style={style}
    >
      <IconoBoton boton={boton} size={grande || ancho ? 17 : 15} motorActivo={ctx.motorActivo} />
      {boton.texto}
    </a>
  );
}

// Los botones de una zona. En la página publicada solo pasan los que tienen
// destino válido; en el editor pasan todos, para que el hotelero vea el que
// acaba de agregar y por qué todavía no sirve.
function botonesDeZona(
  botones: Boton[],
  zona: BotonZona,
  ctx: BotonCtx,
  preview: boolean
): Boton[] {
  return botones.filter(
    (b) => (b.zonas ?? []).includes(zona) && (preview || hrefBoton(b, ctx))
  );
}

function RedesSociales({ ig, fb }: { ig: string | null; fb: string | null }) {
  if (!ig && !fb) return null;
  return (
    <>
      {ig && (
        <a
          href={ig}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="btn-press inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-kora-text hover:border-kora-accent transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
        </a>
      )}
      {fb && (
        <a
          href={fb}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
          className="btn-press inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-kora-text hover:border-kora-accent transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
          </svg>
        </a>
      )}
    </>
  );
}

// ─── Envoltura de sección (título + fondo elegidos por el hotelero) ───────────

function SeccionBloque({
  bloque,
  children,
  claseExtra,
}: {
  bloque: Bloque;
  children: React.ReactNode;
  claseExtra?: string;
}) {
  const titulo = tituloBloque(bloque);
  const fondo = bloque.fondo ?? "ninguno";
  const cls =
    fondo === "tarjeta"
      ? "rounded-2xl bg-white border border-gray-100 shadow-sm p-5"
      : fondo === "marca"
        ? "rounded-2xl p-5"
        : "";
  const style: React.CSSProperties =
    fondo === "marca" ? { backgroundColor: "var(--brand)", color: "var(--brand-ink)" } : {};
  return (
    <section id={anclaBloque(bloque)} className={`scroll-mt-20 ${claseExtra ?? ""}`}>
      <div className={cls} style={style}>
        {titulo && (
          <h2
            className="text-lg font-bold mb-3"
            style={fondo === "marca" ? undefined : { color: "var(--brand)" }}
          >
            {titulo}
          </h2>
        )}
        {children}
      </div>
    </section>
  );
}

function Cuerpo({
  preview,
  className,
  children,
}: {
  preview: boolean;
  className: string;
  children: React.ReactNode;
}) {
  if (preview) return <div className={className}>{children}</div>;
  return <Reveal className={className}>{children}</Reveal>;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function MiniRender({
  datos,
  modo = "publico",
  pagina,
  onNavPagina,
}: {
  datos: MiniDatos;
  /** "preview" apaga las animaciones de entrada para que en el editor todo se
   *  vea de inmediato en vez de esperar a que el bloque entre en pantalla. */
  modo?: "publico" | "preview";
  /** Página propia a mostrar en vez de la portada (/h/{hotel}/{slug}). */
  pagina?: Pagina;
  /** Solo editor: al tocar un tab se cambia de página sin navegar. */
  onNavPagina?: (slugPagina: string | null) => void;
}) {
  const {
    slug,
    nombre,
    ubicacion,
    descripcion,
    whatsapp,
    habitaciones,
    fotos,
    extras,
    resenas,
    rating,
    totalResenas,
    motorActivo,
    marcaOculta,
    hoy,
  } = datos;

  const diseno = extras.diseno ?? {};
  const color = diseno.color || COLOR_DEFAULT;
  const ink = inkFor(color);
  const font = fontStack(diseno.fuente);
  const heroCompleto = diseno.heroEstilo === "completa";
  const logo = diseno.logoUrl;
  const textos = extras.textos ?? {};

  const bloques = (pagina ? resolverBloquesPagina(pagina) : resolverBloques(extras)).filter(
    (b) => !b.oculto
  );
  const botones = resolverBotones(extras);

  const mapsUrl = (extras.mapsUrl ?? "").trim() || null;
  const mapEmbedUrl = (extras.mapEmbedUrl ?? "").trim() || null;
  const igUrl = urlRed("https://instagram.com/", extras.instagram);
  const fbUrl = urlRed("https://facebook.com/", extras.facebook);

  const ctx: BotonCtx = {
    slug,
    nombreHotel: nombre,
    whatsapp,
    mapsUrl,
    motorActivo,
  };

  const amenidades = (extras.amenidades ?? []).map((k) => AMENIDADES_MAP[k]).filter(Boolean);
  const faqs = (extras.faqs ?? []).filter((f) => (f.pregunta ?? "").trim());
  const politicas = extras.politicas ?? {};
  const formasPago = extras.formasPago ?? [];
  const idiomas = extras.idiomas ?? [];
  const tienePoliticas =
    !!(politicas.cancelacion || politicas.mascotas || politicas.ninos) ||
    formasPago.length > 0 ||
    idiomas.length > 0;

  const portada = fotos?.[0];
  const resto = fotos?.slice(1) ?? [];

  const aviso = extras.aviso;
  const mostrarAviso = avisoVigente(aviso, hoy);

  const heroTitulo = (textos.heroTitulo ?? "").trim() || nombre;
  const heroSubtitulo = (textos.heroSubtitulo ?? "").trim();

  // Enlace a la habitación: en el editor no se navega (no existe la ruta con
  // datos sin guardar), así que ahí las tarjetas van sin link.
  const preview = modo === "preview";

  const btnPortada = botonesDeZona(botones, "portada", ctx, preview);
  const btnCierre = botonesDeZona(botones, "cierre", ctx, preview);
  const btnFlotante = botonesDeZona(botones, "flotante", ctx, preview);
  const portadaAncho = btnPortada.filter((b) => (b.estilo ?? "contorno") === "relleno");
  const portadaFila = btnPortada.filter((b) => (b.estilo ?? "contorno") !== "relleno");

  // ─── Contenido de cada tipo de bloque ──────────────────────────────────────
  function contenido(b: Bloque): React.ReactNode {
    switch (b.tipo) {
      case "formulario":
        if (!motorActivo && !whatsapp) return null;
        return (
          <ReservaForm
            hotelNombre={nombre}
            whatsapp={whatsapp ?? ""}
            slug={slug}
            motorActivo={motorActivo}
            habitaciones={(habitaciones ?? []).map((h) => h.nombre || "").filter(Boolean)}
          />
        );

      case "descripcion":
        if (!descripcion) return null;
        return (
          <p className="text-kora-text leading-relaxed whitespace-pre-line">{descripcion}</p>
        );

      case "fotos":
        if (resto.length === 0) return null;
        return (
          <div className="grid grid-cols-2 gap-3">
            {resto.map((url) => (
              <HotelImage
                key={url}
                src={url}
                alt={nombre}
                className="w-full h-36 sm:h-44 rounded-xl border border-gray-100"
                sizes="(max-width: 640px) 50vw, 300px"
              />
            ))}
          </div>
        );

      case "amenidades":
        if (amenidades.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2">
            {amenidades.map(({ key, label, Icon }) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm text-sm text-kora-text"
              >
                <Icon size={15} className="text-[var(--brand)]" aria-hidden={true} />
                {label}
              </span>
            ))}
          </div>
        );

      case "habitaciones":
        if (!habitaciones?.length) return null;
        return (
          <div className="space-y-4">
            {habitaciones.map((h, i) => {
              const precio = precioDesde(h);
              const tarifas = (h.tarifas ?? []).filter((t) => aNumero(t.precio) > 0);
              const fotosHab = h.fotos ?? [];
              const reservarHab: Boton = {
                id: `hab-${i}`,
                texto: "Reservar esta habitación",
                accion: "reservar",
                estilo: "discreto",
              };
              const hrefHab = motorActivo
                ? `/h/${slug}/reservar${h.nombre ? `?habitacion=${encodeURIComponent(h.nombre)}` : ""}`
                : hrefBoton(
                    {
                      ...reservarHab,
                      accion: "whatsapp",
                      valor: `Hola, vi su página y quiero reservar ${h.nombre ? `la ${h.nombre} ` : ""}en ${nombre}`,
                    },
                    ctx
                  );
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  {fotosHab.length > 0 && (
                    <div className="grid grid-cols-3 gap-1">
                      {fotosHab.slice(0, 3).map((url) => (
                        <HotelImage
                          key={url}
                          src={url}
                          alt={h.nombre || "Habitación"}
                          className="w-full h-24 sm:h-28"
                          sizes="(max-width: 640px) 33vw, 200px"
                        />
                      ))}
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-kora-text">{h.nombre || "Habitación"}</p>
                        {h.capacidad && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-kora-muted">
                            <Users size={12} aria-hidden="true" />
                            hasta {h.capacidad} personas
                          </p>
                        )}
                        {Array.isArray(h.camas) && h.camas.length > 0 && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-kora-muted">
                            <BedDouble size={12} aria-hidden="true" />
                            {h.camas.map((c) => `${c.cantidad} ${c.tipo}`).join(" · ")}
                          </p>
                        )}
                        {h.descripcion && (
                          <p className="mt-1 text-sm text-kora-muted leading-snug">
                            {h.descripcion}
                          </p>
                        )}
                      </div>
                      {precio.texto && (
                        <p
                          className="shrink-0 text-right font-bold tabular-nums"
                          style={{ color: "var(--brand)" }}
                        >
                          {precio.desde && (
                            <span className="block text-[10px] font-normal text-kora-muted">
                              desde
                            </span>
                          )}
                          {precio.texto}
                          <span className="block text-[10px] font-normal text-kora-muted">
                            por noche
                          </span>
                        </p>
                      )}
                    </div>

                    {tarifas.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {tarifas.map((t, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-kora-bg border border-gray-100 text-xs text-kora-text"
                          >
                            {t.personas || "?"}p
                            <span className="font-semibold" style={{ color: "var(--brand)" }}>
                              {fmtPrecio(t.precio)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {Array.isArray(h.features) && h.features.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {h.features.map((f) => (
                          <span
                            key={f}
                            className="rounded-full border border-gray-100 bg-kora-bg px-2.5 py-1 text-[11px] text-kora-text"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      {preview ? (
                        <span className="text-sm font-semibold text-kora-muted">
                          Ver detalles &rarr;
                        </span>
                      ) : (
                        <Link
                          href={`/h/${slug}/habitacion/${i}`}
                          className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-text"
                        >
                          Ver detalles &rarr;
                        </Link>
                      )}
                      {hrefHab && (
                        <a
                          href={hrefHab}
                          {...(motorActivo ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                          className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold"
                          style={{ color: "var(--brand)" }}
                        >
                          <IconoBoton boton={reservarHab} size={15} motorActivo={motorActivo} />
                          Reservar esta habitación
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case "resenas":
        if (resenas.length === 0) return null;
        return (
          <>
            {rating && (
              <p className="-mt-1 mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-text">
                <Estrellas valor={rating} />
                {rating.toFixed(1)}
                <span className="font-normal text-kora-muted">({totalResenas})</span>
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resenas.map((r, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between gap-2">
                    {r.estrellas >= 1 && r.estrellas <= 5 && (
                      <Estrellas valor={r.estrellas} size={14} />
                    )}
                    {r.verificada && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <ShieldCheck size={12} /> Verificada
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-kora-text leading-relaxed">“{r.texto}”</p>
                  <p className="mt-2 text-xs font-semibold text-kora-muted">
                    — {r.autor || "Huésped"}
                    {r.fecha ? ` · ${r.fecha}` : ""}
                  </p>
                  {r.respuesta && (
                    <div className="mt-3 rounded-xl bg-gray-50 p-3">
                      <p className="text-[11px] font-semibold text-kora-muted">
                        Respuesta de {nombre}
                      </p>
                      <p className="mt-1 text-sm text-kora-text leading-relaxed">{r.respuesta}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        );

      case "faq":
        if (faqs.length === 0) return null;
        return (
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <details
                key={i}
                className="group bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3"
              >
                <summary className="cursor-pointer list-none font-semibold text-sm text-kora-text flex items-center justify-between gap-3">
                  {f.pregunta}
                  <span className="text-kora-muted transition-transform group-open:rotate-45 text-lg leading-none">
                    +
                  </span>
                </summary>
                {f.respuesta && (
                  <p className="mt-2 text-sm text-kora-muted leading-relaxed whitespace-pre-line">
                    {f.respuesta}
                  </p>
                )}
              </details>
            ))}
          </div>
        );

      case "politicas":
        if (!tienePoliticas) return null;
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3 text-sm">
            {politicas.cancelacion && (
              <p className="flex gap-2">
                <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--brand)" }} aria-hidden="true" />
                <span className="text-kora-text">
                  <span className="font-semibold">Cancelación:</span> {politicas.cancelacion}
                </span>
              </p>
            )}
            {politicas.mascotas && (
              <p className="text-kora-text">
                <span className="font-semibold">Mascotas:</span> {politicas.mascotas}
              </p>
            )}
            {politicas.ninos && (
              <p className="text-kora-text">
                <span className="font-semibold">Niños:</span> {politicas.ninos}
              </p>
            )}
            {formasPago.length > 0 && (
              <div className="flex items-start gap-2">
                <CreditCard size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--brand)" }} aria-hidden="true" />
                <div className="flex flex-wrap gap-1.5">
                  {formasPago.map((f) => (
                    <span key={f} className="px-2.5 py-1 rounded-full bg-kora-bg border border-gray-100 text-xs text-kora-text">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {idiomas.length > 0 && (
              <div className="flex items-start gap-2">
                <Languages size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--brand)" }} aria-hidden="true" />
                <div className="flex flex-wrap gap-1.5">
                  {idiomas.map((l) => (
                    <span key={l} className="px-2.5 py-1 rounded-full bg-kora-bg border border-gray-100 text-xs text-kora-text">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "ubicacion":
        if (!mapEmbedUrl && !mapsUrl) return null;
        return (
          <>
            {mapEmbedUrl && (
              <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <iframe
                  src={mapEmbedUrl}
                  title={`Mapa de ${nombre}`}
                  className="w-full h-64"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
              >
                <Navigation size={15} aria-hidden="true" /> Cómo llegar
              </a>
            )}
          </>
        );

      // ── Bloques propios del hotelero ──
      case "texto": {
        const t = (b.texto ?? "").trim();
        if (!t) return null;
        return (
          <div className="text-kora-text leading-relaxed whitespace-pre-line">{t}</div>
        );
      }

      case "galeria": {
        const imgs = (b.imagenes ?? []).filter(Boolean);
        if (imgs.length === 0) return null;
        return (
          <div className="grid grid-cols-2 gap-3">
            {imgs.map((url) => (
              <HotelImage
                key={url}
                src={url}
                alt={tituloBloque(b) || nombre}
                className="w-full h-36 sm:h-44 rounded-xl border border-gray-100"
                sizes="(max-width: 640px) 50vw, 300px"
              />
            ))}
          </div>
        );
      }

      case "destacados": {
        const items = (b.items ?? []).filter((it) => (it.titulo ?? "").trim());
        if (items.length === 0) return null;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((it, i) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              >
                {it.icono && (
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full"
                    style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
                  >
                    <IconoDe clave={it.icono} size={17} />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-sm text-kora-text">{it.titulo}</p>
                  {it.texto && (
                    <p className="mt-0.5 text-sm text-kora-muted leading-snug">{it.texto}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }

      case "video": {
        const embed = youtubeEmbed(b.videoUrl);
        if (!embed) return null;
        return (
          <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm aspect-video bg-black">
            <iframe
              src={embed}
              title={tituloBloque(b) || `Video de ${nombre}`}
              className="w-full h-full"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }

      case "promocion": {
        const promo = b.promo ?? {};
        const texto = (promo.texto ?? "").trim();
        if (!texto) return null;
        const vigente = vigenciaActiva(promo.desde, promo.hasta, hoy);
        // Fuera de vigencia no se publica, pero en el editor se ve marcada:
        // si desapareciera, el hotelero creería que el editor está roto.
        if (!vigente && !preview) return null;
        const btn: Boton = {
          id: `${b.id}-cta`,
          texto: (promo.botonTexto ?? "").trim() || "Reservar ahora",
          accion: "reservar",
        };
        const href = hrefBoton(btn, ctx);
        return (
          <div
            className="relative rounded-2xl p-6 sm:p-7 text-center"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            {!vigente && (
              <span className="absolute top-3 right-3 rounded-full bg-white/90 text-gray-600 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1">
                Fuera de vigencia
              </span>
            )}
            <p className="text-xl sm:text-2xl font-bold leading-snug whitespace-pre-line">{texto}</p>
            {promo.hasta && (
              <p className="mt-2 text-sm opacity-85">Válido hasta el {fechaCorta(promo.hasta)}</p>
            )}
            {href && (
              <a
                href={href}
                className="btn-press mt-4 inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-semibold text-sm"
                style={{ backgroundColor: "var(--brand-ink)", color: "var(--brand)" }}
              >
                <IconoBoton boton={btn} size={17} motorActivo={ctx.motorActivo} />
                {btn.texto}
              </a>
            )}
          </div>
        );
      }

      case "cercanos": {
        const items = (b.cercanos ?? []).filter((it) => (it.titulo ?? "").trim());
        if (items.length === 0) return null;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((it, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {it.foto && (
                  <HotelImage
                    src={it.foto}
                    alt={it.titulo}
                    className="w-full h-36 sm:h-40"
                    sizes="(max-width: 640px) 100vw, 320px"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm text-kora-text">{it.titulo}</p>
                    {(it.distancia ?? "").trim() && (
                      <span
                        className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
                      >
                        <MapPin size={11} />
                        {it.distancia}
                      </span>
                    )}
                  </div>
                  {it.texto && (
                    <p className="mt-1 text-sm text-kora-muted leading-snug">{it.texto}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }

      case "menu": {
        const secciones = (b.menuSecciones ?? [])
          .map((s) => ({ ...s, items: (s.items ?? []).filter((it) => (it.nombre ?? "").trim()) }))
          .filter((s) => s.items.length > 0);
        if (secciones.length === 0) return null;
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
            {secciones.map((s, i) => (
              <div key={i}>
                {(s.titulo ?? "").trim() && (
                  <h3
                    className="text-sm font-bold uppercase tracking-wide mb-2"
                    style={{ color: "var(--brand)" }}
                  >
                    {s.titulo}
                  </h3>
                )}
                <ul className="space-y-2.5">
                  {s.items.map((it, j) => (
                    <li key={j}>
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm text-kora-text">{it.nombre}</span>
                        <span className="flex-1 border-b border-dotted border-gray-300" aria-hidden />
                        {(it.precio ?? "").trim() && (
                          <span className="text-sm font-bold text-kora-text whitespace-nowrap">
                            {precioMenu(it.precio!)}
                          </span>
                        )}
                      </div>
                      {it.descripcion && (
                        <p className="text-[13px] text-kora-muted leading-snug">{it.descripcion}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      }

      default:
        return null;
    }
  }

  const cuerpo = bloques
    .map((b) => {
      const hijo = contenido(b);
      if (!hijo) return null;
      return (
        <SeccionBloque key={b.id} bloque={b}>
          {hijo}
        </SeccionBloque>
      );
    })
    .filter(Boolean);

  return (
    <div
      className="min-h-full bg-kora-bg"
      style={
        {
          "--brand": color,
          "--brand-ink": ink,
          fontFamily: font,
        } as React.CSSProperties
      }
    >
      {/* Banner de aviso (temporada, promoción) con vigencia por fechas */}
      {mostrarAviso && (
        <div
          className="px-4 py-2.5 text-center text-sm font-semibold"
          style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
        >
          {aviso?.texto}
          {(aviso?.enlaceUrl ?? "").trim() && (
            <a
              href={aviso!.enlaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 underline underline-offset-2 font-bold"
            >
              {(aviso?.enlaceTexto ?? "").trim() || "Ver más"}
            </a>
          )}
        </div>
      )}

      {/* Pestañas del sitio (Inicio · páginas propias · Blog) */}
      {datos.nav && (
        <MiniNav
          slugHotel={slug}
          nav={{ ...datos.nav, activo: pagina ? pagina.slug : datos.nav.activo }}
          preview={preview}
          onNav={onNavPagina}
        />
      )}

      {/* Encabezado de una página propia: sin hero, directo al contenido */}
      {pagina && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8">
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight"
            style={{ color: "var(--brand)" }}
          >
            {pagina.titulo}
          </h1>
          {(pagina.descripcion ?? "").trim() && (
            <p className="mt-1.5 text-sm sm:text-base text-kora-muted leading-snug">
              {pagina.descripcion}
            </p>
          )}
        </div>
      )}

      {/* Portada */}
      {pagina ? null : heroCompleto && portada ? (
        <section className="relative h-[68vh] min-h-[400px] flex items-end">
          <Image src={portada} alt={nombre} fill sizes="100vw" priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
          <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 pb-10 text-white">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={`Logo de ${nombre}`} className="h-16 w-auto mb-4 drop-shadow" />
            )}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow">
              {heroTitulo}
            </h1>
            {heroSubtitulo && (
              <p className="mt-1.5 text-base text-white/90 drop-shadow max-w-lg">{heroSubtitulo}</p>
            )}
            {ubicacion && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/90">
                <MapPin size={14} aria-hidden="true" />
                {ubicacion}
              </p>
            )}
            {rating && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm">
                <Estrellas valor={rating} />
                <span className="font-semibold">{rating.toFixed(1)}</span>
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="relative">
          {portada ? (
            <HotelImage src={portada} alt={nombre} className="w-full h-60 sm:h-80" sizes="100vw" priority />
          ) : (
            <div className="w-full h-40" style={{ backgroundColor: "var(--brand)" }} />
          )}
        </section>
      )}

      {!pagina && (
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div
          className={`${heroCompleto ? "mt-6" : "-mt-12"} relative bg-white rounded-2xl shadow-lg border border-gray-100 p-6`}
        >
          {!heroCompleto && (
            <>
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={`Logo de ${nombre}`} className="h-12 w-auto mb-3" />
              )}
              <h1
                className="text-2xl sm:text-3xl font-extrabold tracking-tight"
                style={{ color: "var(--brand)" }}
              >
                {heroTitulo}
              </h1>
              {heroSubtitulo && (
                <p className="mt-1.5 text-sm sm:text-base text-kora-muted leading-snug">
                  {heroSubtitulo}
                </p>
              )}
              {ubicacion && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-kora-muted">
                  <MapPin size={14} aria-hidden="true" />
                  {ubicacion}
                </p>
              )}
              {rating && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-text">
                  <Estrellas valor={rating} />
                  {rating.toFixed(1)}
                  <span className="font-normal text-kora-muted">({totalResenas})</span>
                </p>
              )}
            </>
          )}

          {/* Botones de portada: los de relleno mandan (ancho completo), el
              resto va en una fila junto a las redes sociales. */}
          {portadaAncho.length > 0 && (
            <div className="mt-4 space-y-2">
              {portadaAncho.map((b) => (
                <BotonUI key={b.id} boton={b} ctx={ctx} ancho preview={preview} />
              ))}
            </div>
          )}
          {(portadaFila.length > 0 || igUrl || fbUrl) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {portadaFila.map((b) => (
                <BotonUI key={b.id} boton={b} ctx={ctx} preview={preview} />
              ))}
              <RedesSociales ig={igUrl} fb={fbUrl} />
            </div>
          )}
        </div>
      </div>
      )}

      {/* En público el cuerpo entra con la animación de siempre; en el editor va
          directo, porque dentro del marco de vista previa el "entró en pantalla"
          no se dispara y los bloques se quedarían en blanco. */}
      <Cuerpo
        preview={preview}
        className={`max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8 ${
          btnFlotante.length > 0 ? "pb-28 sm:pb-8" : ""
        }`}
      >
        {cuerpo}

        {/* Cierre: encabezado propio + botones de la zona final */}
        {(btnCierre.length > 0 ||
          (textos.cierreTitulo ?? "").trim() ||
          (textos.cierreTexto ?? "").trim()) && (
          <section className="text-center">
            {(textos.cierreTitulo ?? "").trim() && (
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--brand)" }}>
                {textos.cierreTitulo}
              </h2>
            )}
            {(textos.cierreTexto ?? "").trim() && (
              <p className="mb-4 text-sm text-kora-muted max-w-md mx-auto leading-relaxed">
                {textos.cierreTexto}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {btnCierre.map((b) => (
                <BotonUI key={b.id} boton={b} ctx={ctx} grande={(b.estilo ?? "contorno") === "relleno"} preview={preview} />
              ))}
            </div>
          </section>
        )}

        {/* Pie: hecho con Kora (oculto en premium) */}
        {!marcaOculta && (
          <footer className="pt-6 border-t border-gray-200 text-center">
            {preview ? (
              <span className="text-xs text-kora-muted">
                Hecho con <span className="font-bold text-kora-primary">Kora</span> · Crea tu página
                de reservas gratis
              </span>
            ) : (
              <Link
                href="/?utm_source=mini-pagina"
                className="text-xs text-kora-muted hover:text-kora-primary transition-colors"
              >
                Hecho con <span className="font-bold text-kora-primary">Kora</span> · Crea tu página
                de reservas gratis
              </Link>
            )}
          </footer>
        )}
      </Cuerpo>

      {/* Barra flotante de celular: se queda pegada abajo mientras el huésped
          hace scroll. Solo móvil; en escritorio estorba y no hace falta. */}
      {btnFlotante.length > 0 && (
        <div
          className={`${
            preview ? "absolute" : "fixed"
          } bottom-0 inset-x-0 z-40 sm:hidden bg-white/95 backdrop-blur border-t border-gray-200 px-3 py-2.5 flex items-center gap-2`}
        >
          {btnFlotante.map((b) => (
            <div key={b.id} className="flex-1 min-w-0">
              <BotonUI boton={b} ctx={ctx} ancho preview={preview} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
