"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  BedDouble,
  CalendarPlus,
  CreditCard,
  ExternalLink,
  FlaskConical,
  Gift,
  History,
  LoaderCircle,
  Lock,
  LockOpen,
  MessageCircle,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { money } from "./util";
import { rutaFichaHotel } from "@/lib/crm/types";
// Sólo tipos de los módulos de servidor: sus valores arrastrarían la
// service-role al navegador.
import type { Bloque, FichaHotel as Ficha } from "@/lib/crm/ficha";
import type { FilaBitacora } from "@/lib/crm/bitacora";
import type { EstadoCamila } from "@/lib/crm/fuentes";
import type { MotivoSinBot } from "@/lib/bot/elegibilidad";
import type { SituacionHotel } from "@/lib/crm/operaciones";
import type { EstadoSuscripcion } from "@/lib/suscripcion";
// lib/crm/acciones.ts SÍ se importa con valores: es puro a propósito, para que
// la ficha apague los mismos botones que la API rechaza.
import {
  DIAS_EXTENSION,
  MENSAJE_BLOQUEO_MAX,
  MENSAJES_REGALO_MAX,
  MOTIVO_MAX,
  MOTIVO_MIN,
  calcularExtension,
  diasRestantes,
  mensajeBloqueoValido,
  mensajesRegaloValidos,
  motivoValido,
  puedeDarCortesia,
  puedeExtenderPrueba,
  puedeMarcarDemo,
  type DiasExtension,
  type SuscripcionMinima,
} from "@/lib/crm/acciones";

// La ficha de un hotel en el CRM del fundador. Responde, en este orden:
//   1. ¿Qué hago con este hotel?  → los botones, arriba
//   2. ¿En qué situación está?    → plan, prueba, cobros, motor, Camila, saldo
//   3. ¿Qué ha pasado?            → reservas y la bitácora de lo que hizo el CRM
//
// Cada botón abre un diálogo propio (no `window.confirm`: en el móvil no deja
// escribir el motivo y en Safari se puede silenciar para siempre con un clic)
// con lo que va a pasar escrito en palabras y el motivo obligatorio. Tras cada
// acción la ficha se vuelve a cargar del servidor en vez de «adivinar» el nuevo
// estado en el navegador: la cortesía, la prueba y el modo prueba del motor se
// afectan entre sí, y recalcularlo aquí sería copiar las reglas.

// ─── Formato ─────────────────────────────────────────────────────────────────

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Las partes numéricas se piden en `en-CA` y el mes se escribe a mano: el nombre
// del mes que da `es-MX` cambia entre Node y cada navegador («sep» / «sept.»), y
// eso rompe la hidratación de React con un aviso en consola.
const PARTES = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** «15 sep 2026» (o con hora), en la hora de México. */
export function fechaMx(v: string | number | null | undefined, conHora = false): string {
  if (v === null || v === undefined || v === "") return "—";
  const t = typeof v === "number" ? v : Date.parse(v);
  if (!Number.isFinite(t)) return "—";
  const p: Record<string, string> = {};
  for (const x of PARTES.formatToParts(t)) p[x.type] = x.value;
  const base = `${Number(p.day)} ${MESES[Number(p.month) - 1] ?? ""} ${p.year}`;
  return conHora ? `${base}, ${p.hour}:${p.minute}` : base;
}

export function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const d = Math.floor((Date.now() - t) / 86_400_000);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} d`;
  const m = Math.floor(d / 30);
  return `hace ${m} mes${m === 1 ? "" : "es"}`;
}

// ─── Chips (clases literales: Tailwind no ve las que se arman con variables) ─

type EstiloChip = { label: string; clase: string };

const VERDE = "bg-emerald-50 text-emerald-700 border-emerald-200";
const AMBAR = "bg-amber-50 text-amber-700 border-amber-200";
const ROJO = "bg-red-50 text-red-700 border-red-200";
const GRIS = "bg-gray-100 text-gray-600 border-gray-200";
const CIELO = "bg-sky-50 text-sky-700 border-sky-200";

export const SITUACION_CHIP: Record<SituacionHotel, EstiloChip> = {
  pago: { label: "Pagando", clase: VERDE },
  cortesia: { label: "Cortesía", clase: CIELO },
  prueba: { label: "En prueba", clase: AMBAR },
  prueba_vencida: { label: "Prueba vencida", clase: GRIS },
  moroso: { label: "Cobro fallido", clase: ROJO },
  cancelada: { label: "Cancelada", clase: GRIS },
  bloqueado: { label: "Bloqueado", clase: "bg-red-100 text-red-800 border-red-300" },
  demo: { label: "Demo", clase: "bg-violet-50 text-violet-700 border-violet-200" },
};

/** null = no se pudo saber. Se pinta distinto de cualquier situación real. */
export function chipSituacion(s: SituacionHotel | null): EstiloChip {
  return s ? SITUACION_CHIP[s] : { label: "No se pudo saber", clase: "bg-white text-gray-500 border-gray-300 border-dashed" };
}

/** null = el servidor de Camila no tiene sesión para este hotel. */
export function chipCamila(e: EstadoCamila | null): EstiloChip {
  if (!e) return { label: "Sin sesión", clase: GRIS };
  switch (e.status) {
    case "ready":
      return { label: "Conectada", clase: VERDE };
    case "qr":
      return { label: "Esperando QR", clase: AMBAR };
    case "sin-vincular":
      return { label: "Sin vincular", clase: AMBAR };
    case "starting":
      return { label: "Arrancando", clase: CIELO };
    case "disconnected":
      return { label: "Desconectada", clase: ROJO };
    case "auth_failure":
    case "error":
      return { label: "Con error", clase: ROJO };
    default:
      return { label: e.status, clase: GRIS };
  }
}

export function Chip({ estilo, extra }: { estilo: EstiloChip; extra?: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${estilo.clase}`}
    >
      {estilo.label}
      {extra}
    </span>
  );
}

