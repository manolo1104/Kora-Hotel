"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CircleAlert,
  ExternalLink,
  Filter,
  Mail,
  Search,
  UserPlus,
} from "lucide-react";
import { fechaCorta, money } from "./util";
import type {
  Alerta,
  CobrosHotelOps,
  HotelOps,
  Operaciones as Datos,
  SituacionHotel,
  TipoCamila,
} from "@/lib/crm/operaciones";
import { DIAS_SIN_RESERVAS_PAGANDO, VENTANA_DIAS, rutaFichaHotel } from "@/lib/crm/types";

// El puesto de mando del fundador. Responde tres preguntas, en este orden:
//   1. ¿Cómo va el negocio?            → las métricas y el embudo
//   2. ¿Qué requiere mi atención HOY?  → las alertas, cada una con su botón
//   3. ¿Qué pasa con cada hotel?       → la tabla, que lleva a la ficha
//
// Las alertas van ARRIBA de la tabla a propósito: una tabla de 30 hoteles no
// dice cuál se está por caer, y ese es el dato que hace ganar o perder dinero.
//
// Todo lo que viene de `lib/crm/operaciones.ts` es `import type`: ese archivo
// usa la service-role y un import de valor la metería en el navegador.

const SITUACION: Record<SituacionHotel, { label: string; clase: string }> = {
  pago: { label: "Pagando", clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cortesia: { label: "Cortesía", clase: "bg-sky-50 text-sky-700 border-sky-200" },
  prueba: { label: "En prueba", clase: "bg-amber-50 text-amber-700 border-amber-200" },
  prueba_vencida: { label: "Prueba vencida", clase: "bg-gray-100 text-gray-600 border-gray-200" },
  moroso: { label: "Cobro fallido", clase: "bg-red-50 text-red-700 border-red-200" },
  cancelada: { label: "Cancelada", clase: "bg-gray-100 text-gray-600 border-gray-200" },
  bloqueado: { label: "Bloqueado", clase: "bg-red-100 text-red-800 border-red-300" },
  demo: { label: "Demo", clase: "bg-violet-50 text-violet-700 border-violet-200" },
};

const SIN_SABER = { label: "Sin saber", clase: "bg-gray-50 text-gray-500 border-gray-200" };

// La etiqueta vieja decía «sin Stripe» cuando el hotel no tenía id de cuenta, y
// callaba justo el caso caro: la cuenta empezada que todavía no cobra, donde el
// dinero del motor cae en la cuenta de Kora.
const COBROS: Record<CobrosHotelOps, { label: string; clase: string; titulo: string }> = {
  listos: {
    label: "Listos",
    clase: "bg-emerald-50 text-emerald-700 border-emerald-200",
    titulo: "Su cuenta de Stripe ya puede cobrar: el dinero entra al hotel.",
  },
  "a-medias": {
    label: "Stripe a medias",
    clase: "bg-amber-50 text-amber-700 border-amber-200",
    titulo: "Empezó su cuenta de Stripe pero todavía no puede cobrar.",
  },
  "sin-cuenta": {
    label: "Sin cuenta",
    clase: "bg-gray-100 text-gray-600 border-gray-200",
    titulo: "Todavía no empieza su cuenta de Stripe.",
  },
};

const CAMILA: Record<TipoCamila, { label: string; clase: string }> = {
  conectada: { label: "Conectada", clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "por-vincular": { label: "Sin vincular", clase: "bg-amber-50 text-amber-700 border-amber-200" },
  caida: { label: "Caída", clase: "bg-red-50 text-red-700 border-red-200" },
  arrancando: { label: "Arrancando", clase: "bg-gray-100 text-gray-600 border-gray-200" },
  otro: { label: "Desconocido", clase: "bg-gray-100 text-gray-600 border-gray-200" },
};

const CHIP = "inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium";
const NO_LEIDO = "No se pudo leer";

type Filtro = "todos" | "pagando" | "prueba" | "riesgo" | "sin_estrenar";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pagando", label: "Pagando" },
  { id: "prueba", label: "En prueba" },
  { id: "riesgo", label: "En riesgo" },
  { id: "sin_estrenar", label: "Sin estrenar" },
];

/**
 * Lo que se sabe de las reservas. `leidas` = la consulta funcionó; `completas` =
 * además no se alcanzó el tope y los totales históricos son de verdad.
 *
 * Los dos hacen falta y no son lo mismo: «tiene 0 reservas en total» sólo se
 * puede afirmar con la lista ENTERA. Es la misma distinción que hace
 * `calcularAlertas` en lib/crm/operaciones.ts (`conReservas` / `conTotales`), y
 * si la pantalla no la hiciera, un hotel que sólo vendió antes del corte saldría
 * marcado «sin estrenar» y «en riesgo» por un cero que no es suyo.
 */
type Reservas = { leidas: boolean; completas: boolean };

/**
 * "En riesgo" es lo que se puede perder esta semana si nadie hace nada. Son los
 * mismos casos que levantan una alerta alta en lib/crm/operaciones.ts.
 */
function enRiesgo(h: HotelOps, r: Reservas): boolean {
  if (h.situacion === "moroso" || h.cancelaAlFinal) return true;
  if (h.situacion === "prueba" && (h.diasPrueba ?? 99) <= 7) return true;
  // `publicado`: la alerta de Camila tampoco sale sin publicar (ahí ya hay otra
  // alerta y Camila no arranca), así que la fila tampoco se pinta en rojo.
  if (
    (h.situacion === "pago" || h.situacion === "cortesia") &&
    h.publicado &&
    h.camila?.tipo === "caida" &&
    !h.botApagado
  ) {
    return true;
  }
  if (!r.leidas) return false;
  if (r.completas && h.situacion === "pago" && h.reservas.total === 0 && h.diasDeVida >= 7) return true;
  // Aunque la lista venga cortada, la más reciente sí se leyó (viene ordenada de
  // nueva a vieja): «hace N días que no vende» se puede afirmar igual.
  if (h.situacion === "pago" && h.reservas.total > 0 && diasDesde(h.reservas.ultima) >= DIAS_SIN_RESERVAS_PAGANDO) {
    return true;
  }
  return false;
}

function sinEstrenar(h: HotelOps, r: Reservas): boolean {
  return r.completas && h.reservas.total === 0 && !h.demo;
}

function diasDesde(iso: string | null): number {
  return iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : 0;
}

function haceCuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const d = diasDesde(iso);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} d`;
  const m = Math.floor(d / 30);
  return `hace ${m} mes${m === 1 ? "" : "es"}`;
}

/** Un número que puede no haberse leído: «—» con la explicación, nunca un 0. */
function Cifra({ n, formato }: { n: number | null; formato?: (n: number) => string }) {
  if (n === null) {
    return (
      <span title={NO_LEIDO} className="text-kora-muted">
        —
      </span>
    );
  }
  return <>{formato ? formato(n) : n.toLocaleString("es-MX")}</>;
}

const tarjeta = "rounded-2xl border border-gray-100 bg-white p-4";

export function Operaciones({ datos }: { datos: Datos }) {
  const {
    metricas: m,
    mrr,
    alertas,
    hoteles,
    embudo,
    notaEmbudo,
    registradosSinHotel,
    lecturas,
    origenesSuscriptores,
    fallos,
    pendientes,
  } = datos;
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");
  const reservasLeidas = lecturas.reservas;
  const reservas: Reservas = useMemo(
    () => ({ leidas: lecturas.reservas, completas: lecturas.reservas && !datos.reservasRecortadas }),
    [lecturas.reservas, datos.reservasRecortadas],
  );

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return hoteles
      .filter((h) => {
        if (filtro === "pagando" && h.situacion !== "pago") return false;
        if (filtro === "prueba" && h.situacion !== "prueba") return false;
        if (filtro === "riesgo" && !enRiesgo(h, reservas)) return false;
        if (filtro === "sin_estrenar" && !sinEstrenar(h, reservas)) return false;
        if (!needle) return true;
        return (
          h.nombre.toLowerCase().includes(needle) ||
          h.slug.toLowerCase().includes(needle) ||
          (h.ownerEmail ?? "").toLowerCase().includes(needle)
        );
      })
      // Lo que puede doler primero; dentro de eso, quien más mueve.
      .sort((a, b) => {
        const ra = enRiesgo(a, reservas) ? 0 : 1;
        const rb = enRiesgo(b, reservas) ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return b.reservas.recientes - a.reservas.recientes;
      });
  }, [hoteles, filtro, q, reservas]);

  const conteo = (f: Filtro): number => {
    if (f === "todos") return hoteles.length;
    if (f === "pagando") return m.pago;
    if (f === "prueba") return m.prueba;
    if (f === "riesgo") return hoteles.filter((h) => enRiesgo(h, reservas)).length;
    return hoteles.filter((h) => sinEstrenar(h, reservas)).length;
  };

  // Lo que se cuenta hotel por hotel sale 0 si los hoteles no se leyeron, y lo
  // que depende del plan sale 0 si los planes no se leyeron: los dos son ceros
  // falsos y se pintan «—». Antes, con la consulta de hoteles rota, estas
  // tarjetas decían «0 cobros fallidos» debajo de la banda roja.
  const hotelesLeidos = lecturas.hoteles;
  const planesLeidos = hotelesLeidos && lecturas.suscripciones;
  const porHotel = (n: number) => (hotelesLeidos ? n : null);
  const porPlan = (n: number) => (planesLeidos ? n : null);

  // Lo que ya se calculaba y no se veía. Cada una lleva adonde se atiende.
  const secundarias: { label: string; n: number | null; href?: string; alerta?: boolean; titulo?: string }[] = [
    { label: "Cobro fallido", n: porPlan(m.morosos), alerta: planesLeidos && m.morosos > 0 },
    { label: "Bloqueados", n: porHotel(m.bloqueados), href: "/crm/hoteles" },
    { label: "Cancelados", n: porPlan(m.canceladas) },
    { label: "Sin ninguna reserva", n: reservasLeidas ? porHotel(m.sinNingunaReserva) : null },
    {
      label: "Motor en modo prueba",
      n: m.modoPrueba,
      titulo: "En prueba y sin cobros de Stripe listos: sus reservas se simulan.",
    },
    { label: "Leads nuevos", n: m.leadsNuevos, href: "/crm/leads" },
    { label: "Leads activos", n: m.leadsActivos, href: "/crm/leads" },
    {
      label: m.chatsSinAtender ? "Chats escalados por atender" : "Chats escalados (7 d)",
      n: m.chatsEscalados,
      // Igual que la alerta: sin `?pestana=chats` la bandeja abre en «Alertas»
      // en cuanto haya una sola alerta pendiente, y los chats no se ven.
      href: "/crm/bandeja?pestana=chats",
      alerta: (m.chatsEscalados ?? 0) > 0,
    },
  ];

  const baseEmbudo = embudo[0]?.n ?? null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Datos que no se pudieron leer ─────────────────────────────────
          Va lo PRIMERO y en rojo: si algo falló, todos los números de abajo
          están mal y hay que saberlo antes de leerlos, no después. */}
      {fallos.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-800">
            <CircleAlert className="h-4 w-4" /> Esta pantalla está incompleta
          </p>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {fallos.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── SQL sin correr ────────────────────────────────────────────────
          En gris, no en rojo: no es una avería, es un paso de instalación. Si
          esto pintara la banda roja, estaría encendida siempre y la banda roja
          dejaría de significar algo. */}
      {pendientes.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-kora-text">Falta terminar de instalar</p>
          <ul className="mt-2 space-y-1 text-sm text-kora-muted">
            {pendientes.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Cómo va el negocio ────────────────────────────────────────── */}
      <section>
        <h1 className="text-lg font-bold tracking-tight text-kora-text">Operaciones</h1>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <div className={`${tarjeta} col-span-2 lg:col-span-1`}>
            <div className="text-xs text-kora-muted">
              MRR {mrr.fuente === "estimado" && <span className="font-semibold text-amber-700">· estimado</span>}
            </div>
            <div className="text-2xl font-bold text-kora-text">
              <Cifra n={mrr.mrr} formato={money} />
            </div>
            <div className="mt-1 space-y-0.5 text-xs text-kora-muted">
              {mrr.fuente === "stripe" && (
                <>
                  <p>
                    {mrr.pagando} cobrando en Stripe
                    {mrr.cortesia > 0 && ` · ${mrr.cortesia} de cortesía ($0)`}
                  </p>
                  {(mrr.enPruebaConTarjeta ?? 0) > 0 && (
                    <p>
                      {mrr.enPruebaConTarjeta} en prueba con tarjeta ({money(mrr.mrrEnPrueba)} al mes cuando
                      paguen, no suman)
                    </p>
                  )}
                  {mrr.sinMonto > 0 && (
                    <p className="text-amber-700">
                      {mrr.sinMonto} cobrando sin un monto en pesos legible: no suman
                    </p>
                  )}
                  {mrr.enStripeSinFila > 0 && (
                    <p className="text-amber-700">
                      {mrr.enStripeSinFila} activa{mrr.enStripeSinFila === 1 ? "" : "s"} en Stripe que Kora no
                      tiene registrada{mrr.enStripeSinFila === 1 ? "" : "s"}: no suman
                    </p>
                  )}
                  {mrr.enKoraSinCobro > 0 && (
                    <p className="text-amber-700">
                      {mrr.enKoraSinCobro} con plan activo en Kora que Stripe no está cobrando: no suman
                    </p>
                  )}
                  {mrr.motivo && <p className="text-amber-700">Ojo: {mrr.motivo}.</p>}
                  <p>Precio de lista: no descuenta cupones.</p>
                </>
              )}
              {mrr.fuente === "estimado" && (
                <p className="text-amber-700">
                  {mrr.pagando} con plan activo × precio del plan. Stripe no se pudo leer ({mrr.motivo}): cuenta
                  como pagando a quien sigue en prueba con tarjeta.
                  {mrr.cortesia > 0 && ` ${mrr.cortesia} de cortesía no suman.`}
                </p>
              )}
              {mrr.fuente === "sin-datos" && <p className="text-red-700">{NO_LEIDO}: {mrr.motivo}.</p>}
            </div>
          </div>
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">Hoteles</div>
            <div className="text-2xl font-bold text-kora-text">
              <Cifra n={porHotel(m.hoteles)} />
            </div>
            <div className="mt-1 text-xs text-kora-muted">
              {!hotelesLeidos ? (
                NO_LEIDO
              ) : !lecturas.suscripciones ? (
                <span className="text-red-700">No se pudo leer el plan de cada dueño</span>
              ) : (
                <>
                  {m.pago} pagando
                  {m.pagoEnPruebaStripe > 0 && ` (${m.pagoEnPruebaStripe} con tarjeta, aún en prueba)`} ·{" "}
                  {m.cortesia} cortesía · {m.prueba} en prueba · {m.pruebaVencida} vencidas
                  {/* Los demo son de Kora, no clientes. Sin enseñarlos, el total de
                      arriba salía más grande que este desglose sin explicación. */}
                  {m.demo > 0 && ` · ${m.demo} demo`}
                  {m.sinSaber > 0 && <span className="text-red-700"> · {m.sinSaber} sin saber</span>}
                </>
              )}
            </div>
          </div>
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">Reservas ({VENTANA_DIAS} días)</div>
            <div className="text-2xl font-bold text-kora-text">
              <Cifra n={lecturas.reservas ? porHotel(m.reservasRecientes) : null} />
            </div>
            <div className="mt-1 text-xs text-kora-muted">
              {lecturas.reservas && hotelesLeidos
                ? `${money(m.gmvReciente)} movidos · ${m.reservasTotal} históricas`
                : NO_LEIDO}
            </div>
          </div>
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">Registros (7 días)</div>
            <div className="text-2xl font-bold text-kora-text">
              <Cifra n={m.registros7d} />
            </div>
            <div className="mt-1 text-xs text-kora-muted">
              {m.registros30d === null ? (
                NO_LEIDO
              ) : (
                <>
                  {m.registros30d} en {VENTANA_DIAS} días · {m.cuentas} cuentas en total
                </>
              )}
            </div>
          </div>
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">Mensajes de Camila ({VENTANA_DIAS} días)</div>
            <div className="text-2xl font-bold text-kora-text">
              <Cifra n={m.mensajesCamila30d} />
            </div>
            <div className="mt-1 text-xs text-kora-muted">
              {m.mensajesCamila30d === null ? (
                NO_LEIDO
              ) : (
                <>
                  De {m.hotelesEnPrepago} hotel{m.hotelesEnPrepago === 1 ? "" : "es"} en el prepago
                  {m.mensajesCamilaIncompleto && <span className="text-red-700"> · faltan hoteles por contar</span>}
                </>
              )}
            </div>
          </div>
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">Lista de correo</div>
            <div className="text-2xl font-bold text-kora-text">
              <Cifra n={m.suscriptoresActivos} />
            </div>
            <div className="mt-1 text-xs text-kora-muted">
              {m.suscriptoresNuevos7d === null ? (
                NO_LEIDO
              ) : (
                <>
                  +{m.suscriptoresNuevos7d} en 7 días
                  {(m.bajas ?? 0) > 0 && ` · ${m.bajas} baja${m.bajas === 1 ? "" : "s"}`}
                </>
              )}
            </div>
          </div>
        </div>

        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {secundarias.map((s) => {
            const cuerpo = (
              <>
                <span className="block text-[11px] leading-tight text-kora-muted">{s.label}</span>
                <span
                  className={`mt-0.5 block text-lg font-bold tabular-nums ${
                    s.alerta ? "text-red-600" : "text-kora-text"
                  }`}
                >
                  <Cifra n={s.n} />
                </span>
              </>
            );
            const clase = "block h-full rounded-xl border border-gray-100 bg-white px-3 py-2";
            return (
              <li key={s.label} title={s.titulo}>
                {s.href ? (
                  <Link href={s.href} className={`${clase} hover:border-kora-primary/40`}>
                    {cuerpo}
                  </Link>
                ) : (
                  <div className={clase}>{cuerpo}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Lo que requiere atención ──────────────────────────────────── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-kora-text">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Requiere tu atención
          {alertas.length > 0 && (
            <span className="rounded-full bg-kora-text px-2 py-0.5 text-[11px] font-semibold text-white">
              {alertas.length}
            </span>
          )}
        </h2>

        {alertas.length === 0 ? (
          <div className={`${tarjeta} text-sm text-kora-muted`}>
            Nada urgente hoy. Ningún cobro fallido, ninguna prueba por vencer y
            ningún hotel de pago sin estrenar.
            {/* También con `pendientes`: sin el servidor de Camila configurado, o
                sin el SQL de cobros o del prepago, las alertas de esas cosas NO se
                calculan y el silencio aquí no significa que no haya nada. Mirando
                sólo `fallos`, «nada urgente hoy» se afirmaba a secas. */}
            {(fallos.length > 0 || pendientes.length > 0) &&
              " Ojo: arriba hay datos que no se pudieron leer, y ahí puede esconderse algo."}
          </div>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a) => (
              <FilaAlerta key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>

      {/* ── Embudo de alta ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-kora-text">
          <Filter className="h-4 w-4 text-kora-muted" />
          Embudo de alta
        </h2>
        <div className={tarjeta}>
          <ol className="space-y-4">
            {embudo.map((p, i) => {
              const ancho =
                p.n !== null && baseEmbudo ? Math.min(100, Math.round((p.n / baseEmbudo) * 100)) : 0;
              return (
                <li key={p.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-semibold text-kora-text">
                      {i + 1}. {p.titulo}
                    </span>
                    <span className="text-sm tabular-nums text-kora-text">
                      <span className="font-bold">
                        <Cifra n={p.n} />
                      </span>
                      {p.pct !== null && (
                        <span className={`ml-2 text-xs ${p.pct > 100 ? "text-amber-700" : "text-kora-muted"}`}>
                          {p.pct}% del paso anterior
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-gray-100">
                    <span className="block h-full rounded-full bg-kora-accent" style={{ width: `${ancho}%` }} />
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-kora-muted">{p.criterio}</p>
                  {p.nota && (
                    <p className={`mt-0.5 text-xs ${p.n === null ? "text-red-700" : "text-amber-700"}`}>{p.nota}</p>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-4 border-t border-gray-100 pt-3 text-xs leading-relaxed text-kora-muted">{notaEmbudo}</p>
        </div>
      </section>

      {/* ── Registrados sin hotel ───────────────────────────────────────── */}
      <RegistradosSinHotel lista={registradosSinHotel} />

      {/* ── Los hoteles ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-kora-text">
            Hoteles <span className="font-normal text-kora-muted">({visibles.length})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filtro === f.id
                    ? "border-kora-primary bg-kora-primary text-white"
                    : "border-gray-200 bg-white text-kora-muted hover:text-kora-text"
                }`}
              >
                {f.label} <span className="opacity-60">{conteo(f.id)}</span>
              </button>
            ))}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kora-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar hotel o correo"
                className="w-52 rounded-full border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-kora-text placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-kora-muted">
                <th className="px-4 py-3 font-medium">Hotel</th>
                <th className="px-4 py-3 font-medium">Situación</th>
                <th className="px-4 py-3 font-medium">Cobros</th>
                <th className="px-4 py-3 font-medium">Camila</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
                <th className="px-4 py-3 text-right font-medium">Reservas {VENTANA_DIAS}d</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Movido ({VENTANA_DIAS}d)</th>
                <th className="px-4 py-3 font-medium">Última reserva</th>
                <th className="px-4 py-3 font-medium">Alta</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((h) => {
                const s = h.situacion ? SITUACION[h.situacion] : SIN_SABER;
                const riesgo = enRiesgo(h, reservas);
                return (
                  <tr
                    key={h.id}
                    className={`border-b border-gray-50 last:border-0 ${riesgo ? "bg-red-50/30" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-semibold text-kora-text">
                        <Link href={rutaFichaHotel(h.slug)} className="hover:text-kora-primary hover:underline">
                          {h.nombre}
                        </Link>
                        {!h.publicado && !h.demo && (
                          <span
                            title="Sin publicar: no puede cobrar"
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                          >
                            sin publicar
                          </span>
                        )}
                        {h.situacion === "bloqueado" && (
                          <Ban className="h-3.5 w-3.5 text-red-600" aria-label="Bloqueado" />
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-kora-muted">
                        {h.ownerEmail ?? (lecturas.usuarios ? "sin correo" : "correo sin leer")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`${CHIP} ${s.clase}`}
                        title={h.situacion ? undefined : "No se pudo leer el plan del dueño"}
                      >
                        {s.label}
                        {h.diasPrueba !== null && ` · ${h.diasPrueba} d`}
                      </span>
                      {h.situacion === "pago" && h.stripe?.status === "trialing" && (
                        <div className="mt-1 text-[11px] font-medium text-amber-700">
                          con tarjeta, en prueba{h.stripe.trialEnd ? ` hasta el ${fechaCorta(h.stripe.trialEnd)}` : ""}
                        </div>
                      )}
                      {h.cancelaAlFinal && (
                        <div className="mt-1 text-[11px] font-medium text-red-600">cancela al final</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {h.demo ? (
                        <span className="text-xs text-kora-muted">—</span>
                      ) : h.cobros === null ? (
                        <span className={`${CHIP} bg-gray-50 text-gray-500 border-gray-200`} title={NO_LEIDO}>
                          ?
                        </span>
                      ) : (
                        <span className={`${CHIP} ${COBROS[h.cobros].clase}`} title={COBROS[h.cobros].titulo}>
                          {COBROS[h.cobros].label}
                        </span>
                      )}
                      {h.modoPrueba === true && (
                        <div
                          className="mt-1 text-[11px] font-medium text-amber-700"
                          title="Sus reservas se simulan: no llega nada a Stripe."
                        >
                          motor en modo prueba
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoCamila h={h} leida={lecturas.camila} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      {!lecturas.saldo ? (
                        <span className="text-kora-muted" title={NO_LEIDO}>
                          ?
                        </span>
                      ) : h.saldo ? (
                        <span
                          className={h.saldo.mensajes <= 0 ? "font-semibold text-red-600" : "text-kora-text"}
                          title={
                            h.saldo.consumo30d === null
                              ? "No se pudo contar su consumo"
                              : `${h.saldo.consumo30d} mensajes en ${VENTANA_DIAS} días`
                          }
                        >
                          {h.saldo.mensajes.toLocaleString("es-MX")} msj
                        </span>
                      ) : (
                        <span
                          className="text-kora-muted"
                          title="Fuera del prepago: a Camila no se le calla por saldo"
                        >
                          fuera
                        </span>
                      )}
                    </td>
                    {reservasLeidas ? (
                      <>
                        <td className="px-4 py-3 text-right tabular-nums text-kora-text">
                          {h.reservas.recientes}
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums ${
                            h.reservas.total === 0 ? "font-semibold text-red-600" : "text-kora-muted"
                          }`}
                        >
                          {h.reservas.total}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-kora-muted">
                          {h.reservas.gmvReciente > 0 ? money(h.reservas.gmvReciente) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-kora-muted">
                          {haceCuanto(h.reservas.ultima)}
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} className="px-4 py-3 text-center text-xs text-kora-muted" title={NO_LEIDO}>
                        reservas sin leer
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-kora-muted">{h.diasDeVida} d</td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/h/${h.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir el sitio del hotel"
                        className="inline-flex text-kora-muted hover:text-kora-primary"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-kora-muted">
                    {!hotelesLeidos
                      ? "No se pudieron leer los hoteles. No es que no haya ninguno."
                      : hoteles.length === 0
                        ? "Todavía no hay hoteles."
                        : "Ningún hotel con ese filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-kora-muted">
          El nombre abre la ficha del hotel, donde están sus botones. Las reservas canceladas y las
          reembolsadas cuentan como uso del producto, pero no suman al dinero movido. «Cobros» es el último
          dato que mandó Stripe.
        </p>
      </section>

      {/* ── De dónde salen los suscriptores ───────────────────────────── */}
      {origenesSuscriptores.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-kora-text">
            <Mail className="h-4 w-4 text-kora-muted" />
            Qué superficie capta correos
          </h2>
          <div className={tarjeta}>
            <ul className="space-y-2">
              {origenesSuscriptores.map((o) => {
                const total = m.suscriptoresActivos ?? 0;
                const pct = total ? Math.round((o.n / total) * 100) : 0;
                return (
                  <li key={o.origen} className="flex items-center gap-3">
                    <span className="w-28 flex-shrink-0 truncate text-xs text-kora-muted">
                      {o.origen}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span
                        className="block h-full rounded-full bg-kora-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-16 flex-shrink-0 text-right text-xs tabular-nums text-kora-text">
                      {o.n} <span className="text-kora-muted">({pct}%)</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-kora-muted">
              Los artículos y las herramientas se agrupan por familia. Si una
              superficie no aparece, todavía no ha captado a nadie.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

function FilaAlerta({ a }: { a: Alerta }) {
  const boton =
    "inline-flex flex-shrink-0 items-center gap-1 rounded-xl border border-kora-primary/30 bg-white px-3 py-1.5 text-xs font-semibold text-kora-primary transition-colors hover:bg-kora-primary hover:text-white";
  return (
    <li
      className={`rounded-2xl border p-4 ${
        a.severidad === "alta" ? "border-red-200 bg-red-50/60" : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-kora-text">{a.titulo}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-kora-muted">{a.detalle}</p>
        </div>
        {/* Un ancla de esta misma página va con <a>: <Link> no hace nada útil
            con un «#» y en algunos navegadores no desplaza. */}
        {a.href.startsWith("#") ? (
          <a href={a.href} className={`${boton} self-start`}>
            {a.accion} <ArrowUpRight className="h-3 w-3" />
          </a>
        ) : (
          <Link href={a.href} className={`${boton} self-start`}>
            {a.accion} <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </li>
  );
}

function EstadoCamila({ h, leida }: { h: HotelOps; leida: boolean }) {
  if (h.demo) return <span className="text-xs text-kora-muted">—</span>;
  if (!leida) {
    return (
      <span className={`${CHIP} bg-gray-50 text-gray-500 border-gray-200`} title={NO_LEIDO}>
        ?
      </span>
    );
  }
  if (!h.camila) {
    // El servidor de Camila no tiene a este hotel. No es una avería por sí sola:
    // no arranca sin publicar, sin acceso o si el hotelero la apagó.
    return (
      <span
        className={`${CHIP} bg-gray-100 text-gray-600 border-gray-200`}
        title={
          h.botApagado
            ? "El hotelero apagó a Camila desde su panel."
            : "El servidor de Camila no tiene a este hotel: sin publicar, sin acceso o todavía no le toca."
        }
      >
        {h.botApagado ? "Apagada" : "Sin arrancar"}
      </span>
    );
  }
  const c = CAMILA[h.camila.tipo];
  return (
    <span className={`${CHIP} ${c.clase}`} title={h.camila.tipo === "otro" ? `El servidor dice «${h.camila.status}»` : undefined}>
      {c.label}
    </span>
  );
}

const LIMITE_REGISTRADOS = 20;

function RegistradosSinHotel({ lista }: { lista: Datos["registradosSinHotel"] }) {
  const [todos, setTodos] = useState(false);
  const visibles = lista ? (todos ? lista : lista.slice(0, LIMITE_REGISTRADOS)) : [];

  return (
    <section id="registrados-sin-hotel" className="scroll-mt-20">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-kora-text">
        <UserPlus className="h-4 w-4 text-kora-muted" />
        Registrados sin hotel
        {lista && <span className="font-normal text-kora-muted">({lista.length})</span>}
      </h2>
      <p className="mb-3 text-xs text-kora-muted">
        Crearon su cuenta y no llegaron a crear su hotel. No aparecen en los leads ni les llega ningún aviso: si
        nadie les escribe, se pierden. No incluye al personal que cada hotel da de alta.
      </p>

      {lista === null ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo leer esta lista (mira la banda roja de arriba). No es que no haya nadie.
        </div>
      ) : lista.length === 0 ? (
        <div className={`${tarjeta} text-sm text-kora-muted`}>Nadie: todas las cuentas tienen su hotel.</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-kora-muted">
                  <th className="px-4 py-3 font-medium">Correo</th>
                  <th className="px-4 py-3 font-medium">Se registró</th>
                  <th className="px-4 py-3 font-medium">Confirmó su correo</th>
                  <th className="px-4 py-3 font-medium">Último acceso</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-kora-text">{r.email ?? "sin correo"}</div>
                      {r.estadoPlan && (
                        <div className="mt-0.5 text-[11px] font-medium text-amber-700">
                          ya tiene plan ({r.estadoPlan === "cortesia" ? "cortesía" : r.estadoPlan.replace("_", " ")})
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-kora-muted">
                      {fechaCorta(r.creado)} · {haceCuanto(r.creado)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.correoConfirmado ? (
                        <span className="text-emerald-700">Sí</span>
                      ) : (
                        <span className="font-semibold text-amber-700">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-kora-muted">
                      {r.ultimoAcceso ? haceCuanto(r.ultimoAcceso) : "nunca entró"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {/* Sólo correo: el registro no pide teléfono, así que no hay
                          WhatsApp al que escribirle. */}
                      {r.email && (
                        <a
                          href={`mailto:${r.email}?subject=${encodeURIComponent("Tu cuenta en Kora")}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-kora-primary/30 px-3 py-1.5 text-xs font-semibold text-kora-primary transition-colors hover:bg-kora-primary hover:text-white"
                        >
                          <Mail className="h-3.5 w-3.5" /> Escribirle
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lista.length > LIMITE_REGISTRADOS && (
            <button
              onClick={() => setTodos((t) => !t)}
              className="mt-2 text-xs font-semibold text-kora-primary hover:underline"
            >
              {todos ? "Ver sólo los más recientes" : `Ver los ${lista.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
