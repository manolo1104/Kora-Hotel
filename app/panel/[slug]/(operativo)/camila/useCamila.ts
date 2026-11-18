"use client";

// Carga y AUTOGUARDADO de todo lo que se configura de Camila.
//
// Antes había cuatro maneras de guardar en la misma pantalla —autoguardado del
// entrenamiento, botón para el teléfono, guardado instantáneo del interruptor y
// del idioma, y Mi sitio con su propio botón— y los fallos de tres de ellas eran
// silenciosos. Ahora todo pasa por aquí:
//   · se guarda solo, por CAMPOS (sólo lo que cambió), ~0.8 s después de escribir;
//   · un único estado de guardado para toda la pantalla, con «Reintentar»;
//   · los errores de validación del servidor vuelven al campo que los causó;
//   · las preguntas frecuentes se mandan como diferencia (lib/bot/faqs.ts), así
//     que lo enseñado desde «Corregir» no se borra.

import { useCallback, useEffect, useRef, useState } from "react";
import type { EstadoGuardado } from "@/components/panel/ui";
import {
  BOT_VACIO,
  DATOS_VACIOS,
  MENSAJES_CAMPO,
  digitos,
  telefonoValido,
  type BotConfig,
  type DatosHotel,
  type Faq,
} from "./tipos";

type ParcheBot = Partial<Omit<BotConfig, "pago" | "emojis" | "faqs">> & {
  pago?: Partial<BotConfig["pago"]>;
  emojis?: Partial<BotConfig["emojis"]>;
};

interface Pendiente {
  bot: ParcheBot;
  faqs: boolean;
  enabled?: boolean;
  lang?: "es" | "en";
  adminPhone?: string;
  datos: Partial<DatosHotel>;
}

const vacio = (): Pendiente => ({ bot: {}, faqs: false, datos: {} });
const ESPERA_MS = 800;

