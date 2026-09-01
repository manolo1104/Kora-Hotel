"use client";

import { useState } from "react";
import { ArrowRight, Copy, Check, MessageCircle, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

function fmtMXN(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-MX") + " MXN";
}

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-kora-text mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Anticipo() {
  const [hotel, setHotel] = useState("");
  const [total, setTotal] = useState(2000);
  const [modo, setModo] = useState<"porcentaje" | "fijo">("porcentaje");
  const [valor, setValor] = useState(50);
  const [banco, setBanco] = useState("");
  const [titular, setTitular] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [limite, setLimite] = useState("");
  const [copiado, setCopiado] = useState(false);

  const anticipo =
    modo === "porcentaje"
      ? total * (Math.min(Math.max(valor, 0), 100) / 100)
      : Math.min(valor, total);
  const restante = Math.max(total - anticipo, 0);

  const limiteTxt = limite
    ? new Date(limite + "T00:00:00").toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
      })
    : "la fecha acordada";

  const mensaje = `¡Hola! Gracias por elegir ${hotel || "nuestro hotel"} 🏨

Para confirmar tu reservación te pedimos un anticipo${
    modo === "porcentaje" ? ` (${valor}% del total)` : ""
  }:

💰 Total de tu reservación: ${fmtMXN(total)}
✅ Anticipo para apartar: ${fmtMXN(anticipo)}
🔸 Resto al llegar: ${fmtMXN(restante)}

Datos para tu transferencia o depósito:
🏦 Banco: ${banco || "[banco]"}
👤 A nombre de: ${titular || "[titular de la cuenta]"}
🔢 Cuenta / CLABE: ${cuenta || "[número de cuenta o CLABE]"}

📅 Tienes hasta el ${limiteTxt} para realizar el anticipo y asegurar tu lugar.

En cuanto lo hagas, mándanos tu comprobante por aquí y te confirmamos. ¡Gracias! 🙌`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* noop */
    }
  }

  const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    mensaje
  )}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Formulario */}
        <Reveal>
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-kora-text mb-4">
              Datos del anticipo
            </h2>
            <div className="space-y-4">
              <Campo label="Nombre de tu hotel">
                <input
                  className={inputCls}
                  value={hotel}
                  onChange={(e) => setHotel(e.target.value)}
                  placeholder="Hotel Paraíso Encantado"
                />
              </Campo>
              <Campo label="Total de la reservación">
                <input
                  type="number"
                  min={0}
                  step={50}
                  className={inputCls}
                  value={total}
                  onChange={(e) => setTotal(Number(e.target.value))}
                />
              </Campo>

              <div>
                <span className="block text-sm font-semibold text-kora-text mb-1.5">
                  El anticipo es…
                </span>
                <div className="flex gap-2">
                  {[
                    { id: "porcentaje", label: "Porcentaje" },
                    { id: "fijo", label: "Monto fijo" },
                  ].map((o) => {
                    const active = o.id === modo;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setModo(o.id as "porcentaje" | "fijo")}
                        aria-pressed={active}
                        className={`btn-press flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          active
                            ? "bg-kora-primary text-white border-kora-primary"
                            : "bg-white text-kora-text border-gray-200 hover:border-kora-accent"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Campo label={modo === "porcentaje" ? "Porcentaje de anticipo (%)" : "Monto del anticipo"}>
                <input
                  type="number"
                  min={0}
                  step={modo === "porcentaje" ? 5 : 50}
                  className={inputCls}
                  value={valor}
                  onChange={(e) => setValor(Number(e.target.value))}
                />
              </Campo>

              <Campo label="Banco">
                <input
                  className={inputCls}
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  placeholder="BBVA"
                />
              </Campo>
              <Campo label="Titular de la cuenta">
                <input
                  className={inputCls}
                  value={titular}
                  onChange={(e) => setTitular(e.target.value)}
                  placeholder="Nombre completo o razón social"
                />
              </Campo>
              <Campo label="Cuenta o CLABE">
                <input
                  className={inputCls}
                  value={cuenta}
                  onChange={(e) => setCuenta(e.target.value)}
                  placeholder="CLABE de 18 dígitos"
                />
              </Campo>
              <Campo label="Fecha límite para el anticipo (opcional)">
                <input
                  type="date"
                  className={inputCls}
                  value={limite}
                  onChange={(e) => setLimite(e.target.value)}
                />
              </Campo>
            </div>
          </div>
        </Reveal>

        {/* Vista previa del mensaje */}
        <Reveal delay={0.1}>
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
              <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-3">
                Mensaje listo para enviar
              </p>
              <div className="rounded-xl bg-kora-bg p-4 text-sm text-kora-text leading-relaxed whitespace-pre-line">
                {mensaje}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={copiar}
                className="btn-press inline-flex items-center gap-2 px-5 py-3 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
              >
                {copiado ? <Check size={16} /> : <Copy size={16} />}
                {copiado ? "¡Copiado!" : "Copiar mensaje"}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press btn-fill inline-flex items-center gap-2 px-5 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                <MessageCircle size={16} aria-hidden="true" />
                Abrir en WhatsApp
              </a>
            </div>
          </div>
        </Reveal>
      </div>

      {/* CAPA 2 */}
      <Reveal>
        <div className="mt-10">
          <LeadCaptureTool
            herramienta="Generador de mensaje de anticipo"
            title="¿Y si el anticipo se cobrara solo?"
            subtitle="Te enseñamos por WhatsApp cómo Kora cobra el anticipo con un link de pago y confirma la reserva sin que persigas el comprobante."
            buttonText="Quiero saber más"
            hiddenFields={{ hotel: hotel || "—", total: fmtMXN(total) }}
          />
        </div>
      </Reveal>

      {/* CAPA 3 */}
      <Reveal>
        <div className="mt-10 rounded-2xl bg-kora-primary p-7 sm:p-9 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kora-accent/15 mb-4">
            <Sparkles size={14} className="text-kora-accent" aria-hidden="true" />
            <span className="text-xs font-bold text-kora-accent uppercase tracking-widest">
              Cobro de anticipo automático
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Deja de perseguir transferencias y comprobantes
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Con Kora, el agente de IA manda un link de pago, cobra el anticipo y
            confirma la reserva solo. Sin contar a mano, sin revisar capturas de
            pantalla, sin reservas que se caen.
          </p>
          <a
            href="/contacto?utm_source=anticipo"
            className="btn-press btn-arrow btn-fill mt-6 inline-flex items-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Ver cómo funciona Kora
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </Reveal>
    </div>
  );
}
