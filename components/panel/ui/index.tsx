"use client";

// Primitivas del panel: las piezas que se repetían escritas a mano en cada
// pantalla (cada una con sus propios grises, y varias que no cambiaban con el
// modo oscuro). Usan sólo tokens del panel (`kora-*`, `panel-*`, `--chip-*`), así
// que respetan la marca y el tema sin que la pantalla tenga que pensarlo.
//
// Movimiento según .agents/skills/emil-design-eng: sólo transform/opacity,
// ease-out, menos de 300 ms, y nada si el usuario pidió menos movimiento.

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Check, CircleAlert, Info, Loader2, RotateCcw } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Tarjeta de sección ──────────────────────────────────────────────────────
export function Tarjeta({
  titulo,
  descripcion,
  icono,
  accion,
  children,
  className,
  id,
}: {
  titulo?: ReactNode;
  descripcion?: ReactNode;
  icono?: ReactNode;
  accion?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cx("rounded-2xl border border-panel-border-soft bg-panel-surface p-5 sm:p-6", className)}
    >
      {(titulo || accion) && (
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {icono && (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-kora-primary/10 text-kora-primary" aria-hidden="true">
                {icono}
              </span>
            )}
            <div className="min-w-0">
              {titulo && <h2 className="text-base font-bold leading-tight text-kora-text">{titulo}</h2>}
              {descripcion && <p className="mt-1 text-sm leading-relaxed text-kora-muted">{descripcion}</p>}
            </div>
          </div>
          {accion && <div className="sm:shrink-0">{accion}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

// ── Campo de formulario: etiqueta, ayuda, error y contador ──────────────────
export function Campo({
  label,
  ayuda,
  error,
  max,
  valor,
  children,
  opcional,
}: {
  label: ReactNode;
  ayuda?: ReactNode;
  error?: string | null;
  /** Con `max` y `valor` se pinta el contador (el servidor recorta en silencio). */
  max?: number;
  valor?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  opcional?: boolean;
}) {
  const id = useId();
  const ayudaId = `${id}-ayuda`;
  const largo = valor?.length ?? 0;
  const cerca = max != null && largo > max * 0.9;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-kora-text">
          {label}
          {opcional && <span className="ml-1.5 text-xs font-normal text-kora-muted">(opcional)</span>}
        </label>
        {max != null && valor != null && (
          <span className={cx("text-[11px] tabular-nums", cerca ? "text-[var(--chip-aviso-text)]" : "text-kora-muted")}>
            {largo}/{max}
          </span>
        )}
      </div>
      {children({ id, "aria-describedby": ayuda || error ? ayudaId : undefined, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={ayudaId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-[var(--chip-mal-text)]">
          <CircleAlert size={13} className="mt-px shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : ayuda ? (
        <p id={ayudaId} className="mt-1.5 text-xs leading-relaxed text-kora-muted">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

// ── Interruptor ─────────────────────────────────────────────────────────────
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  tamano = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  tamano?: "md" | "lg";
}) {
  const lg = tamano === "lg";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50",
        lg ? "h-8 w-14" : "h-6 w-11",
        checked ? "bg-kora-primary" : "bg-panel-border",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none",
          lg ? "h-6 w-6" : "h-4 w-4",
          checked ? (lg ? "translate-x-7" : "translate-x-6") : "translate-x-1",
        )}
      />
    </button>
  );
}

// ── Pestañas (accesibles con teclado) ───────────────────────────────────────
export interface Pestana<T extends string> {
  id: T;
  label: string;
  icono?: ReactNode;
  /** Punto o número al lado (p. ej. cosas pendientes). */
  marca?: ReactNode;
}

export function Pestanas<T extends string>({
  items,
  activa,
  onChange,
  etiqueta,
}: {
  items: Pestana<T>[];
  activa: T;
  onChange: (id: T) => void;
  etiqueta: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const mover = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + items.length) % items.length;
    refs.current[j]?.focus();
    onChange(items[j].id);
  };
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((it, i) => {
        const sel = it.id === activa;
        return (
          <button
            key={it.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`tab-${it.id}`}
            aria-selected={sel}
            aria-controls={`panel-${it.id}`}
            tabIndex={sel ? 0 : -1}
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => mover(e, i)}
            className={cx(
              "btn-press inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              sel
                ? "bg-kora-primary text-white"
                : "text-kora-muted hover:bg-panel-contrast/5 hover:text-kora-text",
            )}
          >
            {it.icono && <span aria-hidden="true">{it.icono}</span>}
            {it.label}
            {it.marca}
          </button>
        );
      })}
    </div>
  );
}

// ── Indicador de guardado (uno solo para toda la pantalla) ──────────────────
export type EstadoGuardado = "idle" | "guardando" | "guardado" | "error";