export function useCamila() {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [bot, setBot] = useState<BotConfig>(BOT_VACIO);
  const [enabled, setEnabledState] = useState(true);
  const [lang, setLangState] = useState<"es" | "en">("es");
  const [adminPhone, setAdminPhoneState] = useState("");
  const [puedeConfigurar, setPuedeConfigurar] = useState(false);
  const [datos, setDatos] = useState<DatosHotel>(DATOS_VACIOS);
  const [faqsSitio, setFaqsSitio] = useState<Faq[]>([]);
  const [puedeEditarSitio, setPuedeEditarSitio] = useState(false);
  const [estado, setEstado] = useState<EstadoGuardado>("idle");
  const [errores, setErrores] = useState<Record<string, string>>({});

  const pendiente = useRef<Pendiente>(vacio());
  const faqsBase = useRef<Faq[]>([]);
  const botRef = useRef<BotConfig>(BOT_VACIO);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enVuelo = useRef(false);
  /** Para reprogramar un guardado desde dentro de `enviar` (que se define antes que `programar`). */
  const programarRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    botRef.current = bot;
  }, [bot]);

  const cargar = useCallback(async () => {
    try {
      const [rc, rs] = await Promise.all([
        fetch("/api/admin/bot-config", { cache: "no-store" }),
        fetch("/api/admin/camila-sabe", { cache: "no-store" }),
      ]);
      if (!rc.ok) throw new Error("config");
      const c = await rc.json();
      setEnabledState(Boolean(c.enabled));
      setLangState(c.lang === "en" ? "en" : "es");
      setAdminPhoneState(typeof c.adminPhone === "string" ? c.adminPhone : "");
      setPuedeConfigurar(Boolean(c.puedeConfigurar));
      const b: BotConfig = {
        ...BOT_VACIO,
        ...(c.bot ?? {}),
        pago: { ...BOT_VACIO.pago, ...(c.bot?.pago ?? {}) },
        emojis: { ...BOT_VACIO.emojis, ...(c.bot?.emojis ?? {}) },
        faqs: Array.isArray(c.bot?.faqs) ? c.bot.faqs.map((f: Faq) => ({ q: f.q ?? "", a: f.a ?? "" })) : [],
        pruebas: Number(c.bot?.pruebas) || 0,
      };
      setBot(b);
      faqsBase.current = b.faqs;
      if (rs.ok) {
        const s = await rs.json();
        setDatos({ ...DATOS_VACIOS, ...(s.datos ?? {}) });
        setFaqsSitio(Array.isArray(s.faqsSitio) ? s.faqsSitio : []);
        setPuedeEditarSitio(Boolean(s.puedeEditar));
      }
      setErrorCarga(null);
    } catch {
      setErrorCarga("No pude cargar la configuración de tu asistente. Revisa tu conexión y recarga la página.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const enviar = useCallback(async () => {
    if (enVuelo.current) {
      // Hay un guardado en curso: se reintenta al terminar.
      temporizador.current = setTimeout(() => programarRef.current?.(), 300);
      return;
    }
    const p = pendiente.current;
    pendiente.current = vacio();
    const cuerpoConfig: Record<string, unknown> = {};
    if (Object.keys(p.bot).length) cuerpoConfig.bot = p.bot;
    if (p.faqs) {
      const nuevo = botRef.current.faqs.filter((f) => f.q.trim());
      cuerpoConfig.faqs = { base: faqsBase.current, nuevo };
    }
    if (p.enabled !== undefined) cuerpoConfig.enabled = p.enabled;
    if (p.lang) cuerpoConfig.lang = p.lang;
    if (p.adminPhone !== undefined) cuerpoConfig.adminPhone = p.adminPhone;
    const hayConfig = Object.keys(cuerpoConfig).length > 0;
    const hayDatos = Object.keys(p.datos).length > 0;
    if (!hayConfig && !hayDatos) return;

    enVuelo.current = true;
    setEstado("guardando");
    const nuevosErrores: Record<string, string> = {};
    let fallo = false;
    try {
      const pedidos: Promise<void>[] = [];
      if (hayConfig) {
        pedidos.push(
          fetch("/api/admin/bot-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cuerpoConfig),
          }).then(async (r) => {
            const d = await r.json().catch(() => ({}));
            if (r.ok && d.ok) {
              if (p.faqs) faqsBase.current = (cuerpoConfig.faqs as { nuevo: Faq[] }).nuevo;
              return;
            }
            if (d.campo && d.error) {
              nuevosErrores[d.campo] = MENSAJES_CAMPO[d.error] ?? "Revisa este dato.";
              // El servidor rechazó la petición entera por UN campo: el resto se
              // vuelve a mandar sin él, para no perder lo demás.
              pendiente.current = fusionar(pendiente.current, sinCampo({ ...p, datos: {} }, d.campo));
              programarRef.current?.();
            } else {
              fallo = true;
              // Lo que no se guardó vuelve a la cola, para «Reintentar».
              pendiente.current = fusionar(pendiente.current, { ...p, datos: {} });
            }
          }),
        );
      }
      if (hayDatos) {
        pedidos.push(
          fetch("/api/admin/camila-sabe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p.datos),
          }).then(async (r) => {
            const d = await r.json().catch(() => ({}));
            if (r.ok && d.ok) return;
            if (d.campo && d.error) nuevosErrores[d.campo] = MENSAJES_CAMPO[d.error] ?? "Revisa este dato.";
            else {
              fallo = true;
              pendiente.current = fusionar(pendiente.current, { ...vacio(), datos: p.datos });
            }
          }),
        );
      }
      await Promise.all(pedidos);
    } catch {
      fallo = true;
      pendiente.current = fusionar(pendiente.current, p);
    } finally {
      enVuelo.current = false;
    }
    setErrores((e) => {
      const limpio = { ...e };
      // Un campo que se volvió a mandar y no trajo error, ya está bien.
      for (const k of [...Object.keys(p.bot), ...Object.keys(p.datos), ...(p.adminPhone !== undefined ? ["adminPhone"] : [])])
        delete limpio[k];
      if (p.bot.pago) for (const k of Object.keys(p.bot.pago)) delete limpio[k];
      return { ...limpio, ...nuevosErrores };
    });
    setEstado(fallo || Object.keys(nuevosErrores).length ? "error" : "guardado");
  }, []);

  const programar = useCallback(
    (inmediato = false) => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => void enviar(), inmediato ? 0 : ESPERA_MS);
    },
    [enviar],
  );
  useEffect(() => {
    programarRef.current = () => programar();
  }, [programar]);

  /**
   * Validación ANTES de mandar: un teléfono o una CLABE a medio escribir no se
   * guarda (ni se manda a que el servidor rechace el lote entero). El campo se
   * queda en pantalla con su aviso hasta que esté bien o vacío.
   */
  const marcar = useCallback((campo: string, mensaje: string | null) => {
    setErrores((e) => {
      if (!mensaje) {
        if (!(campo in e)) return e;
        const r = { ...e };
        delete r[campo];
        return r;
      }
      return { ...e, [campo]: mensaje };
    });
  }, []);

  // El estado «Cambios guardados» se apaga solo; el error se queda hasta que se arregle.
  useEffect(() => {
    if (estado !== "guardado") return;
    const t = setTimeout(() => setEstado("idle"), 2500);
    return () => clearTimeout(t);
  }, [estado]);

  // ── acciones ──
  const cambiarBot = useCallback(
    (parche: ParcheBot) => {
      setBot((b) => ({
        ...b,
        ...parche,
        pago: { ...b.pago, ...(parche.pago ?? {}) },
        emojis: { ...b.emojis, ...(parche.emojis ?? {}) },
      }));
      const aMandar: ParcheBot = { ...parche, ...(parche.pago ? { pago: { ...parche.pago } } : {}) };
      if (parche.escalarWhatsapp !== undefined) {
        const ok = !digitos(parche.escalarWhatsapp) || telefonoValido(parche.escalarWhatsapp);
        marcar("escalarWhatsapp", ok ? null : MENSAJES_CAMPO["telefono-invalido"]);
        if (!ok) delete aMandar.escalarWhatsapp;
      }
      if (parche.pago?.clabe !== undefined) {
        const d = digitos(parche.pago.clabe);
        const ok = !d || d.length === 18;
        marcar("clabe", ok ? null : MENSAJES_CAMPO["clabe-invalida"]);
        if (!ok && aMandar.pago) delete aMandar.pago.clabe;
      }
      if (aMandar.pago && !Object.keys(aMandar.pago).length) delete aMandar.pago;
      if (!Object.keys(aMandar).length) return;
      pendiente.current = fusionar(pendiente.current, { ...vacio(), bot: aMandar });
      programar();
    },
    [programar, marcar],
  );

  const cambiarFaqs = useCallback(
    (faqs: Faq[]) => {
      setBot((b) => ({ ...b, faqs }));
      botRef.current = { ...botRef.current, faqs };
      pendiente.current.faqs = true;
      programar();
    },
    [programar],
  );

  const cambiarDatos = useCallback(
    (parche: Partial<DatosHotel>) => {
      setDatos((d) => ({ ...d, ...parche }));
      pendiente.current = fusionar(pendiente.current, { ...vacio(), datos: parche });
      programar();
    },
    [programar],
  );

  const setEnabled = useCallback(
    (v: boolean) => {
      setEnabledState(v);
      pendiente.current.enabled = v;
      programar(true);
    },
    [programar],
  );

  const setLang = useCallback(
    (v: "es" | "en") => {
      setLangState(v);
      pendiente.current.lang = v;
      programar(true);
    },
    [programar],
  );

  const setAdminPhone = useCallback(
    (v: string) => {
      setAdminPhoneState(v);
      const ok = !digitos(v) || telefonoValido(v);
      marcar("adminPhone", ok ? null : MENSAJES_CAMPO["telefono-invalido"]);
      if (!ok) return;
      pendiente.current.adminPhone = v;
      programar();
    },
    [programar, marcar],
  );

  /** Cuenta una prueba exitosa (chat o verificador); el servidor marca "probada" a las 3. */
  const registrarPrueba = useCallback(() => {
    setBot((b) => {
      const pruebas = b.pruebas + 1;
      return { ...b, pruebas, probadoAt: b.probadoAt ?? (pruebas >= 3 ? new Date().toISOString() : null) };
    });
    fetch("/api/admin/bot-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prueba: true }),
    }).catch(() => {});
  }, []);

  /** Tras un «Corregir» en la bandeja: trae las preguntas nuevas sin perder lo que se está editando. */
  const recargarFaqs = useCallback(async () => {
    if (pendiente.current.faqs) return; // hay cambios propios por guardar: se combinan al guardar
    try {
      const r = await fetch("/api/admin/bot-config", { cache: "no-store" });
      const c = await r.json();
      const faqs: Faq[] = Array.isArray(c.bot?.faqs) ? c.bot.faqs.map((f: Faq) => ({ q: f.q ?? "", a: f.a ?? "" })) : [];
      faqsBase.current = faqs;
      setBot((b) => ({ ...b, faqs }));
    } catch {
      /* la próxima carga las trae */
    }
  }, []);

  const reintentar = useCallback(() => programar(true), [programar]);

  return {
    cargando,
    errorCarga,
    bot,
    enabled,
    lang,
    adminPhone,
    puedeConfigurar,
    datos,
    faqsSitio,
    puedeEditarSitio,
    estado,
    errores,
    cambiarBot,
    cambiarFaqs,
    cambiarDatos,
    setEnabled,
    setLang,
    setAdminPhone,
    registrarPrueba,
    recargarFaqs,
    reintentar,
  };
}

