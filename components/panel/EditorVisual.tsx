"use client";

// Editor visual de la mini-página: controles a la izquierda, página real a la
// derecha. La vista previa NO es una maqueta: es el mismo componente que dibuja
// /h/[slug] (MiniRender) alimentado con lo que el hotelero lleva escrito, así
// que lo que ve es literalmente lo que va a publicar.
//
// Todo lo editable vive en UN objeto (`Doc`). Eso es lo que hace posible el
// "Deshacer": cada cambio apila el documento anterior y volver atrás es
// devolver el snapshot, sin tener que reconstruir estado pieza por pieza.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  GripVertical,
  Images,
  Loader2,
  MapPin,
  Megaphone,
  Monitor,
  MousePointerClick,
  Palette,
  Plus,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  Type,
  Undo2,
  UtensilsCrossed,
  Video,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/images-client";
import { AMENIDADES } from "@/lib/amenidades";
import { construirMapa } from "@/lib/maps";
import { MiniRender, type MiniDatos } from "@/components/mini/MiniRender";
import { ICONO_MAP } from "@/components/mini/iconos";
import {
  ACCIONES_BOTON,
  BLOQUES_CATALOGO,
  BLOQUE_TITULO_DEFAULT,
  COLOR_DEFAULT,
  COLOR_PRESETS,
  esBloqueNativo,
  fontStack,
  FUENTES,
  ICONOS,
  MAX_PAGINAS,
  nuevoId,
  PLANTILLAS_BLOQUES,
  resolverBloques,
  resolverBotones,
  resolverPaginas,
  SLUGS_RESERVADOS,
  slugificarPagina,
  ZONAS_BOTON,
  type Aviso,
  type Bloque,
  type BloqueTipo,
  type Boton,
  type BotonAccion,
  type BotonEstilo,
  type BotonZona,
  type Diseno,
  type MiniExtras,
  type MiniFaq,
  type Pagina,
  type Politicas,
  type Textos,
} from "@/lib/mini";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-panel-border text-sm text-kora-text placeholder:text-panel-faint focus:outline-none focus:ring-2 focus:ring-kora-primary/30 focus:border-kora-primary transition";

const labelCls = "block text-xs font-semibold text-kora-muted mb-1";

const ayudaCls = "mt-1 text-[11px] text-kora-muted leading-snug";

// Etiqueta corta de cada tipo de bloque, para la lista.
const LABEL_TIPO: Record<string, string> = Object.fromEntries(
  BLOQUES_CATALOGO.map((c) => [c.tipo, c.label])
);

// Tonos de la IA: los mismos que acepta /api/admin/hotel-description.
const TONOS_IA = [
  { key: "evocadora", label: "Evocadora" },
  { key: "emotiva", label: "Cálida" },
  { key: "vender", label: "Para vender" },
  { key: "sencilla", label: "Sencilla" },
  { key: "moderna", label: "Moderna" },
] as const;

function IconoTipo({ tipo }: { tipo: BloqueTipo }) {
  const cls = "text-kora-muted";
  if (tipo === "texto") return <Type size={15} className={cls} />;
  if (tipo === "galeria") return <Images size={15} className={cls} />;
  if (tipo === "destacados") return <Sparkles size={15} className={cls} />;
  if (tipo === "video") return <Video size={15} className={cls} />;
  if (tipo === "promocion") return <Tag size={15} className={cls} />;
  if (tipo === "cercanos") return <MapPin size={15} className={cls} />;
  if (tipo === "menu") return <UtensilsCrossed size={15} className={cls} />;
  if (tipo === "cta") return <MousePointerClick size={15} className={cls} />;
  if (tipo === "pdf") return <FileText size={15} className={cls} />;
  return <GripVertical size={15} className="text-panel-faint" />;
}

type PanelKey = "bloques" | "estilo" | "botones" | "textos" | "aviso";

const PANELES: { key: PanelKey; label: string; Icon: typeof Type }[] = [
  { key: "bloques", label: "Bloques", Icon: Images },
  { key: "estilo", label: "Estilo", Icon: Palette },
  { key: "botones", label: "Botones", Icon: MousePointerClick },
  { key: "textos", label: "Textos", Icon: Type },
  { key: "aviso", label: "Aviso", Icon: Megaphone },
];

// Todo lo que este editor puede cambiar. Unos campos son columnas del hotel
// (descripcion, fotos) y otros viven en el jsonb `extras`; guardar() sabe cuál
// es cuál.
interface Doc {
  bloques: Bloque[];
  paginas: Pagina[];
  botones: Boton[];
  textos: Textos;
  aviso: Aviso;
  diseno: Diseno;
  descripcion: string;
  fotos: string[];
  amenidades: string[];
  faqs: MiniFaq[];
  politicas: Politicas;
  mapsUrl: string;
  mapEmbedUrl: string;
}

