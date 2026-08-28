'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Calendar, BookOpen, FileText, TrendingUp, Users, LogOut, Menu, X, LayoutDashboard, ClipboardCheck, Globe2, CreditCard, Pencil, CalendarCheck, Building2, Bot, Sparkles, Moon, Sun, UserCog } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './AdminSidebar.module.css';
import { useTema } from '@/components/panel/TemaToggle';
import type { RolHotel } from '@/lib/tenant';
import { CANALES_OTA_DISPONIBLES } from '@/lib/panel/canales-ota';

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
  // Canales OTA retirado del panel: ver CANALES_OTA_DISPONIBLES en
  // lib/panel/canales-ota.ts. Los feeds ya pegados en una extranet siguen vivos
  // a propósito — cortarlos provoca sobreventa.
  ...(CANALES_OTA_DISPONIBLES ? [{ seg: 'canales', label: 'Canales OTA', icon: Globe2 }] : []),
];

export default function AdminSidebar({
  slug,
  hotelName,
  rol,
}: {
  slug: string;
  hotelName: string;
  /** Rol del usuario en ESTE hotel: decide qué enlaces se pintan. */
  rol?: RolHotel;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { oscuro, montado: temaMontado, alternar: alternarTema } = useTema();
  const [botEnabled, setBotEnabled] = useState<boolean | null>(null);
  // Conexión REAL de WhatsApp (runtime): 'ready' = vinculada. Antes el punto
  // decía "Activo" solo por el flag on/off aunque nunca se hubiera escaneado el QR.
  const [botConexion, setBotConexion] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/bot-status')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('no-auth'))))
      .then(d => {
        setBotEnabled(Boolean(d.enabled));
        setBotConexion(typeof d.conexion === 'string' ? d.conexion : 'sin-servicio');
      })
      .catch(() => setBotEnabled(true));
  }, []);

  // Estado visible del bot: pausada / conectada / sin conectar / preparando.
  const bot =
    botEnabled === null
      ? { dot: '', txt: '...' }
      : !botEnabled
        ? { dot: styles.botOff, txt: 'Pausada' }
        : botConexion === 'ready'
          ? { dot: styles.botOn, txt: 'Conectada' }
          : botConexion === 'sin-servicio' || botConexion === null
            ? { dot: styles.botWarn, txt: 'Preparando conexión' }
            : { dot: styles.botWarn, txt: 'Sin conectar WhatsApp' };

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
                data-tour={`nav-${seg}`}
                className={`${styles.navItem} ${pathname === href ? styles.active : ''}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} strokeWidth={1.5} />
                <span>{label}</span>
              </a>
            );
          })}

          {/* Sólo el dueño puede dar de alta gente (es tocar identidad), así
              que a los demás ni se les pinta el enlace: un enlace que lleva a
              un redirect es peor que no tenerlo. */}
          {rol === 'dueno' && (
            <a
              href={`${base}/equipo`}
              className={`${styles.navItem} ${pathname === `${base}/equipo` ? styles.active : ''}`}
              onClick={() => setOpen(false)}
            >
              <UserCog size={18} strokeWidth={1.5} />
              <span>Quién trabaja aquí</span>
            </a>
          )}

          {/* La cara pública del hotel: editar el sitio y ver el motor en vivo */}
          <p className={styles.navGroupLabel}>Mi sitio</p>
          <a
            href={`${base}/sitio`}
            data-tour="nav-sitio"
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
            data-tour="nav-motor"
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
          <a
            href="/panel/herramientas"
            className={`${styles.navItem} ${pathname === '/panel/herramientas' ? styles.active : ''}`}
            onClick={() => setOpen(false)}
          >
            <Sparkles size={18} strokeWidth={1.5} />
            <span>Herramientas IA</span>
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
            <span className={`${styles.botToggleDot} ${bot.dot}`} />
            <span className={styles.botToggleStatus}>{bot.txt}</span>
          </div>
          <span className={`${styles.botToggleBtn} ${botEnabled ? styles.botToggleBtnOn : styles.botToggleBtnOff}`}>
            Configurar
          </span>
        </a>

        <button
          className={styles.tema}
          onClick={alternarTema}
          aria-pressed={temaMontado ? oscuro : undefined}
          aria-label={
            temaMontado
              ? oscuro
                ? 'Cambiar a tema claro'
                : 'Cambiar a tema oscuro'
              : 'Cambiar el tema'
          }
        >
          {oscuro ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
          <span>{oscuro ? 'Tema claro' : 'Tema oscuro'}</span>
        </button>

        <button className={styles.logout} onClick={handleLogout}>
          <LogOut size={16} strokeWidth={1.5} />
          <span>Cerrar sesión</span>
        </button>
      </aside>
    </>
  );
}
