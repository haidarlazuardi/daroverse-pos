// Schedule generation engine untuk Soeka House
// Constraint: Min-Kam bisa libur, Jum-Sab wajib hadir

export type SlotShift = 'PAGI' | 'SORE';
export type SlotRole  = 'BARISTA' | 'HELPER' | 'KITCHEN' | 'KITCHEN_HELPER' | 'BARISTA_HELPER';
export type SlotType  = 'REGULAR' | 'EXTRA' | 'COVER' | 'DAILY_WORKER';

export interface StaffConfig {
  userId: string;
  name:   string;
  role:   SlotRole;
  // KITCHEN_HELPER selalu SORE, tidak perlu rotasi
}

export interface GeneratedSlot {
  date:      Date;
  shift:     SlotShift;
  role:      SlotRole;
  userId:    string | null;
  type:      SlotType;
  isOff:     boolean;
  notes?:    string;
}

// Slot yang dibutuhkan per hari per shift
function getRequiredSlots(date: Date): { shift: SlotShift; role: SlotRole }[] {
  const dow = date.getDay(); // 0=Min, 1=Sen, ..., 5=Jum, 6=Sab
  const isFriSat = dow === 5 || dow === 6;

  const slots: { shift: SlotShift; role: SlotRole }[] = [
    // Pagi (semua hari sama)
    { shift: 'PAGI', role: 'BARISTA' },
    { shift: 'PAGI', role: 'HELPER' },
    { shift: 'PAGI', role: 'KITCHEN' },
    // Sore
    { shift: 'SORE', role: 'BARISTA' },
    { shift: 'SORE', role: 'HELPER' },
    { shift: 'SORE', role: 'KITCHEN' },
    { shift: 'SORE', role: 'KITCHEN_HELPER' },
  ];

  if (isFriSat) {
    // Extra slot sore Jum/Sab
    slots.push({ shift: 'SORE', role: 'BARISTA_HELPER' });
  }

  return slots;
}

// Apakah hari ini boleh libur (bukan Jum/Sab)
function canBeOff(date: Date): boolean {
  const dow = date.getDay();
  return dow !== 5 && dow !== 6;
}

// Generate array tanggal dalam 1 bulan
function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

// Group days by week
function groupByWeek(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  let week: Date[] = [];
  for (const day of days) {
    if (day.getDay() === 0 && week.length > 0) {
      weeks.push(week);
      week = [];
    }
    week.push(day);
  }
  if (week.length) weeks.push(week);
  return weeks;
}