export type Camila = ReturnType<typeof useCamila>;

function fusionar(a: Pendiente, b: Pendiente): Pendiente {
  return {
    bot: {
      ...a.bot,
      ...b.bot,
      ...(a.bot.pago || b.bot.pago ? { pago: { ...(a.bot.pago ?? {}), ...(b.bot.pago ?? {}) } } : {}),
      ...(a.bot.emojis || b.bot.emojis ? { emojis: { ...(a.bot.emojis ?? {}), ...(b.bot.emojis ?? {}) } } : {}),
    },
    faqs: a.faqs || b.faqs,
    enabled: b.enabled ?? a.enabled,
    lang: b.lang ?? a.lang,
    adminPhone: b.adminPhone ?? a.adminPhone,
    datos: { ...a.datos, ...b.datos },
  };
}

/** Quita del lote el campo que el servidor rechazó. */
function sinCampo(p: Pendiente, campo: string): Pendiente {
  const bot = { ...p.bot };
  if (campo === "clabe" && bot.pago) {
    const pago = { ...bot.pago };
    delete pago.clabe;
    bot.pago = pago;
  } else delete (bot as Record<string, unknown>)[campo];
  const r: Pendiente = { ...p, bot };
  if (campo === "adminPhone") delete r.adminPhone;
  return r;
}
