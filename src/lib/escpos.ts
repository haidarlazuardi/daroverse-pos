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
