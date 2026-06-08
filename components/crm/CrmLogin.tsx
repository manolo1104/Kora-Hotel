"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { api } from "./util";

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all";

export function CrmLogin() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/crm/login", { method: "POST", body: JSON.stringify({ password }) });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  }

  return (
    <main className="pt-16">
      <section className="py-20 bg-kora-bg min-h-[70vh] flex items-center">
        <div className="max-w-sm mx-auto px-4 w-full">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-kora-primary flex items-center justify-center">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-kora-text tracking-tight">CRM de Kora</h1>
            <p className="mt-2 text-sm text-kora-muted">Acceso privado. Ingresa tu contraseña.</p>
          </div>
          <form
            onSubmit={onSubmit}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoFocus
              className={inputCls}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-kora-primary px-4 py-3 text-sm font-semibold text-white hover:bg-kora-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
