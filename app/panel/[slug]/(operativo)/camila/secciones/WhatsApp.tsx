"use client";

// Conexión con WhatsApp, saldo y ajustes. Los estados de la conexión y sus
// textos vienen de la pantalla anterior (cada uno tiene su porqué en el
// historial); lo que cambia es el orden: primero lo que el hotelero tiene que
// HACER, y lo técnico (el token) al final y plegado.

import { useState } from "react";
import { Check, Copy, Eye, Loader2, QrCode, Wallet, Smartphone, Languages, Wrench } from "lucide-react";
import { Aviso, Campo, Chips, Tarjeta, btnSecundario } from "@/components/panel/ui";
import { RUTA_ACTIVAR } from "@/lib/oferta";
import { waLink } from "@/lib/contacto";
import type { Camila } from "../useCamila";
import type { Saldo } from "../tipos";

export type Motivo = { clave: string; titulo: string; detalle: string };

export const ESTADOS_CONEXION: Record<string, { tono: "ok" | "alerta" | "error" | "neutro"; txt: (n: string) => string }> = {
  ready: { tono: "ok", txt: (n) => `${n} está conectada` },
  qr: { tono: "alerta", txt: () => "Falta escanear el código" },
  starting: { tono: "neutro", txt: () => "Preparando la conexión…" },
  disconnected: { tono: "error", txt: () => "Desconectada, reconectando…" },
  auth_failure: { tono: "error", txt: () => "Se cayó la vinculación" },
  error: { tono: "error", txt: () => "No pudo arrancar" },
  "sin-sitio": { tono: "alerta", txt: () => "En cola, la estamos conectando" },
  requisitos: { tono: "alerta", txt: () => "Falta un paso tuyo" },
  "sin-servicio": { tono: "neutro", txt: () => "Preparando tu conexión" },
  "sin-vincular": { tono: "neutro", txt: () => "Abriendo tu conexión…" },
  desconocido: { tono: "neutro", txt: () => "Preparando tu conexión" },
  "sin-permiso": { tono: "neutro", txt: () => "La conecta el dueño" },
};