const ESTADO_PLAN: Record<EstadoSuscripcion, string> = {
  activa: "Activa",
  pago_vencido: "Pago vencido",
  cancelada: "Cancelada",
  incompleta: "Incompleta",
  cortesia: "Cortesía",
};

const ESTADO_STRIPE: Record<string, string> = {
  active: "Pagando",
  trialing: "En prueba de Stripe (todavía no paga)",
  past_due: "Cobro atrasado",
  unpaid: "Sin pagar",
  canceled: "Cancelada",
  incomplete: "Incompleta",
  incomplete_expired: "Venció sin pagar",
  paused: "Pausada",
};

const ALTA_STRIPE: Record<string, string> = {
  pendiente: "Alta sin terminar",
  verificado: "Verificada",
  requiere_info: "Stripe le pide datos",
};

const MOTIVO_CAMILA: Record<MotivoSinBot, string> = {
  demo: "Es un hotel demo: Camila no se conecta a propósito.",
  "sin-publicar": "Su página no está publicada.",
  "bot-apagado": "El hotelero apagó a Camila en su panel.",
  "sin-acceso": "No tiene acceso: está bloqueado, su prueba venció o su plan no está activo.",
  "sin-whatsapp": "No ha capturado el WhatsApp del hotel.",
};

// ─── Piezas de la ficha ──────────────────────────────────────────────────────

const tarjeta = "rounded-2xl border border-gray-100 bg-white p-4";

function Tarjeta({ titulo, icono, children }: { titulo: string; icono: ReactNode; children: ReactNode }) {
  return (
    <section className={tarjeta}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-kora-text">
        {icono}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <dt className="flex-shrink-0 text-kora-muted">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-kora-text">{children}</dd>
    </div>
  );
}

function Nota({ children, tono = "gris" }: { children: ReactNode; tono?: "gris" | "ambar" | "rojo" }) {
  const clase =
    tono === "rojo"
      ? "border-red-200 bg-red-50 text-red-700"
      : tono === "ambar"
        ? "border-amber-200 bg-amber-50/60 text-amber-800"
        : "border-gray-200 bg-gray-50 text-kora-muted";
  return <p className={`mt-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${clase}`}>{children}</p>;
}

/** Pinta un bloque de datos, o dice por qué no se puede: nunca un cero falso. */
function VistaBloque<T>({ bloque, children }: { bloque: Bloque<T>; children: (data: T) => ReactNode }) {
  if (bloque.estado === "falta-sql") {
    return (
      <Nota>
        Falta correr <code className="rounded bg-white px-1">{bloque.archivo}</code> para ver esto.
      </Nota>
    );
  }
  if (bloque.estado === "error") return <Nota tono="rojo">No se pudo leer. {bloque.detalle}</Nota>;
  return (
    <>
      {children(bloque.data)}
      {bloque.aviso && <Nota tono="ambar">{bloque.aviso}</Nota>}
    </>
  );
}

const SiNo = ({ si, textoSi = "Sí", textoNo = "No" }: { si: boolean; textoSi?: string; textoNo?: string }) => (
  <span className={si ? "text-emerald-700" : "text-red-600"}>{si ? textoSi : textoNo}</span>
);

// ─── Bitácora ────────────────────────────────────────────────────────────────

const ETIQUETA_ACCION: Record<string, string> = {
  "suscripcion.cortesia_dar": "Dio cortesía",
  "suscripcion.cortesia_quitar": "Quitó la cortesía",
  "prueba.dias_extra": "Alargó la prueba",
  "saldo.regalar": "Regaló mensajes",
  "hotel.demo_marcar": "Lo marcó como demo",
  "hotel.demo_quitar": "Le quitó el demo",
  "hotel.bloquear": "Bloqueó la cuenta",
  "hotel.desbloquear": "Desbloqueó la cuenta",
};

function campo(o: unknown, k: string): unknown {
  return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>)[k] : undefined;
}

/** Lo que cambió, en una línea. Tolera apuntes de otras pantallas con otra forma. */
function resumenApunte(f: FilaBitacora): string | null {
  if (f.accion === "prueba.dias_extra") {
    const dias = campo(f.detalle, "diasRegalados");
    const fin = campo(f.despues, "fin");
    const partes = [
      typeof dias === "number" ? `+${dias} días` : null,
      typeof fin === "string" ? `hasta el ${fechaMx(fin)}` : null,
    ].filter(Boolean);
    return partes.length ? partes.join(", ") + "." : null;
  }
  if (f.accion === "saldo.regalar") {
    const n = campo(f.detalle, "regalados");
    const quedo = campo(f.despues, "mensajes");
    const partes = [
      typeof n === "number" ? `+${n.toLocaleString("es-MX")} mensajes` : null,
      typeof quedo === "number" ? `quedó en ${quedo.toLocaleString("es-MX")}` : null,
    ].filter(Boolean);
    return partes.length ? partes.join(", ") + "." : null;
  }
  if (f.accion === "hotel.bloquear") {
    const m = campo(f.despues, "mensaje");
    return typeof m === "string" ? `Mensaje: «${m}»` : null;
  }
  return null;
}

// ─── Acciones ────────────────────────────────────────────────────────────────

type Accion =
  | "dar_cortesia"
  | "quitar_cortesia"
  | "extender_prueba"
  | "regalar_mensajes"
  | "marcar_demo"
  | "quitar_demo"
  | "bloquear"
  | "desbloquear";

interface OpcionAccion {
  accion: Accion;
  titulo: string;
  descripcion: string;
  icono: ReactNode;
  peligro?: boolean;
  /** Por qué no se puede hoy. null = disponible. */
  noDisponible: string | null;
}

