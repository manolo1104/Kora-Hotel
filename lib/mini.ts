// Tipos, opciones y helpers compartidos entre el editor del panel (PanelEditor)
// y la mini-página pública (/h/[slug]). Todo lo nuevo vive dentro del jsonb
// `extras` del hotel para no requerir migraciones de columnas.

export interface Resena {
  autor: string;
  texto: string;
  estrellas: number; // 1..5
  fecha?: string;
}

export interface MiniFaq {
  pregunta: string;
  respuesta: string;
}

export interface Politicas {
  cancelacion?: string;
  mascotas?: string;
  ninos?: string;
}

export interface Diseno {
  color?: string; // hex del color de marca
  acento?: string; // hex del color de acento (botones del motor); default = color
  logoUrl?: string;
  fuente?: string; // clave de FUENTES
  heroEstilo?: "banda" | "completa";
  portada?: boolean; // mostrar la 1ª foto del hotel como portada en el motor (default: sí)
  ordenSecciones?: string[]; // claves de SECCIONES
}

export interface Reglas {
  anticipoPct?: number; // % a cobrar como anticipo (0..100); default 50
  anticipoMinNoches?: number; // mín. noches para aplicar anticipo; menos = cobra 100%; default 2
  minNoches?: number; // mín. de noches por reserva; default 1
  nrfActiva?: boolean; // ofrecer tarifa No Reembolsable con descuento; default no
  nrfPct?: number; // % de descuento de la tarifa no reembolsable (5..50); default 10
  cancelacionDias?: number; // días antes del check-in con cancelación gratis (tarifa flexible); default 2
  pagoEnHotel?: boolean; // permitir "pagar al llegar" con tarjeta como garantía; default no
}

// Impuestos del hotel para el desglose del motor. Los precios cargados por el
// hotel se tratan como precio FINAL (impuestos incluidos, como exige Profeco);
// el desglose solo transparenta cuánto es base, IVA e ISH.
export interface Impuestos {
  ishPct?: number; // Impuesto Sobre Hospedaje del estado (0..10, ej. SLP = 3); default 0
}

// Medición del propio hotel en su motor (IDs suyos, no de Kora).
export interface Medicion {
  ga4Id?: string; // p.ej. G-XXXXXXX
  metaPixelId?: string; // p.ej. 1234567890
}

// Avisos por correo al hotel (nueva reserva, cancelación) y recuperación de
// reservas incompletas hacia el huésped.
export interface Notificaciones {
  email?: string; // destinatario de avisos; vacío = correo de la cuenta del dueño
  abandono?: boolean; // recordatorio de reserva incompleta al huésped (default: sí)
}

// Progreso del asistente de configuración (6 pasos: 1-2 crean el hotel en
// /panel/onboarding; 3-6 viven en /panel/[slug]/onboarding y son resumables).
export interface OnboardingProgreso {
  paso?: number; // último paso alcanzado (3..6)
  completado?: boolean; // el dueño llegó al final y publicó
}

// Extras vendibles (add-ons): desayuno, transporte, late checkout, etc.
export interface Addon {
  nombre: string;
  precio: number;
  tipo: "estancia" | "noche" | "persona"; // cobro: por reserva / por noche / por persona
  imagen?: string; // URL de foto (Storage del hotel); opcional
}

