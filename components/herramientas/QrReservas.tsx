"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowRight, Download, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

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

// Limpia el número a solo dígitos para wa.me
function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

export function QrReservas() {
  const [tipo, setTipo] = useState<"whatsapp" | "url">("whatsapp");
  const [numero, setNumero] = useState("");
  const [mensaje, setMensaje] = useState("Hola, quiero reservar una habitación");
  const [url, setUrl] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const destino =
    tipo === "whatsapp"
      ? numero
        ? `https://wa.me/${soloDigitos(numero)}${
            mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""
          }`
        : ""
      : url.trim();

  const valido = destino.length > 0;

  function descargar() {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const png = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = png;
    a.download = "qr-reservas.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Formulario */}
        <Reveal>
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-kora-text mb-4">
              ¿A dónde lleva tu QR?
            </h2>

            <div className="flex gap-2 mb-5" role="group">
              {[
                { id: "whatsapp", label: "WhatsApp" },
                { id: "url", label: "Página web" },
              ].map((o) => {
                const active = o.id === tipo;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setTipo(o.id as "whatsapp" | "url")}
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

            {tipo === "whatsapp" ? (
              <div className="space-y-4">
                <Campo label="Tu número de WhatsApp (con lada del país)">
                  <input
                    className={inputCls}
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="52 489 123 4567"
                  />
                </Campo>
                <Campo label="Mensaje que se escribe solo (opcional)">
                  <input
                    className={inputCls}
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Hola, quiero reservar una habitación"
                  />
                </Campo>
              </div>
            ) : (
              <Campo label="Dirección de tu página o reservaciones">
                <input
                  className={inputCls}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://tuhotel.com/reservar"
                />
              </Campo>
            )}

            <p className="mt-4 text-xs text-kora-muted leading-relaxed">
              Imprime el QR y ponlo en recepción, en las habitaciones, en tu tarjeta
              o en tus redes. Quien lo escanee llega directo a reservar contigo.
            </p>
          </div>
        </Reveal>

        {/* QR */}
        <Reveal delay={0.1}>
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm text-center">
            <div
              ref={wrapRef}
              className="inline-flex items-center justify-center p-4 rounded-2xl bg-white border border-gray-100"
            >
              {valido ? (
                <QRCodeCanvas
                  value={destino}
                  size={220}
                  bgColor="#FFFFFF"
                  fgColor="#1B4332"
                  level="M"
                  marginSize={2}
                />
              ) : (
                <div className="w-[220px] h-[220px] flex items-center justify-center text-sm text-kora-muted text-center px-6">
                  Llena los datos y aquí aparecerá tu QR
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={descargar}
              disabled={!valido}
              className="btn-press btn-fill mt-5 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} aria-hidden="true" />
              Descargar QR (PNG)
            </button>
          </div>
        </Reveal>
      </div>

      {/* CAPA 2 */}
      <Reveal>
        <div className="mt-10">
          <LeadCaptureTool
            herramienta="Generador de QR de reservas"
            title="¿Y si el QR llevara a tu propia página de reservas?"
            subtitle="Te enseñamos por WhatsApp cómo tener una página de reservas directas para que tu QR convierta sin pagar comisión."
            buttonText="Quiero saber más"
            hiddenFields={{ tipo_qr: tipo }}
          />
        </div>
      </Reveal>

      {/* CAPA 3 */}
      <Reveal>
        <div className="mt-10 rounded-2xl bg-kora-primary p-7 sm:p-9 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kora-accent/15 mb-4">
            <Sparkles size={14} className="text-kora-accent" aria-hidden="true" />
            <span className="text-xs font-bold text-kora-accent uppercase tracking-widest">
              Reservas directas
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Que tu QR lleve a reservar, no solo a preguntar
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Con Kora, ese QR puede llevar a tu propia página donde el huésped
            reserva y paga directo — y un agente de IA contesta sus dudas al
            instante. Cero comisión.
          </p>
          <a
            href="/#contacto?utm_source=qr-reservas"
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