const TEXTO_CONFIRMAR: Record<Accion, string> = {
  dar_cortesia: "Dar cortesía",
  quitar_cortesia: "Quitar cortesía",
  extender_prueba: "Alargar prueba",
  regalar_mensajes: "Regalar mensajes",
  marcar_demo: "Marcar como demo",
  quitar_demo: "Quitar demo",
  bloquear: "Bloquear cuenta",
  desbloquear: "Desbloquear",
};

/** `crm:<uuid>`, generado UNA vez al abrir el diálogo de regalo (ver REF_REGALO). */
function nuevoRef(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return `crm:${c.randomUUID()}`;
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `crm:${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function opcionesDe(f: Ficha): OpcionAccion[] {
  const { plan, prueba, saldo, hotel } = f;
  const planNoLeido =
    plan.estado === "falta-sql"
      ? "Falta correr sql/kora-suscripciones-schema.sql."
      : plan.estado === "error"
        ? "No se pudo leer su plan: recarga la ficha."
        : null;
  const sub: SuscripcionMinima | null =
    plan.estado === "ok" && plan.data.estado
      ? { estado: plan.data.estado, stripe_subscription_id: plan.data.stripeSubscriptionId }
      : null;
  const icono = "h-4 w-4";
  const opciones: OpcionAccion[] = [];

  // Cortesía
  if (sub?.estado === "cortesia") {
    opciones.push({
      accion: "quitar_cortesia",
      titulo: "Quitar cortesía",
      descripcion: "Deja de tener acceso regalado. Desde ese momento manda su prueba.",
      icono: <ShieldCheck className={icono} />,
      noDisponible: planNoLeido,
    });
  } else {
    const v = puedeDarCortesia(sub);
    opciones.push({
      accion: "dar_cortesia",
      titulo: "Dar cortesía",
      descripcion: "Kora completo sin pagar y sin fecha de fin, en todos sus hoteles.",
      icono: <ShieldCheck className={icono} />,
      noDisponible: planNoLeido ?? (v.ok ? null : v.motivo),
    });
  }

  // Prueba
  {
    let noDisponible: string | null = planNoLeido;
    let descripcion = "Dale más días de prueba.";
    if (!noDisponible) {
      if (prueba.estado !== "ok") {
        noDisponible =
          prueba.estado === "falta-sql" ? `Falta correr ${prueba.archivo}.` : "No se pudo leer su prueba: recarga la ficha.";
      } else {
        const p = prueba.data;
        descripcion = p.vencida
          ? `Su prueba venció el ${fechaMx(p.fin)}. Los días cuentan desde hoy.`
          : `Le quedan ${p.diasRestantes} día${p.diasRestantes === 1 ? "" : "s"} (hasta el ${fechaMx(p.fin)}).`;
        const v = puedeExtenderPrueba({
          planActivo: plan.estado === "ok" && plan.data.planActivo,
          estado: sub?.estado ?? null,
          demo: hotel.demo,
        });
        if (!v.ok) noDisponible = v.motivo;
        else if (p.faltaSqlDiasExtra) {
          noDisponible = p.faltaSqlAncla
            ? "Falta correr sql/kora-prueba-por-dueno.sql y después sql/kora-crm-mando.sql."
            : "Falta correr sql/kora-crm-mando.sql.";
        }
      }
    }
    opciones.push({
      accion: "extender_prueba",
      titulo: "Alargar prueba",
      descripcion,
      icono: <CalendarPlus className={icono} />,
      noDisponible,
    });
  }

  // Saldo
  opciones.push({
    accion: "regalar_mensajes",
    titulo: "Regalar mensajes",
    descripcion:
      saldo.estado === "ok"
        ? saldo.data.enPrepago
          ? `Tiene ${(saldo.data.mensajes ?? 0).toLocaleString("es-MX")} mensajes de Camila.`
          : "Todavía no está en el prepago de Camila."
        : "Suma mensajes al saldo de Camila.",
    icono: <Gift className={icono} />,
    noDisponible: saldo.estado === "falta-sql" ? `Falta correr ${saldo.archivo}.` : null,
  });

  // Demo
  if (hotel.demo) {
    opciones.push({
      accion: "quitar_demo",
      titulo: "Quitar demo",
      descripcion: "Vuelve a caducar, a cobrar y a conectar a Camila como cualquier hotel.",
      icono: <FlaskConical className={icono} />,
      noDisponible: null,
    });
  } else {
    const v = puedeMarcarDemo({ demo: false, sub });
    opciones.push({
      accion: "marcar_demo",
      titulo: "Marcar como demo",
      descripcion: "Sólo para hoteles de demostración: no caduca, no cobra y no conecta a Camila.",
      icono: <FlaskConical className={icono} />,
      peligro: true,
      noDisponible: planNoLeido ?? (v.ok ? null : v.motivo),
    });
  }

  // Bloqueo
  if (hotel.bloqueo) {
    opciones.push({
      accion: "desbloquear",
      titulo: "Desbloquear",
      descripcion: `Bloqueado${hotel.bloqueo.fecha ? ` el ${fechaMx(hotel.bloqueo.fecha)}` : ""}. Vuelve a encender su cuenta.`,
      icono: <LockOpen className={icono} />,
      noDisponible: null,
    });
    opciones.push({
      accion: "bloquear",
      titulo: "Cambiar mensaje",
      descripcion: hotel.bloqueo.mensaje ? `Ve: «${hotel.bloqueo.mensaje}»` : "Cambia lo que ve al entrar.",
      icono: <Lock className={icono} />,
      noDisponible: null,
    });
  } else {
    opciones.push({
      accion: "bloquear",
      titulo: "Bloquear cuenta",
      descripcion: "Apaga su panel, su página de reservas y a Camila. No borra nada.",
      icono: <Lock className={icono} />,
      peligro: true,
      noDisponible: null,
    });
  }

  return opciones;
}

/** Lo que va a pasar, dicho antes de confirmar. */
function advertenciasDe(accion: Accion, f: Ficha): string[] {
  const s = f.stripe?.estado === "ok" ? f.stripe.data : null;
  switch (accion) {
    case "dar_cortesia":
      return [
        "Tendrá Kora completo sin pagar y sin fecha de fin, en todos sus hoteles.",
        "Con cortesía puede dar de alta más de un hotel.",
        ...(s && ["active", "trialing", "past_due", "unpaid"].includes(s.status)
          ? [`Stripe dice que su suscripción está «${ESTADO_STRIPE[s.status] ?? s.status}». Revísala en Stripe antes: la cortesía no la cancela.`]
          : []),
      ];
    case "quitar_cortesia":
      return [
        "Pasa a «cancelada» y desde ese momento manda su prueba.",
        f.prueba.estado === "ok"
          ? f.prueba.data.vencida
            ? "Su prueba ya venció: en cuanto confirmes se pausa su motor y Camila se desconecta."
            : `Su prueba le llega hasta el ${fechaMx(f.prueba.data.fin)}.`
          : "No se pudo leer su prueba: si ya venció, se le apaga en cuanto confirmes.",
      ];
    case "extender_prueba":
      return [
        "Si su prueba sigue vigente, los días se suman a su fin. Si ya venció, cuentan desde hoy.",
        "Aplica a todos los hoteles de este dueño.",
        "Le vuelven a llegar los avisos de 7, 3 y 1 días antes de la nueva fecha.",
      ];
    case "regalar_mensajes":
      return [
        ...(f.saldo.estado === "ok" && !f.saldo.data.enPrepago
          ? [
              "Este hotel todavía no está en el prepago: con este regalo entra. Si algún día se le acaban y está encendido «callar a Camila sin saldo», Camila deja de contestar.",
            ]
          : []),
        "Se suma a lo que ya tenga. Un doble clic no lo regala dos veces.",
      ];
    case "marcar_demo":
      return [
        "Un hotel demo nunca caduca.",
        "Su motor no cobra: el pago se simula.",
        "Camila queda fuera: no se conecta a su WhatsApp.",
        "No lo uses con un cliente real.",
      ];
    case "quitar_demo":
      return [
        "Su prueba vuelve a contar desde su alta: si ya pasó, su motor se pausa y Camila no se conecta hasta que tenga plan o más días.",
      ];
    case "bloquear":
      return f.hotel.bloqueo
        ? ["Sigue bloqueado; sólo cambia el mensaje que ve al entrar."]
        : [
            "Apaga su panel, su página de reservas y a Camila. No borra nada y se deshace con Desbloquear.",
            "Verá el mensaje cada vez que entre: escríbelo pensando en que se puede volver público.",
            // El bloqueo gana sobre el plan (`accesoDelHotel`), pero no toca
            // Stripe: sin este aviso se le puede dejar todo apagado a alguien a
            // quien se le sigue cobrando cada mes.
            ...(f.plan.estado === "ok" && f.plan.data.pagaConStripe
              ? ["Este dueño paga su plan con Stripe: bloquearlo NO cancela el cobro. Si no quieres cobrarle el mes, cancela su suscripción en Stripe."]
              : []),
          ];
    case "desbloquear":
      return ["Vuelve a encender su panel, su página de reservas y a Camila, según su plan o su prueba."];
  }
}

// ─── Diálogo ─────────────────────────────────────────────────────────────────

function Dialogo({
  ficha,
  accion,
  alCerrar,
  alTerminar,
}: {
  ficha: Ficha;
  accion: Accion;
  /** `refrescar`: hubo un intento fallido y la base puede no coincidir con la pantalla. */
  alCerrar: (refrescar: boolean) => void;
  alTerminar: (r: { mensaje: string; aviso?: string }) => void;
}) {
  const idTitulo = useId();
  const [motivo, setMotivo] = useState("");
  const [dias, setDias] = useState<DiasExtension>(DIAS_EXTENSION[0]);
  const [mensajes, setMensajes] = useState("");
  const [mensajeBloqueo, setMensajeBloqueo] = useState(ficha.hotel.bloqueo?.mensaje ?? "");
  // Se genera al abrir y se reenvía igual en cada reintento: es lo que impide
  // regalar dos veces con un doble clic o tras un corte de red.
  const [ref] = useState(() => (accion === "regalar_mensajes" ? nuevoRef() : ""));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tras un intento fallido de regalo la cantidad se congela: si el primero sí
  // llegó a la base, reintentar con otra cantidad y el mismo `ref` no sumaría
  // nada y confundiría.
  const [cantidadCongelada, setCantidadCongelada] = useState(false);
  const [falloAlgo, setFalloAlgo] = useState(false);
  // El «ahora» de la vista previa se fija al abrir el diálogo: recalcularlo en
  // cada render movería la fecha mientras se escribe el motivo. La API usa su
  // propio reloj al guardar; la diferencia es de segundos.
  const [ahora] = useState(() => Date.now());

  function cerrar() {
    if (!enviando) alCerrar(falloAlgo);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !enviando) alCerrar(falloAlgo);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enviando, falloAlgo, alCerrar]);

  const prueba = ficha.prueba.estado === "ok" ? ficha.prueba.data : null;
  const extension =
    accion === "extender_prueba" && prueba
      ? calcularExtension({
          finBaseMs: prueba.finBaseExtensionMs,
          diasExtraActuales: prueba.diasExtra,
          dias,
          ahora,
        })
      : null;

  const motivoOk = motivoValido(motivo) !== null;
  const camposOk =
    accion === "extender_prueba"
      ? Boolean(extension?.ok)
      : accion === "regalar_mensajes"
        ? mensajesRegaloValidos(Number(mensajes))
        : accion === "bloquear"
          ? mensajeBloqueoValido(mensajeBloqueo) !== null
          : true;
  const listoParaEnviar = motivoOk && camposOk && !enviando;
  const peligro = accion === "bloquear" || accion === "marcar_demo" || accion === "quitar_cortesia";

  async function confirmar() {
    if (!listoParaEnviar) return;
    const cuerpo: Record<string, unknown> = { accion, motivo: motivo.trim() };
    if (accion === "extender_prueba" && prueba) {
      cuerpo.dias = dias;
      cuerpo.diasExtraVistos = prueba.diasExtra;
    }
    if (accion === "regalar_mensajes") {
      cuerpo.mensajes = Number(mensajes);
      cuerpo.ref = ref;
    }
    if (accion === "bloquear") cuerpo.mensaje = mensajeBloqueo.trim();

    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/hoteles/${encodeURIComponent(ficha.hotel.slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; mensaje?: string; aviso?: string; error?: string };
      if (!res.ok || !data.ok) {
        setFalloAlgo(true);
        if (accion === "regalar_mensajes" && res.status >= 500) setCantidadCongelada(true);
        setError(data.error || "No se pudo completar. Intenta de nuevo.");
        return;
      }
      alTerminar({ mensaje: data.mensaje || "Listo.", aviso: data.aviso });
    } catch {
      setFalloAlgo(true);
      if (accion === "regalar_mensajes") setCantidadCongelada(true);
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-kora-text outline-none focus:ring-2 focus:ring-kora-accent disabled:bg-gray-50";
  const label = "block text-xs font-semibold text-kora-text";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={cerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <h2 id={idTitulo} className="font-bold text-kora-text">
            {TEXTO_CONFIRMAR[accion]} · {ficha.hotel.nombre}
          </h2>
          <button
            type="button"
            onClick={cerrar}
            disabled={enviando}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-kora-text disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <ul className={`space-y-1.5 rounded-xl border p-3 text-sm leading-relaxed ${peligro ? "border-red-200 bg-red-50/60 text-red-800" : "border-gray-100 bg-kora-bg text-kora-text"}`}>
            {advertenciasDe(accion, ficha).map((a) => (
              <li key={a}>· {a}</li>
            ))}
          </ul>

          {accion === "extender_prueba" && (
            <div>
              <span className={label}>¿Cuántos días?</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {DIAS_EXTENSION.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDias(d)}
                    aria-pressed={dias === d}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      dias === d
                        ? "border-kora-primary bg-kora-primary text-white"
                        : "border-gray-200 bg-white text-kora-muted hover:text-kora-text"
                    }`}
                  >
                    +{d} días
                  </button>
                ))}
              </div>
              {extension &&
                (extension.ok ? (
                  <p className="mt-2 text-sm text-kora-text">
                    Su prueba llegará hasta el <strong>{fechaMx(extension.nuevoFinMs)}</strong> (le quedarán{" "}
                    {diasRestantes(extension.nuevoFinMs, ahora)} días).
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-red-700">{extension.motivo}</p>
                ))}
            </div>
          )}

          {accion === "regalar_mensajes" && (
            <div>
              <label htmlFor={`${idTitulo}-mensajes`} className={label}>
                ¿Cuántos mensajes? (de 1 a {MENSAJES_REGALO_MAX.toLocaleString("es-MX")})
              </label>
              <input
                id={`${idTitulo}-mensajes`}
                type="number"
                inputMode="numeric"
                min={1}
                max={MENSAJES_REGALO_MAX}
                step={1}
                value={mensajes}
                disabled={cantidadCongelada || enviando}
                onChange={(e) => setMensajes(e.target.value)}
                className={input}
                autoFocus
              />
              {cantidadCongelada && (
                <p className="mt-1 text-xs text-kora-muted">
                  La cantidad queda fija para que un reintento no regale dos veces. Para dar otra cantidad,
                  cierra, recarga la ficha y revisa si el primero se aplicó.
                </p>
              )}
            </div>
          )}

          {accion === "bloquear" && (
            <div>
              <label htmlFor={`${idTitulo}-bloqueo`} className={label}>
                Mensaje que verá al entrar
              </label>
              <textarea
                id={`${idTitulo}-bloqueo`}
                value={mensajeBloqueo}
                onChange={(e) => setMensajeBloqueo(e.target.value)}
                rows={3}
                maxLength={MENSAJE_BLOQUEO_MAX}
                placeholder="Escribe aquí lo que quieres que lea…"
                className={`${input} resize-none`}
                autoFocus
              />
            </div>
          )}

          <div>
            <label htmlFor={`${idTitulo}-motivo`} className={label}>
              ¿Por qué? <span className="font-normal text-kora-muted">(queda en la bitácora; sólo lo ves tú)</span>
            </label>
            <textarea
              id={`${idTitulo}-motivo`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              maxLength={MOTIVO_MAX}
              placeholder={`Mínimo ${MOTIVO_MIN} letras`}
              className={`${input} resize-none`}
              autoFocus={accion !== "regalar_mensajes" && accion !== "bloquear"}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cerrar}
              disabled={enviando}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-kora-muted hover:bg-gray-50 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={!listoParaEnviar}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 ${
                peligro ? "bg-red-600 hover:bg-red-700" : "bg-kora-primary hover:bg-kora-primary-dark"
              }`}
            >
              {enviando && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {accion === "bloquear" && ficha.hotel.bloqueo ? "Guardar mensaje" : TEXTO_CONFIRMAR[accion]}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── La ficha ────────────────────────────────────────────────────────────────

export function FichaHotel({ ficha }: { ficha: Ficha }) {
  const router = useRouter();
  const [actualizando, startTransition] = useTransition();
  const [dialogo, setDialogo] = useState<Accion | null>(null);
  const [resultado, setResultado] = useState<{ mensaje: string; aviso?: string } | null>(null);

  const { hotel, plan, stripe, prueba, cobros, modoPrueba, camila, saldo, fases, reservas, bitacora, enlaces } = ficha;
  const opciones = opcionesDe(ficha);
  const situacion = chipSituacion(ficha.situacion);

  function cerrarDialogo(refrescar: boolean) {
    setDialogo(null);
    // Si el diálogo se cierra tras un error, lo que haya en la base puede ser
    // distinto de lo que se ve (un regalo que sí llegó, una prueba que alguien
    // alargó): se recarga para no decidir sobre un dato viejo. Sin error no se
    // recarga: la ficha consulta Stripe y el servidor de Camila, y un «Cancelar»
    // no tiene por qué esperarlos.
    if (refrescar) startTransition(() => router.refresh());
  }

  function terminado(r: { mensaje: string; aviso?: string }) {
    setDialogo(null);
    setResultado(r);
    startTransition(() => router.refresh());
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Cabecera ──────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/crm/hoteles"
          className="inline-flex items-center gap-1 text-sm text-kora-muted hover:text-kora-text"
        >
          <ArrowLeft className="h-4 w-4" /> Hoteles
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-kora-text">
              <span className="break-words">{hotel.nombre}</span>
              <Chip
                estilo={situacion}
                extra={ficha.situacion === "prueba" && prueba.estado === "ok" ? ` · ${prueba.data.diasRestantes} d` : undefined}
              />
              {!hotel.publicado && <Chip estilo={{ label: "Sin publicar", clase: GRIS }} />}
              {hotel.bloqueo && <Ban className="h-4 w-4 text-red-600" aria-label="Bloqueado" />}
            </h1>
            <p className="mt-0.5 text-sm text-kora-muted">
              /h/{hotel.slug}
              {hotel.ubicacion ? ` · ${hotel.ubicacion}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { href: enlaces.sitio, texto: "Ver sitio" },
              { href: enlaces.motor, texto: "Motor de reservas" },
              ...(enlaces.stripeCliente ? [{ href: enlaces.stripeCliente, texto: "Cliente en Stripe" }] : []),
              ...(enlaces.stripeCuenta ? [{ href: enlaces.stripeCuenta, texto: "Cuenta de cobros" }] : []),
            ].map((e) => (
              <a
                key={e.href}
                href={e.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-kora-muted hover:text-kora-primary"
              >
                {e.texto} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Resultado de la última acción ─────────────────────────────── */}
      {resultado && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-emerald-800">{resultado.mensaje}</p>
              {resultado.aviso && <p className="mt-1 text-amber-800">{resultado.aviso}</p>}
              {actualizando && <p className="mt-1 text-xs text-emerald-700">Actualizando la ficha…</p>}
            </div>
            <button
              type="button"
              onClick={() => setResultado(null)}
              aria-label="Cerrar aviso"
              className="text-emerald-700 hover:text-emerald-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Acciones ──────────────────────────────────────────────────── */}
      <section className={tarjeta}>
        <h2 className="text-sm font-bold text-kora-text">Qué quieres hacer</h2>
        <ul className="mt-2 divide-y divide-gray-50">
          {opciones.map((o) => (
            <li
              key={o.accion + o.titulo}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={`mt-0.5 ${o.peligro ? "text-red-600" : "text-kora-primary"}`}>{o.icono}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-kora-text">{o.titulo}</p>
                  <p className={`text-xs leading-relaxed ${o.noDisponible ? "text-amber-700" : "text-kora-muted"}`}>
                    {o.noDisponible ?? o.descripcion}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(o.noDisponible) || actualizando}
                onClick={() => {
                  setResultado(null);
                  setDialogo(o.accion);
                }}
                className={`flex-shrink-0 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                  o.peligro
                    ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                    : "bg-kora-primary text-white hover:bg-kora-primary-dark"
                }`}
              >
                {o.titulo}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── Hotel y dueño ─────────────────────────────────────────── */}
        <Tarjeta titulo="Hotel y dueño" icono={<User className="h-4 w-4 text-kora-muted" />}>
          <dl className="divide-y divide-gray-50">
            <Dato etiqueta="Alta del hotel">
              {fechaMx(hotel.createdAt)} <span className="font-normal text-kora-muted">({haceCuanto(hotel.createdAt)})</span>
            </Dato>
            <Dato etiqueta="Publicado">
              <SiNo si={hotel.publicado} />
            </Dato>
            <Dato etiqueta="WhatsApp del hotel">{hotel.whatsapp || <span className="text-kora-muted">sin capturar</span>}</Dato>
          </dl>
          <VistaBloque bloque={ficha.dueno}>
            {(d) =>
              d ? (
                <dl className="divide-y divide-gray-50 border-t border-gray-100">
                  <Dato etiqueta="Correo del dueño">
                    {d.email ? (
                      <a href={`mailto:${d.email}`} className="text-kora-primary hover:underline">
                        {d.email}
                      </a>
                    ) : (
                      "sin correo"
                    )}
                    {!d.correoConfirmado && <span className="block text-xs font-normal text-amber-700">sin confirmar</span>}
                  </Dato>
                  <Dato etiqueta="Cuenta creada">{fechaMx(d.altaCuenta)}</Dato>
                  <Dato etiqueta="Último acceso">
                    {d.ultimoAcceso ? `${fechaMx(d.ultimoAcceso, true)} (${haceCuanto(d.ultimoAcceso)})` : "nunca"}
                  </Dato>
                </dl>
              ) : (
                <Nota tono="ambar">La cuenta del dueño ya no existe: este hotel quedó sin dueño.</Nota>
              )
            }
          </VistaBloque>
          <VistaBloque bloque={ficha.otrosHoteles}>
            {(otros) =>
              otros.length > 0 ? (
                <p className="mt-2 text-xs text-kora-muted">
                  Este dueño también tiene:{" "}
                  {otros.map((o, i) => (
                    <span key={o.slug}>
                      {i > 0 && ", "}
                      <Link href={rutaFichaHotel(o.slug)} className="text-kora-primary hover:underline">
                        {o.nombre}
                      </Link>
                    </span>
                  ))}
                  . La prueba y el plan son de la cuenta, no de cada hotel.
                </p>
              ) : null
            }
          </VistaBloque>
        </Tarjeta>

        {/* ── Plan ──────────────────────────────────────────────────── */}
        <Tarjeta titulo="Plan" icono={<ShieldCheck className="h-4 w-4 text-kora-muted" />}>
          <VistaBloque bloque={plan}>
            {(p) => (
              <dl className="divide-y divide-gray-50">
                <Dato etiqueta="En Kora">{p.estado ? ESTADO_PLAN[p.estado] : "Sin plan"}</Dato>
                {p.periodoFin && <Dato etiqueta="Periodo pagado hasta">{fechaMx(p.periodoFin)}</Dato>}
                {p.cancelaAlFinal && (
                  <Dato etiqueta="Cancelación">
                    <span className="text-red-600">pidió cancelar al final del periodo</span>
                  </Dato>
                )}
                {p.avisosDunning > 0 && <Dato etiqueta="Avisos de cobro enviados">{p.avisosDunning}</Dato>}
              </dl>
            )}
          </VistaBloque>
          {stripe === null ? (
            plan.estado === "ok" && <Nota>No tiene cliente en Stripe: nunca ha pasado por el pago.</Nota>
          ) : (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <p className="text-xs font-semibold text-kora-muted">Lo que dice Stripe</p>
              <VistaBloque bloque={stripe}>
                {(s) =>
                  s ? (
                    <dl className="divide-y divide-gray-50">
                      <Dato etiqueta="Suscripción">{ESTADO_STRIPE[s.status] ?? s.status}</Dato>
                      <Dato etiqueta="Mensualidad (de lista, sin descuentos)">{s.montoMxn === null ? "—" : money(s.montoMxn)}</Dato>
                      {s.trialEnd && <Dato etiqueta="Fin de la prueba en Stripe">{fechaMx(s.trialEnd)}</Dato>}
                      {s.cancelAtPeriodEnd && (
                        <Dato etiqueta="Cancelación">
                          <span className="text-red-600">al final del periodo</span>
                        </Dato>
                      )}
                    </dl>
                  ) : (
                    <Nota>Stripe no tiene ninguna suscripción para este cliente.</Nota>
                  )
                }
              </VistaBloque>
            </div>
          )}
        </Tarjeta>

        {/* ── Prueba ────────────────────────────────────────────────── */}
        <Tarjeta titulo="Prueba gratis" icono={<CalendarPlus className="h-4 w-4 text-kora-muted" />}>
          <VistaBloque bloque={prueba}>
            {(p) => (
              <>
                {!p.aplica && (
                  <Nota>
                    {hotel.demo
                      ? "Es un hotel demo: su prueba no caduca."
                      : plan.estado === "ok" && plan.data.planActivo
                        ? "Tiene plan o cortesía: hoy la prueba no manda. Estas fechas valen si lo pierde."
                        : "Sin leer su plan no se sabe si la prueba le aplica."}
                  </Nota>
                )}
                <dl className="divide-y divide-gray-50">
                  <Dato etiqueta="Empezó">{fechaMx(p.inicio)}</Dato>
                  <Dato etiqueta="Termina">{fechaMx(p.fin)}</Dato>
                  <Dato etiqueta="Le quedan">
                    {p.vencida ? <span className="text-red-600">vencida</span> : `${p.diasRestantes} día${p.diasRestantes === 1 ? "" : "s"}`}
                  </Dato>
                  <Dato etiqueta="Días extra regalados">{p.diasExtra}</Dato>
                </dl>
                {p.faltaSqlDiasExtra && (
                  <Nota>
                    Falta correr{" "}
                    <code className="rounded bg-white px-1">
                      {p.faltaSqlAncla ? "sql/kora-prueba-por-dueno.sql y sql/kora-crm-mando.sql" : "sql/kora-crm-mando.sql"}
                    </code>{" "}
                    para poder regalar días.
                  </Nota>
                )}
              </>
            )}
          </VistaBloque>
        </Tarjeta>

        {/* ── Cobros y motor ────────────────────────────────────────── */}
        <Tarjeta titulo="Cobros y motor de reservas" icono={<CreditCard className="h-4 w-4 text-kora-muted" />}>
          <VistaBloque bloque={cobros}>
            {(c) => (
              <>
                <dl className="divide-y divide-gray-50">
                  <Dato etiqueta="Puede cobrar con su Stripe">
                    <SiNo si={c.chargesEnabled} />
                  </Dato>
                  <Dato etiqueta="Cuenta conectada">{c.accountId ? ALTA_STRIPE[c.onboardingStatus] ?? c.onboardingStatus : "no ha conectado"}</Dato>
                  {c.accountId && (
                    <Dato etiqueta="Le llegan los pagos a su banco">
                      <SiNo si={c.payoutsEnabled} />
                    </Dato>
                  )}
                  {c.requirementsDue > 0 && <Dato etiqueta="Datos que le pide Stripe">{c.requirementsDue}</Dato>}
                </dl>
              </>
            )}
          </VistaBloque>
          <div className="mt-2 border-t border-gray-100 pt-2">
            <VistaBloque bloque={modoPrueba}>
              {(simula) => (
                <dl className="divide-y divide-gray-50">
                  <Dato etiqueta="Motor en modo prueba">
                    {hotel.demo ? "Demo: siempre simula" : simula ? <span className="text-amber-700">Sí, simula el pago</span> : "No"}
                  </Dato>
                </dl>
              )}
            </VistaBloque>
            <p className="mt-1 text-xs leading-relaxed text-kora-muted">
              El motor simula el pago (no llega nada a Stripe) sólo si el hotel está en prueba y su Stripe todavía no puede
              cobrar. Si paga o tiene cortesía y no puede cobrar, lo que cobre su motor cae en la cuenta de Kora.
              {!hotel.publicado && " Sin publicar, su motor no acepta reservas."}
            </p>
          </div>
        </Tarjeta>

        {/* ── Camila ────────────────────────────────────────────────── */}
        <Tarjeta titulo="Camila (WhatsApp)" icono={<MessageCircle className="h-4 w-4 text-kora-muted" />}>
          <VistaBloque bloque={camila.runtime}>
            {(e) => (
              <dl className="divide-y divide-gray-50">
                <Dato etiqueta="Ahora mismo">
                  <Chip estilo={chipCamila(e)} />
                  {e?.err && <span className="block text-xs font-normal text-red-600">{e.err}</span>}
                </Dato>
              </dl>
            )}
          </VistaBloque>
          <dl className="divide-y divide-gray-50">
            <Dato etiqueta="Encendida por el hotelero">
              <SiNo si={camila.botEncendido} />
            </Dato>
          </dl>
          {camila.motivos.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-kora-muted">Lo que le falta para tener a Camila</p>
              <ul className="mt-1 space-y-1 text-sm text-kora-text">
                {camila.motivos.map((m) => (
                  <li key={m}>· {MOTIVO_CAMILA[m]}</li>
                ))}
              </ul>
            </div>
          )}
          {/* Sin el acceso calculado, la lista de arriba NO incluye «no tiene
              acceso» porque no se sabe, no porque lo tenga: decir «cumple todo»
              con eso sin comprobar sería inventarse la única condición que
              depende de su plan y de su prueba. */}
          {!camila.accesoLeido ? (
            <Nota tono="ambar">
              No se pudo comprobar si tiene acceso (su plan o su prueba), así que esta lista puede estar incompleta.
              Recarga la ficha.
            </Nota>
          ) : (
            camila.motivos.length === 0 && (
              <p className="mt-2 text-xs text-kora-muted">Cumple todo para tener a Camila: el servidor la arranca solo.</p>
            )
          )}
        </Tarjeta>

        {/* ── Saldo ─────────────────────────────────────────────────── */}
        <Tarjeta titulo="Saldo de Camila" icono={<Gift className="h-4 w-4 text-kora-muted" />}>
          <VistaBloque bloque={saldo}>
            {(s) =>
              s.enPrepago ? (
                <dl className="divide-y divide-gray-50">
                  <Dato etiqueta="Mensajes disponibles">
                    <span className={(s.mensajes ?? 0) <= 0 ? "text-red-600" : ""}>{(s.mensajes ?? 0).toLocaleString("es-MX")}</span>
                  </Dato>
                  <Dato etiqueta="Gastados en 30 días">
                    {s.consumo30d === null ? <span className="text-amber-700">no se pudo contar</span> : s.consumo30d.toLocaleString("es-MX")}
                  </Dato>
                </dl>
              ) : (
                <Nota>Fuera del prepago: nunca se le ha acreditado nada, así que Camila no se le calla por saldo.</Nota>
              )
            }
          </VistaBloque>
          {fases && (
            <p className="mt-2 text-xs leading-relaxed text-kora-muted">
              Para todos los hoteles: recargas {fases.recarga ? "abiertas" : "cerradas"} · callar a Camila sin saldo{" "}
              {fases.recarga && fases.bloqueo ? "encendido" : "apagado"}.{" "}
              <Link href="/crm/prepago" className="text-kora-primary hover:underline">
                Cambiarlo en Prepago
              </Link>
            </p>
          )}
        </Tarjeta>

        {/* ── Reservas ──────────────────────────────────────────────── */}
        <Tarjeta titulo="Reservas" icono={<BedDouble className="h-4 w-4 text-kora-muted" />}>
          <VistaBloque bloque={reservas}>
            {(r) => (
              <>
                <dl className="divide-y divide-gray-50">
                  <Dato etiqueta="Totales">{r.total.toLocaleString("es-MX")}</Dato>
                  <Dato etiqueta={`Últimos ${ficha.ventanaDias} días`}>{r.recientes.toLocaleString("es-MX")}</Dato>
                  <Dato etiqueta="Dinero movido (total)">{money(r.gmvTotal)}</Dato>
                  <Dato etiqueta={`Dinero movido (${ficha.ventanaDias} días)`}>{money(r.gmvReciente)}</Dato>
                  <Dato etiqueta="Última reserva">
                    {r.ultima ? `${fechaMx(r.ultima)} (${haceCuanto(r.ultima)})` : "nunca"}
                  </Dato>
                </dl>
                <p className="mt-1 text-xs text-kora-muted">
                  Las canceladas y las reembolsadas cuentan como reserva, pero no suman al dinero movido.
                </p>
              </>
            )}
          </VistaBloque>
        </Tarjeta>
      </div>

      {/* ── Bitácora ──────────────────────────────────────────────────── */}
      <Tarjeta titulo="Lo que se ha hecho desde el CRM" icono={<History className="h-4 w-4 text-kora-muted" />}>
        <VistaBloque bloque={bitacora}>
          {(filas) =>
            filas.length === 0 ? (
              <p className="text-sm text-kora-muted">Nada todavía con este hotel.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {filas.map((f) => {
                  const resumen = resumenApunte(f);
                  return (
                    <li key={f.id} className="py-2.5 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold text-kora-text">{ETIQUETA_ACCION[f.accion] ?? f.accion}</span>
                        <span className="text-xs text-kora-muted">{fechaMx(f.created_at, true)}</span>
                      </div>
                      {resumen && <p className="text-kora-text">{resumen}</p>}
                      {f.motivo && <p className="text-xs text-kora-muted">Motivo: {f.motivo}</p>}
                    </li>
                  );
                })}
              </ul>
            )
          }
        </VistaBloque>
      </Tarjeta>

      {dialogo && (
        <Dialogo ficha={ficha} accion={dialogo} alCerrar={cerrarDialogo} alTerminar={terminado} />
      )}
    </main>
  );
}