// Experiencias vendibles en el motor: tours, traslados, cena, spa. Es un add-on
// "rico": se vende con foto y descripción, y admite cantidad explícita (p. ej.
// "2 boletos al tour", cobro="unidad"), mientras que Addon multiplica por todos
// los huéspedes. Vive en extras.experiencias (sin migración de BD).
export interface Experiencia {
  nombre: string;
  precio: number;
  cobro: "estancia" | "noche" | "persona" | "unidad"; // ×1 / ×noches / ×huéspedes / ×cantidad
  descripcion?: string;
  imagen?: string; // URL de foto (Storage del hotel)
  categoria?: string; // clave de CATEGORIAS_EXPERIENCIA
  cantidadMax?: number; // tope de unidades (solo cobro="unidad"); 0/undefined = sin tope
  // Agenda (Sprint 2): en el motor el huésped elige día (y horario) dentro de su
  // estancia. No afectan el precio; viajan como anotación al hotel.
  dias?: number[]; // días de la semana en que se ofrece (0=Dom … 6=Sáb); vacío/ausente = todos
  horarios?: string[]; // horarios de salida (texto libre, ej. "9:00 am"); ausente = sin horario fijo
  // Cupo (Sprint 3): lugares disponibles POR DÍA (tabla experiencia_ventas).
  // 0/undefined = sin límite. No aplica a cobro="noche" (esa no elige día).
  cupoDia?: number;
}

// Descuento de paquete (Sprint 3): si el huésped agrega `min` o más
// experiencias distintas, sus experiencias tienen `pct`% de descuento.
export interface ExperienciasBundle {
  min?: number; // mínimo de experiencias distintas (default 2)
  pct?: number; // % de descuento sobre el total de experiencias (0 = apagado)
}

// Categorías para agrupar experiencias en el motor y elegir en el panel.
export const CATEGORIAS_EXPERIENCIA = [
  { key: "tour", label: "Tour" },
  { key: "traslado", label: "Traslado" },
  { key: "gastronomia", label: "Gastronomía" },
  { key: "spa", label: "Spa / Bienestar" },
  { key: "otro", label: "Otro" },
] as const;

// ─── Bloques de la página (ultrapersonalización) ─────────────────────────────
// La mini-página dejó de ser una plantilla fija de 8 secciones: ahora es una
// LISTA DE BLOQUES que el hotelero ordena, prende, apaga, retitula y amplía con
// bloques propios. Los 8 de siempre son "nativos" (sacan su contenido de los
// datos del hotel); los demás los escribe el hotelero. Todo vive en `extras`,
// sin migración de columnas.

export type BloqueTipo =
  // nativos: el contenido sale de los datos del hotel
  | "formulario"
  | "descripcion"
  | "fotos"
  | "habitaciones"
  | "amenidades"
  | "resenas"
  | "faq"
  | "politicas"
  | "ubicacion"
  // propios: los crea y escribe el hotelero
  | "texto"
  | "galeria"
  | "destacados"
  | "video"
  | "promocion"
  | "cercanos"
  | "menu";

export const BLOQUES_NATIVOS: BloqueTipo[] = [
  "formulario",
  "descripcion",
  "fotos",
  "habitaciones",
  "amenidades",
  "resenas",
  "faq",
  "politicas",
  "ubicacion",
];

export function esBloqueNativo(tipo: string): boolean {
  return BLOQUES_NATIVOS.includes(tipo as BloqueTipo);
}

// Un punto fuerte del bloque "destacados" (ícono + título + texto corto).
export interface DestacadoItem {
  icono?: string; // clave de ICONOS
  titulo: string;
  texto?: string;
}

// La oferta del bloque "promocion". Fuera de vigencia, el bloque no se pinta
// en la página pública (en el preview del editor se ve marcado).
export interface Promo {
  texto?: string; // "2 noches + desayuno por $1,800"
  desde?: string; // YYYY-MM-DD; vacío = desde siempre
  hasta?: string; // YYYY-MM-DD; vacío = para siempre (inclusive)
  botonTexto?: string; // default "Reservar ahora"
}

// Una tarjeta del bloque "cercanos" (qué hacer cerca del hotel).
export interface CercanoItem {
  foto?: string; // URL pública del bucket "fotos"
  titulo: string;
  texto?: string;
  distancia?: string; // "a 10 min caminando", "15 km"
}

// Una sección del bloque "menu" (restaurante, spa, tours propios…).
export interface MenuSeccion {
  titulo?: string; // "Desayunos", "Bebidas"; vacío = sin encabezado
  items: { nombre: string; precio?: string; descripcion?: string }[];
}

