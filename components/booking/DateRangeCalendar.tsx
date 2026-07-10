"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t, localeOf, type Lang } from "@/lib/booking/i18n";

interface Props {
  checkin: string; // "" = sin elegir
  checkout: string; // "" = eligiendo salida
  onChange: (checkin: string, checkout: string) => void;
  fullDates: string[]; // YYYY-MM-DD con TODO el hotel ocupado
  minNights: number;
  lang: Lang;
  // "Hoy" en la zona del hotel (lo pasa el padre para que SSR y cliente
  // coincidan; sin él, la celda de hoy podía diferir e hidratar mal).
  today?: string;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

interface MonthCell {
  iso: string;
  day: number;
}

function monthMatrix(year: number, month: number): (MonthCell | null)[] {
  const first = new Date(year, month, 1, 12);
  const cells: (MonthCell | null)[] = [];
  // Lunes como primer día de la semana (convención MX).
  const lead = (first.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cells.push(null);
  const cursor = new Date(first);
  while (cursor.getMonth() === month) {
    cells.push({ iso: toISO(cursor), day: cursor.getDate() });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

// Calendario de rango del motor: pinta en tiempo real las fechas con el hotel
// lleno (fullDates, del inventario del PMS) y respeta el mínimo de noches.
// La verdad final siempre la re-valida el servidor al buscar y al pagar.
export function DateRangeCalendar({ checkin, checkout, onChange, fullDates, minNights, lang, today: todayProp }: Props) {
  const today =
    todayProp || new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const full = useMemo(() => new Set(fullDates), [fullDates]);
  const locale = localeOf(lang);

  const [cursor, setCursor] = useState(() => {
    const base = checkin ? new Date(`${checkin}T12:00:00`) : new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const [hint, setHint] = useState("");

  const selectingEnd = Boolean(checkin) && !checkout;

  // Al elegir salida: tope = primera fecha llena DESPUÉS del check-in (una
  // estancia no puede cruzar una noche agotada).
  const endLimit = useMemo(() => {
    if (!selectingEnd) return null;
    let d = checkin;
    for (let i = 0; i < 370; i++) {
      if (full.has(d)) return d; // se puede salir ESTE día, pero no dormir esa noche
      d = addDays(d, 1);
    }
    return null;
  }, [selectingEnd, checkin, full]);

  function isDisabled(iso: string): boolean {
    if (iso < today) return true;
    if (selectingEnd) {
      if (iso <= checkin) return false; // clic re-inicia la selección, no se deshabilita
      if (iso < addDays(checkin, minNights)) return true;
      if (endLimit && iso > endLimit) return true;
      return false;
    }
    return full.has(iso); // no se puede llegar una noche agotada
  }

  function handleClick(iso: string) {
    setHint("");
    if (iso < today) return;
    if (selectingEnd && iso > checkin) {
      if (iso < addDays(checkin, minNights)) {
        setHint(t(lang, "minNochesAviso", { n: minNights }));
        return;
      }
      if (endLimit && iso > endLimit) return;
      onChange(checkin, iso);
      return;
    }
    // Inicia (o reinicia) la selección con la llegada.
    if (full.has(iso)) return;
    onChange(iso, "");
    setHint(t(lang, "seleccionaSalida"));
  }

  function inRange(iso: string): boolean {
    return Boolean(checkin && checkout && iso > checkin && iso < checkout);
  }

  const weekdays = useMemo(() => {
    // Lun..Dom localizados (7-dic-2026 es lunes).
    return Array.from({ length: 7 }, (_, i) =>
      new Date(2026, 11, 7 + i, 12).toLocaleDateString(locale, { weekday: "narrow" }),
    );
  }, [locale]);

  const canGoPrev = cursor.y > new Date().getFullYear() || cursor.m > new Date().getMonth();

  function renderMonth(offset: 0 | 1) {
    const m = (cursor.m + offset) % 12;
    const y = cursor.y + Math.floor((cursor.m + offset) / 12);
    const cells = monthMatrix(y, m);
    const title = new Date(y, m, 1, 12).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
    return (
      <div className={offset === 1 ? "hidden sm:block" : ""}>
        <p className="text-center text-sm font-bold capitalize">{title}</p>
        <div className="mt-2 grid grid-cols-7 gap-y-0.5 text-center">
          {weekdays.map((w, i) => (
            <span key={`w${i}`} className="text-[11px] font-semibold uppercase text-kora-muted" aria-hidden="true">
              {w}
            </span>
          ))}
          {cells.map((c, i) => {
            if (!c) return <span key={`e${i}`} />;
            const disabled = isDisabled(c.iso);
            const isStart = c.iso === checkin;
            const isEnd = c.iso === checkout;
            const range = inRange(c.iso);
            const soldOut = full.has(c.iso) && c.iso >= today;
            const label = new Date(`${c.iso}T12:00:00`).toLocaleDateString(locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            });
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => handleClick(c.iso)}
                disabled={disabled}
                aria-label={soldOut ? `${label} — ${t(lang, "leyendaNoDisponible")}` : label}
                aria-pressed={isStart || isEnd}
                className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums transition-colors ${
                  disabled ? "cursor-not-allowed" : "hover:ring-1 hover:ring-[var(--brand)]"
                }`}
                style={
                  isStart || isEnd
                    ? { background: "var(--brand)", color: "var(--brand-ink)", fontWeight: 700 }
                    : range
                      ? { background: "color-mix(in srgb, var(--brand) 14%, white)" }
                      : soldOut
                        ? { color: "#b91c1c", textDecoration: "line-through", opacity: 0.55 }
                        : disabled
                          ? { color: "#9ca3af", opacity: 0.5 }
                          : undefined
                }
              >
                {c.day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (!canGoPrev) return;
            setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
          }}
          disabled={!canGoPrev}
          aria-label={lang === "en" ? "Previous month" : "Mes anterior"}
          className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-xs font-semibold text-kora-muted" aria-live="polite">
          {!checkin
            ? t(lang, "seleccionaLlegada")
            : selectingEnd
              ? t(lang, "seleccionaSalida")
              : `${checkin} → ${checkout}`}
        </p>
        <button
          type="button"
          onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
          aria-label={lang === "en" ? "Next month" : "Mes siguiente"}
          className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {renderMonth(0)}
        {renderMonth(1)}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-kora-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-200" aria-hidden="true" />
          {t(lang, "leyendaNoDisponible")}
        </span>
        {(hint || minNights > 1) && (
          <span className="text-[11px] text-kora-muted" aria-live="polite">
            {hint || t(lang, "minNochesAviso", { n: minNights })}
          </span>
        )}
      </div>
    </div>
  );
}
