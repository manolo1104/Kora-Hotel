/**
 * Integración con Facturama (PAC) para timbrado de CFDI 4.0.
 *
 * Credenciales (env):
 *   FACTURAMA_USER             usuario de la cuenta Facturama (Basic Auth)
 *   FACTURAMA_PASSWORD         contraseña
 *   FACTURAMA_API_URL          base URL. Default = sandbox.
 *   FACTURAMA_EXPEDITION_PLACE código postal del lugar de expedición (emisor)
 *   FACTURAMA_SERIE            serie de los folios (default "HOSP")
 *
 * En sandbox el emisor es la cuenta de pruebas de Facturama (no se sube el CSD
 * real del hotel). Al pasar a producción solo se cambian estas variables.
 */

const API_URL = (process.env.FACTURAMA_API_URL || 'https://apisandbox.facturama.mx').replace(/\/$/, '');
const USER = process.env.FACTURAMA_USER || '';
const PASS = process.env.FACTURAMA_PASSWORD || '';
const EXPEDITION_PLACE = process.env.FACTURAMA_EXPEDITION_PLACE || '78000';
// La serie es OPCIONAL en el CFDI. Solo se incluye si está configurada y
// existe como serie registrada en la sucursal del PAC; si está vacía, se omite.
const SERIE = process.env.FACTURAMA_SERIE || '';

const IVA_RATE = 0.16;

// Claves del catálogo del SAT para hospedaje.
const SAT_PRODUCT_HOSPEDAJE = '90111800'; // Hoteles, moteles, pensiones y casas de huéspedes
const SAT_UNIT_SERVICIO = 'E48';          // Unidad de servicio

export function facturamaConfigured(): boolean {
  return Boolean(USER && PASS);
}

export function facturamaIsSandbox(): boolean {
  return API_URL.includes('sandbox');
}

export class FacturamaError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(`Facturama respondió ${status}`);
    this.name = 'FacturamaError';
    this.status = status;
    this.detail = detail;
  }
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
}

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface CfdiReceiver {
  Rfc: string;
  Name: string;
  CfdiUse: string;        // p.ej. "G03" gastos en general, "S01" sin efectos fiscales
  FiscalRegime: string;   // régimen fiscal del receptor (CFDI 4.0)
  TaxZipCode: string;     // código postal del domicilio fiscal del receptor
}

export interface CfdiResult {
  id: string;
  uuid: string;
  folio: string;
  serie: string;
  total: number;
  fecha: string;
  raw: any;
}

// Receptor "público en general" cuando el huésped no da RFC.
export const RECEPTOR_PUBLICO: CfdiReceiver = {
  Rfc: 'XAXX010101000',
  Name: 'PUBLICO EN GENERAL',
  CfdiUse: 'S01',         // Sin efectos fiscales
  FiscalRegime: '616',    // Sin obligaciones fiscales
  TaxZipCode: EXPEDITION_PLACE,
};

/** Redondea a 2 decimales de forma estable. */
function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Construye el cuerpo del CFDI a partir de una reserva.
 * El `total` de la reserva se trata como monto CON IVA incluido
 * (subtotal = total / 1.16).
 */
export function buildCfdiPayload(opts: {
  total: number;
  descripcion: string;
  receiver: CfdiReceiver;
  paymentForm?: string;   // catálogo SAT: 01 efectivo, 03 transferencia, 04 tarjeta crédito, 28 débito...
  paymentMethod?: string; // PUE (una exhibición) | PPD (parcialidades)
}): any {
  const total = money(opts.total);
  const subtotal = money(total / (1 + IVA_RATE));
  const iva = money(total - subtotal);

  return {
    ...(SERIE ? { Serie: SERIE } : {}),
    Currency: 'MXN',
    ExpeditionPlace: EXPEDITION_PLACE,
    CfdiType: 'I', // Ingreso
    PaymentForm: opts.paymentForm || '03',
    PaymentMethod: opts.paymentMethod || 'PUE',
    Receiver: {
      Rfc: opts.receiver.Rfc.trim().toUpperCase(),
      Name: opts.receiver.Name.trim().toUpperCase(),
      CfdiUse: opts.receiver.CfdiUse,
      FiscalRegime: opts.receiver.FiscalRegime,
      TaxZipCode: opts.receiver.TaxZipCode.trim(),
    },
    Items: [
      {
        ProductCode: SAT_PRODUCT_HOSPEDAJE,
        UnitCode: SAT_UNIT_SERVICIO,
        Unit: 'Servicio',
        Description: opts.descripcion,
        IdentificationNumber: '',
        Quantity: 1,
        UnitPrice: subtotal,
        Subtotal: subtotal,
        Discount: 0,
        TaxObject: '02', // Sí objeto de impuesto
        Taxes: [
          {
            Total: iva,
            Name: 'IVA',
            Base: subtotal,
            Rate: IVA_RATE,
            IsRetention: false,
          },
        ],
        Total: total,
      },
    ],
  };
}

/** Crea y timbra un CFDI 4.0. */
export async function createCfdi(payload: any): Promise<CfdiResult> {
  if (!facturamaConfigured()) {
    throw new FacturamaError(0, 'Facturama no está configurado (faltan FACTURAMA_USER / FACTURAMA_PASSWORD).');
  }

  const res = await fetch(`${API_URL}/3/cfdis`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    throw new FacturamaError(res.status, data);
  }

  return {
    id: data?.Id || '',
    uuid: data?.Complement?.TaxStamp?.Uuid || '',
    folio: data?.Folio != null ? String(data.Folio) : '',
    serie: data?.Serie || SERIE,
    total: typeof data?.Total === 'number' ? data.Total : money(payload?.Items?.[0]?.Total || 0),
    fecha: data?.Date || new Date().toISOString(),
    raw: data,
  };
}

/** Descarga el archivo del CFDI (pdf | xml) como base64. */
export async function getCfdiFile(id: string, format: 'pdf' | 'xml'): Promise<{
  content: string; contentType: string; filename: string;
}> {
  if (!facturamaConfigured()) {
    throw new FacturamaError(0, 'Facturama no está configurado.');
  }
  const res = await fetch(`${API_URL}/cfdi/${format}/issued/${encodeURIComponent(id)}`, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail: any = text;
    try { detail = JSON.parse(text); } catch { /* texto plano */ }
    throw new FacturamaError(res.status, detail);
  }
  const data = JSON.parse(text);
  return {
    content: data.Content, // base64
    contentType: format === 'pdf' ? 'application/pdf' : 'application/xml',
    filename: `CFDI_${id}.${format}`,
  };
}

/** Ping de credenciales: lista 1 CFDI emitido. Útil para validar la conexión. */
export async function facturamaPing(): Promise<{ ok: boolean; status: number; sandbox: boolean; detail?: unknown }> {
  if (!facturamaConfigured()) return { ok: false, status: 0, sandbox: facturamaIsSandbox(), detail: 'sin credenciales' };
  try {
    const res = await fetch(`${API_URL}/cfdi?type=issued&keyword=&status=active&page=1&pageSize=1`, {
      headers: { Authorization: authHeader(), Accept: 'application/json' },
    });
    return { ok: res.ok, status: res.status, sandbox: facturamaIsSandbox() };
  } catch (e: any) {
    return { ok: false, status: 0, sandbox: facturamaIsSandbox(), detail: e?.message };
  }
}