export interface Bloque {
  id: string; // estable: en los nativos es igual al tipo; en los propios, un uid
  tipo: BloqueTipo;
  oculto?: boolean; // ausente = visible (así el default de todo bloque nuevo es "se ve")
  titulo?: string; // reemplaza el título por defecto; cadena vacía = sin título
  fondo?: "ninguno" | "tarjeta" | "marca"; // cómo se pinta la sección
  // ── contenido de los bloques propios ──
  texto?: string; // "texto"
  imagenes?: string[]; // "galeria"
  items?: DestacadoItem[]; // "destacados"
  videoUrl?: string; // "video" (link normal de YouTube; se convierte a embed)
  promo?: Promo; // "promocion"
  cercanos?: CercanoItem[]; // "cercanos"
  menuSecciones?: MenuSeccion[]; // "menu"
}

// Títulos por defecto de cada tipo (lo que hoy está escrito a fuego en el HTML).
export const BLOQUE_TITULO_DEFAULT: Record<BloqueTipo, string> = {
  formulario: "",
  descripcion: "",
  fotos: "",
  habitaciones: "Habitaciones",
  amenidades: "Servicios",
  resenas: "Lo que dicen los huéspedes",
  faq: "Preguntas frecuentes",
  politicas: "Información útil",
  ubicacion: "Ubicación",
  texto: "Sobre nosotros",
  galeria: "Galería",
  destacados: "Por qué elegirnos",
  video: "Conoce el hotel",
  promocion: "Promoción",
  cercanos: "Qué hacer cerca",
  menu: "Menú",
};

// Catálogo para el botón "+ Agregar bloque" del editor.
export const BLOQUES_CATALOGO: {
  tipo: BloqueTipo;
  label: string;
  desc: string;
  nativo: boolean;
}[] = [
  { tipo: "formulario", label: "Formulario de reserva", desc: "La caja de fechas y personas para pedir disponibilidad.", nativo: true },
  { tipo: "descripcion", label: "Descripción", desc: "El texto de presentación de tu hotel.", nativo: true },
  { tipo: "fotos", label: "Galería del hotel", desc: "Las fotos que cargaste en Contenido.", nativo: true },
  { tipo: "habitaciones", label: "Habitaciones", desc: "Tus habitaciones con precio y botón de reserva.", nativo: true },
  { tipo: "amenidades", label: "Servicios", desc: "Las amenidades que marcaste (wifi, alberca…).", nativo: true },
  { tipo: "resenas", label: "Reseñas", desc: "Las reseñas verificadas de tus huéspedes.", nativo: true },
  { tipo: "faq", label: "Preguntas frecuentes", desc: "Las preguntas que cargaste en su pestaña.", nativo: true },
  { tipo: "politicas", label: "Información útil", desc: "Cancelación, mascotas, niños, formas de pago.", nativo: true },
  { tipo: "ubicacion", label: "Ubicación", desc: "El mapa y el botón Cómo llegar.", nativo: true },
  { tipo: "texto", label: "Texto libre", desc: "Escribe lo que quieras: tu historia, reglas de la casa, qué hacer cerca.", nativo: false },
  { tipo: "galeria", label: "Galería propia", desc: "Un grupo de fotos aparte, con su propio título (ej. El restaurante).", nativo: false },
  { tipo: "destacados", label: "Puntos fuertes", desc: "Filas con ícono y texto: alberca natural, desayuno incluido, pet friendly.", nativo: false },
  { tipo: "video", label: "Video", desc: "Un video de YouTube de tu hotel.", nativo: false },
  { tipo: "promocion", label: "Promoción", desc: "Una oferta con fecha de fin y botón de reservar (ej. 2 noches + desayuno).", nativo: false },
  { tipo: "cercanos", label: "Qué hacer cerca", desc: "Tarjetas con foto de lugares y actividades cerca de tu hotel.", nativo: false },
  { tipo: "menu", label: "Menú o lista de precios", desc: "Tu menú del restaurante o lista de servicios con precios.", nativo: false },
];

