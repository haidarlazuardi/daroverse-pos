// Late tracking & incentive calculation engine — Soeka House

export const SHIFT_CONFIG = {
  '1': { start: { h: 9, m: 30 }, tolerance: 15, name: 'Shift 1 (09:30)' },
  '2': { start: { h: 16, m: 0  }, tolerance: 15, name: 'Shift 2 (16:00)' },
};

export const INCENTIVE_LEVELS = [
  { level: 1, target: 1_500_000, pool: 120_000 },
  { level: 2, target: 3_000_000, pool: 240_000 },
  { level: 3, target: 4_500_000, pool: 360_000 },
];

// Hitung berapa menit terlambat dari waktu check-in WIB
export function calcMinutesLate(checkInTime: Date, shiftKey: '1' | '2'): number {
  const cfg = SHIFT_CONFIG[shiftKey];
  const wib = new Date(checkInTime.getTime() + 7 * 60 * 60 * 1000);
  const actualMinutes = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  const shiftMinutes  = cfg.start.h * 60 + cfg.start.m;
  const lateMinutes   = actualMinutes - shiftMinutes - cfg.tolerance;
  return Math.max(0, lateMinutes);
}

// Tentukan status berdasarkan keterlambatan
export function getLateStatus(minutesLate: number): 'ON_TIME' | 'LATE' | 'VERY_LATE' {
  if (minutesLate <= 0)  return 'ON_TIME';
  if (minutesLate <= 75) return 'LATE';      // ≤ 1.5 jam = telat biasa
  return 'VERY_LATE';                         // > 1.5 jam
}

// Hitung punishment dari late records bulan ini
export interface PunishmentResult {
  lateCount:        number;  // total terlambat (LATE + VERY_LATE)
  lateDeduction:    number;  // potongan dari akumulasi 3x
  veryLateDeduction: number; // potongan 50% dari telat > 1.5 jam
  absentDeduction:  number;  // potongan dari tidak masuk tanpa kabar
  totalDeduction:   number;
  details:          string[];
}

export function calcMonthlyPunishment(
  lateRecords: Array<{ status: string; confirmed: boolean; minutesLate: number }>,
  dailyRate: number
): PunishmentResult {
  const lateCount       = lateRecords.filter(r => r.status === 'LATE' || r.status === 'VERY_LATE').length;
  const veryLateUnconf  = lateRecords.filter(r => r.status === 'VERY_LATE' && !r.confirmed);
  const absentNoInfo    = lateRecords.filter(r => r.status === 'ABSENT_NO_INFO');

  const lateDeductions  = Math.floor(lateCount / 3); // setiap 3x terlambat = 1 hari
  const lateDeduction   = lateDeductions * dailyRate;
  const veryLateDeduction = veryLateUnconf.length * (dailyRate * 0.5);
  const absentDeduction = absentNoInfo.length * dailyRate;

  const details: string[] = [];
  if (lateDeductions > 0)      details.push(`${lateCount}x terlambat → potong ${lateDeductions} hari gaji`);
  if (veryLateUnconf.length > 0) details.push(`${veryLateUnconf.length}x telat >1.5 jam → potong 50% per kejadian`);
  if (absentNoInfo.length > 0)   details.push(`${absentNoInfo.length}x alpha → potong ${absentNoInfo.length} hari gaji`);

  return {
    lateCount, lateDeduction, veryLateDeduction, absentDeduction,
    totalDeduction: lateDeduction + veryLateDeduction + absentDeduction,
    details,
  };
}

// Hitung level insentif berdasarkan revenue harian
export function getIncentiveLevel(revenue: number) {
  let result = null;
  for (const lvl of INCENTIVE_LEVELS) {
    if (revenue >= lvl.target) result = lvl;
  }
  return result; // null = tidak ada insentif
}
