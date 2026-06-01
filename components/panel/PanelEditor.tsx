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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AMENIDADES } from "@/lib/amenidades";

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

export function PanelEditor({ userId }: { userId: string }) {
  const supabase = createClient();

  const [cargando, setCargando] = useState(true);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");

  // Mini-página
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);

  // Extras (nivel hotel)
  const [amenidades, setAmenidades] = useState<string[]>([]);
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");

  // Guía del huésped
  const [wifi, setWifi] = useState("");
  const [wifiClave, setWifiClave] = useState("");
  const [gCheckin, setGCheckin] = useState("");
  const [gCheckout, setGCheckout] = useState("");
  const [reglas, setReglas] = useState(""); // una por línea
  const [recomendaciones, setRecomendaciones] = useState(""); // una por línea

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
        const ex = data.extras ?? {};
        setAmenidades(Array.isArray(ex.amenidades) ? ex.amenidades : []);
        setInstagram(ex.instagram ?? "");
        setFacebook(ex.facebook ?? "");
        setMapsUrl(ex.mapsUrl ?? "");
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

  // Tarifas por número de personas (por habitación)
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

  // Sube archivos al bucket "fotos" y devuelve las URLs públicas. Reutilizable
  // para las fotos del hotel y para las fotos de cada habitación.
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
    };

    const payloadBase = {
      nombre: nombre.trim(),
      ubicacion: ubicacion.trim(),
      descripcion: descripcion.trim(),
      whatsapp: whatsapp.trim(),
      habitaciones,
      fotos,
      guia,
    };
    const payload = { ...payloadBase, extras };

    // Si la columna "extras" aún no existe en la base (falta correr el SQL),
    // guardamos con "payloadBase" (sin ella) para que el resto —incluidas las
    // fotos/tarifas por habitación, que viven en "habitaciones"— sí se guarde.
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
            usarExtras = false; // reintenta sin "extras"
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

  return (
    <div className="mt-8 space-y-6">
      {/* Dirección / enlaces */}
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
              href={`/g/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
            >
              <ExternalLink size={14} /> Ver guía del huésped
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

      {/* Datos del hotel */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm space-y-4">
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
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm">
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

      {/* Habitaciones */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm">
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

              {/* Capacidad */}
              <div className="sm:max-w-[50%]">
                <input
                  className={inputCls}
                  value={h.capacidad ?? ""}
                  onChange={(e) => updateHab(i, "capacidad", e.target.value)}
                  placeholder="Capacidad: máx. huéspedes (ej. 4)"
                  inputMode="numeric"
                />
              </div>

              {/* Precios por número de personas */}
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

              {/* Fotos de la habitación */}
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

      {/* Amenidades */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-kora-text mb-1">Amenidades</h2>
        <p className="text-sm text-kora-muted mb-4">
          Marca los servicios que ofrece tu hotel. Se muestran con iconos en tu
          página.
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
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm space-y-4">
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

      {/* Guía del huésped */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-kora-text">Guía del huésped</h2>
          <p className="text-sm text-kora-muted mt-0.5">
            La info útil para tus huéspedes (wifi, horarios, reglas, recomendaciones).
            Aparece en tu página de guía con su propio QR para la habitación.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-kora-text mb-1.5">
              Red WiFi
            </label>
            <input
              className={inputCls}
              value={wifi}
              onChange={(e) => setWifi(e.target.value)}
              placeholder="Nombre de la red"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-kora-text mb-1.5">
              Clave WiFi
            </label>
            <input
              className={inputCls}
              value={wifiClave}
              onChange={(e) => setWifiClave(e.target.value)}
              placeholder="Contraseña"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-kora-text mb-1.5">
              Hora de check-in
            </label>
            <input
              className={inputCls}
              value={gCheckin}
              onChange={(e) => setGCheckin(e.target.value)}
              placeholder="3:00 PM"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-kora-text mb-1.5">
              Hora de check-out
            </label>
            <input
              className={inputCls}
              value={gCheckout}
              onChange={(e) => setGCheckout(e.target.value)}
              placeholder="12:00 PM"
            />
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

      {/* Códigos QR */}
      {hotelId && (
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-kora-text mb-1">Tus códigos QR</h2>
          <p className="text-sm text-kora-muted mb-5">
            Imprímelos: el de reservas para recepción y redes; el de la guía para
            la habitación.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="text-center">
              <div
                ref={qrPaginaRef}
                className="inline-flex p-3 rounded-xl border border-gray-100 bg-white"
              >
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
              <div
                ref={qrGuiaRef}
                className="inline-flex p-3 rounded-xl border border-gray-100 bg-white"
              >
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

      {/* Guardar */}
      <div className="sticky bottom-4 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-gray-100 shadow-lg flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm">
            {error ? (
              <span className="text-red-600">{error}</span>
            ) : guardado ? (
              <span className="text-kora-primary font-semibold inline-flex items-center gap-1.5">
                <Check size={16} /> Guardado
              </span>
            ) : (
              <span className="text-kora-muted">Guarda tus cambios cuando termines.</span>
            )}
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