// ─── Botones y CTAs ──────────────────────────────────────────────────────────
// Antes solo existían "Reservar ahora", "Cómo llegar", Instagram y Facebook, y
// no se podían editar. Ahora el hotelero arma los que quiera.

export type BotonAccion =
  | "reservar" // al motor de reservas (o a WhatsApp si el motor está pausado)
  | "whatsapp" // al WhatsApp del hotel, con mensaje propio
  | "telefono"
  | "email"
  | "mapa" // al link de Google Maps del hotel
  | "enlace" // a cualquier URL
  | "ancla"; // baja a un bloque de la misma página

export type BotonEstilo = "relleno" | "contorno" | "discreto";
export type BotonZona = "portada" | "cierre" | "flotante";

export interface Boton {
  id: string;
  texto: string;
  accion: BotonAccion;
  valor?: string; // URL, teléfono, correo, mensaje de WhatsApp o id de bloque
  icono?: string; // clave de ICONOS
  estilo?: BotonEstilo; // default "contorno"
  zonas?: BotonZona[]; // dónde aparece; vacío = en ningún lado
}

export const ACCIONES_BOTON: {
  key: BotonAccion;
  label: string;
  ayuda: string;
  campo: string | null; // etiqueta del campo "valor"; null = no necesita
}[] = [
  { key: "reservar", label: "Reservar", ayuda: "Lleva a tu motor de reservas.", campo: null },
  { key: "whatsapp", label: "WhatsApp", ayuda: "Abre un chat contigo.", campo: "Mensaje que llega escrito (opcional)" },
  { key: "telefono", label: "Llamar", ayuda: "Marca desde el celular.", campo: "Número" },
  { key: "email", label: "Correo", ayuda: "Abre el correo del huésped.", campo: "Correo" },
  { key: "mapa", label: "Cómo llegar", ayuda: "Abre tu ubicación en Google Maps.", campo: null },
  { key: "enlace", label: "Enlace", ayuda: "A donde tú quieras: menú, tour virtual, TripAdvisor.", campo: "Dirección (https://…)" },
  { key: "ancla", label: "Bajar a un bloque", ayuda: "Baja a una sección de esta misma página.", campo: "Bloque" },
];

export const ZONAS_BOTON: { key: BotonZona; label: string; ayuda: string }[] = [
  { key: "portada", label: "Arriba", ayuda: "Junto al nombre del hotel." },
  { key: "cierre", label: "Al final", ayuda: "Después de todas las secciones." },
  { key: "flotante", label: "Barra del celular", ayuda: "Siempre visible abajo, en celular." },
];

// Íconos disponibles para botones y puntos fuertes. Las claves se resuelven a
// componentes de lucide en components/mini/iconos.tsx (aquí solo van datos, para
// que este archivo lo pueda leer el servidor sin cargar la librería de íconos).
export const ICONOS = [
  { key: "calendario", label: "Calendario" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "telefono", label: "Teléfono" },
  { key: "correo", label: "Correo" },
  { key: "mapa", label: "Mapa" },
  { key: "enlace", label: "Enlace" },
  { key: "estrella", label: "Estrella" },
  { key: "corazon", label: "Corazón" },
  { key: "cama", label: "Cama" },
  { key: "alberca", label: "Alberca" },
  { key: "cafe", label: "Café" },
  { key: "comida", label: "Comida" },
  { key: "wifi", label: "Wifi" },
  { key: "auto", label: "Auto" },
  { key: "mascota", label: "Mascota" },
  { key: "montana", label: "Montaña" },
  { key: "sol", label: "Sol" },
  { key: "escudo", label: "Escudo" },
  { key: "regalo", label: "Regalo" },
  { key: "camara", label: "Cámara" },
  { key: "musica", label: "Música" },
  { key: "flecha", label: "Flecha" },
] as const;

