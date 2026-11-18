"use client";

// Cómo cierra la venta y qué pasa cuando necesita a una persona.
//
// Antes «Pasar con una persona» venía RELLENO con el WhatsApp del propio hotel
// (el mismo número donde contesta la asistente), así que parecía configurado y
// en realidad no servía para nada; y la asistente decía «ya le avisé al equipo»
// sin avisar a nadie. Ahora ese número recibe un WhatsApp de verdad.

import { BellRing, CreditCard, Landmark, Lock, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { Aviso, Campo, Tarjeta } from "@/components/panel/ui";
import type { Camila } from "../useCamila";
import { mismoTelefono, telefonoValido } from "../tipos";

export default function ComoVende({
  c,
  nombreBot,
  slug,
  whatsappHotel,
  cobrosListos,
}: {
  c: Camila;
  nombreBot: string;
  slug: string;
  whatsappHotel: string;
  /** De `cobrosListosDelHotel` (la cuenta de Stripe COBRA de verdad, no sólo existe). */
  cobrosListos: boolean;
}) {
  const { bot, cambiarBot, puedeConfigurar, errores, adminPhone } = c;
  const esElMismo = bot.escalarWhatsapp.trim() !== "" && mismoTelefono(bot.escalarWhatsapp, whatsappHotel);
  const aviso = esElMismo
    ? `Ese es el WhatsApp donde contesta ${nombreBot}: no se puede avisar a sí misma. Pon el celular de una persona.`
    : errores.escalarWhatsapp;
  const avisaAlDueno = !telefonoValido(bot.escalarWhatsapp) && telefonoValido(adminPhone);

  return (
    <div className="space-y-5">
      <Tarjeta
        icono={<BellRing size={18} />}
        titulo="Cuando necesite a una persona"
        descripcion={`Quejas de huéspedes hospedados, comprobantes de pago, grupos grandes o dudas que no sabe contestar.`}
      >
        <ol className="mb-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Te escribe", `${nombreBot} te manda un WhatsApp con el resumen del caso.`],
            ["Se hace a un lado", "Deja de contestar en ese chat para no hablar encima de ti."],
            ["Lo marcas tú", "El chat queda en Conversaciones como «Atender yo». Contestas y listo."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl bg-kora-bg p-3">
              <span className="text-xs font-bold text-kora-primary">Paso {i + 1}</span>
              <p className="mt-0.5 text-sm font-semibold text-kora-text">{t}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-kora-muted">{d}</p>
            </li>
          ))}
        </ol>
        <div className="max-w-md">
          <Campo
            label="¿A qué WhatsApp te aviso?"
            error={aviso}
            ayuda={
              avisaAlDueno
                ? "Si lo dejas vacío, aviso al número de control del dueño (en «WhatsApp y ajustes»)."
                : "El celular de quien atiende: tú, la encargada o recepción. Con lada, 10 dígitos."
            }
          >
            {(p) => (
              <input
                {...p}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={bot.escalarWhatsapp}
                onChange={(e) => cambiarBot({ escalarWhatsapp: e.target.value.slice(0, 20) })}
                placeholder="481 123 4567"
                className="input-kora"
              />
            )}
          </Campo>
        </div>
        {!telefonoValido(bot.escalarWhatsapp) && !telefonoValido(adminPhone) && (
          <div className="mt-4">
            <Aviso tono="alerta">
              Sin un número, {nombreBot} no puede avisarle a nadie: el chat sólo queda marcado en Conversaciones.
            </Aviso>
          </div>
        )}
      </Tarjeta>

      <Tarjeta
        icono={<CreditCard size={18} />}
        titulo="Cómo cobra"
        descripcion={`Cuando el huésped elige cuarto, ${nombreBot} le pide su nombre y correo y le manda un link para pagar el anticipo con tarjeta. El cuarto queda apartado mientras paga.`}
      >
        <div className="flex items-start justify-between gap-3 rounded-xl bg-kora-bg p-3">
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                cobrosListos ? "bg-[var(--chip-ok-bg)] text-[var(--chip-ok-text)]" : "bg-[var(--chip-aviso-bg)] text-[var(--chip-aviso-text)]"
              }`}
            >
              {cobrosListos ? <Check size={12} aria-hidden="true" /> : <AlertTriangle size={11} aria-hidden="true" />}
            </span>
            <div>
              <p className="text-sm font-semibold text-kora-text">
                {cobrosListos ? "Cobros con tarjeta activos" : "Cobros con tarjeta sin activar"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-kora-muted">
                {cobrosListos
                  ? "El dinero entra directo a tu cuenta."
                  : "Sin esto, no puede mandar link de pago: sólo puede ofrecer transferencia."}
              </p>
            </div>
          </div>
          {!cobrosListos && (
            <a href={`/panel/${slug}/pagos`} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-kora-primary hover:underline">
              Activar <ArrowRight size={12} aria-hidden="true" />
            </a>
          )}
        </div>
        <p className="mt-3 text-xs text-kora-muted">
          El anticipo, la cancelación gratis y los códigos de descuento se configuran en{" "}
          <a href={`/panel/${slug}/sitio?tab=avanzado`} className="font-semibold text-kora-primary hover:underline">
            Mi sitio → Reglas de reserva
          </a>
          . {nombreBot} los aplica y los explica tal cual.
        </p>
      </Tarjeta>

      <Tarjeta
        icono={<Landmark size={18} />}
        titulo="Pago por transferencia"
        descripcion={`Opcional. Si lo llenas, ${nombreBot} se los da a quien prefiera transferir, y cuando el huésped diga que ya pagó, te avisa para que tú lo confirmes.`}
      >
        {!puedeConfigurar ? (
          <Aviso tono="info" titulo="Sólo el dueño ve y cambia estos datos">
            <span className="inline-flex items-center gap-1">
              <Lock size={12} aria-hidden="true" /> Son los datos de la cuenta donde reciben el dinero.
            </span>
          </Aviso>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Titular de la cuenta" max={120} valor={bot.pago.titular}>
              {(p) => (
                <input
                  {...p}
                  value={bot.pago.titular}
                  onChange={(e) => cambiarBot({ pago: { titular: e.target.value.slice(0, 120) } })}
                  className="input-kora"
                />
              )}
            </Campo>
            <Campo label="Banco" max={80} valor={bot.pago.banco}>
              {(p) => (
                <input
                  {...p}
                  value={bot.pago.banco}
                  onChange={(e) => cambiarBot({ pago: { banco: e.target.value.slice(0, 80) } })}
                  className="input-kora"
                />
              )}
            </Campo>
            <Campo label="CLABE" ayuda="18 dígitos." error={errores.clabe}>
              {(p) => (
                <input
                  {...p}
                  inputMode="numeric"
                  value={bot.pago.clabe}
                  onChange={(e) => cambiarBot({ pago: { clabe: e.target.value.replace(/[^\d\s]/g, "").slice(0, 22) } })}
                  className="input-kora font-mono tracking-wide"
                />
              )}
            </Campo>
            <Campo label="Número de cuenta o tarjeta" opcional max={40} valor={bot.pago.cuenta}>
              {(p) => (
                <input
                  {...p}
                  value={bot.pago.cuenta}
                  onChange={(e) => cambiarBot({ pago: { cuenta: e.target.value.slice(0, 40) } })}
                  className="input-kora font-mono"
                />
              )}
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="Notas para el huésped" opcional max={600} valor={bot.pago.notas} ayuda="Ej.: Pon tu nombre como referencia.">
                {(p) => (
                  <textarea
                    {...p}
                    rows={2}
                    value={bot.pago.notas}
                    onChange={(e) => cambiarBot({ pago: { notas: e.target.value.slice(0, 600) } })}
                    className="input-kora"
                  />
                )}
              </Campo>
            </div>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
