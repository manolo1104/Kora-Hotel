"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Loader2,
  Check,
  Plus,
  Trash2,
  ImagePlus,
  ExternalLink,
  Copy,
  Download,
  Palette,
  Star,
  HelpCircle,
  FileText,
  Lock,
  Eye,
  ArrowUp,
  ArrowDown,
  Globe,
  MessageCircle,
  BedDouble,
  LayoutDashboard,
  TrendingUp,
  Users,
  Receipt,
  Sparkles,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AMENIDADES } from "@/lib/amenidades";
import {
  FUENTES,
  COLOR_PRESETS,
  COLOR_DEFAULT,
  FORMAS_PAGO,
  IDIOMAS,
  SECCION_LABELS,
  ordenSecciones,
  type Resena,
  type MiniFaq,
} from "@/lib/mini";

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200";

interface Tarifa {
  personas: string;
  precio: string;
}
interface Habitacion {
  nombre: string;
  precio: string;
  descripcion: string;
  capacidad?: string;
  fotos?: string[];
  tarifas?: Tarifa[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const TABS = [
  { key: "contenido", label: "Contenido" },
  { key: "habitaciones", label: "Habitaciones" },
  { key: "diseno", label: "Diseño" },
  { key: "resenas", label: "Reseñas y FAQ" },
  { key: "avanzado", label: "Avanzado" },
  { key: "compartir", label: "Compartir" },
] as const;

// Todo lo que opera Kora Pro (el salto desde la página gratis).
const KORA_PRO = [
  {
    Icon: Globe,
    t: "Motor de reservas directo",
    d: "Cobra reservas en tu web sin pagar comisión a Booking ni Airbnb.",
  },
  {
    Icon: MessageCircle,
    t: "Agente de WhatsApp con IA 24/7",
    d: "Contesta, cotiza, cobra el anticipo y confirma la reserva solo, a cualquier hora.",
  },
  {
    Icon: BedDouble,
    t: "PMS completo",
    d: "Mapa de habitaciones, check-in/out y housekeeping en una sola pantalla.",
  },
  {
    Icon: LayoutDashboard,
    t: "Dashboard con métricas",
    d: "Ocupación, ingresos, RevPAR y pronóstico a 30 días en tiempo real.",
  },
  {
    Icon: TrendingUp,
    t: "Pricing dinámico con IA",
    d: "Sube tarifas en alta demanda y llena en temporada baja, automático.",
  },
  {
    Icon: Users,
    t: "CRM + emails automáticos",
    d: "Mensajes pre y post estancia que convierten huéspedes en recurrentes.",
  },
  {
    Icon: Receipt,
    t: "Facturación CFDI 4.0",
    d: "Genera facturas ante el SAT directo desde cada reserva.",
  },
  {
    Icon: Sparkles,
    t: "Soporte humano en español",
    d: "Acceso directo por WhatsApp al equipo, no a un bot.",
  },
];

// Mejoras específicas de esta página (premium).
const KORA_PRO_PAGINA = [
  { Icon: Globe, t: "Dominio propio", d: "tuhotel.com en vez de kora-hotel.com/h/..." },
  { Icon: Lock, t: "Quitar “Hecho con Kora”", d: "Tu página sin la marca de Kora en el pie." },
  { Icon: BarChart3, t: "Analítica de visitas", d: "Visitas y clics a WhatsApp que genera tu página." },
];

export function PanelEditor({
  userId,
  planActivo = false,
}: {
  userId: string;
  planActivo?: boolean;
}) {
  const supabase = createClient();

  const [cargando, setCargando] = useState(true);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [tab, setTab] = useState<string>("contenido");
  // Wizard de bienvenida (solo cuando aún no existe el hotel)
  const [paso, setPaso] = useState(0);

  // Mini-página
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);
  const [publicado, setPublicado] = useState(true);

  // Extras (nivel hotel)
  const [amenidades, setAmenidades] = useState<string[]>([]);
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [mapEmbedUrl, setMapEmbedUrl] = useState("");

  // Diseño
  const [color, setColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [fuente, setFuente] = useState("jakarta");
  const [heroEstilo, setHeroEstilo] = useState<"banda" | "completa">("banda");
  const [orden, setOrden] = useState<string[]>([...ordenSecciones()]);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Reseñas y FAQ
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [faqs, setFaqs] = useState<MiniFaq[]>([]);

  // Políticas / pago / idiomas
  const [polCancelacion, setPolCancelacion] = useState("");
  const [polMascotas, setPolMascotas] = useState("");
  const [polNinos, setPolNinos] = useState("");
  const [formasPago, setFormasPago] = useState<string[]>([]);
  const [idiomas, setIdiomas] = useState<string[]>([]);

  // Premium (gancho — controlado por nosotros)
  const [marcaOculta, setMarcaOculta] = useState(false);

  // Guía del huésped
  const [wifi, setWifi] = useState("");
  const [wifiClave, setWifiClave] = useState("");
  const [gCheckin, setGCheckin] = useState("");
  const [gCheckout, setGCheckout] = useState("");
  const [reglas, setReglas] = useState("");
  const [recomendaciones, setRecomendaciones] = useState("");

  const [subiendo, setSubiendo] = useState(false);
  const [subiendoHab, setSubiendoHab] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  const qrPaginaRef = useRef<HTMLDivElement>(null);
  const qrGuiaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      const { data } = await supabase
        .from("hoteles")
        .select("*")
        .eq("owner_id", userId)
        .maybeSingle();
      if (activo && data) {
        setHotelId(data.id);
        setSlug(data.slug);
        setNombre(data.nombre ?? "");
        setUbicacion(data.ubicacion ?? "");
        setDescripcion(data.descripcion ?? "");
        setWhatsapp(data.whatsapp ?? "");
        setHabitaciones(Array.isArray(data.habitaciones) ? data.habitaciones : []);
        setFotos(Array.isArray(data.fotos) ? data.fotos : []);
        setPublicado(data.publicado !== false);
        const ex = data.extras ?? {};
        setAmenidades(Array.isArray(ex.amenidades) ? ex.amenidades : []);
        setInstagram(ex.instagram ?? "");
        setFacebook(ex.facebook ?? "");
        setMapsUrl(ex.mapsUrl ?? "");
        setMapEmbedUrl(ex.mapEmbedUrl ?? "");
        const d = ex.diseno ?? {};
        setColor(d.color ?? "");
        setLogoUrl(d.logoUrl ?? "");
        setFuente(d.fuente ?? "jakarta");
        setHeroEstilo(d.heroEstilo === "completa" ? "completa" : "banda");
        setOrden(ordenSecciones(d.ordenSecciones));
        setResenas(Array.isArray(ex.resenas) ? ex.resenas : []);
        setFaqs(Array.isArray(ex.faqs) ? ex.faqs : []);
        const p = ex.politicas ?? {};
        setPolCancelacion(p.cancelacion ?? "");
        setPolMascotas(p.mascotas ?? "");
        setPolNinos(p.ninos ?? "");
        setFormasPago(Array.isArray(ex.formasPago) ? ex.formasPago : []);
        setIdiomas(Array.isArray(ex.idiomas) ? ex.idiomas : []);
        setMarcaOculta(ex.premium?.marcaOculta === true);
        const g = data.guia ?? {};
        setWifi(g.wifi ?? "");
        setWifiClave(g.wifiClave ?? "");
        setGCheckin(g.checkin ?? "");
        setGCheckout(g.checkout ?? "");
        setReglas(Array.isArray(g.reglas) ? g.reglas.join("\n") : "");
        setRecomendaciones(
          Array.isArray(g.recomendaciones) ? g.recomendaciones.join("\n") : ""
        );
      }
      if (activo) setCargando(false);
    })();
    return () => {
      activo = false;
    };
  }, [supabase, userId]);

  const slugPreview = slug || slugify(nombre) || "tu-hotel";

  function addHab() {
    setHabitaciones((h) => [...h, { nombre: "", precio: "", descripcion: "" }]);
  }
  function updateHab(
    i: number,
    campo: "nombre" | "precio" | "descripcion" | "capacidad",
    valor: string
  ) {
    setHabitaciones((h) =>
      h.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it))
    );
  }
  function removeHab(i: number) {
    setHabitaciones((h) => h.filter((_, idx) => idx !== i));
  }

  function addTarifa(i: number) {
    setHabitaciones((h) =>
      h.map((it, idx) =>
        idx === i
          ? { ...it, tarifas: [...(it.tarifas ?? []), { personas: "", precio: "" }] }
          : it
      )
    );
  }
  function updateTarifa(i: number, j: number, campo: keyof Tarifa, valor: string) {
    setHabitaciones((h) =>
      h.map((it, idx) =>
        idx === i
          ? {
              ...it,
              tarifas: (it.tarifas ?? []).map((t, tj) =>
                tj === j ? { ...t, [campo]: valor } : t
              ),
            }
          : it
      )
    );
  }
  function removeTarifa(i: number, j: number) {
    setHabitaciones((h) =>
      h.map((it, idx) =>
        idx === i
          ? { ...it, tarifas: (it.tarifas ?? []).filter((_, tj) => tj !== j) }
          : it
      )
    );
  }

  function toggleAmenidad(key: string) {
    setAmenidades((a) =>
      a.includes(key) ? a.filter((k) => k !== key) : [...a, key]
    );
  }

  // Reseñas
  function addResena() {
    setResenas((r) => [...r, { autor: "", texto: "", estrellas: 5 }]);
  }
  function updateResena(i: number, campo: keyof Resena, valor: string | number) {
    setResenas((r) => r.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }
  function removeResena(i: number) {
    setResenas((r) => r.filter((_, idx) => idx !== i));
  }

  // FAQ
  function addFaq() {
    setFaqs((f) => [...f, { pregunta: "", respuesta: "" }]);
  }
  function updateFaq(i: number, campo: keyof MiniFaq, valor: string) {
    setFaqs((f) => f.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }
  function removeFaq(i: number) {
    setFaqs((f) => f.filter((_, idx) => idx !== i));
  }

  function toggleEnLista(valor: string, lista: string[], set: (v: string[]) => void) {
    set(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  }

  function moveSeccion(i: number, dir: -1 | 1) {
    setOrden((o) => {
      const j = i + dir;
      if (j < 0 || j >= o.length) return o;
      const copia = [...o];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }

  const subirArchivos = useCallback(
    async (files: FileList | null): Promise<string[]> => {
      if (!files || files.length === 0) return [];
      const nuevas: string[] = [];
      for (const file of Array.from(files)) {
        const limpio = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const rnd = Math.random().toString(36).slice(2, 6);
        const path = `${userId}/${Date.now()}-${rnd}-${limpio}`;
        const { error: upErr } = await supabase.storage
          .from("fotos")
          .upload(path, file, { upsert: false });
        if (upErr) {
          setError("No se pudo subir una foto. Inténtalo de nuevo.");
          continue;
        }
        const { data } = supabase.storage.from("fotos").getPublicUrl(path);
        nuevas.push(data.publicUrl);
      }
      return nuevas;
    },
    [supabase, userId]
  );

  const onSubirFotos = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setSubiendo(true);
      setError("");
      try {
        const nuevas = await subirArchivos(files);
        setFotos((f) => [...f, ...nuevas]);
      } finally {
        setSubiendo(false);
      }
    },
    [subirArchivos]
  );

  function removeFoto(url: string) {
    setFotos((f) => f.filter((u) => u !== url));
  }

  const onSubirLogo = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setSubiendoLogo(true);
      setError("");
      try {
        const nuevas = await subirArchivos(files);
        if (nuevas[0]) setLogoUrl(nuevas[0]);
      } finally {
        setSubiendoLogo(false);
      }
    },
    [subirArchivos]
  );

  const onSubirFotosHab = useCallback(
    async (i: number, files: FileList | null) => {
      if (!files || files.length === 0) return;
      setSubiendoHab(i);
      setError("");
      try {
        const nuevas = await subirArchivos(files);
        setHabitaciones((h) =>
          h.map((it, idx) =>
            idx === i ? { ...it, fotos: [...(it.fotos ?? []), ...nuevas] } : it
          )
        );
      } finally {
        setSubiendoHab(null);
      }
    },
    [subirArchivos]
  );

  function removeFotoHab(i: number, url: string) {
    setHabitaciones((h) =>
      h.map((it, idx) =>
        idx === i
          ? { ...it, fotos: (it.fotos ?? []).filter((u) => u !== url) }
          : it
      )
    );
  }

  function descargarQR(ref: React.RefObject<HTMLDivElement | null>, archivo: string) {
    const canvas = ref.current?.querySelector("canvas");
    if (!canvas) return;
    const png = (canvas as HTMLCanvasElement).toDataURL("image/png");
    const a = document.createElement("a");
    a.href = png;
    a.download = archivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function guardar() {
    setError("");
    if (!nombre.trim()) {
      setError("Ponle un nombre a tu hotel.");
      setTab("contenido");
      return;
    }
    setGuardando(true);
    setGuardado(false);

    const guia = {
      wifi: wifi.trim(),
      wifiClave: wifiClave.trim(),
      checkin: gCheckin.trim(),
      checkout: gCheckout.trim(),
      reglas: reglas.split("\n").map((l) => l.trim()).filter(Boolean),
      recomendaciones: recomendaciones
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    };

    const extras = {
      amenidades,
      instagram: instagram.trim(),
      facebook: facebook.trim(),
      mapsUrl: mapsUrl.trim(),
      mapEmbedUrl: mapEmbedUrl.trim(),
      diseno: {
        color: color.trim(),
        logoUrl,
        fuente,
        heroEstilo,
        ordenSecciones: orden,
      },
      resenas: resenas.filter((r) => (r.texto ?? "").trim()),
      faqs: faqs.filter((f) => (f.pregunta ?? "").trim()),
      politicas: {
        cancelacion: polCancelacion.trim(),
        mascotas: polMascotas.trim(),
        ninos: polNinos.trim(),
      },
      formasPago,
      idiomas,
      premium: { marcaOculta },
    };

    const payloadBase = {
      nombre: nombre.trim(),
      ubicacion: ubicacion.trim(),
      descripcion: descripcion.trim(),
      whatsapp: whatsapp.trim(),
      habitaciones,
      fotos,
      publicado,
      guia,
    };
    const payload = { ...payloadBase, extras };

    const COL_FALTANTE = "42703";

    try {
      if (hotelId) {
        let { error: upErr } = await supabase
          .from("hoteles")
          .update(payload)
          .eq("id", hotelId);
        if (upErr && upErr.code === COL_FALTANTE) {
          ({ error: upErr } = await supabase
            .from("hoteles")
            .update(payloadBase)
            .eq("id", hotelId));
        }
        if (upErr) throw upErr;
      } else {
        const intento = slugify(nombre) || "hotel";
        let creado = null;
        let usarExtras = true;
        for (let i = 0; i < 4 && !creado; i++) {
          const slugTry =
            i === 0 ? intento : `${intento}-${Math.random().toString(36).slice(2, 6)}`;
          const cuerpo = usarExtras ? payload : payloadBase;
          const { data, error: insErr } = await supabase
            .from("hoteles")
            .insert({ ...cuerpo, owner_id: userId, slug: slugTry })
            .select("id, slug")
            .single();
          if (!insErr && data) {
            creado = data;
          } else if (insErr && insErr.code === COL_FALTANTE && usarExtras) {
            usarExtras = false;
            i--;
          } else if (insErr && insErr.code !== "23505") {
            throw insErr;
          }
        }
        if (!creado) throw new Error("No se pudo crear. Intenta con otro nombre.");
        setHotelId(creado.id);
        setSlug(creado.slug);
      }
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="mt-8 flex items-center justify-center py-16">
        <Loader2 size={26} className="animate-spin text-kora-primary" />
      </div>
    );
  }

  const urlPagina = `${SITE}/h/${slug}`;
  const urlGuia = `${SITE}/g/${slug}`;
  const card = "bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm";

  // ─── Wizard de bienvenida: 4 pasos y tu página queda publicada ─────────────
  if (!hotelId) {
    const pasos = [
      { titulo: "Tu hotel", desc: "Empecemos por lo básico." },
      { titulo: "Contacto", desc: "Para que el huésped te escriba directo." },
      { titulo: "Fotos", desc: "La primera será tu portada." },
      { titulo: "Habitaciones", desc: "Al menos una para mostrar precios." },
    ];
    const puedeAvanzar =
      paso === 0 ? nombre.trim().length > 1 : paso === 1 ? whatsapp.trim().length >= 8 : true;

    return (
      <div className="mt-8 max-w-xl mx-auto">
        <div className={card}>
          {/* Progreso */}
          <div className="flex items-center gap-1.5 mb-5">
            {pasos.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= paso ? "bg-kora-primary" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest">
            Paso {paso + 1} de {pasos.length}
          </p>
          <h2 className="mt-1 text-xl font-bold text-kora-text">{pasos[paso].titulo}</h2>
          <p className="mt-1 text-sm text-kora-muted">{pasos[paso].desc}</p>

          <div className="mt-5 space-y-4">
            {paso === 0 && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-kora-text mb-1.5">
                    Nombre del hotel
                  </label>
                  <input
                    className={inputCls}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Hotel Paraíso Encantado"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-kora-text mb-1.5">
                    ¿Dónde está?
                  </label>
                  <input
                    className={inputCls}
                    value={ubicacion}
                    onChange={(e) => setUbicacion(e.target.value)}
                    placeholder="Xilitla, San Luis Potosí"
                  />
                </div>
              </>
            )}

            {paso === 1 && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-kora-text mb-1.5">
                    WhatsApp del hotel (con lada del país)
                  </label>
                  <input
                    className={inputCls}
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="52 489 123 4567"
                    inputMode="tel"
                    autoFocus
                  />
                  <p className="mt-1.5 text-xs text-kora-muted">
                    Aquí llegan las reservas de tu página.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-kora-text mb-1.5">
                    Describe tu hotel en 2 o 3 líneas
                  </label>
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="¿Por qué es especial y qué hay cerca?"
                  />
                </div>
              </>
            )}

            {paso === 2 && (
              <div>
                {fotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {fotos.map((url) => (
                      <div key={url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt="Foto del hotel"
                          className="w-full h-20 object-cover rounded-xl border border-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => removeFoto(url)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center text-red-600 shadow-sm"
                          aria-label="Quitar foto"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="btn-press inline-flex items-center gap-2 px-5 py-3 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors cursor-pointer">
                  {subiendo ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                  {subiendo ? "Subiendo…" : "Subir fotos"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={subiendo}
                    onChange={(e) => onSubirFotos(e.target.files)}
                  />
                </label>
                <p className="mt-2 text-xs text-kora-muted">
                  Puedes saltarte este paso y subirlas después.
                </p>
              </div>
            )}

            {paso === 3 && (
              <div className="space-y-3">
                {habitaciones.map((h, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      className={inputCls}
                      value={h.nombre}
                      onChange={(e) => updateHab(i, "nombre", e.target.value)}
                      placeholder="Habitación doble"
                    />
                    <input
                      className={inputCls}
                      value={h.precio}
                      onChange={(e) => updateHab(i, "precio", e.target.value)}
                      placeholder="Precio por noche (ej. 1500)"
                      inputMode="numeric"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addHab}
                  className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
                >
                  <Plus size={15} /> {habitaciones.length === 0 ? "Agregar mi primera habitación" : "Otra habitación"}
                </button>
                <p className="text-xs text-kora-muted">
                  También puedes saltarte este paso. En el editor podrás agregar fotos,
                  tarifas por personas y más.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPaso((p) => Math.max(0, p - 1))}
              disabled={paso === 0}
              className="btn-press px-5 py-3 rounded-full border border-gray-200 text-kora-text font-semibold text-sm disabled:opacity-40 hover:border-kora-accent transition-colors"
            >
              Atrás
            </button>
            {paso < pasos.length - 1 ? (
              <button
                type="button"
                onClick={() => setPaso((p) => p + 1)}
                disabled={!puedeAvanzar}
                className="btn-press btn-fill inline-flex items-center gap-2 px-7 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors disabled:opacity-50"
              >
                Siguiente <ArrowRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="btn-press btn-fill inline-flex items-center gap-2 px-7 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors disabled:opacity-60"
              >
                {guardando ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Publicando…
                  </>
                ) : (
                  "Publicar mi página"
                )}
              </button>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-kora-muted">
          Tu página queda en {SITE}/h/<span className="font-semibold">{slugPreview}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Dirección / enlaces (siempre visible) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
        <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-2">
          La dirección de tu mini-página
        </p>
        <p className="text-sm text-kora-text break-all">
          {SITE}/h/<span className="font-bold text-kora-primary">{slugPreview}</span>
        </p>
        {hotelId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/h/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
            >
              <ExternalLink size={14} /> Abrir mi página
            </a>
            <a
              href={`/h/${slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
            >
              <Eye size={14} /> Vista previa
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(urlPagina)}
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
            >
              <Copy size={14} /> Copiar enlace
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-kora-muted">
            La dirección se fija al guardar por primera vez (se crea a partir del
            nombre).
          </p>
        )}
      </div>

      {/* Checklist de activación (se oculta al completarse) */}
      {(() => {
        const items = [
          { ok: whatsapp.trim().length >= 8, label: "Pon tu WhatsApp", tab: "contenido" },
          { ok: fotos.length > 0, label: "Sube al menos 1 foto", tab: "contenido" },
          { ok: descripcion.trim().length > 20, label: "Describe tu hotel", tab: "contenido" },
          { ok: habitaciones.length > 0, label: "Agrega una habitación", tab: "habitaciones" },
          { ok: publicado, label: "Publica tu página", tab: "contenido" },
        ];
        const hechos = items.filter((i) => i.ok).length;
        if (hechos === items.length) return null;
        return (
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-kora-primary/15 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-kora-text">
                Deja tu página lista para recibir reservas
              </p>
              <span className="text-xs font-bold text-kora-primary tabular-nums">
                {hechos}/{items.length}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-kora-primary transition-all"
                style={{ width: `${(hechos / items.length) * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {items.map((i) => (
                <button
                  key={i.label}
                  type="button"
                  onClick={() => setTab(i.tab)}
                  className={`btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                    i.ok
                      ? "border-kora-accent bg-kora-accent/10 text-kora-primary"
                      : "border-gray-200 text-kora-muted hover:border-kora-accent"
                  }`}
                >
                  {i.ok ? <Check size={12} /> : <Plus size={12} />}
                  {i.label}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Pestañas */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`btn-press whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-kora-primary text-white"
                : "bg-white border border-gray-200 text-kora-muted hover:border-kora-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── CONTENIDO ─── */}
      {tab === "contenido" && (
        <div className="space-y-6">
          <div className={`${card} space-y-4`}>
            <h2 className="text-lg font-bold text-kora-text">Datos de tu hotel</h2>
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Nombre del hotel
              </label>
              <input
                className={inputCls}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Hotel Paraíso Encantado"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  Ubicación
                </label>
                <input
                  className={inputCls}
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Xilitla, San Luis Potosí"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  WhatsApp (con lada del país)
                </label>
                <input
                  className={inputCls}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="52 489 123 4567"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Descripción
              </label>
              <textarea
                className={inputCls}
                rows={4}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Cuéntale al huésped por qué tu hotel es especial y qué hay cerca."
              />
            </div>
          </div>

          {/* Fotos */}
          <div className={card}>
            <h2 className="text-lg font-bold text-kora-text mb-1">Fotos</h2>
            <p className="text-sm text-kora-muted mb-4">
              Sube las mejores fotos de tu hotel (la primera será la portada).
            </p>
            {fotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                {fotos.map((url) => (
                  <div key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Foto del hotel"
                      className="w-full h-24 object-cover rounded-xl border border-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeFoto(url)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center text-red-600 shadow-sm"
                      aria-label="Quitar foto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="btn-press inline-flex items-center gap-2 px-5 py-3 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors cursor-pointer">
              {subiendo ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {subiendo ? "Subiendo…" : "Subir fotos"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={subiendo}
                onChange={(e) => onSubirFotos(e.target.files)}
              />
            </label>
          </div>

          {/* Amenidades */}
          <div className={card}>
            <h2 className="text-lg font-bold text-kora-text mb-1">Amenidades</h2>
            <p className="text-sm text-kora-muted mb-4">
              Marca los servicios que ofrece tu hotel. Se muestran con iconos en tu página.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {AMENIDADES.map(({ key, label, Icon }) => {
                const activa = amenidades.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAmenidad(key)}
                    aria-pressed={activa}
                    className={`btn-press flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold text-left transition-colors ${
                      activa
                        ? "border-kora-accent bg-kora-accent/10 text-kora-primary"
                        : "border-gray-200 text-kora-muted hover:border-kora-accent"
                    }`}
                  >
                    <Icon size={16} aria-hidden={true} />
                    <span className="min-w-0 truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ubicación y redes */}
          <div className={`${card} space-y-4`}>
            <div>
              <h2 className="text-lg font-bold text-kora-text">Ubicación y redes</h2>
              <p className="text-sm text-kora-muted mt-0.5">
                Para que el huésped llegue fácil y te siga en redes.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Link de Google Maps (para “Cómo llegar”)
              </label>
              <input
                className={inputCls}
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                inputMode="url"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Mapa para mostrar en la página{" "}
                <span className="font-normal text-kora-muted">(opcional, URL de “insertar mapa”)</span>
              </label>
              <input
                className={inputCls}
                value={mapEmbedUrl}
                onChange={(e) => setMapEmbedUrl(e.target.value)}
                placeholder="https://www.google.com/maps/embed?pb=..."
                inputMode="url"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  Instagram
                </label>
                <input
                  className={inputCls}
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@tuhotel o link"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  Facebook
                </label>
                <input
                  className={inputCls}
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="Nombre o link de tu página"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── HABITACIONES ─── */}
      {tab === "habitaciones" && (
        <div className={card}>
          <h2 className="text-lg font-bold text-kora-text mb-1">Habitaciones</h2>
          <p className="text-sm text-kora-muted mb-4">
            Los tipos de habitación que ofreces y su precio por noche.
          </p>
          <div className="space-y-3">
            {habitaciones.map((h, i) => (
              <div key={i} className="rounded-xl border border-gray-100 p-4 bg-kora-bg/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className={inputCls}
                    value={h.nombre}
                    onChange={(e) => updateHab(i, "nombre", e.target.value)}
                    placeholder="Habitación doble"
                  />
                  <input
                    className={inputCls}
                    value={h.precio}
                    onChange={(e) => updateHab(i, "precio", e.target.value)}
                    placeholder="Precio base por noche (ej. 1500)"
                    inputMode="numeric"
                  />
                </div>
                <input
                  className={inputCls}
                  value={h.descripcion}
                  onChange={(e) => updateHab(i, "descripcion", e.target.value)}
                  placeholder="Breve descripción (opcional)"
                />
                <div className="sm:max-w-[50%]">
                  <input
                    className={inputCls}
                    value={h.capacidad ?? ""}
                    onChange={(e) => updateHab(i, "capacidad", e.target.value)}
                    placeholder="Capacidad: máx. huéspedes (ej. 4)"
                    inputMode="numeric"
                  />
                </div>

                <div className="rounded-lg bg-white border border-gray-100 p-3">
                  <p className="text-xs font-semibold text-kora-text mb-2">
                    Precios por número de personas{" "}
                    <span className="font-normal text-kora-muted">(opcional)</span>
                  </p>
                  {(h.tarifas ?? []).map((t, j) => (
                    <div key={j} className="flex items-center gap-2 mb-2">
                      <input
                        className={`${inputCls} !py-2`}
                        value={t.personas}
                        onChange={(e) => updateTarifa(i, j, "personas", e.target.value)}
                        placeholder="Personas (ej. 2)"
                        inputMode="numeric"
                      />
                      <input
                        className={`${inputCls} !py-2`}
                        value={t.precio}
                        onChange={(e) => updateTarifa(i, j, "precio", e.target.value)}
                        placeholder="Precio (ej. 1900)"
                        inputMode="numeric"
                      />
                      <button
                        type="button"
                        onClick={() => removeTarifa(i, j)}
                        className="btn-press flex-shrink-0 w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-red-600 hover:border-red-300"
                        aria-label="Quitar tarifa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addTarifa(i)}
                    className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary hover:text-kora-primary-dark"
                  >
                    <Plus size={14} /> Agregar precio por personas
                  </button>
                </div>

                <div>
                  {(h.fotos ?? []).length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-2">
                      {(h.fotos ?? []).map((url) => (
                        <div key={url} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt="Foto de la habitación"
                            className="w-full h-16 object-cover rounded-lg border border-gray-100"
                          />
                          <button
                            type="button"
                            onClick={() => removeFotoHab(i, url)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center text-red-600 shadow-sm"
                            aria-label="Quitar foto"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors cursor-pointer">
                    {subiendoHab === i ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <ImagePlus size={15} />
                    )}
                    {subiendoHab === i ? "Subiendo…" : "Fotos de la habitación"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={subiendoHab === i}
                      onChange={(e) => onSubirFotosHab(i, e.target.files)}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => removeHab(i)}
                  className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  <Trash2 size={14} /> Quitar habitación
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addHab}
            className="btn-press mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
          >
            <Plus size={16} /> Agregar habitación
          </button>
        </div>
      )}

      {/* ─── DISEÑO ─── */}
      {tab === "diseno" && (
        <div className="space-y-6">
          <div className={`${card} space-y-5`}>
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-kora-primary" />
              <h2 className="text-lg font-bold text-kora-text">Diseño de tu página</h2>
            </div>

            {/* Logo */}
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Logo de tu hotel
              </label>
              <div className="flex items-center gap-4">
                {logoUrl && (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-16 w-16 object-contain rounded-xl border border-gray-100 bg-white p-1"
                    />
                    <button
                      type="button"
                      onClick={() => setLogoUrl("")}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-red-600 shadow-sm"
                      aria-label="Quitar logo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                <label className="btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors cursor-pointer">
                  {subiendoLogo ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                  {subiendoLogo ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={subiendoLogo}
                    onChange={(e) => onSubirLogo(e.target.files)}
                  />
                </label>
              </div>
            </div>

            {/* Color de marca */}
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Color de marca
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    className={`w-9 h-9 rounded-full border-2 transition-transform ${
                      (color || COLOR_DEFAULT).toLowerCase() === c.toLowerCase()
                        ? "border-kora-text scale-110"
                        : "border-white shadow-sm"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="inline-flex items-center gap-2 ml-1 text-sm text-kora-muted">
                  <input
                    type="color"
                    value={color || COLOR_DEFAULT}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer bg-white"
                  />
                  Personalizado
                </label>
              </div>
            </div>

            {/* Tipografía */}
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Tipografía
              </label>
              <div className="flex flex-wrap gap-2">
                {FUENTES.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFuente(f.key)}
                    className={`btn-press px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${
                      fuente === f.key
                        ? "border-kora-accent bg-kora-accent/10 text-kora-primary"
                        : "border-gray-200 text-kora-muted hover:border-kora-accent"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estilo de portada */}
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Estilo de portada
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { k: "banda", label: "Banda con tarjeta" },
                  { k: "completa", label: "Portada a pantalla completa" },
                ].map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setHeroEstilo(o.k as "banda" | "completa")}
                    className={`btn-press px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${
                      heroEstilo === o.k
                        ? "border-kora-accent bg-kora-accent/10 text-kora-primary"
                        : "border-gray-200 text-kora-muted hover:border-kora-accent"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Orden de secciones */}
          <div className={card}>
            <h2 className="text-lg font-bold text-kora-text mb-1">Orden de las secciones</h2>
            <p className="text-sm text-kora-muted mb-4">
              Acomoda cómo aparecen las secciones en tu página.
            </p>
            <div className="space-y-2">
              {orden.map((s, i) => (
                <div
                  key={s}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-kora-bg/50 px-4 py-2.5"
                >
                  <span className="text-sm font-semibold text-kora-text">
                    {SECCION_LABELS[s] ?? s}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveSeccion(i, -1)}
                      disabled={i === 0}
                      className="btn-press w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-kora-text disabled:opacity-30 hover:border-kora-accent"
                      aria-label="Subir"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSeccion(i, 1)}
                      disabled={i === orden.length - 1}
                      className="btn-press w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-kora-text disabled:opacity-30 hover:border-kora-accent"
                      aria-label="Bajar"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── RESEÑAS Y FAQ ─── */}
      {tab === "resenas" && (
        <div className="space-y-6">
          <div className={card}>
            <div className="flex items-center gap-2 mb-1">
              <Star size={18} className="text-kora-primary" />
              <h2 className="text-lg font-bold text-kora-text">Reseñas de huéspedes</h2>
            </div>
            <p className="text-sm text-kora-muted mb-4">
              Agrega reseñas reales de tus huéspedes. Se muestran con su calificación y
              suman al rating de tu página.
            </p>
            <div className="space-y-3">
              {resenas.map((r, i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-4 bg-kora-bg/50 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      className={inputCls}
                      value={r.autor}
                      onChange={(e) => updateResena(i, "autor", e.target.value)}
                      placeholder="Nombre del huésped"
                    />
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => updateResena(i, "estrellas", n)}
                          aria-label={`${n} estrellas`}
                          className="btn-press p-1"
                        >
                          <Star
                            size={22}
                            className={n <= r.estrellas ? "fill-kora-accent text-kora-accent" : "text-gray-300"}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={r.texto}
                    onChange={(e) => updateResena(i, "texto", e.target.value)}
                    placeholder="Lo que dijo el huésped…"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <input
                      className={`${inputCls} !py-2 sm:max-w-[50%]`}
                      value={r.fecha ?? ""}
                      onChange={(e) => updateResena(i, "fecha", e.target.value)}
                      placeholder="Fecha (ej. Mayo 2026)"
                    />
                    <button
                      type="button"
                      onClick={() => removeResena(i)}
                      className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={14} /> Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addResena}
              className="btn-press mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
            >
              <Plus size={16} /> Agregar reseña
            </button>
          </div>

          {/* FAQ */}
          <div className={card}>
            <div className="flex items-center gap-2 mb-1">
              <HelpCircle size={18} className="text-kora-primary" />
              <h2 className="text-lg font-bold text-kora-text">Preguntas frecuentes</h2>
            </div>
            <p className="text-sm text-kora-muted mb-4">
              Responde de antemano lo que más te preguntan (mascotas, estacionamiento,
              llegada tarde…).
            </p>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-4 bg-kora-bg/50 space-y-3">
                  <input
                    className={inputCls}
                    value={f.pregunta}
                    onChange={(e) => updateFaq(i, "pregunta", e.target.value)}
                    placeholder="¿Aceptan mascotas?"
                  />
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={f.respuesta}
                    onChange={(e) => updateFaq(i, "respuesta", e.target.value)}
                    placeholder="Sí, aceptamos mascotas pequeñas con un cargo adicional…"
                  />
                  <button
                    type="button"
                    onClick={() => removeFaq(i)}
                    className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={14} /> Quitar
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addFaq}
              className="btn-press mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
            >
              <Plus size={16} /> Agregar pregunta
            </button>
          </div>
        </div>
      )}

      {/* ─── AVANZADO ─── */}
      {tab === "avanzado" && (
        <div className="space-y-6">
          {/* Políticas / pago / idiomas */}
          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-kora-primary" />
              <h2 className="text-lg font-bold text-kora-text">Políticas e información</h2>
            </div>
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Política de cancelación
              </label>
              <input
                className={inputCls}
                value={polCancelacion}
                onChange={(e) => setPolCancelacion(e.target.value)}
                placeholder="Ej. Cancelación gratis hasta 48 h antes."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">Mascotas</label>
                <input
                  className={inputCls}
                  value={polMascotas}
                  onChange={(e) => setPolMascotas(e.target.value)}
                  placeholder="Ej. Pet-friendly con cargo"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">Niños</label>
                <input
                  className={inputCls}
                  value={polNinos}
                  onChange={(e) => setPolNinos(e.target.value)}
                  placeholder="Ej. Menores de 5 sin costo"
                />
              </div>
            </div>
            <div>
              <p className="block text-sm font-semibold text-kora-text mb-2">Formas de pago</p>
              <div className="flex flex-wrap gap-2">
                {FORMAS_PAGO.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleEnLista(f, formasPago, setFormasPago)}
                    className={`btn-press px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                      formasPago.includes(f)
                        ? "border-kora-accent bg-kora-accent/10 text-kora-primary"
                        : "border-gray-200 text-kora-muted hover:border-kora-accent"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="block text-sm font-semibold text-kora-text mb-2">Idiomas que hablan</p>
              <div className="flex flex-wrap gap-2">
                {IDIOMAS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleEnLista(l, idiomas, setIdiomas)}
                    className={`btn-press px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                      idiomas.includes(l)
                        ? "border-kora-accent bg-kora-accent/10 text-kora-primary"
                        : "border-gray-200 text-kora-muted hover:border-kora-accent"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Guía del huésped */}
          <div className={`${card} space-y-4`}>
            <div>
              <h2 className="text-lg font-bold text-kora-text">Guía del huésped</h2>
              <p className="text-sm text-kora-muted mt-0.5">
                La info útil para tus huéspedes (wifi, horarios, reglas, recomendaciones).
                Aparece en tu página de guía con su propio QR para la habitación.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">Red WiFi</label>
                <input className={inputCls} value={wifi} onChange={(e) => setWifi(e.target.value)} placeholder="Nombre de la red" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">Clave WiFi</label>
                <input className={inputCls} value={wifiClave} onChange={(e) => setWifiClave(e.target.value)} placeholder="Contraseña" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">Hora de check-in</label>
                <input className={inputCls} value={gCheckin} onChange={(e) => setGCheckin(e.target.value)} placeholder="3:00 PM" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">Hora de check-out</label>
                <input className={inputCls} value={gCheckout} onChange={(e) => setGCheckout(e.target.value)} placeholder="12:00 PM" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Reglas de la casa (una por línea)
              </label>
              <textarea
                className={inputCls}
                rows={3}
                value={reglas}
                onChange={(e) => setReglas(e.target.value)}
                placeholder={"No fumar dentro de la habitación\nSilencio después de las 10 PM"}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Recomendaciones de la zona (una por línea)
              </label>
              <textarea
                className={inputCls}
                rows={3}
                value={recomendaciones}
                onChange={(e) => setRecomendaciones(e.target.value)}
                placeholder={"Las Pozas (Jardín de Edward James)\nCafé Conde para desayunar"}
              />
            </div>
          </div>

          {/* Marca de Kora (premium: solo con plan activo) */}
          <div className={`${card} space-y-3`}>
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-kora-primary" />
              <h2 className="text-lg font-bold text-kora-text">Marca de Kora en tu página</h2>
            </div>
            {planActivo ? (
              <>
                <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-kora-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marcaOculta}
                    onChange={(e) => setMarcaOculta(e.target.checked)}
                    className="w-4 h-4 accent-kora-primary"
                  />
                  Ocultar “Hecho con Kora” en el pie de mi página
                </label>
                <p className="text-xs text-kora-muted">
                  Incluido en tu plan. Guarda para aplicar el cambio.
                </p>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-kora-muted leading-relaxed">
                  Tu página gratis muestra “Hecho con Kora” en el pie. Con
                  cualquier plan de Kora puedes quitarla.
                </p>
                <a
                  href="/precios"
                  className="btn-press inline-flex items-center px-4 py-2 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
                >
                  Ver planes
                </a>
              </div>
            )}
          </div>

          {/* Kora Pro — el salto completo */}
          <div className="rounded-2xl border border-kora-primary/20 bg-kora-primary p-6 sm:p-7 text-white">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-kora-accent text-kora-primary text-xs font-bold mb-3">
              <Sparkles size={13} aria-hidden="true" /> Kora Pro
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              De tu página gratis a tu hotel en automático
            </h2>
            <p className="mt-2 text-white/70 text-sm leading-relaxed max-w-xl">
              Esta página gratis capta reservas por WhatsApp. Con Kora Pro no solo se
              ven mejor: el sistema opera tu hotel completo por ti.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {KORA_PRO.map(({ Icon, t, d }) => (
                <div key={t} className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-kora-accent/20 flex items-center justify-center">
                    <Icon size={17} className="text-kora-accent" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white leading-tight">{t}</p>
                    <p className="text-xs text-white/60 mt-0.5 leading-snug">{d}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-white/15">
              <p className="text-[11px] font-bold uppercase tracking-widest text-kora-accent mb-3">
                Y para esta misma página
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {KORA_PRO_PAGINA.map(({ Icon, t, d }) => (
                  <div key={t} className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <Icon size={15} className="text-white/70 mb-2" aria-hidden="true" />
                    <p className="text-sm font-bold text-white">{t}</p>
                    <p className="text-xs text-white/60 mt-0.5 leading-snug">{d}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/#contacto"
                className="btn-press btn-arrow inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                Quiero subir a Kora <ArrowRight size={15} aria-hidden="true" />
              </a>
              <a
                href="/precios"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press inline-flex items-center gap-1.5 px-5 py-3 rounded-full border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                Ver precios
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─── COMPARTIR ─── */}
      {tab === "compartir" && hotelId && (
        <div className={card}>
          <h2 className="text-lg font-bold text-kora-text mb-1">Tus códigos QR</h2>
          <p className="text-sm text-kora-muted mb-5">
            Imprímelos: el de reservas para recepción y redes; el de la guía para la habitación.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="text-center">
              <div ref={qrPaginaRef} className="inline-flex p-3 rounded-xl border border-gray-100 bg-white">
                <QRCodeCanvas value={urlPagina} size={150} fgColor="#1B4332" level="M" marginSize={2} />
              </div>
              <p className="mt-2 text-xs font-semibold text-kora-text">Página de reservas</p>
              <button
                type="button"
                onClick={() => descargarQR(qrPaginaRef, "qr-reservas.png")}
                className="btn-press mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text text-sm font-semibold hover:border-kora-accent transition-colors"
              >
                <Download size={14} /> Descargar
              </button>
            </div>
            <div className="text-center">
              <div ref={qrGuiaRef} className="inline-flex p-3 rounded-xl border border-gray-100 bg-white">
                <QRCodeCanvas value={urlGuia} size={150} fgColor="#1B4332" level="M" marginSize={2} />
              </div>
              <p className="mt-2 text-xs font-semibold text-kora-text">Guía del huésped</p>
              <button
                type="button"
                onClick={() => descargarQR(qrGuiaRef, "qr-guia.png")}
                className="btn-press mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text text-sm font-semibold hover:border-kora-accent transition-colors"
              >
                <Download size={14} /> Descargar
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === "compartir" && !hotelId && (
        <div className={card}>
          <p className="text-sm text-kora-muted">
            Guarda tu página por primera vez para generar tus códigos QR.
          </p>
        </div>
      )}

      {/* Guardar (sticky) */}
      <div className="sticky bottom-4 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-gray-100 shadow-lg flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-kora-text cursor-pointer">
              <input
                type="checkbox"
                checked={publicado}
                onChange={(e) => setPublicado(e.target.checked)}
                className="w-4 h-4 accent-kora-primary"
              />
              Publicada
            </label>
            <div className="text-sm">
              {error ? (
                <span className="text-red-600">{error}</span>
              ) : guardado ? (
                <span className="text-kora-primary font-semibold inline-flex items-center gap-1.5">
                  <Check size={16} /> Guardado
                </span>
              ) : (
                <span className="text-kora-muted hidden sm:inline">Guarda cuando termines.</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="btn-press btn-fill inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors disabled:opacity-60"
          >
            {guardando ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Guardando…
              </>
            ) : (
              "Guardar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
