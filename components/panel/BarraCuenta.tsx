"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { supabaseEnvReady } from "@/lib/supabase/env";

// "Cerrar sesión", siempre a la vista.
//
// POR QUÉ EXISTE: el botón ya estaba — al FONDO de la barra lateral, que en
// celular vive detrás de la hamburguesa y hay que desplazar hasta abajo. La
// camarista del hotel de Nealtican lo dijo tal cual: *"entré en la sección de
// camarista pero ahora no encuentro la parte de cerrar sesión"*.
//
// La barra superior del panel tenía todo el lado derecho vacío, y se ve en
// TODAS las pantallas sin abrir ningún menú. Ahí va. El de la barra lateral se
// queda: en escritorio es donde la gente ya lo busca.
//
// El correo se enseña a propósito: en un hotel el celular se comparte, y saber
// "estoy dentro como camarista@…" es la mitad del problema que resuelve el
// botón. En pantallas chicas se corta con puntos suspensivos (CSS), no se
// esconde: es el dato que dice de quién es la sesión.
export function BarraCuenta() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    if (!supabaseEnvReady) return;
    let vivo = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (vivo) setEmail(data.user?.email ?? "");
      })
      .catch(() => {
        // Sin correo el botón sigue sirviendo: es lo único que no puede fallar.
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function salir() {
    if (saliendo) return;
    setSaliendo(true);
    try {
      await createClient().auth.signOut();
    } catch {
      /* Aunque falle el cierre remoto, se le saca de la pantalla. */
    }
    router.push("/entrar");
    router.refresh();
  }

  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3 min-w-0">
      {email && (
        <span
          data-cuenta-email
          className="block max-w-[30vw] sm:max-w-[220px] truncate text-xs text-gray-500"
          title={email}
        >
          {email}
        </span>
      )}
      <button
        type="button"
        data-cuenta-salir
        onClick={salir}
        disabled={saliendo}
        className="btn-press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-kora-primary hover:text-kora-primary disabled:opacity-60"
      >
        <LogOut size={14} aria-hidden="true" />
        <span>{saliendo ? "Saliendo…" : "Salir"}</span>
      </button>
    </div>
  );
}
