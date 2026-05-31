"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Check,
  Plus,
  Trash2,
  ImagePlus,
  ExternalLink,
  Copy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200";

interface Habitacion {
  nombre: string;
  precio: string;
  descripcion: string;
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

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

export function PanelEditor({ userId }: { userId: string }) {
  const supabase = createClient();

  const [cargando, setCargando] = useState(true);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");

  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);

  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  // Carga inicial del hotel del usuario (si ya existe).
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
        setHabitaciones(
          Array.isArray(data.habitaciones) ? data.habitaciones : []
        );
        setFotos(Array.isArray(data.fotos) ? data.fotos : []);
      }
      if (activo) setCargando(false);
    })();
    return () => {
      activo = false;
    };
  }, [supabase, userId]);

  const slugPreview = slug || slugify(nombre) || "tu-hotel";

  // ── Habitaciones ──
  function addHab() {
    setHabitaciones((h) => [...h, { nombre: "", precio: "", descripcion: "" }]);
  }
  function updateHab(i: number, campo: keyof Habitacion, valor: string) {
    setHabitaciones((h) =>
      h.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it))
    );
  }
  function removeHab(i: number) {
    setHabitaciones((h) => h.filter((_, idx) => idx !== i));
  }

  // ── Fotos ──
  const onSubirFotos = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setSubiendo(true);
      setError("");
      try {
        const nuevas: string[] = [];
        for (const file of Array.from(files)) {
          const limpio = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
          const path = `${userId}/${Date.now()}-${limpio}`;
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
        setFotos((f) => [...f, ...nuevas]);
      } finally {
        setSubiendo(false);
      }
    },
    [supabase, userId]
  );

  function removeFoto(url: string) {
    setFotos((f) => f.filter((u) => u !== url));
  }

  // ── Guardar ──
  async function guardar() {
    setError("");
    if (!nombre.trim()) {
      setError("Ponle un nombre a tu hotel.");
      return;
    }
    setGuardando(true);
    setGuardado(false);

    const payload = {
      nombre: nombre.trim(),
      ubicacion: ubicacion.trim(),
      descripcion: descripcion.trim(),
      whatsapp: whatsapp.trim(),
      habitaciones,
      fotos,
    };

    try {
      if (hotelId) {
        const { error: upErr } = await supabase
          .from("hoteles")
          .update(payload)
          .eq("id", hotelId);
        if (upErr) throw upErr;
      } else {
        // Genera un slug único (reintenta con sufijo si ya existe).
        let intento = slugify(nombre) || "hotel";
        let creado = null;
        for (let i = 0; i < 4 && !creado; i++) {
          const slugTry =
            i === 0 ? intento : `${intento}-${Math.random().toString(36).slice(2, 6)}`;
          const { data, error: insErr } = await supabase
            .from("hoteles")
            .insert({ ...payload, owner_id: userId, slug: slugTry })
            .select("id, slug")
            .single();
          if (!insErr && data) {
            creado = data;
          } else if (insErr && insErr.code !== "23505") {
            throw insErr; // error distinto a slug duplicado
          }
        }
        if (!creado) throw new Error("No se pudo crear. Intenta con otro nombre.");
        setHotelId(creado.id);
        setSlug(creado.slug);
      }
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo guardar.";
      setError(msg);
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
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(`${SITE}/h/${slug}`);
              }}
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
          Sube las mejores fotos de tu hotel (habitaciones, áreas comunes, fachada).
        </p>

        {fotos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
            {fotos.map((url) => (
              <div key={url} className="relative group">
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
          {subiendo ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ImagePlus size={16} />
          )}
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
            <div
              key={i}
              className="rounded-xl border border-gray-100 p-4 bg-kora-bg/50 space-y-3"
            >
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
                  placeholder="Precio por noche (ej. 1500)"
                  inputMode="numeric"
                />
              </div>
              <input
                className={inputCls}
                value={h.descripcion}
                onChange={(e) => updateHab(i, "descripcion", e.target.value)}
                placeholder="Breve descripción (opcional)"
              />
              <button
                type="button"
                onClick={() => removeHab(i)}
                className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700"
              >
                <Trash2 size={14} /> Quitar
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
