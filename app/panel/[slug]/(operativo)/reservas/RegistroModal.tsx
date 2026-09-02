'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, QrCode } from 'lucide-react';
import { QrCompartir } from '@/components/panel/QrCompartir';

// La ventana de "Registro de llegada" de una reserva: enseña el QR para que el
// huésped se registre desde su celular en el mostrador, y —si ya lo llenó— la
// ficha que recepción coteja contra su identificación.
//
// Es lo que el hotelero pidió: "para los huéspedes que no lo hagan previamente,
// estaría muy bien que en recepción pudiéramos proporcionarles un código QR para
// que realicen el check-in desde su celular".

interface Acompanante { nombre: string; edad?: number }
interface Registro {
  nombreCompleto: string; telefono?: string; email?: string;
  domicilio?: string; ciudadOrigen?: string; pais?: string;
  documentoTipo?: string; documentoRef?: string;
  acompanantes?: Acompanante[]; horaEstimada?: string; placas?: string;
  firma?: string; aceptaReglamento: boolean; origen: string; creadoEn: string;
}

export default function RegistroModal({
  slug, folio, bookingId, cliente, onClose,
}: {
  slug: string; folio: string; bookingId: string; cliente: string; onClose: () => void;
}) {
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/pre-checkin?folio=${encodeURIComponent(folio)}`);
        const d = await res.json().catch(() => ({}));
        if (vivo) setRegistro(d.registro ?? null);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [folio]);

  // Canónico kora-hotel.com y no `location.origin`: el QR se imprime o se
  // escanea desde otro dispositivo, donde un `localhost` no lleva a ningún sitio.
  const url = `https://kora-hotel.com/h/${slug}/pre-checkin?r=${bookingId}&qr=1`;

  const dato = (etiqueta: string, valor?: string) =>
    valor ? (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
        <span style={{ color: 'var(--clay)', fontSize: 12 }}>{etiqueta}</span>
        <span style={{ color: 'var(--ink)', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{valor}</span>
      </div>
    ) : null;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex',
               alignItems:'center', justifyContent:'center', zIndex:60, padding:16 }}
    >
      <div style={{ background:'var(--cream)', borderRadius:14, width:'100%', maxWidth:420,
                    maxHeight:'90vh', overflowY:'auto', padding:20, border:'1px solid var(--line)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <strong style={{ color:'var(--ink)', fontSize:15 }}>Registro de llegada</strong>
          <button onClick={onClose} aria-label="Cerrar"
            style={{ background:'none', border:0, color:'var(--clay)', cursor:'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ color:'var(--clay)', fontSize:12, marginBottom:14 }}>
          {cliente} · {folio}
        </p>

        {cargando ? (
          <p style={{ color:'var(--clay)', fontSize:13, textAlign:'center', padding:'24px 0' }}>
            <Loader2 size={16} style={{ verticalAlign:'-3px' }} /> Cargando…
          </p>
        ) : registro ? (
          <>
            <div style={{ background:'var(--chip-ok-bg)', color:'var(--chip-ok-text)',
                          borderRadius:10, padding:'8px 12px', fontSize:12, fontWeight:600, marginBottom:12 }}>
              Ya se registró · {new Date(registro.creadoEn).toLocaleString('es-MX', { timeZone:'America/Mexico_City' })}
            </div>
            {dato('Nombre', registro.nombreCompleto)}
            {dato('Teléfono', registro.telefono)}
            {dato('Correo', registro.email)}
            {dato('Domicilio', registro.domicilio)}
            {dato('Procedencia', [registro.ciudadOrigen, registro.pais].filter(Boolean).join(', '))}
            {dato('Identificación', [registro.documentoTipo, registro.documentoRef && `····${registro.documentoRef}`].filter(Boolean).join(' '))}
            {dato('Llega a las', registro.horaEstimada)}
            {dato('Placas', registro.placas)}
            {dato('Acompañantes', registro.acompanantes?.map(a => a.nombre).filter(Boolean).join(', '))}
            {dato('Reglamento', registro.aceptaReglamento ? 'Aceptado' : 'No aceptado')}
            {registro.firma && (
              <div style={{ marginTop:12 }}>
                <span style={{ color:'var(--clay)', fontSize:12 }}>Firma</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={registro.firma} alt="Firma del huésped"
                  style={{ display:'block', width:'100%', background:'#fff', borderRadius:8,
                           border:'1px solid var(--line)', marginTop:4 }} />
              </div>
            )}
          </>
        ) : (
          <>
            <p style={{ color:'var(--clay)', fontSize:13, marginBottom:14 }}>
              Aún no se registra. Enséñale este código para que lo llene desde su celular.
            </p>
            <QrCompartir valor={url} titulo="Registro del huésped" archivo={`qr-registro-${folio}.png`} />
            <p style={{ color:'var(--clay)', fontSize:11, marginTop:14, wordBreak:'break-all' }}>
              <QrCode size={11} style={{ verticalAlign:'-1px' }} /> {url}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