// ─── Textos editables de la página ───────────────────────────────────────────
export interface Textos {
  heroTitulo?: string; // reemplaza el nombre del hotel como título grande
  heroSubtitulo?: string; // eslogan bajo el título
  cierreTitulo?: string; // encabezado del bloque final de reserva
  cierreTexto?: string; // frase bajo ese encabezado
}

// ─── Banner de aviso con vigencia ────────────────────────────────────────────
export interface Aviso {
  activo?: boolean;
  texto?: string;
  desde?: string; // YYYY-MM-DD; vacío = desde siempre
  hasta?: string; // YYYY-MM-DD; vacío = para siempre (inclusive: se apaga al día siguiente)
  enlaceTexto?: string;
  enlaceUrl?: string;
}

// ¿Una vigencia desde/hasta aplica hoy? Se compara en fecha local YYYY-MM-DD
// para que "hasta el 2 de noviembre" incluya todo el día 2 en México. La usan
// el aviso y el bloque de promoción.
export function vigenciaActiva(desde: string | undefined, hasta: string | undefined, hoy: string): boolean {
  if (desde && hoy < desde) return false;
  if (hasta && hoy > hasta) return false;
  return true;
}

// ¿El aviso debe verse hoy?
export function avisoVigente(aviso: Aviso | undefined, hoy: string): boolean {
  if (!aviso?.activo || !(aviso.texto ?? "").trim()) return false;
  return vigenciaActiva(aviso.desde, aviso.hasta, hoy);
}

