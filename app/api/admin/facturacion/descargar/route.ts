import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getCfdiFile, facturamaConfigured, FacturamaError } from '@/lib/admin/facturama';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Aislamiento multi-tenant: solo miembros del hotel activo descargan.
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  // Degradación elegante: sin PAC configurado no truena.
  if (!facturamaConfigured()) {
    return NextResponse.json({ error: 'Facturación no configurada aún.' }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get('id') || '';
  const formato = (req.nextUrl.searchParams.get('formato') || 'pdf').toLowerCase();

  if (!id) return NextResponse.json({ error: 'Falta el id del CFDI.' }, { status: 400 });
  if (formato !== 'pdf' && formato !== 'xml') {
    return NextResponse.json({ error: 'Formato inválido (usa pdf o xml).' }, { status: 400 });
  }

  try {
    const file = await getCfdiFile(id, formato);
    const buffer = Buffer.from(file.content, 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof FacturamaError) {
      console.error('[facturacion/descargar] Facturama error', e.status, JSON.stringify(e.detail));
      return NextResponse.json({ error: 'No se pudo descargar el CFDI.', status: e.status }, { status: 502 });
    }
    console.error('[facturacion/descargar] Error', e);
    return NextResponse.json({ error: 'Error inesperado.' }, { status: 500 });
  }
}
