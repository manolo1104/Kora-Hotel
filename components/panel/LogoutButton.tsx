"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function salir() {
    setLoading(true);
    try {
      await createClient().auth.signOut();
      router.push("/entrar");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={salir}
      disabled={loading}
      className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-full border border-panel-border text-kora-text text-sm font-semibold hover:border-kora-accent transition-colors disabled:opacity-60"
    >
      <LogOut size={15} aria-hidden="true" />
      Cerrar sesión
    </button>
  );
}
