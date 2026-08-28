"use client";

// Editor "modificar antes de descargar": prefila el documento branded con los
// datos reales (marca del hotel + cotización/reserva), deja ajustar campos, y
// permite descargar/imprimir a PDF o el .html editable, y guardar los cambios
// (persisten en la columna doc). La vista previa se regenera en vivo.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer, Save, Check, Loader2, Plus, Trash2 } from "lucide-react";
import type { BookingBrand } from "@/lib/email/booking-branded";
import {
  buildCotizacionDoc,
  buildReservaDoc,
  type CotizacionDocData,
  type ReservaDocData,
  type DocConcepto,
} from "@/lib/docs/documento-branded";

type DocData = CotizacionDocData | ReservaDocData;

type Props = {
  kind: "cotizacion" | "reserva";
  slug: string;
  id: string;
  brand: BookingBrand;
  data: DocData;
};

const asRecord = (d: DocData) => d as unknown as Record<string, unknown>;

export default function DocumentoEditor({ kind, slug, id, brand, data }: Props) {
  const [d, setD] = useState<DocData>(data);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const esCotizacion = kind === "cotizacion";
  const seg = esCotizacion ? "cotizaciones" : "reservas";
  const volverHref = `/panel/${slug}/${seg}`;

  const html = useMemo(
    () =>
      esCotizacion
        ? buildCotizacionDoc(brand, d as CotizacionDocData, { forPrint: false })
        : buildReservaDoc(brand, d as ReservaDocData, { forPrint: false }),
    [d, brand, esCotizacion],
  );

  function buildFull(forPrint: boolean): string {
    return esCotizacion
      ? buildCotizacionDoc(brand, d as CotizacionDocData, { forPrint })
      : buildReservaDoc(brand, d as ReservaDocData, { forPrint });
  }

  const val = (k: string) => (asRecord(d)[k] as string) ?? "";
  const setField = (k: string, v: string) =>
    setD((prev) => ({ ...(asRecord(prev)), [k]: v }) as unknown as DocData);

  const conceptos = (asRecord(d).conceptos as DocConcepto[]) ?? [];
  const setConcepto = (i: number, key: keyof DocConcepto, v: string) =>
    setD((prev) => {
      const list = [...((asRecord(prev).conceptos as DocConcepto[]) ?? [])];
      list[i] = { ...list[i], [key]: v };
      return { ...(asRecord(prev)), conceptos: list } as unknown as DocData;
    });
  const addConcepto = () =>
    setD(
      (prev) =>
        ({
          ...(asRecord(prev)),
          conceptos: [
            ...((asRecord(prev).conceptos as DocConcepto[]) ?? []),
            { nombre: "", descripcion: "", cantidad: "", precio_unitario: "", importe: "" },
          ],
        }) as unknown as DocData,
    );
  const removeConcepto = (i: number) =>
    setD(
      (prev) =>
        ({
          ...(asRecord(prev)),
          conceptos: ((asRecord(prev).conceptos as DocConcepto[]) ?? []).filter((_, j) => j !== i),
        }) as unknown as DocData,
    );

  function imprimir() {
    const w = window.open("", "_blank");
    if (!w) {
      setAviso("Tu navegador bloqueó la ventana. Permite las ventanas emergentes para imprimir/guardar como PDF.");
      return;
    }
    w.document.open();
    w.document.write(buildFull(true));
    w.document.close();
  }

  function descargarHtml() {
    const blob = new Blob([buildFull(false)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${val("folio") || "documento"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      const res = await fetch(`/api/admin/${seg}/${id}/doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: d }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setGuardado(true);
        setTimeout(() => setGuardado(false), 2500);
      } else {
        setAviso(j.hint || j.error || "No se pudo guardar.");
      }
    } catch {
      setAviso("Error de red al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link
            href={volverHref}
            className="inline-flex items-center gap-1.5 text-sm text-kora-muted hover:text-kora-text"
          >
            <ArrowLeft size={15} /> Volver a {esCotizacion ? "cotizaciones" : "reservas"}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-kora-text tracking-tight">
            {esCotizacion ? "Cotización" : "Comprobante de reserva"} · {val("folio")}
          </h1>
          <p className="text-sm text-kora-muted">
            Ajusta lo que quieras y descárgalo como PDF. Se adapta a <strong>{brand.nombre}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={guardar}
            disabled={guardando}
            className="btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-panel-contrast/5 text-kora-text font-semibold text-sm hover:bg-panel-contrast/10 disabled:opacity-60"
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : guardado ? <Check size={15} /> : <Save size={15} />}
            {guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar cambios"}
          </button>
          <button
            onClick={descargarHtml}
            className="btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-panel-contrast/5 text-kora-text font-semibold text-sm hover:bg-panel-contrast/10"
          >
            <Download size={15} /> .html
          </button>
          <button
            onClick={imprimir}
            className="btn-press inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-kora-primary text-white font-semibold text-sm hover:bg-kora-primary-dark"
          >
            <Printer size={15} /> Descargar PDF
          </button>
        </div>
      </div>

      {aviso && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          {aviso}
        </div>
      )}

      <div className="mt-5 grid lg:grid-cols-2 gap-6 items-start">
        {/* Campos editables */}
        <div className="space-y-5">
          {esCotizacion ? (
            <Bloque titulo="Vigencia">
              <Campo label="Válida hasta">
                <input className="input-kora" value={val("valida_hasta")} onChange={(e) => setField("valida_hasta", e.target.value)} />
              </Campo>
            </Bloque>
          ) : (
            <Bloque titulo="Pago">
              <div className="grid sm:grid-cols-2 gap-3">
                <Campo label="Método de pago">
                  <input className="input-kora" value={val("metodo_pago")} placeholder="Tarjeta ···· 4242 / Efectivo / Transferencia" onChange={(e) => setField("metodo_pago", e.target.value)} />
                </Campo>
                <Campo label="Fecha de pago">
                  <input className="input-kora" value={val("fecha_pago")} onChange={(e) => setField("fecha_pago", e.target.value)} />
                </Campo>
              </div>
            </Bloque>
          )}

          <Bloque titulo="Conceptos">
            <div className="space-y-3">
              {conceptos.map((c, i) => (
                <div key={i} className="rounded-xl border border-panel-contrast/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input className="input-kora flex-1" placeholder="Concepto" value={c.nombre} onChange={(e) => setConcepto(i, "nombre", e.target.value)} />
                    <button onClick={() => removeConcepto(i)} className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-panel-contrast/5 text-red-500 hover:bg-panel-contrast/10" title="Quitar" aria-label="Quitar concepto">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <input className="input-kora text-sm" placeholder="Descripción" value={c.descripcion} onChange={(e) => setConcepto(i, "descripcion", e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">
                    <input className="input-kora text-sm" placeholder="Cantidad" value={c.cantidad} onChange={(e) => setConcepto(i, "cantidad", e.target.value)} />
                    <input className="input-kora text-sm" placeholder="P. unitario" value={c.precio_unitario} onChange={(e) => setConcepto(i, "precio_unitario", e.target.value)} />
                    <input className="input-kora text-sm" placeholder="Importe" value={c.importe} onChange={(e) => setConcepto(i, "importe", e.target.value)} />
                  </div>
                </div>
              ))}
              <button onClick={addConcepto} className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary hover:underline">
                <Plus size={14} /> Agregar concepto
              </button>
            </div>
          </Bloque>

          <Bloque titulo="Totales">
            <div className="grid sm:grid-cols-2 gap-3">
              {esCotizacion ? (
                <>
                  <Campo label="Subtotal"><input className="input-kora" value={val("subtotal")} onChange={(e) => setField("subtotal", e.target.value)} /></Campo>
                  <Campo label="Total"><input className="input-kora" value={val("total")} onChange={(e) => setField("total", e.target.value)} /></Campo>
                  <Campo label="Anticipo (%)"><input className="input-kora" value={val("anticipo_pct")} onChange={(e) => setField("anticipo_pct", e.target.value)} /></Campo>
                  <Campo label="Anticipo"><input className="input-kora" value={val("anticipo")} onChange={(e) => setField("anticipo", e.target.value)} /></Campo>
                  <Campo label="Saldo al llegar"><input className="input-kora" value={val("saldo")} onChange={(e) => setField("saldo", e.target.value)} /></Campo>
                </>
              ) : (
                <>
                  <Campo label="Total de la estancia"><input className="input-kora" value={val("total_estancia")} onChange={(e) => setField("total_estancia", e.target.value)} /></Campo>
                  <Campo label="Anticipo pagado"><input className="input-kora" value={val("anticipo_pagado")} onChange={(e) => setField("anticipo_pagado", e.target.value)} /></Campo>
                  <Campo label="Restante al llegar"><input className="input-kora" value={val("restante")} onChange={(e) => setField("restante", e.target.value)} /></Campo>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-kora-muted">Los totales no se recalculan solos: si cambias un concepto, ajústalos aquí.</p>
          </Bloque>

          {/* Datos del cliente y estancia (menos comunes → plegado) */}
          <details className="rounded-2xl border border-panel-contrast/10 bg-panel-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-kora-text">Cliente y estancia</summary>
            <div className="px-4 pb-4 space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <Campo label="Cliente"><input className="input-kora" value={val("cliente_nombre")} onChange={(e) => setField("cliente_nombre", e.target.value)} /></Campo>
                <Campo label="Email"><input className="input-kora" value={val("cliente_email")} onChange={(e) => setField("cliente_email", e.target.value)} /></Campo>
                <Campo label="Teléfono"><input className="input-kora" value={val("cliente_telefono")} onChange={(e) => setField("cliente_telefono", e.target.value)} /></Campo>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <Campo label="Habitación"><input className="input-kora" value={val("habitacion")} onChange={(e) => setField("habitacion", e.target.value)} /></Campo>
                <Campo label="Huéspedes"><input className="input-kora" value={val("huespedes")} onChange={(e) => setField("huespedes", e.target.value)} /></Campo>
                <Campo label="Noches"><input className="input-kora" value={val("noches")} onChange={(e) => setField("noches", e.target.value)} /></Campo>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Campo label="Entrada (detalle)"><input className="input-kora" value={val("entrada_detalle")} onChange={(e) => setField("entrada_detalle", e.target.value)} /></Campo>
                <Campo label="Salida (detalle)"><input className="input-kora" value={val("salida_detalle")} onChange={(e) => setField("salida_detalle", e.target.value)} /></Campo>
              </div>
            </div>
          </details>
        </div>

        {/* Vista previa en vivo */}
        <div className="lg:sticky lg:top-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-kora-muted mb-2">Vista previa</p>
          <div className="rounded-2xl border border-panel-contrast/10 overflow-hidden bg-[var(--line)]">
            <iframe title="Vista previa del documento" srcDoc={html} className="w-full" style={{ height: "760px", border: "0", background: "var(--line)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-panel-contrast/10 bg-panel-surface p-4 space-y-3">
      <h2 className="text-sm font-bold text-kora-text">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-kora-muted mb-1">{label}</span>
      {children}
    </label>
  );
}