export function EditorVisual({
  hotelId,
  userId,
  datosIniciales,
}: {
  hotelId: string;
  userId: string;
  datosIniciales: MiniDatos;
}) {
  const supabase = createClient();
  const router = useRouter();
  const extrasBase = useRef<Record<string, unknown>>(
    (datosIniciales.extras ?? {}) as Record<string, unknown>
  );

  const [doc, setDoc] = useState<Doc>(() => {
    const e = datosIniciales.extras ?? {};
    return {
      bloques: resolverBloques(e),
      paginas: resolverPaginas(e),
      botones: resolverBotones(e),
      textos: e.textos ?? {},
      aviso: e.aviso ?? {},
      diseno: e.diseno ?? {},
      descripcion: datosIniciales.descripcion ?? "",
      fotos: datosIniciales.fotos ?? [],
      amenidades: e.amenidades ?? [],
      faqs: e.faqs ?? [],
      politicas: e.politicas ?? {},
      mapsUrl: e.mapsUrl ?? "",
      mapEmbedUrl: e.mapEmbedUrl ?? "",
    };
  });

  // Espejo del documento para los flujos asíncronos (subir fotos, IA), que
  // terminan cuando la clausura del handler ya quedó vieja.
  const docRef = useRef(doc);
  const historial = useRef<Doc[]>([]);
  const ultimoGrupo = useRef<{ clave: string; t: number }>({ clave: "", t: 0 });
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);

  const [panel, setPanel] = useState<PanelKey>("bloques");
  const [abierto, setAbierto] = useState<string | null>(null);

  // Qué página edita el panel Bloques: null = Inicio (la portada). Va también
  // en un ref para que los flujos asíncronos (fotos, IA) escriban en la página
  // correcta aunque su clausura haya quedado vieja. No entra al historial de
  // deshacer: cambiar de página es navegación, no edición.
  const [paginaActiva, setPaginaActivaState] = useState<string | null>(null);
  const paginaActivaRef = useRef<string | null>(null);
  const [vista, setVista] = useState<"movil" | "escritorio">("escritorio");
  const [pestanaMovil, setPestanaMovil] = useState<"editar" | "ver">("editar");
  const [menuAgregar, setMenuAgregar] = useState(false);

  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");
  const [subiendo, setSubiendo] = useState<string | null>(null); // id del bloque cuya foto sube
  const [generando, setGenerando] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  const arrastrado = useRef<number | null>(null);

  // Cambia el documento y apila el anterior para poder deshacer. `grupo` junta
  // en un solo paso lo que el hotelero vive como una sola acción: escribir una
  // frase son 30 teclazos, no 30 deshaceres.
  const aplicar = useCallback((cambios: Partial<Doc>, grupo?: string) => {
    const ahora = Date.now();
    const mismoGrupo =
      !!grupo && ultimoGrupo.current.clave === grupo && ahora - ultimoGrupo.current.t < 1500;
    if (!mismoGrupo) {
      historial.current.push(docRef.current);
      if (historial.current.length > 80) historial.current.shift();
      setPuedeDeshacer(true);
    }
    ultimoGrupo.current = { clave: grupo ?? "", t: ahora };
    const nuevo = { ...docRef.current, ...cambios };
    docRef.current = nuevo;
    setDoc(nuevo);
    setSucio(true);
    setGuardado(false);
  }, []);

  const deshacer = useCallback(() => {
    const previo = historial.current.pop();
    if (!previo) return;
    docRef.current = previo;
    setDoc(previo);
    setPuedeDeshacer(historial.current.length > 0);
    ultimoGrupo.current = { clave: "", t: 0 };
    setSucio(true);
    setGuardado(false);
  }, []);

  // Ctrl/Cmd+Z, como en cualquier editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const t = e.target as HTMLElement | null;
        // Dentro de un campo de texto, Ctrl+Z es del campo.
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        deshacer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deshacer]);

  // Red de seguridad al cerrar la pestaña o recargar. El aviso al usar "Salir
  // del editor" lo da el modal de abajo: esto solo cubre lo que el navegador no
  // deja interceptar de otra forma.
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  // ─── Vista previa ──────────────────────────────────────────────────────────
  const datosPreview: MiniDatos = useMemo(
    () => ({
      ...datosIniciales,
      descripcion: doc.descripcion,
      fotos: doc.fotos,
      extras: {
        ...datosIniciales.extras,
        bloques: doc.bloques,
        paginas: doc.paginas,
        botones: doc.botones,
        textos: doc.textos,
        aviso: doc.aviso,
        diseno: doc.diseno,
        amenidades: doc.amenidades,
        faqs: doc.faqs,
        politicas: doc.politicas,
        mapsUrl: doc.mapsUrl,
        mapEmbedUrl: doc.mapEmbedUrl,
      } as MiniExtras,
      nav: {
        paginas: doc.paginas.filter((p) => !p.oculta).map((p) => ({ slug: p.slug, titulo: p.titulo })),
        blog: false,
        activo: null,
      },
    }),
    [datosIniciales, doc]
  );

  // La página que se está viendo en el preview (con sus bloques al día).
  const paginaPreview = paginaActiva
    ? doc.paginas.find((p) => p.id === paginaActiva)
    : undefined;

  // ─── Bloques ───────────────────────────────────────────────────────────────
  // Todos los helpers de bloques pasan por este par: editan la portada
  // (doc.bloques) o la página activa (doc.paginas[i].bloques) según el selector.
  function bloquesActuales(): Bloque[] {
    const pid = paginaActivaRef.current;
    if (!pid) return docRef.current.bloques;
    return docRef.current.paginas.find((p) => p.id === pid)?.bloques ?? [];
  }
  function conBloques(bs: Bloque[]): Partial<Doc> {
    const pid = paginaActivaRef.current;
    if (!pid) return { bloques: bs };
    return {
      paginas: docRef.current.paginas.map((p) => (p.id === pid ? { ...p, bloques: bs } : p)),
    };
  }
  function actualizarBloque(id: string, cambios: Partial<Bloque>, grupo?: string) {
    aplicar(
      conBloques(bloquesActuales().map((b) => (b.id === id ? { ...b, ...cambios } : b))),
      grupo
    );
  }
  function borrarBloque(id: string) {
    aplicar(conBloques(bloquesActuales().filter((b) => b.id !== id)));
  }
  function moverBloque(desde: number, hasta: number) {
    const bs = bloquesActuales();
    if (hasta < 0 || hasta >= bs.length || desde === hasta) return;
    const copia = [...bs];
    const [item] = copia.splice(desde, 1);
    copia.splice(hasta, 0, item);
    aplicar(conBloques(copia));
  }
  function agregarBloque(tipo: BloqueTipo) {
    setMenuAgregar(false);
    // Un bloque nativo no se duplica: si ya está en la lista, solo se prende y
    // se abre (dos "Habitaciones" mostrarían el mismo contenido dos veces). En
    // una página propia los nativos ni siquiera salen en el catálogo.
    if (esBloqueNativo(tipo)) {
      if (paginaActivaRef.current) return;
      const ya = docRef.current.bloques.find((b) => b.tipo === tipo);
      if (ya) {
        actualizarBloque(ya.id, { oculto: false });
        setAbierto(ya.id);
        return;
      }
    }
    const nuevo: Bloque = { id: nuevoId(tipo), tipo };
    if (tipo === "destacados") nuevo.items = [{ icono: "estrella", titulo: "" }];
    if (tipo === "cercanos") nuevo.cercanos = [{ titulo: "" }];
    if (tipo === "menu") nuevo.menuSecciones = [{ titulo: "", items: [{ nombre: "" }] }];
    if (tipo === "cta") {
      nuevo.ctaBoton = { id: nuevoId("btn"), texto: "Reservar ahora", accion: "reservar", estilo: "relleno" };
    }
    aplicar(conBloques([...bloquesActuales(), nuevo]));
    setAbierto(nuevo.id);
  }

  // Inserta una sección prehecha: varios bloques ya armados con contenido de
  // ejemplo que el hotelero solo rellena. Cada uso trae ids nuevos.
  function agregarPlantilla(key: string) {
    setMenuAgregar(false);
    const plantilla = PLANTILLAS_BLOQUES.find((pl) => pl.key === key);
    if (!plantilla) return;
    const nuevos = plantilla.crear();
    aplicar(conBloques([...bloquesActuales(), ...nuevos]));
    if (nuevos[0]) setAbierto(nuevos[0].id);
  }

  // ─── Páginas ───────────────────────────────────────────────────────────────
  function setPaginaActiva(id: string | null) {
    paginaActivaRef.current = id;
    setPaginaActivaState(id);
    setAbierto(null);
    setMenuAgregar(false);
  }
  // Crea la página y devuelve un mensaje de error para el formulario, o null.
  function crearPagina(titulo: string): string | null {
    const t = titulo.trim();
    if (!t) return "Escribe el nombre de la página.";
    const paginas = docRef.current.paginas;
    if (paginas.length >= MAX_PAGINAS) {
      return `Ya tienes ${MAX_PAGINAS} páginas, el máximo. Elimina una para crear otra.`;
    }
    const slugNuevo = slugificarPagina(t);
    if (!slugNuevo) return "El nombre necesita al menos una letra o número.";
    if (SLUGS_RESERVADOS.includes(slugNuevo)) {
      return `"${t}" no se puede usar: esa dirección ya la ocupa el sitio. Prueba otro nombre.`;
    }
    if (paginas.some((p) => p.slug === slugNuevo)) {
      return "Ya tienes una página con ese nombre.";
    }
    const nueva: Pagina = { id: nuevoId("pag"), slug: slugNuevo, titulo: t, bloques: [] };
    aplicar({ paginas: [...paginas, nueva] });
    setPaginaActiva(nueva.id);
    return null;
  }
  // El título del tab se puede cambiar; el slug (la URL) se queda: es SEO.
  function renombrarPagina(id: string, titulo: string) {
    const t = titulo.trim();
    if (!t) return;
    aplicar(
      { paginas: docRef.current.paginas.map((p) => (p.id === id ? { ...p, titulo: t } : p)) },
      `pag-titulo:${id}`
    );
  }
  function describirPagina(id: string, descripcion: string) {
    aplicar(
      { paginas: docRef.current.paginas.map((p) => (p.id === id ? { ...p, descripcion } : p)) },
      `pag-desc:${id}`
    );
  }
  function toggleOcultaPagina(id: string) {
    aplicar({
      paginas: docRef.current.paginas.map((p) =>
        p.id === id ? { ...p, oculta: !p.oculta } : p
      ),
    });
  }
  function eliminarPagina(id: string) {
    aplicar({ paginas: docRef.current.paginas.filter((p) => p.id !== id) });
    if (paginaActivaRef.current === id) setPaginaActiva(null);
  }

  // ─── Subir imágenes ────────────────────────────────────────────────────────
  // Devuelve las URLs públicas de lo que se logró subir.
  const subirImagenes = useCallback(
    async (files: FileList | null): Promise<string[]> => {
      if (!files || files.length === 0) return [];
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const blob = await comprimirImagen(file);
        const esWebp = blob !== file && blob.type === "image/webp";
        const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
        const ext = esWebp
          ? "webp"
          : (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
        const rnd = Math.random().toString(36).slice(2, 6);
        const path = `${userId}/${Date.now()}-${rnd}-${base}.${ext}`;
        const { error: upErr } = await supabase.storage.from("fotos").upload(path, blob, {
          upsert: false,
          contentType: esWebp ? "image/webp" : file.type || undefined,
        });
        if (upErr) {
          setError("No se pudo subir una foto. Inténtalo de nuevo.");
          continue;
        }
        const { data } = supabase.storage.from("fotos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      return urls;
    },
    [supabase, userId]
  );

  // Fotos de un bloque "galería propia".
  const subirFotos = useCallback(
    async (bloqueId: string, files: FileList | null) => {
      setSubiendo(bloqueId);
      setError("");
      try {
        const urls = await subirImagenes(files);
        if (urls.length) {
          const bs = bloquesActuales().map((b) =>
            b.id === bloqueId ? { ...b, imagenes: [...(b.imagenes ?? []), ...urls] } : b
          );
          aplicar(conBloques(bs));
        }
      } finally {
        setSubiendo(null);
      }
    },
    // bloquesActuales/conBloques son estables en la práctica (solo leen refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subirImagenes, aplicar]
  );

  // La foto de una tarjeta del bloque "Qué hacer cerca" (una por tarjeta).
  const subirFotoCercano = useCallback(
    async (bloqueId: string, idx: number, files: FileList | null) => {
      setSubiendo(`${bloqueId}:${idx}`);
      setError("");
      try {
        const urls = await subirImagenes(files);
        if (urls[0]) {
          const bs = bloquesActuales().map((b) => {
            if (b.id !== bloqueId) return b;
            const copia = [...(b.cercanos ?? [])];
            if (!copia[idx]) return b;
            copia[idx] = { ...copia[idx], foto: urls[0] };
            return { ...b, cercanos: copia };
          });
          aplicar(conBloques(bs));
        }
      } finally {
        setSubiendo(null);
      }
    },
    // bloquesActuales/conBloques son estables en la práctica (solo leen refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subirImagenes, aplicar]
  );

  // El PDF de un bloque "Archivo PDF". No se comprime (no es imagen); tope de
  // 10 MB para no colgar la subida del hotelero.
  const subirPdf = useCallback(
    async (bloqueId: string, files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (file.type !== "application/pdf") {
        setError("Ese archivo no es un PDF.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("El PDF pesa más de 10 MB. Compáctalo e inténtalo de nuevo.");
        return;
      }
      setSubiendo(bloqueId);
      setError("");
      try {
        const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
        const rnd = Math.random().toString(36).slice(2, 6);
        const path = `${userId}/${Date.now()}-${rnd}-${base}.pdf`;
        const { error: upErr } = await supabase.storage.from("fotos").upload(path, file, {
          upsert: false,
          contentType: "application/pdf",
        });
        if (upErr) {
          setError("No se pudo subir el PDF. Inténtalo de nuevo.");
          return;
        }
        const { data } = supabase.storage.from("fotos").getPublicUrl(path);
        const bs = bloquesActuales().map((b) =>
          b.id === bloqueId
            ? {
                ...b,
                pdfUrl: data.publicUrl,
                pdfNombre: (b.pdfNombre ?? "").trim() || file.name.replace(/\.pdf$/i, ""),
              }
            : b
        );
        aplicar(conBloques(bs));
      } finally {
        setSubiendo(null);
      }
    },
    // bloquesActuales/conBloques son estables en la práctica (solo leen refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supabase, userId, aplicar]
  );

  // Fotos del hotel (las del bloque nativo "Galería del hotel").
  const subirFotosHotel = useCallback(
    async (files: FileList | null) => {
      setSubiendo("fotos-hotel");
      setError("");
      try {
        const urls = await subirImagenes(files);
        if (urls.length) aplicar({ fotos: [...docRef.current.fotos, ...urls] });
      } finally {
        setSubiendo(null);
      }
    },
    [subirImagenes, aplicar]
  );

  const subirLogo = useCallback(
    async (files: FileList | null) => {
      setSubiendo("logo");
      setError("");
      try {
        const urls = await subirImagenes(files);
        if (urls[0]) aplicar({ diseno: { ...docRef.current.diseno, logoUrl: urls[0] } });
      } finally {
        setSubiendo(null);
      }
    },
    [subirImagenes, aplicar]
  );

  // ─── Escribir con IA ───────────────────────────────────────────────────────
  // Toma lo que el hotelero ya escribió como notas y lo mejora, en vez de
  // inventar: el endpoint tiene prohibido agregar datos que no le dimos.
  const escribirConIA = useCallback(
    async (tono: string, destino: { tipo: "descripcion" } | { tipo: "bloque"; id: string }) => {
      if (generando) return;
      setGenerando(true);
      setError("");
      try {
        const d = docRef.current;
        const notas =
          destino.tipo === "descripcion"
            ? d.descripcion
            : bloquesActuales().find((b) => b.id === destino.id)?.texto ?? "";
        const res = await fetch("/api/admin/hotel-description", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: datosIniciales.nombre,
            ubicacion: datosIniciales.ubicacion ?? "",
            amenidades: d.amenidades.map(
              (k) => AMENIDADES.find((a) => a.key === k)?.label ?? k
            ),
            habitaciones: datosIniciales.habitaciones,
            notas,
            tono,
          }),
        });
        const data = (await res.json()) as { texto?: string; error?: string };
        if (!res.ok || !data.texto) {
          // El endpoint responde con códigos ("no-auth"); aquí se traducen a algo
          // que el hotelero pueda entender y accionar.
          setError(
            res.status === 401
              ? "Tu sesión se venció. Vuelve a entrar y guarda tus cambios."
              : data.error && !/^[a-z-]+$/.test(data.error)
                ? data.error
                : "No se pudo escribir el texto. Inténtalo de nuevo."
          );
          return;
        }
        if (destino.tipo === "descripcion") aplicar({ descripcion: data.texto });
        else actualizarBloque(destino.id, { texto: data.texto });
      } catch {
        setError("No se pudo conectar con la IA. Revisa tu internet.");
      } finally {
        setGenerando(false);
      }
    },
    // actualizarBloque es estable en la práctica (usa docRef + aplicar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generando, aplicar, datosIniciales.nombre, datosIniciales.ubicacion, datosIniciales.habitaciones]
  );

  // ─── Botones ───────────────────────────────────────────────────────────────
  function actualizarBoton(id: string, cambios: Partial<Boton>, grupo?: string) {
    aplicar(
      { botones: docRef.current.botones.map((b) => (b.id === id ? { ...b, ...cambios } : b)) },
      grupo
    );
  }
  function borrarBoton(id: string) {
    aplicar({ botones: docRef.current.botones.filter((b) => b.id !== id) });
  }
  function agregarBoton() {
    const nuevo: Boton = {
      id: nuevoId("btn"),
      texto: "Nuevo botón",
      accion: "enlace",
      estilo: "contorno",
      zonas: ["portada"],
    };
    aplicar({ botones: [...docRef.current.botones, nuevo] });
    setAbierto(nuevo.id);
  }
  function toggleZona(b: Boton, z: BotonZona) {
    const zonas = b.zonas ?? [];
    actualizarBoton(b.id, {
      zonas: zonas.includes(z) ? zonas.filter((x) => x !== z) : [...zonas, z],
    });
  }

  // ─── Guardar ───────────────────────────────────────────────────────────────
  // Devuelve si alcanzó a guardar: el modal de salida lo usa para no sacar al
  // hotelero de la página cuando el guardado falló.
  async function guardar(): Promise<boolean> {
    setGuardando(true);
    setError("");
    try {
      const d = docRef.current;
      // Releer extras justo antes de escribir: el editor de contenido, el
      // onboarding u otra pestaña pudieron guardar claves desde que este editor
      // cargó, y el jsonb se escribe completo (last-write-wins).
      const { data: fresco } = await supabase
        .from("hoteles")
        .select("extras")
        .eq("id", hotelId)
        .maybeSingle();
      if (fresco?.extras && typeof fresco.extras === "object") {
        extrasBase.current = fresco.extras as Record<string, unknown>;
      }
      const extras = {
        ...extrasBase.current,
        bloques: d.bloques.map((b) => ({ ...b })),
        paginas: d.paginas.map((p) => ({ ...p, bloques: p.bloques.map((b) => ({ ...b })) })),
        botones: d.botones.filter((b) => (b.texto ?? "").trim()),
        textos: d.textos,
        aviso: d.aviso,
        amenidades: d.amenidades,
        faqs: d.faqs.filter((f) => (f.pregunta ?? "").trim()),
        politicas: d.politicas,
        mapsUrl: d.mapsUrl,
        mapEmbedUrl: d.mapEmbedUrl,
        // El orden viejo se mantiene sincronizado por si alguna pantalla o
        // export todavía lo lee; la fuente de verdad ya es `bloques`.
        diseno: {
          ...d.diseno,
          ordenSecciones: d.bloques.filter((b) => esBloqueNativo(b.tipo)).map((b) => b.tipo),
        },
      };
      // Las columnas del hotel solo se escriben si este editor las cambió. Si el
      // hotelero solo reordenó bloques, no tiene por qué revertir una foto o una
      // descripción que en el intertanto cambió desde el panel de contenido.
      const columnas: { descripcion?: string; fotos?: string[] } = {};
      if (d.descripcion.trim() !== (datosIniciales.descripcion ?? "").trim()) {
        columnas.descripcion = d.descripcion.trim();
      }
      if (JSON.stringify(d.fotos) !== JSON.stringify(datosIniciales.fotos ?? [])) {
        columnas.fotos = d.fotos;
      }
      const { error: upErr } = await supabase
        .from("hoteles")
        .update({ ...columnas, extras })
        .eq("id", hotelId);
      if (upErr) throw upErr;
      extrasBase.current = extras as Record<string, unknown>;
      setSucio(false);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return false;
    } finally {
      setGuardando(false);
    }
  }

  const slug = datosIniciales.slug;
  const pro = datosIniciales.pro === true;
  const rutaSalida = `/panel/${slug}/sitio`;

  async function guardarYSalir() {
    if (await guardar()) router.push(rutaSalida);
  }

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 top-16 flex flex-col bg-kora-bg">
      {/* Barra superior */}
      <header className="flex-shrink-0 border-b border-panel-border bg-panel-surface px-3 sm:px-5 py-2.5 flex items-center gap-2 sm:gap-3">
        <Link
          href={rutaSalida}
          onClick={(e) => {
            if (sucio) {
              e.preventDefault();
              setConfirmarSalida(true);
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-text transition-colors"
        >
          <ArrowLeft size={15} /> <span className="hidden sm:inline">Salir del editor</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-kora-text">{datosIniciales.nombre}</p>
        </div>

        <button
          type="button"
          onClick={deshacer}
          disabled={!puedeDeshacer}
          title="Deshacer el último cambio"
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-full text-sm font-semibold text-kora-muted hover:text-kora-text disabled:opacity-30 transition-colors"
        >
          <Undo2 size={15} /> <span className="hidden md:inline">Deshacer</span>
        </button>

        {/* Móvil / escritorio (solo afecta la vista previa) */}
        <div className="hidden lg:flex items-center rounded-full border border-panel-border p-0.5">
          <button
            type="button"
            onClick={() => setVista("escritorio")}
            aria-label="Ver como computadora"
            className={`p-1.5 rounded-full transition-colors ${vista === "escritorio" ? "bg-kora-primary text-white" : "text-kora-muted hover:text-kora-text"}`}
          >
            <Monitor size={15} />
          </button>
          <button
            type="button"
            onClick={() => setVista("movil")}
            aria-label="Ver como celular"
            className={`p-1.5 rounded-full transition-colors ${vista === "movil" ? "bg-kora-primary text-white" : "text-kora-muted hover:text-kora-text"}`}
          >
            <Smartphone size={15} />
          </button>
        </div>

        <a
          href={`/h/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-panel-border text-sm font-semibold text-kora-text hover:border-kora-accent transition-colors"
        >
          <ExternalLink size={14} /> Ver publicada
        </a>

        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !sucio}
          className="btn-press inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-kora-primary text-white font-semibold text-sm disabled:opacity-50 hover:bg-kora-primary-dark transition-colors"
        >
          {guardando ? (
            <Loader2 size={15} className="animate-spin" />
          ) : guardado ? (
            <Check size={15} />
          ) : null}
          {guardando ? "Guardando…" : guardado ? "Guardado" : sucio ? "Guardar cambios" : "Guardado"}
        </button>
      </header>

      {error && (
        <div className="flex-shrink-0 bg-red-50 text-red-700 text-sm px-4 py-2 text-center">
          {error}
        </div>
      )}

      {/* Pestañas solo en pantallas chicas (no cabe la pantalla partida) */}
      <div className="flex-shrink-0 lg:hidden grid grid-cols-2 border-b border-panel-border bg-panel-surface">
        {(["editar", "ver"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPestanaMovil(p)}
            className={`py-2.5 text-sm font-semibold transition-colors ${
              pestanaMovil === p
                ? "text-kora-primary border-b-2 border-kora-primary"
                : "text-kora-muted"
            }`}
          >
            {p === "editar" ? "Editar" : "Vista previa"}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* ── Columna izquierda: controles ── */}
        <aside
          className={`${
            pestanaMovil === "editar" ? "flex" : "hidden"
          } lg:flex flex-col w-full lg:w-[420px] flex-shrink-0 border-r border-panel-border bg-panel-surface min-h-0`}
        >
          <nav className="flex-shrink-0 grid grid-cols-5 border-b border-panel-border">
            {PANELES.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPanel(key)}
                className={`py-2.5 text-[11px] font-semibold inline-flex flex-col items-center gap-1 transition-colors ${
                  panel === key
                    ? "text-kora-primary border-b-2 border-kora-primary"
                    : "text-kora-muted hover:text-kora-text"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-4">
            {panel === "bloques" && (
              <PanelBloques
                doc={doc}
                slug={slug}
                bloques={paginaPreview ? paginaPreview.bloques : doc.bloques}
                paginas={doc.paginas}
                paginaActiva={paginaActiva}
                onPagina={setPaginaActiva}
                onCrearPagina={crearPagina}
                onRenombrarPagina={renombrarPagina}
                onDescribirPagina={describirPagina}
                onOcultarPagina={toggleOcultaPagina}
                onEliminarPagina={eliminarPagina}
                abierto={abierto}
                setAbierto={setAbierto}
                actualizar={actualizarBloque}
                aplicar={aplicar}
                borrar={borrarBloque}
                mover={moverBloque}
                arrastrado={arrastrado}
                menuAgregar={menuAgregar}
                setMenuAgregar={setMenuAgregar}
                agregar={agregarBloque}
                agregarPlantilla={agregarPlantilla}
                subirFotos={subirFotos}
                subirFotosHotel={subirFotosHotel}
                subirFotoCercano={subirFotoCercano}
                subirPdf={subirPdf}
                subiendo={subiendo}
                pro={pro}
                escribirConIA={escribirConIA}
                generando={generando}
              />
            )}
            {panel === "estilo" && (
              <PanelEstilo
                diseno={doc.diseno}
                set={(cambios, grupo) =>
                  aplicar({ diseno: { ...docRef.current.diseno, ...cambios } }, grupo)
                }
                subirLogo={subirLogo}
                subiendoLogo={subiendo === "logo"}
              />
            )}
            {panel === "botones" && (
              <PanelBotones
                botones={doc.botones}
                bloques={doc.bloques}
                abierto={abierto}
                setAbierto={setAbierto}
                actualizar={actualizarBoton}
                borrar={borrarBoton}
                agregar={agregarBoton}
                toggleZona={toggleZona}
              />
            )}
            {panel === "textos" && (
              <PanelTextos
                textos={doc.textos}
                nombre={datosIniciales.nombre}
                set={(cambios, grupo) =>
                  aplicar({ textos: { ...docRef.current.textos, ...cambios } }, grupo)
                }
              />
            )}
            {panel === "aviso" && (
              <PanelAviso
                aviso={doc.aviso}
                set={(cambios, grupo) =>
                  aplicar({ aviso: { ...docRef.current.aviso, ...cambios } }, grupo)
                }
              />
            )}
          </div>
        </aside>

        {/* ── Columna derecha: la página de verdad ── */}
        <main
          className={`${
            pestanaMovil === "ver" ? "block" : "hidden"
          } lg:block flex-1 min-w-0 overflow-y-auto bg-panel-surface-2 p-0 lg:p-6`}
        >
          <div
            className={`relative mx-auto bg-panel-surface overflow-hidden ${
              vista === "movil"
                ? "w-full max-w-[390px] lg:rounded-[2rem] lg:border-8 lg:border-panel-border lg:shadow-2xl"
                : "w-full max-w-3xl lg:rounded-2xl lg:shadow-xl lg:border lg:border-panel-border"
            }`}
            // Los enlaces de la vista previa no navegan: el hotelero sigue
            // editando en vez de irse a otra página a media edición.
            onClickCapture={(e) => {
              const a = (e.target as HTMLElement).closest("a");
              if (a) e.preventDefault();
            }}
          >
            <MiniRender
              datos={datosPreview}
              modo="preview"
              pagina={paginaPreview}
              onNavPagina={(slugPagina) => {
                if (slugPagina === "blog") return;
                const destino = slugPagina
                  ? doc.paginas.find((p) => p.slug === slugPagina)
                  : null;
                setPaginaActiva(destino ? destino.id : null);
              }}
            />
          </div>
        </main>
      </div>

      {confirmarSalida && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-panel-contrast/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="salir-titulo"
            className="w-full max-w-sm rounded-2xl bg-panel-surface p-5 shadow-2xl"
          >
            <h2 id="salir-titulo" className="text-lg font-bold text-kora-text">
              Tienes cambios sin guardar
            </h2>
            <p className="mt-1 text-sm text-kora-muted leading-relaxed">
              Si sales ahora, tu página se queda como estaba antes de entrar al editor.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={guardarYSalir}
                disabled={guardando}
                className="btn-press w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-kora-primary text-white font-semibold text-sm disabled:opacity-50 hover:bg-kora-primary-dark transition-colors"
              >
                {guardando && <Loader2 size={15} className="animate-spin" />}
                {guardando ? "Guardando…" : "Guardar y salir"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmarSalida(false)}
                className="btn-press w-full px-4 py-2.5 rounded-full border border-panel-border text-sm font-semibold text-kora-text hover:border-kora-accent transition-colors"
              >
                Seguir editando
              </button>
              <button
                type="button"
                onClick={() => router.push(rutaSalida)}
                className="w-full py-1.5 text-xs font-semibold text-kora-muted hover:text-red-600 transition-colors"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Botón "Escríbelo por mí"
// ─────────────────────────────────────────────────────────────────────────────

function BotonIA({
  generando,
  onGenerar,
  hayTexto,
}: {
  generando: boolean;
  onGenerar: (tono: string) => void;
  hayTexto: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={generando}
        className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-kora-accent bg-kora-accent/10 text-kora-primary text-xs font-semibold hover:bg-kora-accent/20 transition-colors disabled:opacity-60"
      >
        {generando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {generando ? "Escribiendo…" : "Escríbelo por mí"}
      </button>
      {abierto && !generando && (
        <div className="absolute z-20 mt-1 left-0 w-56 rounded-xl border border-panel-border bg-panel-surface shadow-lg p-2">
          <p className="px-1.5 pb-1.5 text-[11px] text-kora-muted leading-snug">
            {hayTexto
              ? "Mejora lo que ya escribiste, con este tono:"
              : "Lo escribe con los datos de tu hotel, con este tono:"}
          </p>
          {TONOS_IA.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setAbierto(false);
                onGenerar(t.key);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm font-semibold text-kora-text hover:bg-kora-bg transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel: BLOQUES
// ─────────────────────────────────────────────────────────────────────────────

function PanelBloques({
  doc,
  slug,
  abierto,
  setAbierto,
  actualizar,
  aplicar,
  borrar,
  mover,
  arrastrado,
  menuAgregar,
  setMenuAgregar,
  agregar,
  agregarPlantilla,
  subirFotos,
  subirFotosHotel,
  subirFotoCercano,
  subirPdf,
  subiendo,
  escribirConIA,
  generando,
  pro,
  bloques,
  paginas,
  paginaActiva,
  onPagina,
  onCrearPagina,
  onRenombrarPagina,
  onDescribirPagina,
  onOcultarPagina,
  onEliminarPagina,
}: {
  doc: Doc;
  slug: string;
  bloques: Bloque[];
  paginas: Pagina[];
  paginaActiva: string | null;
  onPagina: (id: string | null) => void;
  onCrearPagina: (titulo: string) => string | null;
  onRenombrarPagina: (id: string, titulo: string) => void;
  onDescribirPagina: (id: string, descripcion: string) => void;
  onOcultarPagina: (id: string) => void;
  onEliminarPagina: (id: string) => void;
  abierto: string | null;
  setAbierto: (id: string | null) => void;
  actualizar: (id: string, cambios: Partial<Bloque>, grupo?: string) => void;
  aplicar: (cambios: Partial<Doc>, grupo?: string) => void;
  borrar: (id: string) => void;
  mover: (desde: number, hasta: number) => void;
  arrastrado: React.MutableRefObject<number | null>;
  menuAgregar: boolean;
  setMenuAgregar: (v: boolean) => void;
  agregar: (t: BloqueTipo) => void;
  agregarPlantilla: (key: string) => void;
  subirFotos: (id: string, files: FileList | null) => void;
  subirFotosHotel: (files: FileList | null) => void;
  subirFotoCercano: (id: string, idx: number, files: FileList | null) => void;
  subirPdf: (id: string, files: FileList | null) => void;
  subiendo: string | null;
  escribirConIA: (
    tono: string,
    destino: { tipo: "descripcion" } | { tipo: "bloque"; id: string }
  ) => void;
  generando: boolean;
  pro: boolean;
}) {
  const paginaSel = paginaActiva ? paginas.find((p) => p.id === paginaActiva) : undefined;
  return (
    <div>
      <SelectorPagina
        slug={slug}
        paginas={paginas}
        activa={paginaActiva}
        onSelect={onPagina}
        onCrear={onCrearPagina}
        onRenombrar={onRenombrarPagina}
        onDescripcion={onDescribirPagina}
        onOcultar={onOcultarPagina}
        onEliminar={onEliminarPagina}
      />

      {paginaSel && bloques.length === 0 && (
        <p className="text-xs text-kora-muted leading-relaxed mb-3">
          Esta página está vacía: agrégale bloques con el botón de abajo.
        </p>
      )}
      {(!paginaSel || bloques.length > 0) && (
        <p className="text-xs text-kora-muted leading-relaxed mb-3">
          Arrastra para cambiar el orden. El ojo prende o apaga el bloque en tu página. Toca uno
          para editar su título y su contenido.
        </p>
      )}

      <div className="space-y-2">
        {bloques.map((b, i) => {
          const nativo = esBloqueNativo(b.tipo);
          const abiertoEste = abierto === b.id;
          return (
            <div
              key={b.id}
              draggable
              onDragStart={() => {
                arrastrado.current = i;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastrado.current !== null) mover(arrastrado.current, i);
                arrastrado.current = null;
              }}
              className={`rounded-xl border bg-panel-surface transition-colors ${
                b.oculto ? "border-panel-border opacity-60" : "border-panel-border"
              } ${abiertoEste ? "ring-2 ring-kora-primary/30" : ""}`}
            >
              <div className="flex items-center gap-2 p-2.5">
                <span className="cursor-grab active:cursor-grabbing text-panel-faint" aria-hidden="true">
                  <GripVertical size={16} />
                </span>
                <IconoTipo tipo={b.tipo} />
                <button
                  type="button"
                  onClick={() => setAbierto(abiertoEste ? null : b.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="block truncate text-sm font-semibold text-kora-text">
                    {b.titulo?.trim() || LABEL_TIPO[b.tipo] || b.tipo}
                  </span>
                  {!nativo && (
                    <span className="block text-[11px] text-kora-muted">Bloque tuyo</span>
                  )}
                </button>

                {/* Orden por botones: en celular no se puede arrastrar */}
                <div className="flex flex-col lg:hidden">
                  <button type="button" onClick={() => mover(i, i - 1)} aria-label="Subir" className="text-kora-muted p-0.5">
                    <ChevronDown size={13} className="rotate-180" />
                  </button>
                  <button type="button" onClick={() => mover(i, i + 1)} aria-label="Bajar" className="text-kora-muted p-0.5">
                    <ChevronDown size={13} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => actualizar(b.id, { oculto: !b.oculto })}
                  aria-label={b.oculto ? "Mostrar bloque" : "Ocultar bloque"}
                  className={`p-1.5 rounded-lg transition-colors ${
                    b.oculto ? "text-panel-faint hover:text-kora-text" : "text-kora-primary"
                  }`}
                >
                  {b.oculto ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => setAbierto(abiertoEste ? null : b.id)}
                  aria-label="Editar bloque"
                  className="p-1.5 text-kora-muted hover:text-kora-text"
                >
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${abiertoEste ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {abiertoEste && (
                <div className="border-t border-panel-border-soft p-3 space-y-3">
                  <div>
                    <label className={labelCls}>Título de la sección</label>
                    <input
                      className={inputCls}
                      value={b.titulo ?? BLOQUE_TITULO_DEFAULT[b.tipo] ?? ""}
                      placeholder="Déjalo vacío para que no aparezca título"
                      onChange={(e) =>
                        actualizar(b.id, { titulo: e.target.value }, `titulo:${b.id}`)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Fondo</label>
                    <div className="flex gap-1.5">
                      {(["ninguno", "tarjeta", "marca"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => actualizar(b.id, { fondo: f })}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            (b.fondo ?? "ninguno") === f
                              ? "border-kora-primary bg-kora-primary/10 text-kora-primary"
                              : "border-panel-border text-kora-muted hover:border-panel-border"
                          }`}
                        >
                          {f === "ninguno" ? "Normal" : f === "tarjeta" ? "Tarjeta blanca" : "Color de marca"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <CamposBloque
                    bloque={b}
                    doc={doc}
                    slug={slug}
                    actualizar={actualizar}
                    aplicar={aplicar}
                    subirFotos={subirFotos}
                    subirFotosHotel={subirFotosHotel}
                    subirFotoCercano={subirFotoCercano}
                    subirPdf={subirPdf}
                    subiendo={subiendo}
                    pro={pro}
                    escribirConIA={escribirConIA}
                    generando={generando}
                  />

                  {!nativo && (
                    <button
                      type="button"
                      onClick={() => borrar(b.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={13} /> Eliminar este bloque
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Agregar bloque */}
      <div className="mt-3">
        {menuAgregar ? (
          <div className="rounded-xl border border-panel-border bg-panel-surface p-2">
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-xs font-bold text-kora-text">Agregar bloque</p>
              <button type="button" onClick={() => setMenuAgregar(false)} aria-label="Cerrar">
                <X size={15} className="text-kora-muted" />
              </button>
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {/* En una página propia solo caben bloques tuyos: los nativos
                  (habitaciones, reseñas…) leen datos del hotel y viven en Inicio. */}
              {(paginaActiva ? BLOQUES_CATALOGO.filter((c) => !c.nativo) : BLOQUES_CATALOGO).map((c) => (
                <button
                  key={c.tipo}
                  type="button"
                  onClick={() => agregar(c.tipo)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-kora-bg transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-kora-text">
                    <IconoTipo tipo={c.tipo} />
                    {c.label}
                    {!c.nativo && (
                      <span className="text-[10px] font-bold text-kora-primary bg-kora-primary/10 px-1.5 py-0.5 rounded-full">
                        tuyo
                      </span>
                    )}
                  </span>
                  <span className="block mt-0.5 text-[11px] text-kora-muted leading-snug">
                    {c.desc}
                  </span>
                </button>
              ))}

              {/* Secciones prehechas: varios bloques ya armados de un clic */}
              <p className="pt-2 mt-1 px-1 border-t border-panel-border-soft text-[10px] font-bold uppercase tracking-wide text-kora-muted">
                Secciones prehechas
              </p>
              {PLANTILLAS_BLOQUES.map((pl) => (
                <button
                  key={pl.key}
                  type="button"
                  onClick={() => agregarPlantilla(pl.key)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-kora-bg transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-kora-text">
                    <Sparkles size={15} className="text-kora-primary" />
                    {pl.label}
                  </span>
                  <span className="block mt-0.5 text-[11px] text-kora-muted leading-snug">
                    {pl.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMenuAgregar(true)}
            className="btn-press w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-panel-border text-sm font-semibold text-kora-muted hover:border-kora-primary hover:text-kora-primary transition-colors"
          >
            <Plus size={16} /> Agregar bloque
          </button>
        )}
      </div>
    </div>
  );
}

// Selector de página del panel Bloques: Inicio o una página propia. Crear,
// renombrar, ocultar y eliminar viven aquí para que el hotelero no tenga que
// salir del editor. El slug (la URL) se fija al crear y ya no cambia: SEO.
function SelectorPagina({
  slug,
  paginas,
  activa,
  onSelect,
  onCrear,
  onRenombrar,
  onDescripcion,
  onOcultar,
  onEliminar,
}: {
  slug: string;
  paginas: Pagina[];
  activa: string | null;
  onSelect: (id: string | null) => void;
  onCrear: (titulo: string) => string | null;
  onRenombrar: (id: string, titulo: string) => void;
  onDescripcion: (id: string, descripcion: string) => void;
  onOcultar: (id: string) => void;
  onEliminar: (id: string) => void;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [errorCrear, setErrorCrear] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const sel = activa ? paginas.find((p) => p.id === activa) : undefined;

  const crear = () => {
    const err = onCrear(nombre);
    if (err) {
      setErrorCrear(err);
      return;
    }
    setCreando(false);
    setNombre("");
    setErrorCrear("");
  };

  return (
    <div className="mb-3 rounded-xl border border-panel-border bg-panel-surface p-2.5 space-y-2">
      <div>
        <label className={labelCls}>Página que estás editando</label>
        <select
          className={inputCls}
          value={creando ? "__nueva__" : activa ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setConfirmarBorrar(false);
            if (v === "__nueva__") {
              setCreando(true);
              return;
            }
            setCreando(false);
            setErrorCrear("");
            onSelect(v || null);
          }}
        >
          <option value="">Inicio (tu portada)</option>
          {paginas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.titulo}
              {p.oculta ? " (oculta)" : ""}
            </option>
          ))}
          {paginas.length < MAX_PAGINAS && <option value="__nueva__">＋ Nueva página…</option>}
        </select>
      </div>

      {creando && (
        <div className="space-y-1.5">
          <input
            className={inputCls}
            value={nombre}
            autoFocus
            placeholder="Restaurante, Bodas, Qué hacer en Xilitla…"
            onChange={(e) => {
              setNombre(e.target.value);
              setErrorCrear("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") crear();
            }}
          />
          {nombre.trim() && (
            <p className="text-[11px] text-kora-muted break-all">
              Su dirección será /h/{slug}/<b>{slugificarPagina(nombre)}</b>
            </p>
          )}
          {errorCrear && <p className="text-[11px] font-semibold text-red-600">{errorCrear}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={crear}
              className="btn-press px-3 py-1.5 rounded-lg bg-kora-primary text-white text-xs font-semibold"
            >
              Crear página
            </button>
            <button
              type="button"
              onClick={() => {
                setCreando(false);
                setNombre("");
                setErrorCrear("");
              }}
              className="px-3 py-1.5 rounded-lg border border-panel-border text-xs font-semibold text-kora-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {sel && !creando && (
        <div className="space-y-1.5">
          <input
            className={inputCls}
            value={sel.titulo}
            onChange={(e) => onRenombrar(sel.id, e.target.value)}
            aria-label="Nombre de la página"
          />
          <textarea
            className={`${inputCls} min-h-[52px]`}
            value={sel.descripcion ?? ""}
            placeholder="Frase corta bajo el título (también es tu descripción en Google)"
            onChange={(e) => onDescripcion(sel.id, e.target.value)}
            aria-label="Descripción de la página"
          />
          <p className="text-[11px] text-kora-muted break-all">
            Vive en /h/{slug}/<b>{sel.slug}</b>
            {sel.oculta ? " · oculta: no sale en tu sitio" : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOcultar(sel.id)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-kora-muted hover:text-kora-text"
            >
              {sel.oculta ? <Eye size={13} /> : <EyeOff size={13} />}
              {sel.oculta ? "Mostrar en el sitio" : "Ocultar del sitio"}
            </button>
            {confirmarBorrar ? (
              <button
                type="button"
                onClick={() => {
                  setConfirmarBorrar(false);
                  onEliminar(sel.id);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600"
              >
                <Trash2 size={13} /> ¿Seguro? Se borra con sus bloques
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmarBorrar(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
              >
                <Trash2 size={13} /> Eliminar página
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Manda al panel viejo lo que este editor no edita (habitaciones, reseñas):
// son pantallas con su propia complejidad y duplicarlas aquí sería tener dos
// verdades del mismo dato.
function EnlacePanel({ slug, tab, texto }: { slug: string; tab: string; texto: string }) {
  return (
    <Link
      href={`/panel/${slug}/sitio?tab=${tab}`}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary hover:underline"
    >
      <ExternalLink size={12} /> {texto}
    </Link>
  );
}

function CamposBloque({
  bloque: b,
  doc,
  slug,
  actualizar,
  aplicar,
  subirFotos,
  subirFotosHotel,
  subirFotoCercano,
  subirPdf,
  subiendo,
  escribirConIA,
  generando,
  pro,
}: {
  bloque: Bloque;
  doc: Doc;
  slug: string;
  actualizar: (id: string, cambios: Partial<Bloque>, grupo?: string) => void;
  aplicar: (cambios: Partial<Doc>, grupo?: string) => void;
  subirFotos: (id: string, files: FileList | null) => void;
  subirFotosHotel: (files: FileList | null) => void;
  subirFotoCercano: (id: string, idx: number, files: FileList | null) => void;
  subirPdf: (id: string, files: FileList | null) => void;
  subiendo: string | null;
  escribirConIA: (
    tono: string,
    destino: { tipo: "descripcion" } | { tipo: "bloque"; id: string }
  ) => void;
  generando: boolean;
  pro: boolean;
}) {
  // ── Bloques nativos: se edita aquí el dato de verdad del hotel ──
  if (b.tipo === "descripcion") {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Descripción de tu hotel</label>
          <BotonIA
            generando={generando}
            hayTexto={!!doc.descripcion.trim()}
            onGenerar={(tono) => escribirConIA(tono, { tipo: "descripcion" })}
          />
        </div>
        <textarea
          className={`${inputCls} min-h-[140px]`}
          value={doc.descripcion}
          placeholder="Cuéntale al huésped cómo es tu hotel y qué lo hace distinto."
          onChange={(e) => aplicar({ descripcion: e.target.value }, "descripcion")}
        />
        <p className={ayudaCls}>
          Si escribes unas notas y luego usas “Escríbelo por mí”, la IA las respeta y solo mejora
          la redacción. Nunca inventa servicios que no tengas.
        </p>
      </div>
    );
  }

  if (b.tipo === "fotos") {
    const imgs = doc.fotos;
    return (
      <div>
        <label className={labelCls}>Fotos de tu hotel</label>
        {imgs.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            {imgs.map((url, i) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-16 object-cover rounded-lg border border-panel-border" />
                {i === 0 && (
                  <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold bg-panel-surface/90 text-kora-text px-1 rounded">
                    portada
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => aplicar({ fotos: imgs.filter((u) => u !== url) })}
                  aria-label="Quitar foto"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-panel-surface border border-panel-border shadow-sm flex items-center justify-center text-kora-muted hover:text-red-600"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="btn-press inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-panel-border text-sm font-semibold text-kora-text cursor-pointer hover:border-kora-accent transition-colors">
          {subiendo === "fotos-hotel" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Plus size={14} />
          )}
          {subiendo === "fotos-hotel" ? "Subiendo…" : "Subir fotos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => subirFotosHotel(e.target.files)}
          />
        </label>
        <p className={ayudaCls}>La primera foto es la portada de tu página.</p>
      </div>
    );
  }

  if (b.tipo === "amenidades") {
    return (
      <div>
        <label className={labelCls}>Lo que ofrece tu hotel</label>
        <div className="flex flex-wrap gap-1.5">
          {AMENIDADES.map((a) => {
            const activa = doc.amenidades.includes(a.key);
            return (
              <button
                key={a.key}
                type="button"
                onClick={() =>
                  aplicar({
                    amenidades: activa
                      ? doc.amenidades.filter((x) => x !== a.key)
                      : [...doc.amenidades, a.key],
                  })
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  activa
                    ? "border-kora-primary bg-kora-primary/10 text-kora-primary"
                    : "border-panel-border text-kora-muted hover:border-panel-border"
                }`}
              >
                <a.Icon size={13} />
                {a.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (b.tipo === "faq") {
    const faqs = doc.faqs;
    return (
      <div>
        <label className={labelCls}>Preguntas frecuentes</label>
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-lg border border-panel-border p-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={f.pregunta}
                  placeholder="¿Tienen estacionamiento?"
                  onChange={(e) => {
                    const copia = [...faqs];
                    copia[i] = { ...copia[i], pregunta: e.target.value };
                    aplicar({ faqs: copia }, `faq-p:${i}`);
                  }}
                />
                <button
                  type="button"
                  onClick={() => aplicar({ faqs: faqs.filter((_, j) => j !== i) })}
                  aria-label="Quitar pregunta"
                  className="p-1 text-panel-faint hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                className={`${inputCls} min-h-[60px]`}
                value={f.respuesta}
                placeholder="Sí, gratuito y dentro del hotel."
                onChange={(e) => {
                  const copia = [...faqs];
                  copia[i] = { ...copia[i], respuesta: e.target.value };
                  aplicar({ faqs: copia }, `faq-r:${i}`);
                }}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => aplicar({ faqs: [...faqs, { pregunta: "", respuesta: "" }] })}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary"
        >
          <Plus size={13} /> Agregar pregunta
        </button>
      </div>
    );
  }

  if (b.tipo === "politicas") {
    const p = doc.politicas;
    const campos: [keyof Politicas, string, string][] = [
      ["cancelacion", "Cancelación", "Gratis hasta 3 días antes de tu llegada."],
      ["mascotas", "Mascotas", "Aceptamos mascotas pequeñas sin costo."],
      ["ninos", "Niños", "Menores de 5 años no pagan."],
    ];
    return (
      <div className="space-y-2">
        {campos.map(([k, label, ph]) => (
          <div key={k}>
            <label className={labelCls}>{label}</label>
            <input
              className={inputCls}
              value={p[k] ?? ""}
              placeholder={ph}
              onChange={(e) => aplicar({ politicas: { ...p, [k]: e.target.value } }, `pol:${k}`)}
            />
          </div>
        ))}
      </div>
    );
  }

  if (b.tipo === "ubicacion") {
    return (
      <div>
        <label className={labelCls}>Dirección o link de Google Maps</label>
        <input
          className={inputCls}
          value={doc.mapsUrl}
          placeholder="Calle Ocampo 12, Xilitla, SLP"
          onChange={(e) => {
            const v = e.target.value;
            const r = construirMapa(v);
            aplicar(
              { mapsUrl: r.mapsUrl || v, mapEmbedUrl: r.needsResolve ? "" : r.embedUrl },
              "mapa"
            );
          }}
        />
        <p className={ayudaCls}>
          Puedes escribir la dirección o pegar el link de Google Maps. El mapa de abajo se acomoda
          solo.
        </p>
      </div>
    );
  }

  if (b.tipo === "habitaciones") {
    return (
      <div className="space-y-1">
        <p className="text-[11px] text-kora-muted leading-relaxed">
          Tus habitaciones, sus precios y su disponibilidad se editan en su propia pantalla,
          porque de ahí come el motor de reservas.
        </p>
        <EnlacePanel slug={slug} tab="habitaciones" texto="Editar mis habitaciones" />
      </div>
    );
  }

  if (b.tipo === "resenas") {
    return (
      <div className="space-y-1">
        <p className="text-[11px] text-kora-muted leading-relaxed">
          Las reseñas verificadas las escriben tus huéspedes: no se editan aquí. Puedes
          responderlas o agregar reseñas viejas desde su pantalla.
        </p>
        <EnlacePanel slug={slug} tab="resenas" texto="Ver mis reseñas" />
      </div>
    );
  }

  if (b.tipo === "formulario") {
    return (
      <p className="text-[11px] text-kora-muted leading-relaxed">
        Es la caja donde el huésped elige fechas y personas. No tiene nada que escribir: cámbiala
        de lugar arrastrándola, o apágala con el ojo si prefieres que te escriban por WhatsApp.
      </p>
    );
  }

  // ── Bloques propios ──
  if (b.tipo === "texto") {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Texto</label>
          <BotonIA
            generando={generando}
            hayTexto={!!(b.texto ?? "").trim()}
            onGenerar={(tono) => escribirConIA(tono, { tipo: "bloque", id: b.id })}
          />
        </div>
        <textarea
          className={`${inputCls} min-h-[140px]`}
          value={b.texto ?? ""}
          placeholder="Escribe aquí. Los saltos de línea se respetan."
          onChange={(e) => actualizar(b.id, { texto: e.target.value }, `texto:${b.id}`)}
        />
      </div>
    );
  }

  if (b.tipo === "galeria") {
    const imgs = b.imagenes ?? [];
    return (
      <div>
        <label className={labelCls}>Fotos de este bloque</label>
        {imgs.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            {imgs.map((url) => (
              <div key={url} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-16 object-cover rounded-lg border border-panel-border" />
                <button
                  type="button"
                  onClick={() => actualizar(b.id, { imagenes: imgs.filter((u) => u !== url) })}
                  aria-label="Quitar foto"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-panel-surface border border-panel-border shadow-sm flex items-center justify-center text-kora-muted hover:text-red-600"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="btn-press inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-panel-border text-sm font-semibold text-kora-text cursor-pointer hover:border-kora-accent transition-colors">
          {subiendo === b.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {subiendo === b.id ? "Subiendo…" : "Subir fotos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => subirFotos(b.id, e.target.files)}
          />
        </label>
      </div>
    );
  }

  if (b.tipo === "video") {
    return (
      <div>
        <label className={labelCls}>Link del video de YouTube</label>
        <input
          className={inputCls}
          value={b.videoUrl ?? ""}
          placeholder="https://www.youtube.com/watch?v=..."
          onChange={(e) => actualizar(b.id, { videoUrl: e.target.value }, `video:${b.id}`)}
        />
        <p className={ayudaCls}>
          Copia la dirección desde YouTube y pégala aquí. Si no se ve en la vista previa, el link
          no es de YouTube.
        </p>
      </div>
    );
  }

  if (b.tipo === "destacados") {
    const items = b.items ?? [];
    return (
      <div>
        <label className={labelCls}>Puntos fuertes</label>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-panel-border p-2 space-y-2">
              <div className="flex items-center gap-2">
                <SelectorIcono
                  valor={it.icono}
                  onChange={(icono) => {
                    const copia = [...items];
                    copia[i] = { ...copia[i], icono };
                    actualizar(b.id, { items: copia });
                  }}
                />
                <input
                  className={inputCls}
                  value={it.titulo}
                  placeholder="Alberca natural"
                  onChange={(e) => {
                    const copia = [...items];
                    copia[i] = { ...copia[i], titulo: e.target.value };
                    actualizar(b.id, { items: copia }, `dest-t:${b.id}:${i}`);
                  }}
                />
                <button
                  type="button"
                  onClick={() => actualizar(b.id, { items: items.filter((_, j) => j !== i) })}
                  aria-label="Quitar"
                  className="p-1 text-panel-faint hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <input
                className={inputCls}
                value={it.texto ?? ""}
                placeholder="Descripción corta (opcional)"
                onChange={(e) => {
                  const copia = [...items];
                  copia[i] = { ...copia[i], texto: e.target.value };
                  actualizar(b.id, { items: copia }, `dest-d:${b.id}:${i}`);
                }}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            actualizar(b.id, { items: [...items, { icono: "estrella", titulo: "" }] })
          }
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary"
        >
          <Plus size={13} /> Agregar punto
        </button>
      </div>
    );
  }

  if (b.tipo === "promocion") {
    const promo = b.promo ?? {};
    const setPromo = (cambios: Partial<typeof promo>, grupo?: string) =>
      actualizar(b.id, { promo: { ...promo, ...cambios } }, grupo);
    return (
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Tu oferta</label>
          <textarea
            className={`${inputCls} min-h-[70px]`}
            value={promo.texto ?? ""}
            placeholder="2 noches + desayuno para dos por $1,800"
            onChange={(e) => setPromo({ texto: e.target.value }, `promo-t:${b.id}`)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Desde (opcional)</label>
            <input
              type="date"
              className={inputCls}
              value={promo.desde ?? ""}
              onChange={(e) => setPromo({ desde: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Hasta (opcional)</label>
            <input
              type="date"
              className={inputCls}
              value={promo.hasta ?? ""}
              onChange={(e) => setPromo({ hasta: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Texto del botón</label>
          <input
            className={inputCls}
            value={promo.botonTexto ?? ""}
            placeholder="Reservar ahora"
            onChange={(e) => setPromo({ botonTexto: e.target.value }, `promo-b:${b.id}`)}
          />
        </div>
        <p className={ayudaCls}>
          Al pasar la fecha “Hasta”, la promoción se quita sola de tu página: no tienes que
          acordarte de borrarla.
        </p>
      </div>
    );
  }

  if (b.tipo === "cercanos") {
    const items = b.cercanos ?? [];
    const setItem = (i: number, cambios: Partial<(typeof items)[number]>, grupo?: string) => {
      const copia = [...items];
      copia[i] = { ...copia[i], ...cambios };
      actualizar(b.id, { cercanos: copia }, grupo);
    };
    return (
      <div>
        <label className={labelCls}>Lugares y actividades cerca de tu hotel</label>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-panel-border p-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={it.titulo}
                  placeholder="Jardín de Edward James"
                  onChange={(e) => setItem(i, { titulo: e.target.value }, `cerc-t:${b.id}:${i}`)}
                />
                <button
                  type="button"
                  onClick={() => actualizar(b.id, { cercanos: items.filter((_, j) => j !== i) })}
                  aria-label="Quitar lugar"
                  className="p-1 text-panel-faint hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={it.distancia ?? ""}
                  placeholder="A 10 min caminando"
                  onChange={(e) => setItem(i, { distancia: e.target.value }, `cerc-k:${b.id}:${i}`)}
                />
                <label className="btn-press flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-panel-border text-xs font-semibold text-kora-text cursor-pointer hover:border-kora-accent transition-colors">
                  {subiendo === `${b.id}:${i}` ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : it.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.foto} alt="" className="w-5 h-5 object-cover rounded" />
                  ) : (
                    <Plus size={13} />
                  )}
                  Foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => subirFotoCercano(b.id, i, e.target.files)}
                  />
                </label>
              </div>
              <input
                className={inputCls}
                value={it.texto ?? ""}
                placeholder="Descripción corta (opcional)"
                onChange={(e) => setItem(i, { texto: e.target.value }, `cerc-d:${b.id}:${i}`)}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => actualizar(b.id, { cercanos: [...items, { titulo: "" }] })}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary"
        >
          <Plus size={13} /> Agregar lugar
        </button>
      </div>
    );
  }

  if (b.tipo === "menu") {
    const secciones = b.menuSecciones ?? [];
    const setSecciones = (nuevas: typeof secciones, grupo?: string) =>
      actualizar(b.id, { menuSecciones: nuevas }, grupo);
    const setSeccion = (i: number, cambios: Partial<(typeof secciones)[number]>, grupo?: string) => {
      const copia = [...secciones];
      copia[i] = { ...copia[i], ...cambios };
      setSecciones(copia, grupo);
    };
    return (
      <div>
        <label className={labelCls}>Secciones de tu menú o lista de precios</label>
        <div className="space-y-3">
          {secciones.map((s, i) => (
            <div key={i} className="rounded-lg border border-panel-border p-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={s.titulo ?? ""}
                  placeholder="Desayunos"
                  onChange={(e) => setSeccion(i, { titulo: e.target.value }, `menu-s:${b.id}:${i}`)}
                />
                <button
                  type="button"
                  onClick={() => setSecciones(secciones.filter((_, j) => j !== i))}
                  aria-label="Quitar sección"
                  className="p-1 text-panel-faint hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {(s.items ?? []).map((it, j) => (
                <div key={j} className="rounded-lg bg-panel-surface-2 p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      value={it.nombre}
                      placeholder="Enchiladas huastecas"
                      onChange={(e) => {
                        const items = [...(s.items ?? [])];
                        items[j] = { ...items[j], nombre: e.target.value };
                        setSeccion(i, { items }, `menu-n:${b.id}:${i}:${j}`);
                      }}
                    />
                    <input
                      className={`${inputCls} !w-24 flex-shrink-0`}
                      value={it.precio ?? ""}
                      placeholder="$120"
                      onChange={(e) => {
                        const items = [...(s.items ?? [])];
                        items[j] = { ...items[j], precio: e.target.value };
                        setSeccion(i, { items }, `menu-p:${b.id}:${i}:${j}`);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSeccion(i, { items: (s.items ?? []).filter((_, k) => k !== j) })
                      }
                      aria-label="Quitar platillo"
                      className="p-1 text-panel-faint hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <input
                    className={inputCls}
                    value={it.descripcion ?? ""}
                    placeholder="Descripción corta (opcional)"
                    onChange={(e) => {
                      const items = [...(s.items ?? [])];
                      items[j] = { ...items[j], descripcion: e.target.value };
                      setSeccion(i, { items }, `menu-d:${b.id}:${i}:${j}`);
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSeccion(i, { items: [...(s.items ?? []), { nombre: "" }] })}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary"
              >
                <Plus size={13} /> Agregar platillo o servicio
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSecciones([...secciones, { titulo: "", items: [{ nombre: "" }] }])}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary"
        >
          <Plus size={13} /> Agregar sección
        </button>
      </div>
    );
  }

  if (b.tipo === "cta") {
    const btn: Boton =
      b.ctaBoton ?? { id: `${b.id}-btn`, texto: "", accion: "reservar", estilo: "relleno" };
    const setBtn = (cambios: Partial<Boton>, grupo?: string) =>
      actualizar(b.id, { ctaBoton: { ...btn, ...cambios } }, grupo);
    const accionInfo = ACCIONES_BOTON.find((a) => a.key === btn.accion);
    return (
      <div className="space-y-3">
        <div>
          <label className={labelCls}>La frase</label>
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={b.texto ?? ""}
            placeholder="¿Listo para tu escapada a la Huasteca?"
            onChange={(e) => actualizar(b.id, { texto: e.target.value }, `cta-f:${b.id}`)}
          />
        </div>
        <div>
          <label className={labelCls}>Texto del botón</label>
          <input
            className={inputCls}
            value={btn.texto}
            placeholder="Reservar ahora"
            onChange={(e) => setBtn({ texto: e.target.value }, `cta-b:${b.id}`)}
          />
        </div>
        <div>
          <label className={labelCls}>A dónde lleva</label>
          <select
            className={inputCls}
            value={btn.accion}
            onChange={(e) => setBtn({ accion: e.target.value as BotonAccion, valor: "" })}
          >
            {ACCIONES_BOTON.filter((a) => a.key !== "ancla").map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
                {a.key === "enlace" ? " — Pro" : ""}
              </option>
            ))}
          </select>
          {accionInfo && <p className={ayudaCls}>{accionInfo.ayuda}</p>}
        </div>
        {accionInfo?.campo && (
          <div>
            <label className={labelCls}>{accionInfo.campo}</label>
            <input
              className={inputCls}
              value={btn.valor ?? ""}
              onChange={(e) => setBtn({ valor: e.target.value }, `cta-v:${b.id}`)}
            />
          </div>
        )}
        {btn.accion === "enlace" && !pro && (
          <p className="rounded-lg bg-kora-primary/5 border border-kora-primary/20 px-3 py-2 text-[11px] text-kora-primary leading-snug">
            Los botones a sitios externos son parte del plan Pro: en la vista previa se ve
            marcado, pero no saldrá en tu página publicada hasta activar el plan.
          </p>
        )}
      </div>
    );
  }

  if (b.tipo === "pdf") {
    return (
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Nombre que se muestra</label>
          <input
            className={inputCls}
            value={b.pdfNombre ?? ""}
            placeholder="Menú del restaurante"
            onChange={(e) => actualizar(b.id, { pdfNombre: e.target.value }, `pdf-n:${b.id}`)}
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="btn-press inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-panel-border text-sm font-semibold text-kora-text cursor-pointer hover:border-kora-accent transition-colors">
            {subiendo === b.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {subiendo === b.id ? "Subiendo…" : b.pdfUrl ? "Cambiar PDF" : "Subir PDF"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => subirPdf(b.id, e.target.files)}
            />
          </label>
          {b.pdfUrl && (
            <a
              href={b.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary hover:underline"
            >
              <ExternalLink size={12} /> Ver el PDF subido
            </a>
          )}
        </div>
        <p className={ayudaCls}>
          Hasta 10 MB: tu menú, catálogo de eventos o carta de servicios.
        </p>
      </div>
    );
  }

  return null;
}

function SelectorIcono({
  valor,
  onChange,
}: {
  valor?: string;
  onChange: (v: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const Icon = valor ? ICONO_MAP[valor] : undefined;
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Elegir ícono"
        className="w-9 h-9 rounded-lg border border-panel-border flex items-center justify-center text-kora-text hover:border-kora-accent transition-colors"
      >
        {Icon ? <Icon size={17} /> : <Plus size={15} className="text-panel-faint" />}
      </button>
      {abierto && (
        <div className="absolute z-20 mt-1 left-0 w-56 rounded-xl border border-panel-border bg-panel-surface shadow-lg p-2 grid grid-cols-6 gap-1">
          {ICONOS.map((ic) => {
            const I = ICONO_MAP[ic.key];
            if (!I) return null;
            return (
              <button
                key={ic.key}
                type="button"
                title={ic.label}
                onClick={() => {
                  onChange(ic.key);
                  setAbierto(false);
                }}
                className={`aspect-square rounded-lg flex items-center justify-center transition-colors ${
                  valor === ic.key ? "bg-kora-primary text-white" : "text-kora-text hover:bg-kora-bg"
                }`}
              >
                <I size={16} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel: ESTILO
// ─────────────────────────────────────────────────────────────────────────────

function PanelEstilo({
  diseno,
  set,
  subirLogo,
  subiendoLogo,
}: {
  diseno: Diseno;
  set: (cambios: Partial<Diseno>, grupo?: string) => void;
  subirLogo: (files: FileList | null) => void;
  subiendoLogo: boolean;
}) {
  const color = diseno.color || COLOR_DEFAULT;
  return (
    <div className="space-y-5">
      <p className="text-xs text-kora-muted leading-relaxed">
        El color, la letra y tu logo. Todo se ve al momento en la página de al lado.
      </p>

      <div>
        <label className={labelCls}>Color de tu marca</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set({ color: c })}
              aria-label={`Color ${c}`}
              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                color.toLowerCase() === c.toLowerCase()
                  ? "border-kora-text"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => set({ color: e.target.value }, "color")}
            aria-label="Elegir otro color"
            className="w-10 h-9 rounded-lg border border-panel-border cursor-pointer bg-panel-surface"
          />
          <input
            className={inputCls}
            value={color}
            onChange={(e) => set({ color: e.target.value }, "color")}
          />
        </div>
        <p className={ayudaCls}>Es el color de tus botones, títulos y detalles.</p>
      </div>

      <div>
        <label className={labelCls}>Tipo de letra</label>
        <div className="grid grid-cols-2 gap-2">
          {FUENTES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => set({ fuente: f.key })}
              className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                (diseno.fuente ?? "jakarta") === f.key
                  ? "border-kora-primary bg-kora-primary/5"
                  : "border-panel-border hover:border-panel-border"
              }`}
            >
              <span
                className="block text-base font-bold text-kora-text"
                style={{ fontFamily: fontStack(f.key) }}
              >
                {f.label}
              </span>
              <span
                className="block text-[11px] text-kora-muted"
                style={{ fontFamily: fontStack(f.key) }}
              >
                Tu hotel se lee así
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Tu logo (opcional)</label>
        {diseno.logoUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={diseno.logoUrl}
              alt="Logo"
              className="h-12 w-auto max-w-[140px] object-contain rounded-lg border border-panel-border bg-panel-surface p-1"
            />
            <button
              type="button"
              onClick={() => set({ logoUrl: "" })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
            >
              <Trash2 size={13} /> Quitar
            </button>
          </div>
        ) : (
          <label className="btn-press inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-panel-border text-sm font-semibold text-kora-text cursor-pointer hover:border-kora-accent transition-colors">
            {subiendoLogo ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {subiendoLogo ? "Subiendo…" : "Subir logo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => subirLogo(e.target.files)}
            />
          </label>
        )}
        <p className={ayudaCls}>Se ve arriba, junto al nombre de tu hotel.</p>
      </div>

      <div>
        <label className={labelCls}>Portada</label>
        <div className="flex gap-1.5">
          {(
            [
              ["banda", "Una banda"],
              ["completa", "Foto grande"],
            ] as [NonNullable<Diseno["heroEstilo"]>, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => set({ heroEstilo: k })}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                (diseno.heroEstilo ?? "banda") === k
                  ? "border-kora-primary bg-kora-primary/10 text-kora-primary"
                  : "border-panel-border text-kora-muted hover:border-panel-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className={ayudaCls}>
          “Foto grande” usa tu primera foto a pantalla completa al abrir la página.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel: BOTONES
// ─────────────────────────────────────────────────────────────────────────────

function PanelBotones({
  botones,
  bloques,
  abierto,
  setAbierto,
  actualizar,
  borrar,
  agregar,
  toggleZona,
}: {
  botones: Boton[];
  bloques: Bloque[];
  abierto: string | null;
  setAbierto: (id: string | null) => void;
  actualizar: (id: string, cambios: Partial<Boton>, grupo?: string) => void;
  borrar: (id: string) => void;
  agregar: () => void;
  toggleZona: (b: Boton, z: BotonZona) => void;
}) {
  return (
    <div>
      <p className="text-xs text-kora-muted leading-relaxed mb-3">
        Estos son los botones de tu página. Puedes cambiarles el texto, a dónde llevan y en qué
        parte aparecen. Si borras todos, tu página se queda sin botones.
      </p>

      <div className="space-y-2">
        {botones.map((b) => {
          const abiertoEste = abierto === b.id;
          const accion = ACCIONES_BOTON.find((a) => a.key === b.accion);
          return (
            <div
              key={b.id}
              className={`rounded-xl border border-panel-border bg-panel-surface ${
                abiertoEste ? "ring-2 ring-kora-primary/30" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setAbierto(abiertoEste ? null : b.id)}
                className="w-full flex items-center gap-2 p-2.5 text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-semibold text-kora-text">
                    {b.texto || "Sin texto"}
                  </span>
                  <span className="block text-[11px] text-kora-muted">
                    {accion?.label ?? b.accion}
                    {(b.zonas ?? []).length > 0
                      ? ` · ${(b.zonas ?? [])
                          .map((z) => ZONAS_BOTON.find((x) => x.key === z)?.label ?? z)
                          .join(", ")}`
                      : " · no se muestra"}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={`text-kora-muted transition-transform ${abiertoEste ? "rotate-180" : ""}`}
                />
              </button>

              {abiertoEste && (
                <div className="border-t border-panel-border-soft p-3 space-y-3">
                  <div>
                    <label className={labelCls}>Texto del botón</label>
                    <input
                      className={inputCls}
                      value={b.texto}
                      onChange={(e) =>
                        actualizar(b.id, { texto: e.target.value }, `btn-txt:${b.id}`)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>¿A dónde lleva?</label>
                    <select
                      className={inputCls}
                      value={b.accion}
                      onChange={(e) =>
                        actualizar(b.id, { accion: e.target.value as BotonAccion, valor: "" })
                      }
                    >
                      {ACCIONES_BOTON.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    {accion && (
                      <p className="mt-1 text-[11px] text-kora-muted">{accion.ayuda}</p>
                    )}
                  </div>

                  {accion?.campo && b.accion === "ancla" ? (
                    <div>
                      <label className={labelCls}>{accion.campo}</label>
                      <select
                        className={inputCls}
                        value={b.valor ?? ""}
                        onChange={(e) => actualizar(b.id, { valor: e.target.value })}
                      >
                        <option value="">Elige un bloque…</option>
                        {bloques.map((bl) => (
                          <option key={bl.id} value={bl.id}>
                            {bl.titulo?.trim() || LABEL_TIPO[bl.tipo] || bl.tipo}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : accion?.campo ? (
                    <div>
                      <label className={labelCls}>{accion.campo}</label>
                      <input
                        className={inputCls}
                        value={b.valor ?? ""}
                        onChange={(e) =>
                          actualizar(b.id, { valor: e.target.value }, `btn-val:${b.id}`)
                        }
                      />
                    </div>
                  ) : null}

                  <div>
                    <label className={labelCls}>¿Dónde aparece?</label>
                    <div className="space-y-1.5">
                      {ZONAS_BOTON.map((z) => {
                        const activa = (b.zonas ?? []).includes(z.key);
                        return (
                          <button
                            key={z.key}
                            type="button"
                            onClick={() => toggleZona(b, z.key)}
                            className={`w-full flex items-start gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                              activa
                                ? "border-kora-primary bg-kora-primary/5"
                                : "border-panel-border hover:border-panel-border"
                            }`}
                          >
                            <span
                              className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${
                                activa
                                  ? "bg-kora-primary border-kora-primary text-white"
                                  : "border-panel-border"
                              }`}
                            >
                              {activa && <Check size={11} />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-kora-text">
                                {z.label}
                              </span>
                              <span className="block text-[11px] text-kora-muted">{z.ayuda}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Estilo</label>
                    <div className="flex gap-1.5">
                      {(
                        [
                          ["relleno", "Relleno"],
                          ["contorno", "Contorno"],
                          ["discreto", "Solo texto"],
                        ] as [BotonEstilo, string][]
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => actualizar(b.id, { estilo: k })}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            (b.estilo ?? "contorno") === k
                              ? "border-kora-primary bg-kora-primary/10 text-kora-primary"
                              : "border-panel-border text-kora-muted hover:border-panel-border"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Ícono</label>
                    <SelectorIcono
                      valor={b.icono}
                      onChange={(icono) => actualizar(b.id, { icono })}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => borrar(b.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={13} /> Eliminar este botón
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={agregar}
        className="btn-press mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-panel-border text-sm font-semibold text-kora-muted hover:border-kora-primary hover:text-kora-primary transition-colors"
      >
        <Plus size={16} /> Agregar botón
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel: TEXTOS
// ─────────────────────────────────────────────────────────────────────────────

function PanelTextos({
  textos,
  nombre,
  set,
}: {
  textos: Textos;
  nombre: string;
  set: (cambios: Partial<Textos>, grupo?: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-kora-muted leading-relaxed">
        Los textos grandes de tu página. Si dejas un campo vacío, se usa el de siempre.
      </p>
      <div>
        <label className={labelCls}>Título grande de la portada</label>
        <input
          className={inputCls}
          value={textos.heroTitulo ?? ""}
          placeholder={nombre}
          onChange={(e) => set({ heroTitulo: e.target.value }, "heroTitulo")}
        />
      </div>
      <div>
        <label className={labelCls}>Frase bajo el título</label>
        <input
          className={inputCls}
          value={textos.heroSubtitulo ?? ""}
          placeholder="Ej. Cabañas frente a la selva, a 10 min de Las Pozas"
          onChange={(e) => set({ heroSubtitulo: e.target.value }, "heroSubtitulo")}
        />
      </div>
      <hr className="border-panel-border-soft" />
      <div>
        <label className={labelCls}>Título del cierre (abajo de todo)</label>
        <input
          className={inputCls}
          value={textos.cierreTitulo ?? ""}
          placeholder="Ej. ¿Listo para tu escapada?"
          onChange={(e) => set({ cierreTitulo: e.target.value }, "cierreTitulo")}
        />
      </div>
      <div>
        <label className={labelCls}>Frase del cierre</label>
        <textarea
          className={`${inputCls} min-h-[80px]`}
          value={textos.cierreTexto ?? ""}
          placeholder="Ej. Reserva directo con nosotros: mejor precio garantizado y confirmación al instante."
          onChange={(e) => set({ cierreTexto: e.target.value }, "cierreTexto")}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel: AVISO
// ─────────────────────────────────────────────────────────────────────────────

function PanelAviso({
  aviso,
  set,
}: {
  aviso: Aviso;
  set: (cambios: Partial<Aviso>, grupo?: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-kora-muted leading-relaxed">
        Una barra arriba de tu página para promociones o avisos de temporada. Ponle fecha de fin y
        se apaga sola: no se te queda un “Xantolo 2026” en enero.
      </p>

      <button
        type="button"
        onClick={() => set({ activo: !aviso.activo })}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${
          aviso.activo ? "border-kora-primary bg-kora-primary/5" : "border-panel-border"
        }`}
      >
        <span className="text-sm font-semibold text-kora-text">Mostrar el aviso</span>
        <span
          className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
            aviso.activo ? "bg-kora-primary" : "bg-panel-border"
          }`}
        >
          <span
            className={`block w-5 h-5 rounded-full bg-panel-surface transition-transform ${
              aviso.activo ? "translate-x-4" : ""
            }`}
          />
        </span>
      </button>

      <div>
        <label className={labelCls}>Texto del aviso</label>
        <input
          className={inputCls}
          value={aviso.texto ?? ""}
          placeholder="Xantolo 2026: 20% de descuento reservando directo"
          onChange={(e) => set({ texto: e.target.value }, "avisoTexto")}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Desde (opcional)</label>
          <input
            type="date"
            className={inputCls}
            value={aviso.desde ?? ""}
            onChange={(e) => set({ desde: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Hasta (opcional)</label>
          <input
            type="date"
            className={inputCls}
            value={aviso.hasta ?? ""}
            onChange={(e) => set({ hasta: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Texto del enlace (opcional)</label>
        <input
          className={inputCls}
          value={aviso.enlaceTexto ?? ""}
          placeholder="Ver paquete"
          onChange={(e) => set({ enlaceTexto: e.target.value }, "avisoEnlaceTexto")}
        />
      </div>
      <div>
        <label className={labelCls}>Dirección del enlace (opcional)</label>
        <input
          className={inputCls}
          value={aviso.enlaceUrl ?? ""}
          placeholder="https://…"
          onChange={(e) => set({ enlaceUrl: e.target.value }, "avisoEnlaceUrl")}
        />
      </div>
    </div>
  );
}
