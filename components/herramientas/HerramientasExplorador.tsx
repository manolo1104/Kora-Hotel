"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Search, X, Stethoscope } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { HerramientaIcono } from "@/components/herramientas/HerramientaIcono";
import {
  herramientas,
  GRUPOS_ORDEN,
  type Herramienta,
  type GrupoHerramienta,
} from "@/lib/herramientas";

const FEATURED_SLUG = "diagnostico";
const EASE = [0.23, 1, 0.32, 1] as const;

function normaliza(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function Tarjeta({
  h,
  index,
  reduce,
}: {
  h: Herramienta;
  index: number;
  reduce: boolean | null;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4), ease: EASE }}
      className="h-full"
    >
      <Link
        href={`/herramientas/${h.slug}`}
        className="card-hover group flex flex-col h-full bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-kora-accent transition-colors"
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="w-10 h-10 rounded-xl bg-kora-primary/5 flex items-center justify-center text-kora-primary shrink-0">
            <HerramientaIcono slug={h.slug} size={20} />
          </span>
          <span className="text-[10px] font-bold text-kora-accent bg-kora-accent/10 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
            {h.etiqueta}
          </span>
        </div>
        <h3 className="text-base font-bold text-kora-text leading-snug">
          {h.titulo}
        </h3>
        <p className="mt-1 text-sm text-kora-muted leading-relaxed flex-1">
          {h.resumen}
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary">
          Usar gratis
          <ArrowRight
            size={14}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-1"
          />
        </span>
      </Link>
    </motion.div>
  );
}

export function HerramientasExplorador() {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [grupoActivo, setGrupoActivo] = useState<"Todas" | GrupoHerramienta>("Todas");

  const featured = herramientas.find((h) => h.slug === FEATURED_SLUG);
  const pool = useMemo(
    () => herramientas.filter((h) => h.disponible && h.slug !== FEATURED_SLUG),
    []
  );

  const q = normaliza(query.trim());
  const filtroActivo = q.length > 0 || grupoActivo !== "Todas";

  const coincide = (h: Herramienta) =>
    q.length === 0 ||
    normaliza(h.titulo).includes(q) ||
    normaliza(h.resumen).includes(q) ||
    normaliza(h.etiqueta).includes(q);

  const secciones = GRUPOS_ORDEN.map((g) => ({
    grupo: g,
    items: pool.filter(
      (h) =>
        h.grupo === g &&
        coincide(h) &&
        (grupoActivo === "Todas" || grupoActivo === g)
    ),
  })).filter((s) => s.items.length > 0);

  const totalVisible = secciones.reduce((n, s) => n + s.items.length, 0);
  const chips: ("Todas" | GrupoHerramienta)[] = ["Todas", ...GRUPOS_ORDEN];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Destacado: punto de entrada (jerarquía) */}
      {featured && !filtroActivo && (
        <Reveal>
          <Link
            href={`/herramientas/${featured.slug}`}
            className="card-hover group block rounded-2xl bg-kora-primary p-7 sm:p-9 mb-10"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="w-12 h-12 rounded-2xl bg-kora-accent/15 flex items-center justify-center text-kora-accent shrink-0">
                  <Stethoscope size={24} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-kora-accent uppercase tracking-widest">
                    Empieza por aquí
                  </p>
                  <h2 className="mt-1 text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                    {featured.titulo}
                  </h2>
                  <p className="mt-1.5 text-sm text-white/70 leading-relaxed max-w-md">
                    {featured.resumen}
                  </p>
                </div>
              </div>
              <span className="btn-press btn-arrow btn-fill shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm group-hover:bg-kora-accent-dark transition-colors">
                Hacer el diagnóstico
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </div>
          </Link>
        </Reveal>
      )}

      {/* Barra de filtro: búsqueda + chips de categoría */}
      <Reveal delay={0.05}>
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-kora-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca una herramienta…"
              aria-label="Buscar herramientas"
              className="w-full pl-11 pr-10 py-3 rounded-full border border-gray-200 bg-white text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-kora-muted hover:text-kora-text p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div
            className="mt-4 flex flex-wrap justify-center gap-2"
            role="group"
            aria-label="Filtrar por categoría"
          >
            {chips.map((c) => {
              const activo = grupoActivo === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setGrupoActivo(c)}
                  aria-pressed={activo}
                  className={`btn-press px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                    activo
                      ? "bg-kora-primary text-white border-kora-primary"
                      : "bg-white text-kora-text border-gray-200 hover:border-kora-accent"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Resultados agrupados (key por categoría → re-entran al cambiar de chip) */}
      {totalVisible === 0 ? (
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center py-16"
        >
          <p className="text-kora-text font-semibold">Sin resultados</p>
          <p className="mt-1 text-sm text-kora-muted">
            No encontramos herramientas para “{query}”. Prueba otra palabra.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setGrupoActivo("Todas");
            }}
            className="btn-press mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary"
          >
            Ver todas
          </button>
        </motion.div>
      ) : (
        <div key={grupoActivo} className="space-y-12">
          {secciones.map((s) => (
            <section key={s.grupo} aria-labelledby={`grupo-${s.grupo}`}>
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex items-baseline justify-between gap-3 mb-4"
              >
                <h2
                  id={`grupo-${s.grupo}`}
                  className="text-lg font-bold text-kora-text tracking-tight"
                >
                  {s.grupo}
                </h2>
                <span className="text-xs text-kora-muted tabular-nums">
                  {s.items.length}
                </span>
              </motion.div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {s.items.map((h, i) => (
                  <Tarjeta key={h.slug} h={h} index={i} reduce={reduce} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