export function generateSchedule(
  year: number,
  month: number,
  staff: StaffConfig[]
): GeneratedSlot[] {
  const days  = getDaysInMonth(year, month);
  const weeks = groupByWeek(days);
  const slots: GeneratedSlot[] = [];

  // Pisahkan staff per role
  const byRole: Record<string, StaffConfig[]> = {};
  for (const s of staff) {
    if (!byRole[s.role]) byRole[s.role] = [];
    byRole[s.role].push(s);
  }

  // Track berapa minggu setiap staff sudah dapat pagi vs sore
  const shiftCount: Record<string, { pagi: number; sore: number }> = {};
  for (const s of staff) shiftCount[s.userId] = { pagi: 0, sore: 0 };

  // Track kapan terakhir libur per staff (untuk distribute libur)
  const lastOff: Record<string, Date | null> = {};
  for (const s of staff) lastOff[s.userId] = null;

  // Per-week scheduling
  for (let wi = 0; wi < weeks.length; wi++) {
    const week = weeks[wi];

    // Assign shift rotasi per minggu (per role, 2 staff bergilir pagi/sore)
    const roleShiftThisWeek: Record<string, Record<string, SlotShift>> = {};

    for (const [role, roleStaff] of Object.entries(byRole)) {
      roleShiftThisWeek[role] = {};

      if (role === 'KITCHEN_HELPER') {
        // Kitchen helper selalu SORE
        for (const s of roleStaff) roleShiftThisWeek[role][s.userId] = 'SORE';
        continue;
      }

      if (roleStaff.length === 1) {
        // 1 staff = ambil shift yang lebih sedikit
        const s = roleStaff[0];
        roleShiftThisWeek[role][s.userId] =
          shiftCount[s.userId].pagi <= shiftCount[s.userId].sore ? 'PAGI' : 'SORE';
        continue;
      }

      // 2+ staff — rotasi: kalau minggu ganjil staff[0] pagi, genap staff[0] sore
      for (let si = 0; si < roleStaff.length; si++) {
        const s = roleStaff[si];
        const isPagi = (wi + si) % 2 === 0;
        roleShiftThisWeek[role][s.userId] = isPagi ? 'PAGI' : 'SORE';
      }
    }

    // Update shift count
    for (const [role, userShifts] of Object.entries(roleShiftThisWeek)) {
      for (const [userId, shift] of Object.entries(userShifts)) {
        if (shift === 'PAGI') shiftCount[userId].pagi++;
        else shiftCount[userId].sore++;
      }
    }

    // Determine 1 libur per staff per minggu
    const offDay: Record<string, Date | null> = {};
    for (const s of staff) {
      // Kitchen helper: pilih hari offable di minggu ini
      const offable = week.filter(d => canBeOff(d));
      if (offable.length === 0) { offDay[s.userId] = null; continue; }

      // Pilih hari yang paling lama tidak libur
      // Simple: round-robin berdasarkan index staff dalam role group
      const roleStaff = byRole[s.role] || [s];
      const idx = roleStaff.findIndex(r => r.userId === s.userId);
      const dayIdx = (wi + idx) % offable.length;
      offDay[s.userId] = offable[dayIdx];
    }

    // Generate slots per hari
    for (const day of week) {
      const required = getRequiredSlots(day);

      for (const req of required) {
        // Cari staff yang sesuai role dan shift
        const roleStaff = byRole[req.role] || [];
        let assigned: string | null = null;

        for (const s of roleStaff) {
          const staffShift = roleShiftThisWeek[s.role]?.[s.userId];
          const isOff = offDay[s.userId]?.toDateString() === day.toDateString();
          if (staffShift === req.shift && !isOff) {
            assigned = s.userId;
            break;
          }
        }

        slots.push({
          date:   day,
          shift:  req.shift,
          role:   req.role,
          userId: assigned,
          type:   assigned ? 'REGULAR' : 'DAILY_WORKER',
          isOff:  false,
          notes:  assigned ? undefined : 'Perlu daily worker atau cover',
        });
      }

      // Tambah OFF slot untuk staff yang libur hari ini
      for (const s of staff) {
        if (offDay[s.userId]?.toDateString() === day.toDateString()) {
          slots.push({
            date:   day,
            shift:  roleShiftThisWeek[s.role]?.[s.userId] || 'PAGI',
            role:   s.role,
            userId: s.userId,
            type:   'REGULAR',
            isOff:  true,
            notes:  'Libur',
          });
        }
      }
    }
  }

  return slots;
}

// Calculate payroll dari slots — hitung per staff
export interface PayrollSummary {
  userId:       string;
  regularDays:  number;  // REGULAR non-off slots
  extraSlots:   number;  // EXTRA / COVER slots (cross-role)
  offDays:      number;
  dailyRate:    number;
  extraRate:    number;  // biasanya dailyRate / 2 untuk extra shift
  totalPay:     number;
}

export function calculateSchedulePayroll(
  slots: Array<{ userId: string | null; type: string; isOff: boolean; role: string }>,
  staffRates: Record<string, number>  // userId -> dailyRate
): PayrollSummary[] {
  const summary: Record<string, PayrollSummary> = {};

  for (const slot of slots) {
    if (!slot.userId) continue;
    const uid = slot.userId;
    if (!summary[uid]) {
      const rate = staffRates[uid] || 0;
      summary[uid] = { userId: uid, regularDays: 0, extraSlots: 0, offDays: 0, dailyRate: rate, extraRate: rate / 2, totalPay: 0 };
    }

    if (slot.isOff) {
      summary[uid].offDays++;
    } else if (slot.type === 'EXTRA' || slot.type === 'COVER') {
      summary[uid].extraSlots++;
    } else if (slot.type === 'REGULAR') {
      summary[uid].regularDays++;
    }
  }

  // Hitung total pay
  for (const s of Object.values(summary)) {
    s.totalPay = (s.regularDays * s.dailyRate) + (s.extraSlots * s.extraRate);
  }

  return Object.values(summary);
}
