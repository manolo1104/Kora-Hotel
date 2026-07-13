'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Calendar, BookOpen, FileText, TrendingUp, Users, BarChart2, LogOut, Menu, X, LayoutDashboard, Receipt, ClipboardCheck, Globe2, CreditCard, Pencil, CalendarCheck, Building2, Bot } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './AdminSidebar.module.css';

const NAV = [
  { seg: 'insights',     label: 'Inicio',         icon: LayoutDashboard },
  { seg: 'camila',       label: 'Camila (bot)',   icon: Bot },
  { seg: 'calendario',   label: 'Calendario',     icon: Calendar },
  { seg: 'reservas',     label: 'Reservas',       icon: BookOpen },
  { seg: 'cotizaciones', label: 'Cotizaciones',   icon: FileText },
  { seg: 'ingresos',     label: 'Ingresos',       icon: TrendingUp },
  { seg: 'pagos',        label: 'Pagos',          icon: CreditCard },
  { seg: 'clientes',     label: 'Clientes',       icon: Users },
  { seg: 'operaciones',  label: 'Operaciones',    icon: ClipboardCheck },
  { seg: 'redes',        label: 'Redes Sociales', icon: BarChart2 },
  { seg: 'facturacion',  label: 'Facturación',    icon: Receipt },
  { seg: 'canales',      label: 'Canales OTA',    icon: Globe2 },
];

export default function AdminSidebar({ slug, hotelName }: { slug: string; hotelName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [botEnabled, setBotEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/admin/bot-status')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('no-auth'))))
      .then(d => setBotEnabled(Boolean(d.enabled)))
      .catch(() => setBotEnabled(true));
  }, []);

  async function handleLogout() {
    try { await createClient().auth.signOut(); } catch { /* noop */ }
    router.push('/entrar');
  }

  const base = `/panel/${slug}`;

  return (
    <>
      <button className={styles.mobileToggle} onClick={() => setOpen(o => !o)} aria-label="Menú">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && <div className={styles.overlay} onClick={() => setOpen(false)} />}

      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.brand}>
          <p className={styles.brandEye}>Panel</p>
          <p className={styles.brandName}>{hotelName}</p>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ seg, label, icon: Icon }) => {
            const href = `${base}/${seg}`;
            return (
              <a
                key={seg}
                href={href}
                className={`${styles.navItem} ${pathname === href ? styles.active : ''}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} strokeWidth={1.5} />
                <span>{label}</span>
              </a>
            );
          })}

          {/* La cara pública del hotel: editar el sitio y ver el motor en vivo */}
          <p className={styles.navGroupLabel}>Mi sitio</p>
          <a
            href={`${base}/sitio`}
            className={`${styles.navItem} ${pathname === `${base}/sitio` ? styles.active : ''}`}
            onClick={() => setOpen(false)}
          >
            <Pencil size={18} strokeWidth={1.5} />
            <span>Editar mi sitio</span>
          </a>
          <a
            href={`/h/${slug}/reservar`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.navItem}
            onClick={() => setOpen(false)}
          >
            <CalendarCheck size={18} strokeWidth={1.5} />
            <span>Ver mi motor</span>
          </a>
          <a href="/panel" className={styles.navItem} onClick={() => setOpen(false)}>
            <Building2 size={18} strokeWidth={1.5} />
            <span>Mis hoteles</span>
          </a>
        </nav>

        {/* Estado del bot + acceso a su página (el on/off real vive en /camila,
            para no tener dos toggles que se desincronizan). */}
        <a
          href={`${base}/camila`}
          className={styles.botToggle}
          onClick={() => setOpen(false)}
          title="Activar, pausar y entrenar a Camila"
        >
          <div className={styles.botToggleInfo}>
            <span className={styles.botToggleLabel}>Camila (bot)</span>
            <span className={`${styles.botToggleDot} ${botEnabled ? styles.botOn : styles.botOff}`} />
            <span className={styles.botToggleStatus}>
              {botEnabled === null ? '...' : botEnabled ? 'Activo' : 'Pausado'}
            </span>
          </div>
          <span className={`${styles.botToggleBtn} ${botEnabled ? styles.botToggleBtnOn : styles.botToggleBtnOff}`}>
            Configurar
          </span>
        </a>

        <button className={styles.logout} onClick={handleLogout}>
          <LogOut size={16} strokeWidth={1.5} />
          <span>Cerrar sesión</span>
        </button>
      </aside>
    </>
  );
}
