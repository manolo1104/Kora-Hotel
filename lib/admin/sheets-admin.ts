// SHIM de compatibilidad: el panel operativo se portó de Paraíso, donde los datos
// vivían en Google Sheets (lib/admin/sheets-admin). En Kora los datos están en
// Supabase (lib/db/admin). Este archivo re-exporta lib/db/admin para que los
// componentes copiados sigan importando "@/lib/admin/sheets-admin" (tipos como
// AdminBooking/AdminQuote/GuestProfile) sin cambios. Las funciones reales viven
// en lib/db/admin y reciben hotelId como primer parámetro.
export * from "@/lib/db/admin";