// Fecha local de México en YYYY-MM-DD (el servidor corre en UTC: sin esto, un
// aviso se apagaría a las 6 pm hora de México).
export function hoyMx(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export interface MiniExtras {
  demo?: boolean; // hotel de demostración: el motor simula el pago (nada se cobra)
  bloques?: Bloque[]; // orden, visibilidad y contenido de la página
  botones?: Boton[]; // botones y CTAs de la portada, el cierre y la barra móvil
  textos?: Textos; // títulos y frases que el hotelero reescribe
  aviso?: Aviso; // banner de temporada con fecha de caducidad
  amenidades?: string[];
  instagram?: string;
  facebook?: string;
  mapsUrl?: string;
  mapEmbedUrl?: string;
  reviewUrl?: string; // link directo "escribir reseña" de Google (lo usa el email del día 7)
  diseno?: Diseno;
  resenas?: Resena[];
  faqs?: MiniFaq[];
  politicas?: Politicas;
  accesibilidad?: string; // rampa, elevador, cuartos adaptados… (la usa Camila)
  reglas?: Reglas;
  impuestos?: Impuestos;
  medicion?: Medicion;
  notificaciones?: Notificaciones;
  onboarding?: OnboardingProgreso;
  addons?: Addon[];
  experiencias?: Experiencia[];
  experienciasBundle?: ExperienciasBundle;
  formasPago?: string[];
  idiomas?: string[];
  premium?: { marcaOculta?: boolean; dominio?: string };
}

// ─── Tipografías curadas (las variables se cargan en app/layout.tsx) ──────────
export const FUENTES = [
  { key: "jakarta", label: "Moderna" },
  { key: "playfair", label: "Elegante" },
  { key: "lora", label: "Clásica" },
  { key: "poppins", label: "Limpia" },
] as const;

const SYS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function fontStack(key?: string): string {
  switch (key) {
    case "playfair":
      return `var(--font-playfair), Georgia, serif`;
    case "lora":
      return `var(--font-lora), Georgia, serif`;
    case "poppins":
      return `var(--font-poppins), ${SYS}`;
    default:
      return `var(--font-jakarta), ${SYS}`;
  }
}

// ─── Color de marca ───────────────────────────────────────────────────────────
export const COLOR_DEFAULT = "#1B4332"; // verde Kora (default)
export const COLOR_PRESETS = [
  "#1B4332", // verde Kora
  "#0F766E", // teal
  "#1E3A8A", // azul
  "#7C3AED", // morado
  "#B45309", // ámbar
  "#9D174D", // vino
  "#1E293B", // pizarra
  "#0EA5E9", // cielo
];

// Tinta legible (texto sobre el color de marca) según luminancia.
export function inkFor(hex?: string): string {
  const h = (hex || COLOR_DEFAULT).replace("#", "");
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#1a1a1a" : "#ffffff";
}

// ─── Secciones reordenables de la mini-página ─────────────────────────────────
export const SECCIONES_DEFAULT = [
  "descripcion",
  "fotos",
  "habitaciones",
  "amenidades",
  "resenas",
  "faq",
  "politicas",
  "ubicacion",
] as const;

export const SECCION_LABELS: Record<string, string> = {
  descripcion: "Descripción",
  fotos: "Galería de fotos",
  habitaciones: "Habitaciones",
  amenidades: "Servicios / amenidades",
  resenas: "Reseñas",
  faq: "Preguntas frecuentes",
  politicas: "Políticas",
  ubicacion: "Ubicación y contacto",
};

// Devuelve el orden guardado completado con cualquier sección faltante (para que
// no desaparezcan secciones nuevas si el orden viejo no las incluía).
export function ordenSecciones(guardado?: string[]): string[] {
  const base = [...SECCIONES_DEFAULT];
  if (!guardado || guardado.length === 0) return base;
  const validos = guardado.filter((s) => base.includes(s as never));
  const faltantes = base.filter((s) => !validos.includes(s));
  return [...validos, ...faltantes];
}

// ─── Resolución de bloques ────────────────────────────────────────────────────
// Fuente de verdad de la página. Si el hotel todavía no tocó el editor visual,
// se deriva del orden viejo (extras.diseno.ordenSecciones) para que su página
// se vea EXACTAMENTE igual que antes. Si Kora agrega un bloque nativo nuevo más
// adelante, se suma al final en vez de desaparecer.
export function resolverBloques(extras: MiniExtras | null | undefined): Bloque[] {
  const guardados = extras?.bloques;
  const base = Array.isArray(guardados)
    ? guardados.filter((b) => b && typeof b.id === "string" && typeof b.tipo === "string")
    : // Sin bloques guardados: se deriva del orden viejo, que nunca incluyó el
      // formulario de reserva (iba fijo arriba). Ese es su lugar por defecto.
      ordenSecciones(extras?.diseno?.ordenSecciones).map((t) => ({
        id: t,
        tipo: t as BloqueTipo,
      }));
  if (base.length === 0) return [];
  const presentes = new Set(base.map((b) => b.tipo));
  const faltantes = BLOQUES_NATIVOS.filter((t) => !presentes.has(t)).map((t) => ({
    id: t,
    tipo: t,
  }));
  // El formulario arranca arriba (como estaba); cualquier otro bloque nativo que
  // Kora agregue en el futuro se suma al final para no reacomodar la página.
  const alInicio = faltantes.filter((b) => b.tipo === "formulario");
  const alFinal = faltantes.filter((b) => b.tipo !== "formulario");
  return [...alInicio, ...base, ...alFinal];
}

// El título que se dibuja: lo que escribió el hotelero, o el de fábrica. Una
// cadena vacía guardada a propósito significa "sin encabezado".
export function tituloBloque(b: Bloque): string {
  return b.titulo === undefined ? BLOQUE_TITULO_DEFAULT[b.tipo] ?? "" : b.titulo;
}

// Ancla estable para los botones tipo "bajar a un bloque".
export function anclaBloque(b: Bloque): string {
  return `b-${b.id}`;
}

// ─── Resolución de botones ────────────────────────────────────────────────────
// Los botones que la página tenía cableados pasan a ser datos editables. Un
// hotel que nunca abrió el editor ve exactamente lo de antes: reservar arriba y
// al final, y "Cómo llegar" arriba si tiene mapa.
export function botonesDefault(opts: { mapsUrl?: string }): Boton[] {
  const lista: Boton[] = [
    {
      id: "reservar",
      texto: "Reservar ahora",
      accion: "reservar",
      icono: "calendario",
      estilo: "relleno",
      zonas: ["portada", "cierre"],
    },
  ];
  if ((opts.mapsUrl ?? "").trim()) {
    lista.push({
      id: "mapa",
      texto: "Cómo llegar",
      accion: "mapa",
      icono: "mapa",
      estilo: "contorno",
      zonas: ["portada"],
    });
  }
  return lista;
}

export function resolverBotones(extras: MiniExtras | null | undefined): Boton[] {
  const guardados = extras?.botones;
  if (Array.isArray(guardados)) {
    return guardados.filter((b) => b && typeof b.id === "string" && (b.texto ?? "").trim());
  }
  return botonesDefault({ mapsUrl: extras?.mapsUrl });
}

// Contexto que necesita un botón para saber a dónde apunta.
export interface BotonCtx {
  slug: string;
  nombreHotel: string;
  whatsapp?: string | null;
  mapsUrl?: string | null;
  motorActivo: boolean;
}

// Destino final del botón. Devuelve null si le falta el dato (p. ej. WhatsApp
// sin número): el render lo omite en vez de dibujar un botón muerto.
export function hrefBoton(b: Boton, ctx: BotonCtx): string | null {
  const val = (b.valor ?? "").trim();
  switch (b.accion) {
    case "reservar":
      if (ctx.motorActivo) return `/h/${ctx.slug}/reservar`;
      return waHref(ctx.whatsapp, `Hola, vi su página y quiero reservar en ${ctx.nombreHotel}`);
    case "whatsapp":
      return waHref(ctx.whatsapp, val || `Hola, vi su página de ${ctx.nombreHotel}`);
    case "telefono": {
      const tel = val.replace(/[^\d+]/g, "");
      return tel ? `tel:${tel}` : null;
    }
    case "email":
      return val.includes("@") ? `mailto:${val}` : null;
    case "mapa":
      return (ctx.mapsUrl ?? "").trim() || null;
    case "enlace":
      if (!val) return null;
      return /^https?:\/\//i.test(val) ? val : `https://${val}`;
    case "ancla":
      return val ? `#b-${val}` : null;
    default:
      return null;
  }
}

function waHref(whatsapp: string | null | undefined, mensaje: string): string | null {
  const num = (whatsapp ?? "").replace(/\D/g, "");
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
}

// Los destinos que salen del sitio se abren en pestaña nueva; las anclas y el
// motor, no (perderían el contexto de la reserva).
export function botonExterno(b: Boton, ctx: BotonCtx): boolean {
  if (b.accion === "ancla") return false;
  if (b.accion === "reservar") return !ctx.motorActivo;
  return true;
}

// ─── Video ────────────────────────────────────────────────────────────────────
// Acepta lo que el hotelero pegue (youtu.be, watch?v=, /embed/, /shorts/) y
// devuelve la URL de inserción. null si no es un YouTube reconocible: así nunca
// se mete un iframe a un dominio arbitrario desde el jsonb.
export function youtubeEmbed(url: string | undefined): string | null {
  const s = (url ?? "").trim();
  if (!s) return null;
  const m = s.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

// ─── Ids ──────────────────────────────────────────────────────────────────────
export function nuevoId(prefijo: string): string {
  return `${prefijo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Opciones de políticas / pago / idiomas ───────────────────────────────────
export const FORMAS_PAGO = [
  "Efectivo",
  "Transferencia",
  "Tarjeta de crédito/débito",
  "Depósito bancario",
  "Mercado Pago",
  "PayPal",
] as const;

export const IDIOMAS = ["Español", "Inglés", "Francés", "Portugués"] as const;
