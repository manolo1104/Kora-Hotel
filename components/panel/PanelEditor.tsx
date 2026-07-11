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
  Users,
  Receipt,
  Sparkles,
  BarChart3,
  ArrowRight,
  CalendarCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deriveUnidades } from "@/lib/booking";
import { AMENIDADES, AMENIDADES_HAB } from "@/lib/amenidades";
import {
  FUENTES,
  fontStack,
  COLOR_PRESETS,
  COLOR_DEFAULT,
  FORMAS_PAGO,
  IDIOMAS,
  SECCION_LABELS,
  ordenSecciones,
  type Resena,
  type MiniFaq,
  type Addon,
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
  features?: string[]; // características de la habitación (etiquetas, chips)
  cantidad?: number | string; // unidades físicas del tipo (default 1)
  unidades?: string[]; // nombres de cada unidad (solo si cantidad > 1)
}
// Temporada tal como se edita en el formulario (valores como string para los
// inputs; se convierten a números al guardar en extras.temporadas).
interface TemporadaForm {
  id: string;
  nombre: string;
  desde: string;
  hasta: string;
  tipo: "porcentaje" | "fijo";
  valor: string;
  minNoches: string;
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

// Comprime/redimensiona una imagen EN EL NAVEGADOR antes de subirla: la escala a
// máx. `maxDim` px por lado y la exporta a WebP. Si algo falla o no es una imagen
// rasterizable (SVG/GIF), devuelve el archivo original — nunca bloquea la subida.
// Reduce mucho el peso → el motor de reservas carga más rápido.
async function comprimirImagen(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const t = file.type;
  if (!t.startsWith("image/") || t === "image/svg+xml" || t === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/webp", quality)
    );
    // Solo usar la comprimida si de verdad pesa menos (fotos ya pequeñas no ganan).
    return blob && blob.size > 0 && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
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
  hotelSlug,
}: {
  userId: string;
  planActivo?: boolean;
  // Multi-tenant: si se pasa, el editor carga ESE hotel por slug (un usuario
  // puede tener varios). Sin él, carga el único hotel del usuario por owner_id
  // (comportamiento original, conservado para no romper usos previos).
  hotelSlug?: string;
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
  const [acento, setAcento] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [fuente, setFuente] = useState("jakarta");
  const [heroEstilo, setHeroEstilo] = useState<"banda" | "completa">("banda");
  const [portada, setPortada] = useState(true);
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

  // Reglas de reserva (anticipo, mínimo de noches) — viven en extras.reglas
  const [anticipoPct, setAnticipoPct] = useState(50);
  const [minNoches, setMinNoches] = useState(1);
  // Tarifa no reembolsable + plazo de cancelación gratis (extras.reglas)
  const [nrfActiva, setNrfActiva] = useState(false);
  const [nrfPct, setNrfPct] = useState(10);
  const [cancelacionDias, setCancelacionDias] = useState(2);
  const [pagoEnHotel, setPagoEnHotel] = useState(false);
  // Impuestos para el desglose del motor (extras.impuestos)
  const [ishPct, setIshPct] = useState(0);
  // Medición propia del hotel en su motor (extras.medicion)
  const [medGa4, setMedGa4] = useState("");
  const [medPixel, setMedPixel] = useState("");
  // Avisos por correo + recuperación de abandono (extras.notificaciones)
  const [notifEmail, setNotifEmail] = useState("");
  const [abandonoActivo, setAbandonoActivo] = useState(true);

  // Extras vendibles (add-ons) — viven en extras.addons
  const [addons, setAddons] = useState<Addon[]>([]);
  function addAddon() {
    setAddons((a) => [...a, { nombre: "", precio: 0, tipo: "estancia" }]);
  }
  function updateAddon(i: number, campo: keyof Addon, valor: string | number) {
    setAddons((a) => a.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }
  function removeAddon(i: number) {
    setAddons((a) => a.filter((_, idx) => idx !== i));
  }

  // Temporadas y tarifas por fecha (extras.temporadas) + recargo de fin de semana
  // (extras.recargoFinDeSemana). El motor las respeta noche por noche server-side.
  const [temporadas, setTemporadas] = useState<TemporadaForm[]>([]);
  const [finSemActivo, setFinSemActivo] = useState(false);
  const [finSemDias, setFinSemDias] = useState<number[]>([5, 6]);
  const [finSemTipo, setFinSemTipo] = useState<"porcentaje" | "fijo">("porcentaje");
  const [finSemValor, setFinSemValor] = useState("");
  function addTemporada() {
    setTemporadas((t) => [
      ...t,
      {
        id: Math.random().toString(36).slice(2, 10),
        nombre: "",
        desde: "",
        hasta: "",
        tipo: "porcentaje",
        valor: "",
        minNoches: "",
      },
    ]);
  }
  function updateTemporada(i: number, campo: keyof TemporadaForm, valor: string) {
    setTemporadas((t) => t.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }
  function removeTemporada(i: number) {
    setTemporadas((t) => t.filter((_, idx) => idx !== i));
  }
  function toggleFinSemDia(d: number) {
    setFinSemDias((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));
  }

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

  // Extras crudo tal como vino de la BD: guardar() lo usa de base para NO
  // borrar claves que este editor no maneja (ej. extras.onboarding).
  const extrasBase = useRef<Record<string, unknown>>({});

  const qrPaginaRef = useRef<HTMLDivElement>(null);
  const qrGuiaRef = useRef<HTMLDivElement>(null);
  const qrMotorRef = useRef<HTMLDivElement>(null);
  const [copiadoEmbed, setCopiadoEmbed] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      // Por slug (multi-tenant) si viene; si no, el hotel del usuario por owner_id.
      const query = supabase.from("hoteles").select("*");
      const { data } = await (hotelSlug
        ? query.eq("slug", hotelSlug)
        : query.eq("owner_id", userId)
      ).maybeSingle();
      if (activo && data) {
        setHotelId(data.id);
        setSlug(data.slug);
        setNombre(data.nombre ?? "");
        setUbicacion(data.ubicacion ?? "");
        setDescripcion(data.descripcion ?? "");
        setWhatsapp(data.whatsapp ?? "");
        setHabitaciones(
          (Array.isArray(data.habitaciones) ? data.habitaciones : []).map(
            (h: Habitacion) => {
              const cant = Math.max(1, Math.min(50, Math.round(Number(h?.cantidad) || 1)));
              // Poblar la lista de unidades para que la UI la pueda editar.
              return cant > 1
                ? {
                    ...h,
                    cantidad: cant,
                    unidades: deriveUnidades(
                      String(h?.nombre || "").trim() || "Habitación",
                      cant,
                      h?.unidades
                    ),
                  }
                : { ...h, cantidad: cant };
            }
          )
        );
        setFotos(Array.isArray(data.fotos) ? data.fotos : []);
        setPublicado(data.publicado !== false);
        const ex = data.extras ?? {};
        extrasBase.current = ex;
        setAmenidades(Array.isArray(ex.amenidades) ? ex.amenidades : []);
        setInstagram(ex.instagram ?? "");
        setFacebook(ex.facebook ?? "");
        setMapsUrl(ex.mapsUrl ?? "");
        setMapEmbedUrl(ex.mapEmbedUrl ?? "");
        const d = ex.diseno ?? {};
        setColor(d.color ?? "");
        setAcento(d.acento ?? "");
        setLogoUrl(d.logoUrl ?? "");
        setFuente(d.fuente ?? "jakarta");
        setHeroEstilo(d.heroEstilo === "completa" ? "completa" : "banda");
        setPortada(d.portada !== false);
        setOrden(ordenSecciones(d.ordenSecciones));
        setResenas(Array.isArray(ex.resenas) ? ex.resenas : []);
        setFaqs(Array.isArray(ex.faqs) ? ex.faqs : []);
        const p = ex.politicas ?? {};
        setPolCancelacion(p.cancelacion ?? "");
        setPolMascotas(p.mascotas ?? "");
        setPolNinos(p.ninos ?? "");
        setFormasPago(Array.isArray(ex.formasPago) ? ex.formasPago : []);
        setIdiomas(Array.isArray(ex.idiomas) ? ex.idiomas : []);
        const rg = ex.reglas ?? {};
        setAnticipoPct(typeof rg.anticipoPct === "number" ? rg.anticipoPct : 50);
        setMinNoches(typeof rg.minNoches === "number" ? rg.minNoches : 1);
        setNrfActiva(rg.nrfActiva === true);
        setNrfPct(typeof rg.nrfPct === "number" ? rg.nrfPct : 10);
        setCancelacionDias(typeof rg.cancelacionDias === "number" ? rg.cancelacionDias : 2);
        setPagoEnHotel(rg.pagoEnHotel === true);
        setIshPct(typeof ex.impuestos?.ishPct === "number" ? ex.impuestos.ishPct : 0);
        setMedGa4(ex.medicion?.ga4Id ?? "");
        setMedPixel(ex.medicion?.metaPixelId ?? "");
        setNotifEmail(ex.notificaciones?.email ?? "");
        setAbandonoActivo(ex.notificaciones?.abandono !== false);
        setAddons(Array.isArray(ex.addons) ? ex.addons : []);
        setTemporadas(
          Array.isArray(ex.temporadas)
            ? ex.temporadas.map((t: Record<string, unknown>) => {
                const aj = (t?.ajuste ?? {}) as Record<string, unknown>;
                return {
                  id: typeof t?.id === "string" ? t.id : Math.random().toString(36).slice(2, 10),
                  nombre: typeof t?.nombre === "string" ? t.nombre : "",
                  desde: typeof t?.desde === "string" ? t.desde : "",
                  hasta: typeof t?.hasta === "string" ? t.hasta : "",
                  tipo: aj.tipo === "fijo" ? "fijo" : "porcentaje",
                  valor: aj.valor != null ? String(aj.valor) : "",
                  minNoches: t?.minNoches != null ? String(t.minNoches) : "",
                };
              })
            : []
        );
        const rfs = (ex.recargoFinDeSemana ?? null) as Record<string, unknown> | null;
        if (rfs && typeof rfs === "object") {
          const aj = (rfs.ajuste ?? {}) as Record<string, unknown>;
          setFinSemActivo(rfs.activo === true);
          setFinSemDias(
            Array.isArray(rfs.dias) && rfs.dias.length
              ? (rfs.dias as number[])
              : [5, 6]
          );
          setFinSemTipo(aj.tipo === "fijo" ? "fijo" : "porcentaje");
          setFinSemValor(aj.valor != null ? String(aj.valor) : "");
        }
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
  }, [supabase, userId, hotelSlug]);

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
  // Cambia la cantidad de unidades del tipo y redimensiona la lista de nombres
  // (conserva los que ya escribió el hotelero; rellena los nuevos con el default).
  function updateHabCantidad(i: number, valor: string) {
    const n = Math.max(1, Math.min(50, Math.round(Number(valor) || 1)));
    setHabitaciones((h) =>
      h.map((it, idx) => {
        if (idx !== i) return it;
        const nombre = String(it.nombre || "").trim() || "Habitación";
        const derived = deriveUnidades(nombre, n);
        const prev = Array.isArray(it.unidades) ? it.unidades : [];
        const unidades = derived.map((d, u) => (prev[u]?.trim() ? prev[u] : d));
        return { ...it, cantidad: n, unidades: n > 1 ? unidades : undefined };
      })
    );
  }
  function updateHabUnidad(i: number, j: number, valor: string) {
    setHabitaciones((h) =>
      h.map((it, idx) =>
        idx === i
          ? { ...it, unidades: (it.unidades ?? []).map((u, uj) => (uj === j ? valor : u)) }
          : it
      )
    );
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

  // Activa/desactiva una característica (feature) de la habitación i.
  function toggleHabFeature(i: number, label: string) {
    setHabitaciones((h) =>
      h.map((it, idx) => {
        if (idx !== i) return it;
        const cur = Array.isArray(it.features) ? it.features : [];
        const features = cur.includes(label)
          ? cur.filter((f) => f !== label)
          : [...cur, label];
        return { ...it, features };
      })
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
        // Comprimir antes de subir (WebP; fallback al original si no aplica).
        const blob = await comprimirImagen(file);
        const esWebp = blob !== file && blob.type === "image/webp";
        const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
        const ext = esWebp ? "webp" : (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
        const rnd = Math.random().toString(36).slice(2, 6);
        const path = `${userId}/${Date.now()}-${rnd}-${base}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("fotos")
          .upload(path, blob, { upsert: false, contentType: esWebp ? "image/webp" : file.type || undefined });
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
    // Los nombres de unidad son la identidad en disponibilidad (blocks): dos
    // unidades con el mismo nombre se pisarían. Deben ser únicos en todo el hotel.
    const nombresUnidad = habitaciones
      .flatMap((h) => {
        const cant = Math.max(1, Math.min(50, Math.round(Number(h.cantidad) || 1)));
        return deriveUnidades(String(h.nombre || "").trim() || "Habitación", cant, h.unidades);
      })
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean);
    const dup = nombresUnidad.find((u, idx) => nombresUnidad.indexOf(u) !== idx);
    if (dup) {
      setError("Hay nombres de unidad repetidos. Cada unidad (y tipo) debe tener un nombre único.");
      setTab("habitaciones");
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

    // Claves que SÍ maneja este editor. La base (claves ajenas como
    // extras.onboarding) se agrega al momento de escribir, releída de la BD.
    const extrasPropios = {
      amenidades,
      instagram: instagram.trim(),
      facebook: facebook.trim(),
      mapsUrl: mapsUrl.trim(),
      mapEmbedUrl: mapEmbedUrl.trim(),
      diseno: {
        color: color.trim(),
        acento: acento.trim(),
        logoUrl,
        fuente,
        heroEstilo,
        portada,
        ordenSecciones: orden,
      },
      resenas: resenas.filter((r) => (r.texto ?? "").trim()),
      faqs: faqs.filter((f) => (f.pregunta ?? "").trim()),
      politicas: {
        cancelacion: polCancelacion.trim(),
        mascotas: polMascotas.trim(),
        ninos: polNinos.trim(),
      },
      reglas: {
        anticipoPct,
        minNoches,
        nrfActiva,
        nrfPct,
        cancelacionDias,
        pagoEnHotel,
      },
      impuestos: { ishPct },
      medicion: {
        ga4Id: medGa4.trim(),
        metaPixelId: medPixel.trim(),
      },
      notificaciones: {
        email: notifEmail.trim(),
        abandono: abandonoActivo,
      },
      addons: addons
        .filter((a) => (a.nombre ?? "").trim())
        .map((a) => ({ nombre: a.nombre.trim(), precio: Number(a.precio) || 0, tipo: a.tipo })),
      // Temporadas: solo las que tienen fechas y valor. El resolver del motor
      // (lib/booking/rooms.ts) revalida y clampa al leer, así que aquí basta filtrar.
      temporadas: temporadas
        .filter((t) => t.desde && t.hasta && t.valor !== "")
        .map((t) => ({
          id: t.id,
          nombre: t.nombre.trim() || "Temporada",
          desde: t.desde,
          hasta: t.hasta,
          ajuste: { tipo: t.tipo, valor: Number(t.valor) || 0 },
          ...(Number(t.minNoches) > 0 ? { minNoches: Number(t.minNoches) } : {}),
        })),
      recargoFinDeSemana: {
        activo: finSemActivo,
        dias: finSemDias,
        ajuste: { tipo: finSemTipo, valor: Number(finSemValor) || 0 },
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

    const COL_FALTANTE = "42703";

    try {
      // Releer extras JUSTO antes de escribir: el onboarding u otra pestaña
      // pudieron guardar claves desde que este editor cargó; con la foto vieja
      // de la carga, este update las revertía (last-write-wins del jsonb).
      if (hotelId) {
        try {
          const { data: fresco } = await supabase
            .from("hoteles")
            .select("extras")
            .eq("id", hotelId)
            .maybeSingle();
          if (fresco?.extras && typeof fresco.extras === "object") {
            extrasBase.current = fresco.extras as Record<string, unknown>;
          }
        } catch {
          // Sin lectura fresca se usa la base de la carga (comportamiento previo).
        }
      }
      const extras = { ...extrasBase.current, ...extrasPropios };
      const payload = { ...payloadBase, extras };

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
      // La nueva base es lo recién guardado (para el siguiente guardar()).
      extrasBase.current = extras;
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
  const urlMotor = `${SITE}/h/${slug}/reservar`;
  const embedSnippet = `<script src="${SITE}/embed.js" data-hotel="${slug}"></script>`;
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
              href={`/h/${slug}/reservar`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
            >
              <CalendarCheck size={14} /> Mi motor de reservas
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

                {/* Inventario: cuántas unidades físicas idénticas de este tipo */}
                <div className="rounded-lg bg-white border border-gray-100 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs font-semibold text-kora-text">
                      Unidades de este tipo
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className={`${inputCls} !py-2 w-24`}
                      value={h.cantidad ?? 1}
                      onChange={(e) => updateHabCantidad(i, e.target.value)}
                    />
                    <span className="text-xs text-kora-muted">
                      cuántos cuartos idénticos de este tipo tienes (1 = uno solo)
                    </span>
                  </div>
                  {Number(h.cantidad ?? 1) > 1 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] text-kora-muted">
                        Nombre de cada unidad (único; cada uno tendrá su propio
                        calendario/OTA):
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(h.unidades ?? []).map((u, j) => (
                          <input
                            key={j}
                            className={`${inputCls} !py-2`}
                            value={u}
                            onChange={(e) => updateHabUnidad(i, j, e.target.value)}
                            placeholder={`Unidad ${j + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
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

                {/* Características de la habitación (chips → habitacion.features) */}
                <div className="rounded-lg bg-white border border-gray-100 p-3">
                  <p className="text-xs font-semibold text-kora-text mb-2">
                    Características de la habitación{" "}
                    <span className="font-normal text-kora-muted">
                      (se muestran como etiquetas en el motor)
                    </span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AMENIDADES_HAB.map(({ key, label, Icon }) => {
                      const activa = (h.features ?? []).includes(label);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleHabFeature(i, label)}
                          aria-pressed={activa}
                          className={`btn-press flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-colors ${
                            activa
                              ? "border-kora-accent bg-kora-accent/10 text-kora-primary"
                              : "border-gray-200 text-kora-muted hover:border-kora-accent"
                          }`}
                        >
                          <Icon size={14} aria-hidden={true} />
                          <span className="min-w-0 truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
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

            {/* Color de acento (botones del motor) */}
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Color de acento <span className="font-normal text-kora-muted">(botones del motor)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAcento(c)}
                    aria-label={`Acento ${c}`}
                    className={`w-9 h-9 rounded-full border-2 transition-transform ${
                      (acento || color || COLOR_DEFAULT).toLowerCase() === c.toLowerCase()
                        ? "border-kora-text scale-110"
                        : "border-white shadow-sm"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="inline-flex items-center gap-2 ml-1 text-sm text-kora-muted">
                  <input
                    type="color"
                    value={acento || color || COLOR_DEFAULT}
                    onChange={(e) => setAcento(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer bg-white"
                  />
                  Personalizado
                </label>
              </div>
              <p className="mt-1.5 text-xs text-kora-muted">
                Déjalo igual al color de marca para usar un solo color en todo.
              </p>
            </div>

            {/* Foto de portada en el motor */}
            <div>
              <label className="flex items-center justify-between gap-4 cursor-pointer rounded-xl border border-gray-100 bg-kora-bg/40 px-4 py-3">
                <span className="text-sm font-semibold text-kora-text">
                  Foto de portada en el motor
                  <span className="block text-xs font-normal text-kora-muted">
                    Usa tu primera foto como banner arriba del motor de reservas.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={portada}
                  onChange={(e) => setPortada(e.target.checked)}
                  className="h-5 w-5 flex-shrink-0 rounded border-gray-300 cursor-pointer"
                  style={{ accentColor: "#1B4332" }}
                />
              </label>
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
                    style={{ fontFamily: fontStack(f.key) }}
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
              {/* Muestra en vivo de la fuente elegida */}
              <div
                className="mt-3 rounded-xl border border-gray-100 bg-kora-bg/40 px-5 py-4"
                style={{ fontFamily: fontStack(fuente) }}
              >
                <p className="text-2xl font-bold text-kora-text leading-tight">
                  {(nombre.trim() || "Tu Hotel")}
                </p>
                <p className="text-sm text-kora-muted mt-1">
                  Así se verán los títulos y textos de tu página de reservas.
                </p>
              </div>
            </div>

            {/* Estilo de portada — con mini-mockup de cada layout */}
            <div>
              <label className="block text-sm font-semibold text-kora-text mb-1.5">
                Estilo de portada
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {[
                  { k: "banda", label: "Banda con tarjeta" },
                  { k: "completa", label: "Pantalla completa" },
                ].map((o) => {
                  const activo = heroEstilo === o.k;
                  return (
                    <button
                      key={o.k}
                      type="button"
                      onClick={() => setHeroEstilo(o.k as "banda" | "completa")}
                      aria-pressed={activo}
                      className={`btn-press rounded-xl border p-2 text-left transition-colors ${
                        activo
                          ? "border-kora-accent bg-kora-accent/10"
                          : "border-gray-200 hover:border-kora-accent"
                      }`}
                    >
                      <div className="relative h-20 rounded-lg overflow-hidden bg-gradient-to-br from-kora-primary to-kora-accent">
                        {o.k === "banda" ? (
                          <>
                            <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-br from-kora-primary to-kora-accent" />
                            <div className="absolute inset-x-3 top-7 bottom-1 rounded-md bg-white shadow-sm flex flex-col justify-center px-2 gap-1">
                              <div className="h-1.5 w-2/3 rounded bg-gray-300" />
                              <div className="h-1 w-1/2 rounded bg-gray-200" />
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <div className="h-2 w-2/3 rounded bg-white/90" />
                            <div className="h-1.5 w-1/2 rounded bg-white/70" />
                          </div>
                        )}
                      </div>
                      <p
                        className={`mt-1.5 text-xs font-semibold ${
                          activo ? "text-kora-primary" : "text-kora-muted"
                        }`}
                      >
                        {o.label}
                      </p>
                    </button>
                  );
                })}
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
          {/* Reglas de reserva (anticipo + mínimo de noches) */}
          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-kora-primary" />
              <h2 className="text-lg font-bold text-kora-text">Reglas de reserva</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  ¿Cuánto cobras al reservar?
                </label>
                <div className="flex flex-wrap gap-2">
                  {[30, 50, 100].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAnticipoPct(p)}
                      className={`btn-press px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${
                        anticipoPct === p
                          ? "border-kora-accent bg-kora-accent/10 text-kora-primary"
                          : "border-gray-200 text-kora-muted hover:border-kora-accent"
                      }`}
                    >
                      {p === 100 ? "Total (100%)" : `${p}% de anticipo`}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-kora-muted">
                  El huésped paga este % al reservar y el resto al llegar. Las
                  reservas de 1 noche se cobran completas.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  Mínimo de noches por reserva
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={minNoches}
                  onChange={(e) =>
                    setMinNoches(Math.max(1, Math.min(30, Number(e.target.value) || 1)))
                  }
                  className={inputCls}
                />
                <p className="mt-1.5 text-xs text-kora-muted">
                  Estancia mínima que aceptas (1 = sin mínimo).
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  Cancelación gratis hasta… (días antes de la llegada)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={cancelacionDias}
                  onChange={(e) =>
                    setCancelacionDias(Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                  }
                  className={inputCls}
                />
                <p className="mt-1.5 text-xs text-kora-muted">
                  Ej. 2 = el huésped puede cancelar gratis hasta 2 días antes.
                  Con 0, puede cancelar hasta el día de su llegada.
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2.5 text-sm font-semibold text-kora-text mb-1.5">
                  <input
                    type="checkbox"
                    checked={nrfActiva}
                    onChange={(e) => setNrfActiva(e.target.checked)}
                    className="h-4 w-4 accent-kora-primary"
                  />
                  Ofrecer tarifa &quot;No reembolsable&quot; con descuento
                </label>
                {nrfActiva && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={nrfPct}
                      onChange={(e) =>
                        setNrfPct(Math.max(5, Math.min(50, Number(e.target.value) || 10)))
                      }
                      className={`${inputCls} w-24`}
                    />
                    <span className="text-sm text-kora-muted">% de descuento</span>
                  </div>
                )}
                <p className="mt-1.5 text-xs text-kora-muted">
                  El huésped paga menos a cambio de no poder cancelar. Llena más
                  noches con anticipación.
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2.5 text-sm font-semibold text-kora-text mb-1.5">
                  <input
                    type="checkbox"
                    checked={pagoEnHotel}
                    onChange={(e) => setPagoEnHotel(e.target.checked)}
                    className="h-4 w-4 accent-kora-primary"
                  />
                  Permitir &quot;pagar al llegar al hotel&quot;
                </label>
                <p className="mt-1.5 text-xs text-kora-muted">
                  El huésped no paga nada al reservar: deja su tarjeta como
                  garantía (guardada en TU cuenta de Stripe) y paga en
                  recepción. Requiere tener Pagos conectados.
                </p>
              </div>
            </div>
          </div>

          {/* Temporadas y tarifas por fecha */}
          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <CalendarCheck size={18} className="text-kora-primary" />
              <h2 className="text-lg font-bold text-kora-text">Temporadas y tarifas</h2>
            </div>
            <p className="text-sm text-kora-muted">
              Sube o baja el precio de <strong>todos</strong> tus cuartos en fechas
              específicas (Semana Santa, diciembre, temporada baja). El ajuste solo
              aplica en esas noches, tanto en tu motor de reservas como en el bot de
              WhatsApp.
            </p>

            <div className="space-y-3">
              {temporadas.map((t, i) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-gray-100 bg-kora-bg/40 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                        Nombre
                      </label>
                      <input
                        className={inputCls}
                        value={t.nombre}
                        onChange={(e) => updateTemporada(i, "nombre", e.target.value)}
                        placeholder="Ej. Semana Santa"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTemporada(i)}
                      className="btn-press w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-red-600 hover:border-red-300"
                      aria-label="Quitar temporada"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                        Desde
                      </label>
                      <input
                        type="date"
                        className={inputCls}
                        value={t.desde}
                        onChange={(e) => updateTemporada(i, "desde", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                        Hasta
                      </label>
                      <input
                        type="date"
                        className={inputCls}
                        value={t.hasta}
                        onChange={(e) => updateTemporada(i, "hasta", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-44">
                      <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                        Ajuste
                      </label>
                      <select
                        className={inputCls}
                        value={t.tipo}
                        onChange={(e) => updateTemporada(i, "tipo", e.target.value)}
                      >
                        <option value="porcentaje">Porcentaje (+/−%)</option>
                        <option value="fijo">Precio fijo por noche</option>
                      </select>
                    </div>
                    <div className="w-32">
                      <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                        {t.tipo === "fijo" ? "Precio/noche" : "Porcentaje"}
                      </label>
                      <input
                        type="number"
                        className={inputCls}
                        value={t.valor}
                        onChange={(e) => updateTemporada(i, "valor", e.target.value)}
                        placeholder={t.tipo === "fijo" ? "3000" : "40"}
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                        Mín. noches
                      </label>
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        value={t.minNoches}
                        onChange={(e) => updateTemporada(i, "minNoches", e.target.value)}
                        placeholder="opcional"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-kora-muted">
                    {t.tipo === "fijo"
                      ? "Esas noches cuestan exactamente este precio (reemplaza el precio del cuarto)."
                      : "Ej. 40 = +40% sobre el precio base. Usa un número negativo (−20) para descuento."}
                  </p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTemporada}
              className="btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
            >
              <Plus size={15} /> Agregar temporada
            </button>

            {/* Recargo de fin de semana */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <label className="flex items-center gap-2.5 text-sm font-semibold text-kora-text">
                <input
                  type="checkbox"
                  checked={finSemActivo}
                  onChange={(e) => setFinSemActivo(e.target.checked)}
                  className="h-4 w-4 accent-kora-primary"
                />
                Recargo automático de fin de semana
              </label>
              {finSemActivo && (
                <div className="space-y-3 pl-1">
                  <div>
                    <span className="block text-[11px] font-semibold text-kora-muted mb-1.5">
                      Días con recargo
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { d: 5, l: "Viernes" },
                        { d: 6, l: "Sábado" },
                        { d: 0, l: "Domingo" },
                      ].map(({ d, l }) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleFinSemDia(d)}
                          className={`btn-press px-3 py-1.5 rounded-full border text-sm font-semibold transition-colors ${
                            finSemDias.includes(d)
                              ? "border-kora-accent bg-kora-accent/10 text-kora-primary"
                              : "border-gray-200 text-kora-muted hover:border-kora-accent"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-44">
                      <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                        Ajuste
                      </label>
                      <select
                        className={inputCls}
                        value={finSemTipo}
                        onChange={(e) => setFinSemTipo(e.target.value as "porcentaje" | "fijo")}
                      >
                        <option value="porcentaje">Porcentaje (+%)</option>
                        <option value="fijo">Precio fijo por noche</option>
                      </select>
                    </div>
                    <div className="w-32">
                      <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                        {finSemTipo === "fijo" ? "Precio/noche" : "Porcentaje"}
                      </label>
                      <input
                        type="number"
                        className={inputCls}
                        value={finSemValor}
                        onChange={(e) => setFinSemValor(e.target.value)}
                        placeholder={finSemTipo === "fijo" ? "2500" : "25"}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-kora-muted">
                    Se aplica en esos días cuando la fecha NO cae dentro de una
                    temporada (la temporada manda).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Impuestos y medición del motor */}
          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-kora-primary" />
              <h2 className="text-lg font-bold text-kora-text">Impuestos y medición</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  Impuesto al hospedaje de tu estado (ISH %)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={ishPct}
                  onChange={(e) =>
                    setIshPct(Math.max(0, Math.min(10, Number(e.target.value) || 0)))
                  }
                  className={inputCls}
                />
                <p className="mt-1.5 text-xs text-kora-muted">
                  Solo transparenta el desglose (tarifa + IVA 16% + ISH) en el
                  motor; tus precios NO cambian. En San Luis Potosí es 3%.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-kora-text mb-1.5">
                    Tu Google Analytics (GA4)
                  </label>
                  <input
                    className={inputCls}
                    value={medGa4}
                    onChange={(e) => setMedGa4(e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-kora-text mb-1.5">
                    Tu Meta Pixel (Facebook/Instagram)
                  </label>
                  <input
                    className={inputCls}
                    value={medPixel}
                    onChange={(e) => setMedPixel(e.target.value)}
                    placeholder="1234567890"
                  />
                </div>
                <p className="text-xs text-kora-muted">
                  Opcional. Si los llenas, tu motor registra vistas, checkouts y
                  reservas pagadas en TUS cuentas (para tus campañas).
                </p>
              </div>
            </div>
          </div>

          {/* Avisos por correo + recuperación de abandono */}
          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-kora-primary" />
              <h2 className="text-lg font-bold text-kora-text">Avisos por correo</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  ¿A qué correo te avisamos?
                </label>
                <input
                  type="email"
                  className={inputCls}
                  value={notifEmail}
                  onChange={(e) => setNotifEmail(e.target.value)}
                  placeholder="recepcion@tuhotel.com"
                />
                <p className="mt-1.5 text-xs text-kora-muted">
                  Recibes un correo al instante con cada reserva nueva y cada
                  cancelación. Si lo dejas vacío, usamos el correo de tu cuenta.
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2.5 text-sm font-semibold text-kora-text mb-1.5">
                  <input
                    type="checkbox"
                    checked={abandonoActivo}
                    onChange={(e) => setAbandonoActivo(e.target.checked)}
                    className="h-4 w-4 accent-kora-primary"
                  />
                  Recuperar reservas incompletas
                </label>
                <p className="mt-1.5 text-xs text-kora-muted">
                  Si un huésped deja su correo pero no termina de reservar, le
                  mandamos un recordatorio (una sola vez) con un link para
                  retomar su búsqueda.
                </p>
              </div>
            </div>
          </div>

          {/* Extras vendibles (add-ons) */}
          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-kora-primary" />
              <h2 className="text-lg font-bold text-kora-text">Extras vendibles</h2>
            </div>
            <p className="text-sm text-kora-muted">
              Cosas que el huésped puede agregar a su reserva (desayuno, transporte,
              late checkout…). Se cobran junto con la reserva.
            </p>
            <div className="space-y-3">
              {addons.map((a, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-100 bg-kora-bg/40 p-3"
                >
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                      Nombre
                    </label>
                    <input
                      className={inputCls}
                      value={a.nombre}
                      onChange={(e) => updateAddon(i, "nombre", e.target.value)}
                      placeholder="Ej. Desayuno"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                      Precio
                    </label>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={a.precio}
                      onChange={(e) => updateAddon(i, "precio", Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-36">
                    <label className="block text-[11px] font-semibold text-kora-muted mb-1">
                      Cobro
                    </label>
                    <select
                      className={inputCls}
                      value={a.tipo}
                      onChange={(e) => updateAddon(i, "tipo", e.target.value)}
                    >
                      <option value="estancia">Por reserva</option>
                      <option value="noche">Por noche</option>
                      <option value="persona">Por persona</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAddon(i)}
                    className="btn-press w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-red-600 hover:border-red-300"
                    aria-label="Quitar extra"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addAddon}
              className="btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
            >
              <Plus size={15} /> Agregar extra
            </button>
          </div>

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
        <div className="space-y-6">
          <div className={card}>
            <h2 className="text-lg font-bold text-kora-text mb-1">Tus códigos QR</h2>
            <p className="text-sm text-kora-muted mb-5">
              Imprímelos: el de tu página para recepción y redes; el del motor va directo
              a reservar; el de la guía para la habitación.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                <div ref={qrMotorRef} className="inline-flex p-3 rounded-xl border border-gray-100 bg-white">
                  <QRCodeCanvas value={urlMotor} size={150} fgColor="#1B4332" level="M" marginSize={2} />
                </div>
                <p className="mt-2 text-xs font-semibold text-kora-text">Motor de reservas</p>
                <button
                  type="button"
                  onClick={() => descargarQR(qrMotorRef, "qr-motor.png")}
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

          {/* Incrustar el motor en tu propia web (misma línea que muestra el onboarding) */}
          <div className={card}>
            <h2 className="text-lg font-bold text-kora-text mb-1">
              Tu motor, dentro de tu propia web
            </h2>
            <p className="text-sm text-kora-muted mb-4">
              Si ya tienes página web, pega esta línea donde quieras el botón de
              reservar (o pásasela a tu webmaster). El motor se abre con tus
              colores y tus tarifas.
            </p>
            <div className="rounded-xl bg-kora-primary/95 px-4 py-3 overflow-x-auto">
              <code className="text-xs text-kora-accent whitespace-nowrap">{embedSnippet}</code>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(embedSnippet);
                  setCopiadoEmbed(true);
                  setTimeout(() => setCopiadoEmbed(false), 2000);
                }}
                className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text text-sm font-semibold hover:border-kora-accent transition-colors"
              >
                {copiadoEmbed ? <Check size={14} /> : <Copy size={14} />}
                {copiadoEmbed ? "Copiado" : "Copiar código"}
              </button>
              <a
                href={urlMotor}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text text-sm font-semibold hover:border-kora-accent transition-colors"
              >
                <ExternalLink size={14} /> Ver mi motor
              </a>
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