export default function WhatsApp({
  c,
  nombreBot,
  qrStatus,
  qrImg,
  motivos,
  saldo,
  onRecargar,
  recargando,
}: {
  c: Camila;
  nombreBot: string;
  qrStatus: string | null;
  qrImg: string | null;
  motivos: Motivo[];
  saldo: Saldo | null;
  onRecargar: (mxn: number) => void;
  recargando: boolean;
}) {
  const { lang, setLang, adminPhone, setAdminPhone, puedeConfigurar, errores } = c;
  const [token, setToken] = useState("");
  const [tokenCargando, setTokenCargando] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function verToken() {
    setTokenCargando(true);
    setTokenError(null);
    try {
      const res = await fetch("/api/admin/agent-token");
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.token) setToken(d.token);
      else setTokenError(res.status === 403 ? "Sólo el dueño puede verlo." : "No pude traerlo ahora.");
    } catch {
      setTokenError("Sin conexión.");
    } finally {
      setTokenCargando(false);
    }
  }

  return (
    <div className="space-y-5">
      <Tarjeta id="conexion" icono={<QrCode size={18} />} titulo="Conexión con tu WhatsApp" descripcion={`${nombreBot} contesta desde el WhatsApp de tu hotel. Se conecta una sola vez.`}>
        <Conexion nombreBot={nombreBot} qrStatus={qrStatus} qrImg={qrImg} motivos={motivos} />
      </Tarjeta>

      {saldo && saldo.mensajes !== null && (
        <Tarjeta id="saldo" icono={<Wallet size={18} />} titulo="Saldo de mensajes">
          <p className="text-3xl font-bold tabular-nums text-kora-text">
            {saldo.mensajes.toLocaleString("es-MX")}
            <span className="ml-1.5 text-sm font-normal text-kora-muted">mensajes</span>
          </p>
          <p className="mt-1 text-sm text-kora-muted">
            {saldo.consumo30d > 0
              ? `Usaste ${saldo.consumo30d.toLocaleString("es-MX")} en los últimos 30 días`
              : "Todavía no has usado mensajes este mes"}
            {saldo.mensajes > 0 && saldo.diasRestantes !== null && ` · te duran unos ${saldo.diasRestantes} días`}
          </p>
          <p className="mt-3 text-sm text-kora-muted">
            Cada respuesta que {nombreBot} manda (a un huésped o en «Pruébala») cuenta como un mensaje. Tu página, los cobros y los correos no gastan saldo.
          </p>
          {!saldo.recargaAbierta ? (
            <div className="mt-4">
              <Aviso tono="info" titulo="Próximamente: recarga desde aquí">
                Todavía no se cobra nada y {nombreBot} contesta sin límite, aunque veas bajar el contador. Te avisaremos por correo antes de que esto cambie.
              </Aviso>
            </div>
          ) : saldo.puedeRecargar ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {saldo.paquetes.map((pq) => (
                  <button
                    key={pq.mxn}
                    type="button"
                    onClick={() => onRecargar(pq.mxn)}
                    disabled={recargando}
                    className={`btn-press rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-kora-primary disabled:opacity-50 ${
                      pq.destacado ? "border-kora-primary bg-kora-primary/5" : "border-panel-border"
                    }`}
                  >
                    <span className="block text-sm font-bold text-kora-text">${pq.mxn.toLocaleString("es-MX")}</span>
                    <span className="block text-xs text-kora-muted">{pq.mensajes.toLocaleString("es-MX")} mensajes</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-kora-muted">{recargando ? "Abriendo el pago…" : "El saldo no caduca y se suma al que ya tengas."}</p>
            </>
          ) : (
            <p className="mt-3 text-xs text-kora-muted">Para recargar, pídeselo a quien administra el hotel.</p>
          )}
        </Tarjeta>
      )}

      <Tarjeta icono={<Languages size={18} />} titulo="Idioma" descripcion="Siempre contesta en el idioma en que le escriben. Éste es el que usa cuando no sabe.">
        <Chips
          etiqueta="Idioma principal"
          opciones={[
            { valor: "es", label: "Español" },
            { valor: "en", label: "English" },
          ]}
          seleccion={[lang]}
          onChange={([v]) => setLang(v as "es" | "en")}
        />
      </Tarjeta>

      <Tarjeta
        icono={<Smartphone size={18} />}
        titulo="Apágala o enciéndela desde tu celular"
        descripcion={`Opcional. Desde este número puedes escribirle al WhatsApp del hotel «apagar» o «encender», sin entrar al panel. También es a donde te aviso si no pusiste otro número en «Cómo vende».`}
      >
        {puedeConfigurar ? (
          <div className="max-w-md">
            <Campo label="Tu WhatsApp personal" error={errores.adminPhone}>
              {(p) => (
                <input
                  {...p}
                  type="tel"
                  inputMode="tel"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value.slice(0, 20))}
                  placeholder="55 1234 5678"
                  className="input-kora"
                />
              )}
            </Campo>
          </div>
        ) : (
          <Aviso tono="info">Este número lo pone el dueño del hotel.</Aviso>
        )}
        <details className="mt-4 rounded-xl bg-kora-bg px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-kora-text">Qué le puedo escribir</summary>
          <ul className="mt-2 space-y-1.5 text-sm text-kora-text">
            <li><code className="font-semibold">apagar</code> · deja de contestar a tus huéspedes</li>
            <li><code className="font-semibold">encender</code> · vuelve a contestar</li>
            <li><code className="font-semibold">estado</code> · te dice si está encendida</li>
            <li><code className="font-semibold">ayuda</code> · te manda esta lista</li>
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-kora-muted">
            Se escribe al WhatsApp del hotel, la palabra sola. Y si tú le contestas a un huésped desde el teléfono del hotel, {nombreBot} se calla 2 horas en ese chat para no escribir encima de ti.
          </p>
        </details>
      </Tarjeta>

      <details className="rounded-2xl border border-panel-border-soft bg-panel-surface px-5 py-4">
        <summary className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-kora-muted">
          <Wrench size={15} aria-hidden="true" /> Avanzado
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-sm text-kora-text">Clave de conexión del asistente</p>
          <p className="text-xs text-kora-muted">Sólo la necesitas si el equipo de Kora te la pide. Trátala como una contraseña.</p>
          {token ? (
            <div className="flex items-center gap-2">
              <input readOnly value={token} aria-label="Clave de conexión" className="input-kora flex-1 font-mono text-xs" />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(token);
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 1500);
                  } catch {
                    /* sin portapapeles */
                  }
                }}
                className={btnSecundario}
              >
                {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {copiado ? "Copiada" : "Copiar"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={verToken} disabled={tokenCargando} className={btnSecundario}>
              {tokenCargando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              Ver clave
            </button>
          )}
          {tokenError && <p className="text-xs text-[var(--chip-mal-text)]">{tokenError}</p>}
        </div>
      </details>
    </div>
  );
}