export function IndicadorGuardado({ estado, onReintentar }: { estado: EstadoGuardado; onReintentar?: () => void }) {
  // En reposo no ocupa lugar (en móvil dejaba un hueco en el encabezado), pero la
  // región `aria-live` sigue ahí para anunciar el siguiente cambio.
  if (estado === "idle") return <div aria-live="polite" className="sr-only" />;
  return (
    <div aria-live="polite" className="flex min-h-[28px] items-center text-xs font-medium">
      {estado === "guardando" && (
        <span className="inline-flex items-center gap-1.5 text-kora-muted">
          <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Guardando…
        </span>
      )}
      {estado === "guardado" && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--chip-ok-bg)] px-2.5 py-1 text-[var(--chip-ok-text)]">
          <Check size={13} aria-hidden="true" /> Cambios guardados
        </span>
      )}
      {estado === "error" && (
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--chip-mal-bg)] px-2.5 py-1 text-[var(--chip-mal-text)]">
          <CircleAlert size={13} aria-hidden="true" /> No se pudo guardar
          {onReintentar && (
            <button type="button" onClick={onReintentar} className="inline-flex items-center gap-1 underline underline-offset-2">
              <RotateCcw size={12} aria-hidden="true" /> Reintentar
            </button>
          )}
        </span>
      )}
    </div>
  );
}

// ── Aviso en línea ──────────────────────────────────────────────────────────
type Tono = "info" | "ok" | "alerta" | "error";
const TONOS: Record<Tono, { caja: string; Icono: typeof Info }> = {
  info: { caja: "bg-[var(--chip-info-bg)] text-[var(--chip-info-text)]", Icono: Info },
  ok: { caja: "bg-[var(--chip-ok-bg)] text-[var(--chip-ok-text)]", Icono: Check },
  alerta: { caja: "bg-[var(--chip-aviso-bg)] text-[var(--chip-aviso-text)]", Icono: AlertTriangle },
  error: { caja: "bg-[var(--chip-mal-bg)] text-[var(--chip-mal-text)]", Icono: CircleAlert },
};

export function Aviso({
  tono = "info",
  titulo,
  children,
  accion,
  onCerrar,
}: {
  tono?: Tono;
  titulo?: ReactNode;
  children?: ReactNode;
  accion?: ReactNode;
  onCerrar?: () => void;
}) {
  const { caja, Icono } = TONOS[tono];
  return (
    <div role={tono === "error" ? "alert" : "status"} className={cx("flex items-start gap-3 rounded-xl px-4 py-3 text-sm", caja)}>
      <Icono size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={cx("leading-relaxed", Boolean(titulo) && "mt-0.5 opacity-90")}>{children}</div>}
        {accion && <div className="mt-2">{accion}</div>}
      </div>
      {onCerrar && (
        <button type="button" onClick={onCerrar} className="-m-1 rounded-full p-1 opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
          ×
        </button>
      )}
    </div>
  );
}

// ── Chips de selección (una o varias) ───────────────────────────────────────
export function Chips<T extends string>({
  opciones,
  seleccion,
  onChange,
  multiple,
  etiqueta,
  disabled,
}: {
  opciones: readonly { valor: T; label: string; detalle?: string }[];
  seleccion: T[];
  onChange: (v: T[]) => void;
  multiple?: boolean;
  etiqueta: string;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const on = seleccion.includes(o.valor);
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            title={o.detalle}
            onClick={() =>
              onChange(multiple ? (on ? seleccion.filter((x) => x !== o.valor) : [...seleccion, o.valor]) : [o.valor])
            }
            className={cx(
              "btn-press inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              on
                ? "border-kora-primary bg-kora-primary/10 text-kora-primary"
                : "border-panel-border text-kora-muted hover:border-kora-primary/40 hover:text-kora-text",
            )}
          >
            {on && <Check size={13} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Botones ─────────────────────────────────────────────────────────────────
export const btnPrimario =
  "btn-press inline-flex items-center justify-center gap-2 rounded-full bg-kora-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-kora-primary-dark disabled:cursor-not-allowed disabled:opacity-60";
export const btnSecundario =
  "btn-press inline-flex items-center justify-center gap-2 rounded-full border border-panel-border px-4 py-2 text-sm font-semibold text-kora-text transition-colors hover:border-kora-primary/50 disabled:cursor-not-allowed disabled:opacity-60";
export const btnSuave =
  "btn-press inline-flex items-center justify-center gap-1.5 rounded-full bg-kora-primary/10 px-3.5 py-1.5 text-sm font-semibold text-kora-primary transition-colors hover:bg-kora-primary/15 disabled:cursor-not-allowed disabled:opacity-60";

// ── Texto de WhatsApp: *negritas*, _cursivas_, saltos de línea y links ──────
//
// El chat de prueba pintaba los asteriscos tal cual: el hotelero veía "*Suite*"
// donde el huésped ve **Suite**.
export function TextoWhatsApp({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  return (
    <>
      {lineas.map((l, i) => (
        <span key={i}>
          {formatearLinea(l)}
          {i < lineas.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function formatearLinea(l: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /(https?:\/\/[^\s]+)|\*([^*\n]+)\*|_([^_\n]+)_/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(l))) {
    if (m.index > ultimo) partes.push(l.slice(ultimo, m.index));
    if (m[1]) {
      partes.push(
        <a key={k++} href={m[1]} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
          {m[1].length > 48 ? `${m[1].slice(0, 45)}…` : m[1]}
        </a>,
      );
    } else if (m[2]) partes.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[3]) partes.push(<em key={k++}>{m[3]}</em>);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < l.length) partes.push(l.slice(ultimo));
  return partes;
}
