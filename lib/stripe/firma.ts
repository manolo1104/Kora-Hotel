// Verificación de la firma del webhook de RESERVAS. SOLO servidor.
//
// Vive aparte del route handler por una razón concreta: es la puerta por la que
// entra TODO el dinero de los huéspedes, y para probarla desde `npm test` no
// puede arrastrar `next/server` ni el handler entero. Extraerla es lo que hace
// posible `tests/firma-webhook.test.ts`.
import type Stripe from "stripe";
import { createHash } from "node:crypto";
import { getStripe } from "@/lib/stripe/server";

/** Los secretos configurados hoy. Se lee en cada llamada (los tests los cambian). */
export function secretosDeReservas(): string[] {
  return [
    process.env.STRIPE_WEBHOOK_SECRET_RESERVAS,
    process.env.STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT,
  ].filter(Boolean) as string[];
}

/**
 * Devuelve el evento si la firma valida con ALGUNO de los dos secretos, o null.
 *
 * Son dos porque con direct charges este endpoint se registra dos veces en
 * Stripe: como endpoint de cuenta propia y como endpoint de "connected
 * accounts", y cada registro trae su propio secreto.
 *
 * `null` NO significa "no configurado": significa que la firma no valida. Quien
 * llame debe responder 400 y avisar — un secreto mal puesto en Vercel deja a
 * huéspedes pagando sin recibir reserva.
 */
export function verificarFirma(raw: string, sig: string): Stripe.Event | null {
  const stripe = getStripe();
  for (const secret of secretosDeReservas()) {
    try {
      return stripe.webhooks.constructEvent(raw, sig, secret);
    } catch {
      // probar el siguiente secreto
    }
  }
  return null;
}

/**
 * ¿La petición trae una cabecera con la FORMA de una firma de Stripe?
 *
 * Existe para separar dos casos que antes se contaban igual y no lo son: un
 * secreto mal puesto en Vercel (urgente: hay huéspedes pagando sin recibir
 * reserva) y un robot de internet mandando un POST a la URL del webhook
 * (irrelevante). Sin esta comprobación, lo segundo llenaba la bandeja de Manolo
 * de alertas idénticas a las primeras y las volvía imposibles de creer.
 */
export function pareceDeStripe(sig: string | null): boolean {
  if (!sig) return false;
  return /(^|,)\s*t=\d+/.test(sig) && /(^|,)\s*v1=[0-9a-f]{64}/.test(sig);
}

/**
 * Huella corta de un secreto. NO es el secreto y no se puede volver atrás.
 *
 * `node:crypto` y no `crypto.subtle` a propósito: el global `crypto` depende de
 * la versión de Node del servidor y aquí no hay `engines.node` que la fije. Esta
 * ruta es el camino del dinero; no es sitio para depender de eso.
 */
function huella(secreto: string): string {
  return createHash("sha256").update(secreto).digest("hex").slice(0, 8);
}

/**
 * Por qué falló la firma, en texto para el correo de alerta.
 *
 * El correo anterior decía "revisar los dos secretos en Vercel" y nada más, así
 * que no se podía saber si el evento venía de Stripe ni cuál de los dos
 * secretos tenía que cambiar sin abrir el panel de Stripe. Esto lee el cuerpo
 * SIN VERIFICARLO (va marcado como tal: es texto que manda quien llama) sólo
 * para nombrar el evento, y compara la marca de tiempo de la cabecera con la
 * hora del servidor, que es lo que delata un reintento viejo o un reloj corrido.
 *
 * NUNCA incluye un secreto: sólo su huella, para poder comparar entre despliegues.
 */
export function diagnosticoFirma(raw: string, sig: string | null): string {
  const lineas: string[] = [];

  const t = /(^|,)\s*t=(\d+)/.exec(sig ?? "")?.[2];
  if (t) {
    const edad = Math.round(Date.now() / 1000) - Number(t);
    lineas.push(`Firmado hace ${edad} s (Stripe rechaza por su cuenta a partir de 300 s).`);
  } else {
    lineas.push("La cabecera stripe-signature NO trae marca de tiempo (t=).");
  }
  lineas.push(`Firmas v1 en la cabecera: ${(sig ?? "").match(/v1=/g)?.length ?? 0}`);
  lineas.push(`Tamaño del cuerpo: ${raw.length} bytes`);

  // Lo que el cuerpo DICE ser. Sin verificar: sirve para orientar, no para actuar.
  lineas.push("", "Lo que dice el cuerpo (SIN VERIFICAR, puede ser mentira):");
  try {
    const b = JSON.parse(raw) as {
      id?: unknown; type?: unknown; account?: unknown; livemode?: unknown; api_version?: unknown;
    };
    lineas.push(`  evento: ${String(b.id ?? "—")} · tipo: ${String(b.type ?? "—")}`);
    lineas.push(`  cuenta conectada: ${b.account ? String(b.account) : "ninguna (cuenta propia)"}`);
    lineas.push(`  livemode: ${String(b.livemode ?? "—")}`);
    lineas.push(`  api_version: ${String(b.api_version ?? "—")}`);
    // Las dos causas que este bloque existe para distinguir.
    if (b.livemode === false) {
      lineas.push(
        "  ⚠️ livemode:false — es un evento de MODO PRUEBA llegando al endpoint de " +
          "producción. El secreto que hay en Vercel es el del endpoint LIVE, así que " +
          "nunca va a validar. No se perdió ninguna reserva real.",
      );
    } else if (b.account) {
      lineas.push(
        "  ⚠️ Viene de una CUENTA CONECTADA: el secreto que tiene que cuadrar es " +
          "STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT.",
      );
    } else if (b.id) {
      lineas.push(
        "  ⚠️ Viene de la cuenta propia: el secreto que tiene que cuadrar es " +
          "STRIPE_WEBHOOK_SECRET_RESERVAS.",
      );
    }
  } catch {
    lineas.push("  El cuerpo no es JSON. Casi seguro NO viene de Stripe.");
  }

  const secretos = secretosDeReservas();
  lineas.push("", `Secretos configurados en Vercel: ${secretos.length} de 2`);
  const nombres = ["STRIPE_WEBHOOK_SECRET_RESERVAS", "STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT"];
  const puestos = [
    process.env.STRIPE_WEBHOOK_SECRET_RESERVAS,
    process.env.STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT,
  ];
  for (let i = 0; i < nombres.length; i++) {
    const v = puestos[i];
    lineas.push(`  ${nombres[i]}: ${v ? `puesto (huella ${huella(v)})` : "NO PUESTO"}`);
  }

  lineas.push(
    "",
    "Dónde mirar: Stripe → Developers → Webhooks → el endpoint que apunta a " +
      "/api/h/webhooks/stripe → pestaña de entregas. Si ahí hay entregas en rojo, " +
      "es real y hay huéspedes pagando sin recibir reserva.",
  );
  return lineas.join("\n");
}
