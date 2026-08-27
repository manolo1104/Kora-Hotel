// La baja. SOLO servidor.
//
// Vive aparte de lib/suscriptores.ts (que es puro) porque toca la base de datos,
// y la comparten las dos puertas por las que se puede dar de baja alguien: la
// página /baja (el link del pie) y /api/baja (el botón que pintan Gmail y
// Outlook, RFC 8058).
//
// REGLA APRENDIDA A GOLPES: una baja que apaga UNA SOLA tabla es mentira.
// Si alguien pide no recibir más correos y sólo se apaga la lista de marketing,
// la secuencia de leads del CRM le sigue escribiendo desde otra tabla — y desde
// su bandeja eso no se distingue de haber ignorado su petición. Se apagan las
// dos, buscando por correo.

// (sin el paquete `server-only`: el repo no lo usa. Lo que blinda esto es que
// createAdminClient sólo existe en servidor y usa la llave de service-role.)
import { escribirMejorEsfuerzo } from "@/lib/db/result";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

export type ResultadoBaja =
  | { ok: true; email: string; yaEstaba: boolean }
  | { ok: false; motivo: "sin-bd" | "token-invalido" | "error" };

/**
 * Da de baja por token. Idempotente: darse de baja dos veces no es un error.
 *
 * @param motivo "link" (dio clic en el pie) | "reporte" (botón de Gmail).
 */
export async function darDeBaja(token: string, motivo: string): Promise<ResultadoBaja> {
  if (!adminEnvReady) return { ok: false, motivo: "sin-bd" };
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, motivo: "token-invalido" };

  const admin = createAdminClient();

  const { data: fila, error } = await admin
    .from("suscriptores")
    .select("id, email, baja_at")
    .eq("token_baja", token)
    .maybeSingle();

  if (error) {
    console.error("[baja] error buscando el token:", error.message);
    return { ok: false, motivo: "error" };
  }
  if (!fila) return { ok: false, motivo: "token-invalido" };

  const sus = fila as { id: string; email: string; baja_at: string | null };
  const yaEstaba = Boolean(sus.baja_at);

  if (!yaEstaba) {
    const { error: errBaja } = await admin
      .from("suscriptores")
      .update({ baja_at: new Date().toISOString(), baja_motivo: motivo })
      .eq("id", sus.id);

    if (errBaja) {
      console.error("[baja] no se pudo dar de baja:", errBaja.message);
      return { ok: false, motivo: "error" };
    }
  }

  // La otra mitad de la baja: apagar también la secuencia de leads del CRM si
  // este correo también está ahí. Mejor esfuerzo declarado — la baja de la
  // lista ya quedó guardada y fallar aquí no debe devolverle un error a alguien
  // que sólo quería dejar de recibir correos.
  await escribirMejorEsfuerzo(
    "crm_leads.pausarPorBaja",
    admin.from("crm_leads").update({ secuencia_pausada: true }).eq("email", sus.email),
  );

  return { ok: true, email: sus.email, yaEstaba };
}
