// ESC/POS command generator untuk thermal printer 58mm

const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

export interface ReceiptData {
  orderNumber: string;
  date: string;
  tableInfo?: string;
  customerName?: string;
  customerPoints?: number;
  pointsEarned?: number;
  items: { name: string; qty: number; price: number; subtotal: number }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  serviceCharge?: number;
  total: number;
  payMethod: string;
  received?: number;
  change?: number;
  cashierName?: string;
}

const W = 32; // chars for 58mm paper

function buildSingleReceipt(data: ReceiptData, copy: 'BAR' | 'CUSTOMER'): number[] {
  const cmds: number[] = [];

  const push  = (...b: number[]) => cmds.push(...b);
  const enc   = (s: string) => Array.from(s).map(c => c.charCodeAt(0));
  const line  = (s: string) => { cmds.push(...enc(s), LF); };
  const feed  = (n = 1)    => { for (let i = 0; i < n; i++) push(LF); };
  const center = () => push(ESC, 0x61, 0x01);
  const left   = () => push(ESC, 0x61, 0x00);
  const bold   = (on: boolean) => push(ESC, 0x45, on ? 1 : 0);
  const dbl    = (on: boolean) => push(GS, 0x21, on ? 0x11 : 0x00);
  const divider = () => line('--------------------------------');

  const row = (a: string, b: string) => {
    const sp = W - a.length - b.length;
    line(a + ' '.repeat(Math.max(1, sp)) + b);
  };

  const rp = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

  // ── Init ──────────────────────────────────────────────────────────────────
  push(ESC, 0x40);
  push(ESC, 0x74, 0x00);

  // ── Logo text (simulate logo with big bold text) ───────────────────────
  center();
  dbl(true); bold(true);
  line('SOEKA');
  line('HOUSE');
  dbl(false); bold(false);
  feed(1);

  // ── Copy label ────────────────────────────────────────────────────────────
  center();
  line(`[ ${copy === 'BAR' ? 'STAFF RECEIPT' : 'CUSTOMER RECEIPT'} ]`);
  left();
  divider();

  // ── Order info ────────────────────────────────────────────────────────────
  line(`No  : ${data.orderNumber}`);
  line(`Tgl : ${data.date}`);
  if (data.tableInfo) line(`Meja: ${data.tableInfo}`);
  if (data.cashierName) line(`Kasir: ${data.cashierName}`);
  if (data.customerName) line(`Plg : ${data.customerName}`);
  divider();

  // ── Items ─────────────────────────────────────────────────────────────────
  for (const item of data.items) {
    const name = item.name.length > 22 ? item.name.slice(0, 21) + '.' : item.name;
    line(name);
    row(`  ${item.qty}x ${rp(item.price)}`, rp(item.subtotal));
  }
  divider();

  // ── Totals ────────────────────────────────────────────────────────────────
  if (data.discount && data.discount > 0) row('Diskon', `-${rp(data.discount)}`);
  if (data.tax && data.tax > 0) row('Pajak', rp(data.tax));
  if (data.serviceCharge && data.serviceCharge > 0) row('Service', rp(data.serviceCharge));
  bold(true);
  row('TOTAL', rp(data.total));
  bold(false);
  row('Bayar', data.payMethod);
  if (data.received) row('Tunai', rp(data.received));
  if (data.change && data.change > 0) row('Kembali', rp(data.change));

  // ── Poin (customer copy only) ─────────────────────────────────────────────
  if (copy === 'CUSTOMER' && (data.pointsEarned || data.customerPoints !== undefined)) {
    divider();
    if (data.pointsEarned) {
      bold(true);
      line(`+ ${data.pointsEarned} poin didapat`);
      bold(false);
    }
    if (data.customerPoints !== undefined) {
      line(`Total poin kamu: ${data.customerPoints} poin`);
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  divider();
  center();
  line('Terima kasih sudah mampir!');
  feed(1);
  line('@soeka.house');
  feed(1);
  line('Kritik & Saran: 087897594105');
  feed(3);

  // ── Cut ───────────────────────────────────────────────────────────────────
  push(GS, 0x56, 0x41, 0x00);

  return cmds;
}

export function buildReceipt(data: ReceiptData): Uint8Array {
  // Print 2 copies: BAR first, then CUSTOMER
  const bar      = buildSingleReceipt(data, 'BAR');
  const customer = buildSingleReceipt(data, 'CUSTOMER');
  return new Uint8Array([...bar, ...customer]);
}

// ── Kitchen / Bar Ticket — minimal, hemat kertas ─────────────────────────────
export function buildKitchenTicket(data: {
  orderNumber: string;
  tableInfo?: string;
  customerName?: string;
  date: string;
  items: { name: string; qty: number; notes?: string }[];
  station: 'KITCHEN' | 'BAR';
}): Uint8Array {
  if (data.items.length === 0) return new Uint8Array([]);
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
  const cmds: number[] = [];
  const push = (...b: number[]) => cmds.push(...b);
  const enc  = (s: string) => Array.from(s.slice(0,32)).map(c => Math.min(127, c.charCodeAt(0)));
  const line = (s: string) => { cmds.push(...enc(s), LF); };
  const bold = (on: boolean) => push(ESC, 0x45, on ? 1 : 0);
  const dbl  = (on: boolean) => push(GS, 0x21, on ? 0x11 : 0x00);
  const cut  = () => push(GS, 0x56, 0x42, 0x10); // partial cut

  push(ESC, 0x40); // init

  // Header — 1 baris
  bold(true); dbl(true);
  line(data.station === 'KITCHEN' ? 'KITCHEN' : 'BAR');
  dbl(false); bold(false);

  // Order number + info — compact
  bold(true); line(`#${data.orderNumber.slice(-6)}`); bold(false);
  if (data.tableInfo) line(`Meja: ${data.tableInfo}`);
  if (data.customerName) line(data.customerName.slice(0, 20));
  line('---');

  // Items — bold nama, normal qty
  for (const item of data.items) {
    dbl(true); bold(true);
    line(`${item.qty}x ${item.name.slice(0, 13)}`);
    dbl(false); bold(false);
    if (item.notes) line(`  *${item.notes.slice(0, 28)}`);
  }

  line('---');
  // Time only (no date) - hemat baris
  const t = data.date.split(' ').pop() || data.date;
  line(t);
  push(LF, LF);
  cut();
  return new Uint8Array(cmds);
}

// ── QR as raster bitmap ───────────────────────────────────────────────────────
// Generate QR code as ESC/POS bitmap — compatible with all thermal printers
export async function buildQRLabel(data: {
  name: string;
  qrText: string;
  line1: string; // qty + unit
  line2: string; // 1 karton · tanggal
  line3: string; // PO number
}): Promise<Uint8Array> {
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
  const cmds: number[] = [];
  const push = (...b: number[]) => cmds.push(...b);
  const enc  = (s: string) => Array.from(s.slice(0, 32)).map(c => Math.min(127, c.charCodeAt(0)));
  const line = (s: string) => { cmds.push(...enc(s), LF); };
  const center = () => push(ESC, 0x61, 0x01);
  const bold   = (on: boolean) => push(ESC, 0x45, on ? 1 : 0);
  const dbl    = (on: boolean) => push(GS, 0x21, on ? 0x11 : 0x00);

  push(ESC, 0x40); // init
  center();

  // Nama bahan
  bold(true); dbl(true);
  line(data.name.slice(0, 14));
  dbl(false); bold(false);
  push(LF);

  // Generate QR bitmap via canvas
  const qrBitmap = await generateQRBitmap(data.qrText, 200);
  if (qrBitmap) {
    cmds.push(...qrBitmap);
  }

  push(LF);
  center(); bold(true);
  line(data.line1);
  bold(false);
  line(data.line2);
  line(data.line3);

  push(LF, LF);
  push(GS, 0x56, 0x42, 0x10); // partial cut
  return new Uint8Array(cmds);
}

async function generateQRBitmap(text: string, _size: number): Promise<number[]> {
  try {
    const W = 360;
    // Generate QR locally via qrcode library — no external fetch needed
    const QRCode = (await import('qrcode')).default;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = W;
    await QRCode.toCanvas(canvas, text, {
      width: W,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, W, W);
    return imageDataToESCPOS(imageData, W, W);
  } catch {
    return [];
  }
}

function imageDataToESCPOS(imageData: ImageData, width: number, height: number): number[] {
  const ESC = 0x1B, GS = 0x1D;
  const cmds: number[] = [];

  // ESC/POS raster bit image: GS v 0
  const bytesPerRow = Math.ceil(width / 8);
  const xL = bytesPerRow & 0xFF;
  const xH = (bytesPerRow >> 8) & 0xFF;
  const yL = height & 0xFF;
  const yH = (height >> 8) & 0xFF;

  cmds.push(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);

  for (let y = 0; y < height; y++) {
    for (let bx = 0; bx < bytesPerRow; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = bx * 8 + bit;
        if (x < width) {
          const idx = (y * width + x) * 4;
          const r = imageData.data[idx];
          const g = imageData.data[idx + 1];
          const b = imageData.data[idx + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          if (gray < 128) byte |= (0x80 >> bit); // dark pixel = 1
        }
      }
      cmds.push(byte);
    }
  }
  return cmds;
}

// ── Staff Receipt — Bar + Kitchen dalam 1 struk ───────────────────────────────
export function buildStaffReceipt(data: {
  orderNumber: string;
  date: string;
  customerName?: string;
  barItems: { name: string; qty: number }[];
  kitchenItems: { name: string; qty: number }[];
}): Uint8Array {
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
  const cmds: number[] = [];
  const push = (...b: number[]) => cmds.push(...b);
  const enc  = (s: string) => Array.from(s.slice(0, 32)).map(c => Math.min(127, c.charCodeAt(0)));
  const line = (s: string) => { cmds.push(...enc(s), LF); };
  const center = () => push(ESC, 0x61, 0x01);
  const left   = () => push(ESC, 0x61, 0x00);
  const bold   = (on: boolean) => push(ESC, 0x45, on ? 1 : 0);
  const dbl    = (on: boolean) => push(GS, 0x21, on ? 0x11 : 0x00);
  const feed   = (n = 1) => { for (let i = 0; i < n; i++) push(LF); };

  push(ESC, 0x40); // init

  // Header
  center(); bold(true);
  line('STAFF RECEIPT');
  bold(false);
  line(`#${data.orderNumber}`);
  if (data.customerName) line(data.customerName.slice(0, 20));
  line(data.date);
  left(); line('--------------------------------');

  // BAR section
  if (data.barItems.length > 0) {
    center(); bold(true); dbl(true);
    line('BAR');
    dbl(false); bold(false); left();
    line('- - - - - - - - - - - - - - - -');
    for (const item of data.barItems) {
      bold(true);
      line(`${item.qty}x ${item.name.slice(0, 28)}`);
      bold(false);
    }
    line('--------------------------------');
  }

  // KITCHEN section
  if (data.kitchenItems.length > 0) {
    center(); bold(true); dbl(true);
    line('KITCHEN');
    dbl(false); bold(false); left();
    line('- - - - - - - - - - - - - - - -');
    for (const item of data.kitchenItems) {
      bold(true);
      line(`${item.qty}x ${item.name.slice(0, 28)}`);
      bold(false);
    }
    line('--------------------------------');
  }

  feed(2);
  push(GS, 0x56, 0x42, 0x10); // partial cut
  return new Uint8Array(cmds);
}

// ── Shift Report untuk kasir ──────────────────────────────────────────────────
export interface ShiftReportData {
  date:         string;    // tanggal WIB
  cashierName:  string;
  openingCash:  number;
  closingCash:  number;
  expectedCash: number;
  difference:   number;
  cashSales:    number;
  qrisSales:    number;
  cardSales:    number;
  totalSales:   number;
  totalExpenses:number;
  orderCount:   number;
  items: Array<{ name: string; qty: number; subtotal: number }>;
}

export function buildShiftReport(data: ShiftReportData): Uint8Array {
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
  const buf: number[] = [];
  const push = (...b: number[]) => b.forEach(x => buf.push(x));
  const nl   = (n = 1) => { for (let i = 0; i < n; i++) push(LF); };
  const cut  = () => push(GS, 0x56, 0x42, 0x10);
  const center = () => push(ESC, 0x61, 0x01);
  const left   = () => push(ESC, 0x61, 0x00);
  const bold   = (on: boolean) => push(ESC, 0x45, on ? 1 : 0);
  const W = 32; // lebar karakter 58mm

  const enc = new TextEncoder();
  const text = (s: string) => push(...enc.encode(s));

  const pad = (l: string, r: string, w = W) => {
    const gap = w - l.length - r.length;
    return l + ' '.repeat(Math.max(1, gap)) + r;
  };
  const line = (s: string) => { left(); text(s); nl(); };
  const divider = () => { line('='.repeat(W)); };
  const dashed = () => { line('-'.repeat(W)); };
  const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

  push(ESC, 0x40); // init
  push(ESC, 0x74, 0x00); // charset

  // Header
  center(); bold(true);
  text('SOEKA HOUSE'); nl();
  text('LAPORAN KASIR'); nl();
  bold(false);
  text(data.date); nl();
  text(`Kasir: ${data.cashierName}`); nl();
  divider();

  // Ringkasan kas
  left(); bold(true); text('RINGKASAN KAS'); nl(); bold(false);
  line(pad('Kas Awal', fmt(data.openingCash)));
  line(pad('Total Penjualan', fmt(data.totalSales)));
  line(pad('Pengeluaran', fmt(data.totalExpenses)));
  dashed();
  line(pad('Kas Diharapkan', fmt(data.expectedCash)));
  line(pad('Kas Aktual', fmt(data.closingCash)));
  bold(true);
  const diffSign = data.difference >= 0 ? '+' : '';
  line(pad('Selisih', `${diffSign}${fmt(data.difference)}`));
  bold(false);
  divider();

  // Metode pembayaran
  bold(true); text('METODE PEMBAYARAN'); nl(); bold(false);
  if (data.cashSales > 0)  line(pad('Cash', fmt(data.cashSales)));
  if (data.qrisSales > 0)  line(pad('QRIS', fmt(data.qrisSales)));
  if (data.cardSales > 0)  line(pad('Card', fmt(data.cardSales)));
  line(pad('Total Transaksi', `${data.orderCount} order`));
  divider();

  // Item terjual
  bold(true); text('ITEM TERJUAL'); nl(); bold(false);
  const sorted = [...data.items].sort((a, b) => b.qty - a.qty);
  for (const item of sorted) {
    const name = item.name.length > 18 ? item.name.slice(0, 17) + '.' : item.name;
    const right = `${item.qty}x ${fmt(item.subtotal)}`;
    line(pad(name, right));
  }
  divider();

  // Footer
  center();
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  text(`Dicetak: ${now.toLocaleString('id-ID', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}`);
  nl(3);
  cut();

  return new Uint8Array(buf);
}
