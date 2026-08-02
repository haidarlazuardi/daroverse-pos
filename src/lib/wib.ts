// WIB = UTC+7
const WIB_OFFSET = 7 * 60 * 60 * 1000;

/** Tanggal sekarang dalam WIB */
export function nowWIB(): Date {
  return new Date(Date.now() + WIB_OFFSET);
}

/** Awal hari (00:00:00 WIB) → UTC Date untuk query Prisma */
export function startOfDayWIB(date?: Date): Date {
  const d = date || nowWIB();
  const str = d.toISOString().slice(0, 10); // YYYY-MM-DD dalam WIB
  return new Date(str + 'T00:00:00+07:00');
}

/** Akhir hari (23:59:59 WIB) → UTC Date */
export function endOfDayWIB(date?: Date): Date {
  const d = date || nowWIB();
  const str = d.toISOString().slice(0, 10);
  return new Date(str + 'T23:59:59.999+07:00');
}

/** Awal bulan WIB */
export function startOfMonthWIB(year?: number, month?: number): Date {
  const wib = nowWIB();
  const y = year  ?? wib.getUTCFullYear();
  const m = month ?? (wib.getUTCMonth() + 1);
  return new Date(`${y}-${String(m).padStart(2,'0')}-01T00:00:00+07:00`);
}

/** Akhir bulan WIB */
export function endOfMonthWIB(year?: number, month?: number): Date {
  const wib = nowWIB();
  const y = year  ?? wib.getUTCFullYear();
  const m = month ?? (wib.getUTCMonth() + 1);
  const lastDay = new Date(y, m, 0).getDate();
  return new Date(`${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}T23:59:59.999+07:00`);
}

/** Awal tahun WIB */
export function startOfYearWIB(year?: number): Date {
  const y = year ?? nowWIB().getUTCFullYear();
  return new Date(`${y}-01-01T00:00:00+07:00`);
}

/** Parse date string YYYY-MM-DD ke start/end of day WIB */
export function dateRangeWIB(from?: string | null, to?: string | null) {
  return {
    gte: from ? new Date(from + 'T00:00:00+07:00') : undefined,
    lte: to   ? new Date(to   + 'T23:59:59.999+07:00') : undefined,
  };
}

/** Format ISO string ke display WIB */
export function toWIBString(date: Date | string): string {
  return new Date(date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

/** Ambil YYYY-MM-DD dalam WIB dari Date */
export function toWIBDateStr(date?: Date): string {
  return (date || nowWIB()).toISOString().slice(0, 10);
}
