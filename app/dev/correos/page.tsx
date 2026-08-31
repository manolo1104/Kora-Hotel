// Vista previa de TODOS los correos y documentos de Kora, en localhost, sin
// enviar nada. Paso 7.2 de la auditoría.
//
// El problema que resuelve: `RESEND_API_KEY` está comentada en local a
// propósito, así que la única forma de ver un correo era desplegarlo y
// provocarlo de verdad. Con eso, revisar lo que los correos DICEN (que es la
// mitad de la etapa 7) era imposible sin tocar producción.
//
// Sin JavaScript de cliente: la navegación va por query params y enlaces, así
// el catálogo —que arrastra módulos de servidor— nunca cruza al navegador.
//
// SOLO EN DESARROLLO: en producción devuelve 404.

import { notFound } from "next/navigation";
import Link from "next/link";
import { GRUPOS, ENTRADAS, buscarEntrada, type Lang } from "@/lib/email/preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Correos de Kora — vista previa", robots: { index: false, follow: false } };

// Los correos viven en 600-680px; los documentos son hojas A4 y se cortan ahí,
// por eso hay un ancho completo.
const ANCHOS = { escritorio: 680, movil: 375, completo: 0 } as const;
type Ancho = keyof typeof ANCHOS;
const ETIQUETA_ANCHO: Record<Ancho, string> = {
  escritorio: "Escritorio 680px",
  movil: "Móvil 375px",
  completo: "Completo",
};

export default async function CorreosPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; lang?: string; ancho?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { id, lang: langParam, ancho: anchoParam } = await searchParams;
  const actual = buscarEntrada(id ?? "") ?? ENTRADAS[0];
  const lang: Lang = langParam === "en" ? "en" : "es";
  const ancho: Ancho = anchoParam === "movil" || anchoParam === "completo" ? anchoParam : "escritorio";

  // El asunto sólo lo traen las plantillas que lo definen; el resto lo arma su
  // llamador. Cuando falta hay que ir a leerlo al route de origen, y eso vale
  // decirlo en pantalla en vez de inventar uno.
  let asunto: string | undefined;
  let fallo: string | undefined;
  try {
    asunto = actual.render(lang).subject;
  } catch (e) {
    fallo = e instanceof Error ? e.message : String(e);
  }

  const url = (p: { id?: string; lang?: Lang; ancho?: Ancho }) =>
    `/dev/correos?id=${p.id ?? actual.id}&lang=${p.lang ?? lang}&ancho=${p.ancho ?? ancho}`;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f4f2", fontFamily: "system-ui, sans-serif" }}>
      {/* ── Índice ── */}
      <nav style={{ width: 300, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e2dd", overflowY: "auto", maxHeight: "100vh" }}>
        <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid #e5e2dd" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>Correos de Kora</div>
          <div style={{ fontSize: 12, color: "#8a8378", marginTop: 4 }}>
            {ENTRADAS.length} plantillas · vista previa local · no envía nada
          </div>
        </div>

        {GRUPOS.map((g) => (
          <div key={g.titulo} style={{ padding: "14px 0 6px" }}>
            <div style={{ padding: "0 18px", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8a8378" }}>
              {g.titulo}
            </div>
            <div style={{ padding: "4px 18px 8px", fontSize: 11.5, color: "#a09789", lineHeight: 1.45 }}>{g.nota}</div>
            {g.entradas.map((e) => {
              const activa = e.id === actual.id;
              return (
                <Link
                  key={e.id}
                  href={url({ id: e.id })}
                  style={{
                    display: "block",
                    padding: "7px 18px",
                    fontSize: 13,
                    lineHeight: 1.35,
                    textDecoration: "none",
                    color: activa ? "#fff" : "#3d3a35",
                    background: activa ? "#1B4332" : "transparent",
                  }}
                >
                  {e.nombre}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── El correo y su ficha ── */}
      <main style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "100vh" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{actual.nombre}</h1>

        <dl style={{ margin: "12px 0 0", display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 14px", fontSize: 13, color: "#3d3a35" }}>
          <dt style={{ color: "#8a8378" }}>Le llega a</dt>
          <dd style={{ margin: 0 }}>{actual.quien}</dd>
          <dt style={{ color: "#8a8378" }}>Sale cuando</dt>
          <dd style={{ margin: 0 }}>{actual.cuando}</dd>
          <dt style={{ color: "#8a8378" }}>Lo dispara</dt>
          <dd style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{actual.origen}</dd>
          <dt style={{ color: "#8a8378" }}>Asunto</dt>
          <dd style={{ margin: 0 }}>
            {asunto ?? <span style={{ color: "#a09789" }}>lo arma su llamador — leerlo en {actual.origen}</span>}
          </dd>
        </dl>

        {fallo && (
          <p style={{ marginTop: 14, padding: "10px 12px", background: "#fee2e2", color: "#b91c1c", fontSize: 13, borderRadius: 6 }}>
            La plantilla lanzó una excepción al construirse: {fallo}
          </p>
        )}

        {/* ── Controles ── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "18px 0 12px", flexWrap: "wrap" }}>
          {actual.bilingue ? (
            (["es", "en"] as Lang[]).map((l) => (
              <Link key={l} href={url({ lang: l })} style={boton(l === lang)}>
                {l === "es" ? "Español" : "English"}
              </Link>
            ))
          ) : (
            <span style={{ ...boton(false), color: "#a09789", borderStyle: "dashed" }}>sólo español</span>
          )}
          <span style={{ width: 10 }} />
          {(Object.keys(ANCHOS) as Ancho[]).map((a) => (
            <Link key={a} href={url({ ancho: a })} style={boton(a === ancho)}>
              {ETIQUETA_ANCHO[a]}
            </Link>
          ))}
          <span style={{ width: 10 }} />
          <a href={`/dev/correos/ver?id=${actual.id}&lang=${lang}`} target="_blank" rel="noreferrer" style={boton(false)}>
            Abrirlo suelto ↗
          </a>
        </div>

        {/* El iframe aísla los estilos del correo, igual que hace un cliente de correo. */}
        <iframe
          key={`${actual.id}-${lang}`}
          src={`/dev/correos/ver?id=${actual.id}&lang=${lang}`}
          title={actual.nombre}
          style={{
            width: ANCHOS[ancho] || "100%",
            maxWidth: "100%",
            height: "calc(100vh - 260px)",
            minHeight: 460,
            border: "1px solid #e5e2dd",
            borderRadius: 8,
            background: "#fff",
          }}
        />
      </main>
    </div>
  );
}

function boton(activo: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "5px 11px",
    fontSize: 12.5,
    borderRadius: 6,
    textDecoration: "none",
    border: `1px solid ${activo ? "#1B4332" : "#d9d4cc"}`,
    background: activo ? "#1B4332" : "#fff",
    color: activo ? "#fff" : "#3d3a35",
  };
}
