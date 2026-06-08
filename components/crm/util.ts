// Helpers de cliente para el CRM (sin server-only).

export async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts?.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string })?.error || "Error de red");
  return json as T;
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaCorta(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return "—";
  return `${day} ${MESES[m - 1]}`;
}

/** Fecha de HOY en zona local (YYYY-MM-DD), no UTC (evita corrimiento nocturno en MX). */
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Estado del próximo seguimiento respecto a hoy (local). */
export function seguimiento(d: string | null | undefined): "vencido" | "hoy" | "futuro" | null {
  if (!d) return null;
  const hoy = hoyISO();
  if (d < hoy) return "vencido";
  if (d === hoy) return "hoy";
  return "futuro";
}

/** Link de WhatsApp a partir de un teléfono mexicano libre. */
export function waLink(contacto: string | null | undefined): string | null {
  if (!contacto) return null;
  const digits = contacto.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${full}`;
}
