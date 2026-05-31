"use client";

import { useState } from "react";
import { ArrowRight, Copy, Printer, Check, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200";

type TipoDoc = "cancelacion" | "privacidad" | "reglamento";

const HOY = new Date().toLocaleDateString("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

interface Seccion {
  h: string;
  items: string[];
}
interface Doc {
  titulo: string;
  intro?: string;
  secciones: Seccion[];
  cierre?: string;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-kora-text mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function docATexto(doc: Doc): string {
  let t = doc.titulo.toUpperCase() + "\n\n";
  if (doc.intro) t += doc.intro + "\n\n";
  for (const s of doc.secciones) {
    t += s.h + "\n";
    for (const it of s.items) t += "• " + it + "\n";
    t += "\n";
  }
  if (doc.cierre) t += doc.cierre + "\n\n";
  t += "Última actualización: " + HOY;
  return t;
}

// ─── Generadores ─────────────────────────────────────────────────────────────

function genCancelacion(
  hotel: string,
  d: { diasGratis: number; penTardia: number; penNoShow: number; anticipo: number }
): Doc {
  const H = hotel || "nuestro hotel";
  const cancel: string[] = [];
  cancel.push(
    d.diasGratis > 0
      ? `Cancelación sin costo hasta ${d.diasGratis} ${d.diasGratis === 1 ? "día" : "días"} antes de la fecha de llegada.`
      : "No se permite la cancelación sin costo; toda reservación confirmada es no reembolsable."
  );
  if (d.diasGratis > 0)
    cancel.push(
      `Cancelaciones posteriores a ese plazo: se cobra el ${d.penTardia}% del total de la reservación.`
    );
  cancel.push(
    `No presentarse (no-show): se cobra el ${d.penNoShow}% del total de la reservación.`
  );

  const anticipo: string[] = [];
  if (d.anticipo > 0)
    anticipo.push(
      `Para confirmar tu reservación se solicita un anticipo del ${d.anticipo}% del total, que se aplica a tu estancia.`
    );
  anticipo.push(
    "Los cambios de fecha están sujetos a disponibilidad y a la tarifa vigente."
  );
  anticipo.push(
    "En temporada alta, puentes y fechas especiales pueden aplicar condiciones distintas, que se informarán al momento de reservar."
  );

  return {
    titulo: `Política de cancelación — ${H}`,
    intro: `En ${H} queremos que reserves con confianza. Estas son nuestras condiciones de cancelación:`,
    secciones: [
      { h: "Cancelaciones", items: cancel },
      { h: "Anticipo y cambios", items: anticipo },
    ],
    cierre: "Al confirmar tu reservación, aceptas esta política de cancelación.",
  };
}

function genPrivacidad(
  hotel: string,
  d: {
    responsable: string;
    domicilio: string;
    correo: string;
    telefono: string;
    finalidades: string[];
  }
): Doc {
  const H = hotel || "nuestro hotel";
  return {
    titulo: `Aviso de privacidad — ${H}`,
    intro: `${d.responsable || H}, con domicilio en ${
      d.domicilio || "[domicilio]"
    }, es responsable del tratamiento y protección de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.`,
    secciones: [
      {
        h: "¿Qué datos recabamos?",
        items: [
          "Nombre y datos de contacto (teléfono, correo, WhatsApp).",
          "Datos de tu reservación (fechas, número de personas).",
          "En su caso, datos de facturación (RFC, razón social).",
        ],
      },
      {
        h: "¿Para qué los usamos?",
        items:
          d.finalidades.length > 0
            ? d.finalidades
            : ["Gestionar tu reservación y tu estancia."],
      },
      {
        h: "Tus derechos (ARCO)",
        items: [
          "Puedes Acceder, Rectificar, Cancelar u Oponerte al uso de tus datos, y revocar tu consentimiento.",
          `Para ejercerlos, escríbenos a ${d.correo || "[correo de contacto]"}${
            d.telefono ? ` o al teléfono ${d.telefono}` : ""
          }.`,
        ],
      },
      {
        h: "Transferencias",
        items: [
          "No compartimos tus datos con terceros, salvo lo necesario para prestar el servicio (por ejemplo, el proveedor de facturación) o cuando la ley lo exija.",
        ],
      },
    ],
    cierre:
      "Cualquier cambio a este aviso de privacidad se publicará en nuestros canales oficiales.",
  };
}

function genReglamento(
  hotel: string,
  d: {
    checkin: string;
    checkout: string;
    silDesde: string;
    silHasta: string;
    edad: string;
    mascotas: boolean;
    fumar: boolean;
    alberca: string;
    adicionales: string;
  }
): Doc {
  const H = hotel || "nuestro hotel";
  const convivencia: string[] = [
    `Respeta el descanso de los demás huéspedes; horario de silencio de ${d.silDesde || "22:00"} a ${d.silHasta || "8:00"} hrs.`,
    "El acceso de visitantes no registrados debe autorizarse en recepción.",
  ];
  if (d.edad.trim())
    convivencia.push(`Es necesario ser mayor de ${d.edad} años para registrarse.`);

  const areas: string[] = [];
  areas.push(
    d.fumar
      ? "Se permite fumar únicamente en las áreas designadas al aire libre."
      : "Está prohibido fumar dentro de las habitaciones y áreas cerradas; hacerlo puede generar un cargo por limpieza."
  );
  if (d.alberca.trim())
    areas.push(`Horario de alberca/áreas comunes: ${d.alberca}.`);
  areas.push(
    "El huésped es responsable de los daños ocasionados a la habitación, mobiliario o instalaciones."
  );
  areas.push(`${H} no se hace responsable por objetos de valor no resguardados.`);

  const secciones: Seccion[] = [
    {
      h: "Horarios",
      items: [
        `Check-in: a partir de las ${d.checkin || "15:00"} hrs.`,
        `Check-out: hasta las ${d.checkout || "12:00"} hrs. El check-out tardío está sujeto a disponibilidad y puede tener costo.`,
      ],
    },
    { h: "Convivencia", items: convivencia },
    {
      h: "Mascotas",
      items: [
        d.mascotas
          ? "Se admiten mascotas con previo aviso y reglas específicas; el huésped es responsable de su comportamiento y de cualquier daño."
          : "Por respeto a todos los huéspedes, no se permite el ingreso de mascotas (salvo animales de servicio).",
      ],
    },
    { h: "Áreas y cuidado", items: areas },
  ];

  const extra = d.adicionales
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (extra.length) secciones.push({ h: "Reglas adicionales", items: extra });

  return {
    titulo: `Reglamento interno — ${H}`,
    intro: `Para que todos disfruten su estancia, en ${H} pedimos respetar las siguientes normas:`,
    secciones,
    cierre:
      "Al registrarte aceptas este reglamento. Su incumplimiento puede dar lugar a la terminación de la estancia sin reembolso.",
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function DocumentosLegales() {
  const [tipo, setTipo] = useState<TipoDoc>("cancelacion");
  const [hotel, setHotel] = useState("");
  const [copiado, setCopiado] = useState(false);

  // cancelación
  const [diasGratis, setDiasGratis] = useState(7);
  const [penTardia, setPenTardia] = useState(50);
  const [penNoShow, setPenNoShow] = useState(100);
  const [anticipoPct, setAnticipoPct] = useState(30);

  // privacidad
  const [responsable, setResponsable] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [finReserva] = useState(true);
  const [finFactura, setFinFactura] = useState(true);
  const [finPromos, setFinPromos] = useState(true);
  const [finMejora, setFinMejora] = useState(false);

  // reglamento
  const [checkin, setCheckin] = useState("15:00");
  const [checkout, setCheckout] = useState("12:00");
  const [silDesde, setSilDesde] = useState("22:00");
  const [silHasta, setSilHasta] = useState("08:00");
  const [edad, setEdad] = useState("");
  const [mascotas, setMascotas] = useState(false);
  const [fumar, setFumar] = useState(false);
  const [alberca, setAlberca] = useState("");
  const [adicionales, setAdicionales] = useState("");

  function aplicarPreset(p: "flexible" | "moderada" | "estricta") {
    if (p === "flexible") {
      setDiasGratis(1); setPenTardia(25); setPenNoShow(50); setAnticipoPct(0);
    } else if (p === "moderada") {
      setDiasGratis(7); setPenTardia(50); setPenNoShow(100); setAnticipoPct(30);
    } else {
      setDiasGratis(0); setPenTardia(100); setPenNoShow(100); setAnticipoPct(50);
    }
  }

  const finalidades: string[] = [];
  if (finReserva) finalidades.push("Gestionar tu reservación y tu estancia.");
  if (finFactura) finalidades.push("Emitir comprobantes y facturas (CFDI).");
  if (finPromos)
    finalidades.push(
      "Enviarte información y promociones del hotel (puedes pedir que dejemos de hacerlo cuando quieras)."
    );
  if (finMejora)
    finalidades.push("Mejorar nuestro servicio y tu experiencia como huésped.");

  const doc =
    tipo === "cancelacion"
      ? genCancelacion(hotel, {
          diasGratis,
          penTardia,
          penNoShow,
          anticipo: anticipoPct,
        })
      : tipo === "privacidad"
        ? genPrivacidad(hotel, {
            responsable,
            domicilio,
            correo,
            telefono,
            finalidades,
          })
        : genReglamento(hotel, {
            checkin,
            checkout,
            silDesde,
            silHasta,
            edad,
            mascotas,
            fumar,
            alberca,
            adicionales,
          });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(docATexto(doc));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* noop */
    }
  }

  const tabs: { id: TipoDoc; label: string }[] = [
    { id: "cancelacion", label: "Política de cancelación" },
    { id: "privacidad", label: "Aviso de privacidad" },
    { id: "reglamento", label: "Reglamento interno" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .doc-print, .doc-print * { visibility: visible !important; }
          .doc-print {
            position: absolute; left: 0; top: 0; width: 100%;
            box-shadow: none !important; border: none !important;
            border-radius: 0 !important; padding: 40px !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Selector */}
      <Reveal>
        <div className="flex flex-wrap gap-2 justify-center no-print" role="tablist">
          {tabs.map((t) => {
            const active = t.id === tipo;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTipo(t.id)}
                className={`btn-press px-4 py-2.5 rounded-full text-sm font-semibold border transition-colors ${
                  active
                    ? "bg-kora-primary text-white border-kora-primary"
                    : "bg-white text-kora-text border-gray-200 hover:border-kora-accent"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Reveal>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulario */}
        <Reveal>
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm no-print">
            <h2 className="text-lg font-bold text-kora-text mb-4">Personaliza tu documento</h2>
            <div className="space-y-4">
              <Campo label="Nombre de tu hotel">
                <input
                  className={inputCls}
                  value={hotel}
                  onChange={(e) => setHotel(e.target.value)}
                  placeholder="Hotel Paraíso Encantado"
                />
              </Campo>

              {tipo === "cancelacion" && (
                <>
                  <div>
                    <span className="block text-sm font-semibold text-kora-text mb-1.5">
                      Punto de partida
                    </span>
                    <div className="flex gap-2">
                      {([
                        ["flexible", "Flexible"],
                        ["moderada", "Moderada"],
                        ["estricta", "Estricta"],
                      ] as const).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => aplicarPreset(id)}
                          className="btn-press flex-1 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-kora-text hover:border-kora-accent transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-kora-muted">
                      Elige uno y luego ajusta los números a tu gusto.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Días antes para cancelar gratis">
                      <input type="number" min={0} className={inputCls} value={diasGratis}
                        onChange={(e) => setDiasGratis(Math.max(0, Number(e.target.value)))} />
                    </Campo>
                    <Campo label="Anticipo para confirmar (%)">
                      <input type="number" min={0} max={100} className={inputCls} value={anticipoPct}
                        onChange={(e) => setAnticipoPct(Number(e.target.value))} />
                    </Campo>
                    <Campo label="Cargo por cancelación tardía (%)">
                      <input type="number" min={0} max={100} className={inputCls} value={penTardia}
                        onChange={(e) => setPenTardia(Number(e.target.value))} />
                    </Campo>
                    <Campo label="Cargo por no presentarse (%)">
                      <input type="number" min={0} max={100} className={inputCls} value={penNoShow}
                        onChange={(e) => setPenNoShow(Number(e.target.value))} />
                    </Campo>
                  </div>
                </>
              )}

              {tipo === "privacidad" && (
                <>
                  <Campo label="Responsable (nombre o razón social)">
                    <input className={inputCls} value={responsable}
                      onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre del dueño o empresa" />
                  </Campo>
                  <Campo label="Domicilio">
                    <input className={inputCls} value={domicilio}
                      onChange={(e) => setDomicilio(e.target.value)} placeholder="Calle, número, ciudad, estado" />
                  </Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Correo de contacto">
                      <input className={inputCls} value={correo}
                        onChange={(e) => setCorreo(e.target.value)} placeholder="contacto@tuhotel.com" />
                    </Campo>
                    <Campo label="Teléfono (opcional)">
                      <input className={inputCls} value={telefono}
                        onChange={(e) => setTelefono(e.target.value)} placeholder="489 123 4567" />
                    </Campo>
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-kora-text mb-1.5">
                      ¿Para qué usarás los datos?
                    </span>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 text-sm text-kora-muted">
                        <input type="checkbox" checked disabled className="w-5 h-5 accent-kora-accent opacity-60" />
                        Gestionar la reservación (siempre)
                      </label>
                      <label className="flex items-center gap-3 text-sm text-kora-text cursor-pointer">
                        <input type="checkbox" checked={finFactura} onChange={(e) => setFinFactura(e.target.checked)} className="w-5 h-5 accent-kora-accent" />
                        Emitir facturas (CFDI)
                      </label>
                      <label className="flex items-center gap-3 text-sm text-kora-text cursor-pointer">
                        <input type="checkbox" checked={finPromos} onChange={(e) => setFinPromos(e.target.checked)} className="w-5 h-5 accent-kora-accent" />
                        Enviar promociones
                      </label>
                      <label className="flex items-center gap-3 text-sm text-kora-text cursor-pointer">
                        <input type="checkbox" checked={finMejora} onChange={(e) => setFinMejora(e.target.checked)} className="w-5 h-5 accent-kora-accent" />
                        Mejorar el servicio
                      </label>
                    </div>
                  </div>
                </>
              )}

              {tipo === "reglamento" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Check-in"><input type="time" className={inputCls} value={checkin} onChange={(e) => setCheckin(e.target.value)} /></Campo>
                    <Campo label="Check-out"><input type="time" className={inputCls} value={checkout} onChange={(e) => setCheckout(e.target.value)} /></Campo>
                    <Campo label="Silencio desde"><input type="time" className={inputCls} value={silDesde} onChange={(e) => setSilDesde(e.target.value)} /></Campo>
                    <Campo label="Silencio hasta"><input type="time" className={inputCls} value={silHasta} onChange={(e) => setSilHasta(e.target.value)} /></Campo>
                  </div>
                  <Campo label="Edad mínima para registrarse (opcional)">
                    <input className={inputCls} value={edad} onChange={(e) => setEdad(e.target.value)} placeholder="18" />
                  </Campo>
                  <Campo label="Horario de alberca / áreas comunes (opcional)">
                    <input className={inputCls} value={alberca} onChange={(e) => setAlberca(e.target.value)} placeholder="8:00 a 20:00 hrs" />
                  </Campo>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={mascotas} onChange={(e) => setMascotas(e.target.checked)} className="w-5 h-5 accent-kora-accent" />
                    <span className="text-sm text-kora-text">Se admiten mascotas</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={fumar} onChange={(e) => setFumar(e.target.checked)} className="w-5 h-5 accent-kora-accent" />
                    <span className="text-sm text-kora-text">Se permite fumar (en áreas designadas)</span>
                  </label>
                  <Campo label="Reglas adicionales (una por línea, opcional)">
                    <textarea className={inputCls} rows={3} value={adicionales}
                      onChange={(e) => setAdicionales(e.target.value)}
                      placeholder={"No se permiten fiestas\nProhibido el ingreso de alimentos a la alberca"} />
                  </Campo>
                </>
              )}
            </div>

            <p className="mt-5 text-xs text-kora-muted leading-relaxed">
              ⚠️ Plantilla orientativa. No sustituye asesoría legal; para temas
              fiscales o legales formales, revísala con un profesional.
            </p>
          </div>
        </Reveal>

        {/* Vista previa formateada */}
        <Reveal delay={0.1}>
          <div>
            <div className="doc-print bg-white rounded-2xl border border-gray-200 shadow-sm p-7 sm:p-9">
              <h3 className="text-xl font-extrabold text-kora-primary tracking-tight border-b-2 border-kora-primary pb-3">
                {doc.titulo}
              </h3>
              {doc.intro && (
                <p className="mt-4 text-sm text-kora-text/80 leading-relaxed">
                  {doc.intro}
                </p>
              )}
              {doc.secciones.map((s) => (
                <div key={s.h} className="mt-5">
                  <p className="text-sm font-bold text-kora-text uppercase tracking-wide">
                    {s.h}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {s.items.map((it, i) => (
                      <li key={i} className="flex gap-2 text-sm text-kora-text/80 leading-relaxed">
                        <span className="text-kora-accent mt-0.5">•</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {doc.cierre && (
                <p className="mt-5 text-sm font-medium text-kora-text leading-relaxed">
                  {doc.cierre}
                </p>
              )}
              <p className="mt-6 text-xs text-kora-muted">
                Última actualización: {HOY}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 justify-center no-print">
              <button
                type="button"
                onClick={copiar}
                className="btn-press inline-flex items-center gap-2 px-5 py-3 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
              >
                {copiado ? <Check size={16} /> : <Copy size={16} />}
                {copiado ? "¡Copiado!" : "Copiar texto"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-press btn-fill inline-flex items-center gap-2 px-5 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                <Printer size={16} aria-hidden="true" />
                Imprimir / PDF
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      {/* CAPA 2 */}
      <Reveal>
        <div className="mt-10 no-print">
          <LeadCaptureTool
            herramienta="Generador de documentos legales"
            title="Recibe el paquete de documentos para tu hotel"
            subtitle="Te mandamos por WhatsApp las tres plantillas listas (cancelación, privacidad y reglamento) y cómo ponerlas en tu página."
            buttonText="Enviarme las plantillas"
            hiddenFields={{ hotel: hotel || "—", documento: tipo }}
          />
        </div>
      </Reveal>

      {/* CAPA 3 */}
      <Reveal>
        <div className="mt-10 rounded-2xl bg-kora-primary p-7 sm:p-9 text-center no-print">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kora-accent/15 mb-4">
            <Sparkles size={14} className="text-kora-accent" aria-hidden="true" />
            <span className="text-xs font-bold text-kora-accent uppercase tracking-widest">
              Tu hotel, más profesional
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Una página propia que ya incluye todo esto
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Con Kora tienes tu propia página de reservas directas con tu política
            de cancelación, tu aviso de privacidad y tu reglamento ya integrados —
            todo en orden y con cara profesional.
          </p>
          <a
            href="/#contacto?utm_source=documentos"
            className="btn-press btn-arrow btn-fill mt-6 inline-flex items-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Ver cómo funciona Kora
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </Reveal>
    </div>
  );
}