function Conexion({ nombreBot, qrStatus, qrImg, motivos }: { nombreBot: string; qrStatus: string | null; qrImg: string | null; motivos: Motivo[] }) {
  if (qrStatus === null)
    return (
      <p className="inline-flex items-center gap-2 text-sm text-kora-muted">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Revisando la conexión…
      </p>
    );
  if (qrStatus === "ready")
    return <Aviso tono="ok" titulo={`¡Listo! ${nombreBot} está conectada a tu WhatsApp.`}>Contesta a tus huéspedes las 24 horas mientras esté encendida.</Aviso>;
  if (qrStatus === "sin-permiso")
    return (
      <Aviso tono="info" titulo="Esto lo hace el dueño del hotel.">
        Escanear el código vincula un teléfono al WhatsApp del hotel, así que sólo el dueño puede verlo. Pídele que entre a esta misma pantalla.
      </Aviso>
    );
  if (qrStatus === "requisitos")
    return (
      <Aviso tono="alerta" titulo={`Falta ${motivos.length === 1 ? "un paso" : `${motivos.length} pasos`} para que aparezca tu código`}>
        <ul className="mt-1 space-y-1.5">
          {motivos.map((m) => (
            <li key={m.clave}>
              <span className="font-semibold">{m.titulo}.</span> {m.detalle}
              {m.clave === "sin-pago" && (
                <a href={RUTA_ACTIVAR} className="ml-1 font-semibold underline">
                  Activar mi plan
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs opacity-80">En cuanto lo resuelvas, el código aparece aquí solo.</p>
      </Aviso>
    );
  if (qrStatus === "error")
    return (
      <Aviso
        tono="error"
        titulo="Tu conexión de WhatsApp no pudo arrancar"
        accion={
          <a href={waLink(`Hola, mi ${nombreBot} no pudo arrancar y no me sale el código QR`)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Avisar a Kora por WhatsApp
          </a>
        }
      >
        Tu hotel está bien configurado: el problema es de nuestro lado. Avísanos y lo levantamos hoy mismo.
      </Aviso>
    );
  if (qrStatus === "sin-servicio" || qrStatus === "desconocido")
    return (
      <Aviso
        tono="alerta"
        titulo="No estamos pudiendo conectar con WhatsApp."
        accion={
          <a href={waLink(`Hola, la pantalla de ${nombreBot} dice que no conecta con WhatsApp`)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Avisar a Kora por WhatsApp
          </a>
        }
      >
        Tu hotel ya cumple todo, así que es de nuestro lado. Si en unos minutos sigue igual, avísanos.
      </Aviso>
    );
  if (qrStatus === "auth_failure")
    return (
      <Aviso
        tono="error"
        titulo="La vinculación con WhatsApp se cayó."
        accion={
          <a href={waLink(`Hola, ${nombreBot} perdió la vinculación con WhatsApp y necesito escanear de nuevo`)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Avisar a Kora por WhatsApp
          </a>
        }
      >
        El teléfono desvinculó el dispositivo o la sesión caducó. Hay que escanear de nuevo: avísanos y lo preparamos en unos minutos.
      </Aviso>
    );
  if (qrStatus === "disconnected")
    return (
      <Aviso tono="alerta" titulo={`${nombreBot} se desconectó de WhatsApp.`}>
        Suele reconectarse sola en unos minutos. Si sigue así en un rato, avísanos: mientras tanto no está contestando.
      </Aviso>
    );
  if (qrStatus === "sin-sitio")
    return <Aviso tono="info" titulo="En cola">La estamos conectando. No tienes que hacer nada; esta pantalla se actualiza sola.</Aviso>;
  return (
    <div className="grid items-center gap-5 md:grid-cols-[1fr_auto]">
      <ol className="space-y-2.5 text-sm text-kora-text">
        {[
          <>Abre <strong>WhatsApp</strong> en el teléfono de tu hotel.</>,
          <>Entra a <strong>Ajustes</strong> → <strong>Dispositivos vinculados</strong>.</>,
          <>Toca <strong>Vincular un dispositivo</strong>.</>,
          <>Apunta la cámara a este código.</>,
        ].map((paso, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-kora-primary/10 text-xs font-bold text-kora-primary">{i + 1}</span>
            <span className="pt-0.5">{paso}</span>
          </li>
        ))}
        <li className="pl-8 text-xs text-kora-muted">El código cambia solo cada pocos segundos. Si expira, espera el siguiente.</li>
      </ol>
      <div className="flex justify-center">
        {qrImg ? (
          <div className="rounded-2xl border border-panel-border-soft bg-white p-3">
            {/* QR = data URL que rota; <img> plano es lo correcto (no next/image) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImg} alt="Código QR para vincular WhatsApp" width={220} height={220} />
          </div>
        ) : (
          <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-panel-border text-kora-muted">
            <Loader2 size={22} className="animate-spin" aria-hidden="true" />
            <span className="text-xs">Preparando el código…</span>
          </div>
        )}
      </div>
    </div>
  );
}
