// ESC/POS command generator untuk thermal printer 58mm

const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

export function buildReceipt(data: {
  storeName: string;
  orderNumber: string;
  date: string;
  tableInfo?: string;
  customerName?: string;
  items: { name: string; qty: number; price: number; subtotal: number }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  serviceCharge?: number;
  total: number;
  payMethod: string;
  received?: number;
  change?: number;
  pointsEarned?: number;
  totalPoints?: number;
  checkUrl?: string;
}): Uint8Array {
  const cmds: number[] = [];

  const push = (...bytes: number[]) => cmds.push(...bytes);
  const text = (str: string) => {
    for (let i = 0; i < str.length; i++) cmds.push(str.charCodeAt(i));
  };
  const line = (str: string) => { text(str); push(LF); };
  const feed = (n = 1) => { for (let i = 0; i < n; i++) push(LF); };

  const center  = () => push(ESC, 0x61, 0x01);
  const left    = () => push(ESC, 0x61, 0x00);
  const bold    = (on: boolean) => push(ESC, 0x45, on ? 1 : 0);
  const dblSize = (on: boolean) => push(GS, 0x21, on ? 0x11 : 0x00);
  const divider = () => line('--------------------------------');

  // ── Init ──
  push(ESC, 0x40); // reset
  push(ESC, 0x74, 0x00); // charset PC437

  // ── Header ──
  center();
  dblSize(true);
  bold(true);
  line(data.storeName.toUpperCase());
  dblSize(false);
  bold(false);
  if (data.tableInfo) line(data.tableInfo);
  feed(1);
  left();
  divider();

  // ── Order info ──
  line(`No: ${data.orderNumber}`);
  line(`Tgl: ${data.date}`);
  if (data.customerName) line(`Plg: ${data.customerName}`);
  divider();

  // ── Items ──
  const W = 32; // chars wide for 58mm
  for (const item of data.items) {
    const nameStr = item.name.length > 20 ? item.name.slice(0, 19) + '.' : item.name;
    line(nameStr);
    const qtyPrice = `  ${item.qty}x ${formatNum(item.price)}`;
    const sub = formatNum(item.subtotal);
    const spaces = W - qtyPrice.length - sub.length;
    line(qtyPrice + ' '.repeat(Math.max(1, spaces)) + sub);
  }
  divider();

  // ── Totals ──
  const row = (label: string, val: string) => {
    const spaces = W - label.length - val.length;
    line(label + ' '.repeat(Math.max(1, spaces)) + val);
  };

  if (data.discount && data.discount > 0) row('Diskon', `-${formatNum(data.discount)}`);
  if (data.tax && data.tax > 0) row('Pajak', formatNum(data.tax));
  if (data.serviceCharge && data.serviceCharge > 0) row('Service', formatNum(data.serviceCharge));

  bold(true);
  row('TOTAL', formatNum(data.total));
  bold(false);
  row('Bayar', data.payMethod);
  if (data.received) row('Tunai', formatNum(data.received));
  if (data.change && data.change > 0) row('Kembali', formatNum(data.change));

  // ── Points ──
  if (data.pointsEarned || data.totalPoints) {
    divider();
    if (data.pointsEarned) line(`+ ${data.pointsEarned} poin didapat`);
    if (data.totalPoints) {
      bold(true);
      line(`Total poin: ${data.totalPoints} *`);
      bold(false);
    }
    if (data.checkUrl) { center(); line(data.checkUrl); left(); }
  }

  // ── Footer ──
  divider();
  center();
  line('Terima kasih!');
  line('Soeka House - Bogor');
  feed(3);

  // Cut paper
  push(GS, 0x56, 0x41, 0x00);

  return new Uint8Array(cmds);
}

function formatNum(n: number): string {
  return 'Rp' + n.toLocaleString('id-ID');
}
