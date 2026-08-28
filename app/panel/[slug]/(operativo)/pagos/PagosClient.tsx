"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Banknote,
  Store,
  ShieldCheck,
  CalendarClock,
} from "lucide-react";

interface Payout {
  amount: number;
  currency: string;
  arrivalDate: string;
  status: string;
}

interface Payment {
  created: string;
  availableOn: string; // fecha estimada de llegada al banco
  gross: number;
  fee: number;
  net: number;
  currency: string;
  status: string; // 'available' (ya depositable) | 'pending' (en camino)
}

type Status = {
  connected: boolean;
  pendiente?: boolean;
  stripe?: boolean;
  status?: "pendiente" | "verificado" | "requiere_info";
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  oxxoEnabled?: boolean;
  requirementsDue?: number;
  dashboardUrl?: string | null;
  balance?: { available: number; pending: number; currency: string } | null;
  payments?: Payment[];
  payouts?: Payout[];
} | null;

const PAYOUT_STATUS: Record<string, string> = {
  paid: "Depositado",
  pending: "En camino",
  in_transit: "En camino",
  canceled: "Cancelado",
  failed: "Falló",
};

function fmtMonto(p: Payout): string {
  return `$${p.amount.toLocaleString("es-MX")} ${p.currency}`;
}

function money(n: number, currency = "MXN"): string {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

function fmtFecha(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

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
      <p className="text-kora-muted mb-6">
        Conecta tu cuenta para recibir los pagos de las reservas de <b>{hotelNombre}</b> directo a
        tu banco. El dinero llega a tu cuenta, no a Kora — sin comisión por reserva.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-kora-muted">
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
        <div className="space-y-4">
          {/* Estado de la cuenta */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <div className="flex items-center gap-2 text-green-800 font-semibold">
              <CheckCircle2 size={20} /> Pagos conectados
            </div>
            <p className="text-sm text-green-700 mt-1">
              Tu cuenta está verificada. Los pagos de tus reservas entran directo a tu cuenta y
              Stripe los deposita a tu banco automáticamente.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-panel-surface px-3 py-1 text-xs font-semibold text-green-800 border border-green-200">
                <ShieldCheck size={13} /> Cobros activos
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full bg-panel-surface px-3 py-1 text-xs font-semibold border ${
                  status.payoutsEnabled
                    ? "text-green-800 border-green-200"
                    : "text-amber-700 border-amber-200"
                }`}
              >
                <Banknote size={13} />
                {status.payoutsEnabled ? "Depósitos a tu banco activos" : "Depósitos pendientes de verificación"}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full bg-panel-surface px-3 py-1 text-xs font-semibold border ${
                  status.oxxoEnabled ? "text-green-800 border-green-200" : "text-kora-muted border-panel-border"
                }`}
              >
                <Store size={13} />
                {status.oxxoEnabled ? "OXXO activo" : "OXXO en revisión"}
              </span>
            </div>
            {status.dashboardUrl && (
              <a
                href={status.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-green-300 bg-panel-surface px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
              >
                <ExternalLink size={15} /> Ver mi panel de Stripe (cobros y depósitos)
              </a>
            )}
          </div>

          {/* Saldo actual (neto, ya sin comisión) */}
          {status.balance && (
            <div className="rounded-xl border border-panel-border bg-panel-surface p-5">
              <h2 className="text-sm font-bold text-[#1B2421]">Tu saldo</h2>
              <p className="mt-0.5 text-xs text-kora-muted">
                Ya con la comisión de Stripe descontada: es lo que realmente recibes.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                  <div className="text-xs font-semibold text-green-700">Disponible</div>
                  <div className="text-lg font-bold tabular-nums text-green-800">
                    {money(status.balance.available, status.balance.currency)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-green-600">Listo para depositarse a tu banco</div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                  <div className="text-xs font-semibold text-amber-700">En camino</div>
                  <div className="text-lg font-bold tabular-nums text-amber-800">
                    {money(status.balance.pending, status.balance.currency)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-amber-600">Cobrado, Stripe lo está liberando</div>
                </div>
              </div>
            </div>
          )}

          {/* Pagos recibidos (aunque aún no se depositen) con el neto real */}
          <div className="rounded-xl border border-panel-border bg-panel-surface p-5">
            <h2 className="text-sm font-bold text-[#1B2421]">Pagos recibidos</h2>
            <p className="mt-0.5 text-xs text-kora-muted">
              Cada reserva cobrada. <b>Recibes</b> es lo que te queda después de la comisión de Stripe.
            </p>
            {status.payments && status.payments.length > 0 ? (
              <div className="mt-3 divide-y divide-panel-border-soft">
                {status.payments.map((p, i) => (
                  <div key={i} className="py-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-kora-muted">{fmtFecha(p.created)}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          p.status === "available"
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {p.status === "available" ? "Disponible" : "En camino"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-kora-muted">Cobrado al huésped</span>
                      <span className="tabular-nums text-kora-muted">{money(p.gross, p.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-kora-muted">Comisión de Stripe</span>
                      <span className="tabular-nums text-kora-muted">−{money(p.fee, p.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold text-[#1B2421]">
                      <span>Recibes</span>
                      <span className="tabular-nums text-green-800">{money(p.net, p.currency)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-kora-muted">
                      <CalendarClock size={13} className="shrink-0" />
                      {p.status === "available"
                        ? "Ya disponible — se deposita a tu banco en el siguiente pago"
                        : `Llega a tu banco aprox. el ${fmtFecha(p.availableOn)}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-kora-muted">
                Aún no hay pagos. Aparecerán aquí en cuanto recibas tu primera reserva pagada.
              </p>
            )}
          </div>

          {/* Últimos depósitos */}
          <div className="rounded-xl border border-panel-border bg-panel-surface p-5">
            <h2 className="text-sm font-bold text-[#1B2421]">Últimos depósitos a tu banco</h2>
            {status.payouts && status.payouts.length > 0 ? (
              <div className="mt-3 divide-y divide-panel-border-soft">
                {status.payouts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-kora-muted">{fmtFecha(p.arrivalDate)}</span>
                    <span className="font-semibold tabular-nums">{fmtMonto(p)}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.status === "paid"
                          ? "bg-green-50 text-green-700"
                          : p.status === "failed" || p.status === "canceled"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {PAYOUT_STATUS[p.status] ?? p.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-kora-muted">
                Aún no hay depósitos. Aparecerán aquí en cuanto recibas tus primeras reservas
                pagadas.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-panel-border bg-panel-surface p-5">
          {status?.status === "requiere_info" ? (
            <p className="text-sm text-amber-700 mb-3">
              Stripe necesita más información para terminar de verificar tu cuenta
              {typeof status.requirementsDue === "number" && status.requirementsDue > 0
                ? ` (${status.requirementsDue} dato${status.requirementsDue === 1 ? "" : "s"} pendiente${status.requirementsDue === 1 ? "" : "s"})`
                : ""}
              . Continúa para completarla.
            </p>
          ) : status?.pendiente ? (
            <p className="text-sm text-amber-700 mb-3">
              Tu conexión quedó a medias. Continúa para terminar de verificar tu cuenta.
            </p>
          ) : null}
          {rol !== "dueno" ? (
            <p className="text-sm text-kora-muted">
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
                {status?.pendiente || status?.status === "requiere_info"
                  ? "Continuar conexión"
                  : "Conectar mi cuenta bancaria"}
              </button>
              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
              <p className="text-xs text-panel-faint mt-3">
                Te llevamos a Stripe (nuestro procesador de pagos) para verificar tu identidad y tu
                cuenta bancaria. Toma 2–3 minutos. Kora nunca ve ni guarda tus datos bancarios.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
