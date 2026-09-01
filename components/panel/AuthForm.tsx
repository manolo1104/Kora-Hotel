"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { supabaseEnvReady } from "@/lib/supabase/env";

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-panel-border text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200";

type Modo = "password" | "magico";

export function AuthForm({ next = "/panel" }: { next?: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("password");
  const [registro, setRegistro] = useState(false); // en modo password: entrar vs crear cuenta
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false); // enlace mágico / confirmación enviada

  if (!supabaseEnvReady) {
    return (
      <div className="bg-panel-surface rounded-2xl p-6 sm:p-8 border border-panel-border-soft shadow-sm text-center">
        <p className="text-kora-text font-semibold">Configuración pendiente</p>
        <p className="mt-2 text-sm text-kora-muted leading-relaxed">
          Las cuentas todavía no están activas. En cuanto se configure la base de
          datos, podrás crear tu mini-página aquí.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    // El callback conserva el destino (ej. /pago/iniciar?plan=hotel).
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    try {
      if (modo === "magico") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) setError(traducir(error.message));
        else setEnviado(true);
      } else if (registro) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) setError(traducir(error.message));
        else setEnviado(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) setError(traducir(error.message));
        else router.push(next);
      }
    } catch {
      setError("Ocurrió un problema. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <div className="bg-panel-surface rounded-2xl p-6 sm:p-8 border border-panel-border-soft shadow-sm text-center">
        <div className="w-14 h-14 rounded-full bg-kora-accent/15 flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-kora-primary" />
        </div>
        <h2 className="text-xl font-bold text-kora-text mb-2">Revisa tu correo</h2>
        <p className="text-sm text-kora-muted leading-relaxed">
          Te enviamos un enlace a <span className="font-semibold">{email}</span>.
          Ábrelo desde este dispositivo para entrar.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-panel-surface rounded-2xl p-6 sm:p-8 border border-panel-border-soft shadow-sm">
      {/* Selector de método */}
      <div className="flex gap-2 mb-6">
        {[
          { id: "password", label: "Con contraseña" },
          { id: "magico", label: "Enlace al correo" },
        ].map((o) => {
          const active = o.id === modo;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setModo(o.id as Modo);
                setError("");
              }}
              className={`btn-press flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                active
                  ? "bg-kora-primary text-white border-kora-primary"
                  : "bg-panel-surface text-kora-text border-panel-border hover:border-kora-accent"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-kora-text mb-1.5">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            className={inputCls}
          />
        </div>

        {modo === "password" && (
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-kora-text mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={inputCls}
            />
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-press btn-fill w-full py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Un momento…
            </>
          ) : modo === "magico" ? (
            <>
              <Mail size={16} aria-hidden="true" />
              Enviarme el enlace
            </>
          ) : registro ? (
            "Crear mi cuenta"
          ) : (
            "Entrar"
          )}
        </button>
      </form>

      {modo === "password" && (
        <p className="mt-5 text-sm text-kora-muted text-center">
          {registro ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setRegistro(!registro);
              setError("");
            }}
            className="font-semibold text-kora-primary underline hover:text-kora-primary-dark"
          >
            {registro ? "Entrar" : "Crear una"}
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * Traduce el error de Supabase a algo que un camarista pueda leer.
 *
 * Los TRES topes de "demasiados intentos" son cosas distintas y hasta hoy los
 * tres decían lo mismo: *"Demasiados intentos. Espera un momento."* Ese texto
 * es el que hizo que un hotelero se quedara fuera: pidió el enlace para él y
 * para su camarista, se topó con el aviso, entendió "espera un momento" y
 * siguió pulsando — cavando más hondo, porque el tope es de UNA HORA y es del
 * PROYECTO ENTERO, no de su correo.
 *
 * Lo que cambia aquí es sólo el texto. El tope de verdad vive en la
 * configuración de Supabase (Authentication → Emails → SMTP): mientras el
 * proyecto use el correo que trae Supabase de fábrica son 2 correos por hora
 * para TODOS los hoteles juntos.
 */
function traducir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("already registered")) return "Ese correo ya tiene cuenta. Inicia sesión.";

  // Tope de CORREOS del proyecto. Es el que deja fuera a todo el mundo a la vez.
  if (m.includes("email rate limit") || m.includes("over_email_send_rate_limit")) {
    return (
      "Kora ya mandó los enlaces de acceso que puede mandar esta hora. " +
      "No es tu correo ni tu cuenta: espera ~1 hora y vuelve a pedirlo, o entra " +
      "con tu contraseña si ya tienes una."
    );
  }

  // Ventana de 60 s por correo: "For security purposes, you can only request
  // this after 47 seconds."
  const segundos = msg.match(/after (\d+) seconds?/i)?.[1];
  if (segundos) {
    return `Acabas de pedir un enlace. Espera ${segundos} segundos y vuelve a intentarlo.`;
  }

  if (m.includes("rate limit")) {
    return "Demasiados intentos seguidos desde esta conexión. Espera unos minutos y vuelve a intentarlo.";
  }
  if (m.includes("password")) return "La contraseña debe tener al menos 6 caracteres.";
  return "No se pudo completar. Revisa tus datos e inténtalo de nuevo.";
}
