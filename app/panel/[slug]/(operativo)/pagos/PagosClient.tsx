"use client";

import { useEffect, useState } from "react";
import { CreditCard, CheckCircle2, Loader2, ExternalLink, AlertTriangle } from "lucide-react";

type Status = {
  connected: boolean;
  pendiente?: boolean;
  stripe?: boolean;
} | null;

export default function PagosClient({ rol, hotelNombre }: { rol: string; hotelNombre: string }) {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/panel/connect")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  async function conectar() {
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/panel/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "No se pudo iniciar la conexión.");
    } catch {
      setError("No se pudo iniciar la conexión.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <CreditCard className="text-[#1B4332]" size={26} />
        <h1 className="text-2xl font-bold text-[#1B2421]">Pagos en línea</h1>
      </div>
      <p className="text-gray-600 mb-6">
        Conecta tu cuenta para recibir los pagos de las reservas de <b>{hotelNombre}</b> directo a
        tu banco. El dinero llega a tu cuenta, no a Kora.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="animate-spin" size={18} /> Cargando estado…
        </div>
      ) : status?.stripe === false ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 flex gap-3">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm">
            Los pagos en línea aún no están activados en la plataforma. Mientras tanto, las reservas
            se completan por WhatsApp.
          </p>
        </div>
      ) : status?.connected ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-2 text-green-800 font-semibold">
            <CheckCircle2 size={20} /> Pagos conectados
          </div>
          <p className="text-sm text-green-700 mt-1">
            Tu cuenta está lista. Los huéspedes ya pueden pagar con tarjeta y el dinero llega a tu
            cuenta.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          {status?.pendiente && (
            <p className="text-sm text-amber-700 mb-3">
              Tu conexión quedó a medias. Continúa para terminar de verificar tu cuenta.
            </p>
          )}
          {rol !== "dueno" ? (
            <p className="text-sm text-gray-500">
              Solo el dueño del hotel puede conectar la cuenta de pagos.
            </p>
          ) : (
            <>
              <button
                onClick={conectar}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1B4332] px-5 py-3 text-white font-medium hover:bg-[#143026] disabled:opacity-60"
              >
                {connecting ? <Loader2 className="animate-spin" size={18} /> : <ExternalLink size={18} />}
                {status?.pendiente ? "Continuar conexión" : "Conectar pagos"}
              </button>
              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
              <p className="text-xs text-gray-400 mt-3">
                Te llevamos a Stripe (nuestro procesador de pagos) para verificar tu identidad y tu
                cuenta bancaria. Toma 2–3 minutos.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
