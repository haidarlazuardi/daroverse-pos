export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, ALL_ROLES } from '@/lib/auth';
import { generateSchedule } from '@/lib/schedule-engine';

// GET — ambil jadwal bulan tertentu
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

  const schedule = await (prisma as any).schedule.findUnique({
    where: { year_month: { year, month } },
    include: {
      slots: {
        include: { user: { select: { id: true, name: true, role: true, dailyRate: true } } },
        orderBy: [{ date: 'asc' }, { shift: 'asc' }],
      },
    },
  });

  return success(schedule);
}, ALL_ROLES);

// POST — generate jadwal baru
export const POST = withAuth(async (req: NextRequest, user) => {
  const { year, month, staffConfigs } = await req.json();
  if (!year || !month) return error('year dan month wajib');

  // Cek jadwal sudah ada
  const existing = await (prisma as any).schedule.findUnique({
    where: { year_month: { year, month } },
  });
  if (existing && existing.status !== 'DRAFT') {
    return error('Jadwal sudah dipublish, tidak bisa di-generate ulang');
  }

  // Ambil staff yang aktif kalau tidak ada config manual
  let configs = staffConfigs;
  if (!configs?.length) {
    const staff = await prisma.user.findMany({
      where: { active: true, role: 'STAFF', dailyRate: { gt: 0 } },
      select: { id: true, name: true },
    });
    // Default: semua STAFF → manager assign role via UI
    configs = staff.map((s: any) => ({ userId: s.id, name: s.name, role: 'BARISTA' }));
  }

  // Generate slots
  const generatedSlots = generateSchedule(year, month, configs);

  // Hapus jadwal lama kalau DRAFT
  if (existing) {
    await (prisma as any).scheduleSlot.deleteMany({ where: { scheduleId: existing.id } });
    await (prisma as any).schedule.delete({ where: { id: existing.id } });
  }

  // Simpan ke DB
  const schedule = await (prisma as any).schedule.create({
    data: {
      year,
      month,
      status: 'DRAFT',
      createdBy: user.userId,
      slots: {
        create: generatedSlots.map(s => ({
          date:             s.date,
          shift:            s.shift,
          role:             s.role,
          userId:           s.userId,
          type:             s.type,
          isOff:            s.isOff,
          isDailyWorker:    s.type === 'DAILY_WORKER',
          notes:            s.notes,
        })),
      },
    },
    include: {
      slots: {
        include: { user: { select: { id: true, name: true, role: true, dailyRate: true } } },
        orderBy: [{ date: 'asc' }, { shift: 'asc' }],
      },
    },
  });

  return success(schedule, 201);
}, ADMIN_ROLES);

// PATCH — update slot (assign/swap/extra)
export const PATCH = withAuth(async (req: NextRequest) => {
  const { slotId, action, userId, dailyWorkerName, notes, role, shift, type } = await req.json();

  if (action === 'assign') {
    const slot = await (prisma as any).scheduleSlot.update({
      where: { id: slotId },
      data: {
        userId:          userId || null,
        isDailyWorker:   !userId,
        dailyWorkerName: userId ? null : (dailyWorkerName || null),
        notes:           notes || null,
        type:            userId ? (type || 'REGULAR') : 'DAILY_WORKER',
      },
      include: { user: { select: { id: true, name: true, role: true, dailyRate: true } } },
    });
    return success(slot);
  }

  if (action === 'add_extra') {
    // Tambah slot extra (double shift / cross-role)
    const existing = await (prisma as any).scheduleSlot.findUnique({ where: { id: slotId } });
    if (!existing) return error('Slot tidak ditemukan');

    const extra = await (prisma as any).scheduleSlot.create({
      data: {
        scheduleId: existing.scheduleId,
        date:       existing.date,
        shift:      shift || existing.shift,
        role:       role  || existing.role,
        userId,
        type:       'EXTRA',
        notes:      notes || 'Shift tambahan',
      },
      include: { user: { select: { id: true, name: true, role: true, dailyRate: true } } },
    });
    return success(extra, 201);
  }

  if (action === 'toggle_off') {
    const slot = await (prisma as any).scheduleSlot.update({
      where: { id: slotId },
      data:  { isOff: true, userId, notes: notes || 'Libur' },
      include: { user: { select: { id: true, name: true, role: true, dailyRate: true } } },
    });
    return success(slot);
  }

  if (action === 'publish') {
    const { scheduleId } = await req.json().catch(() => ({ scheduleId: slotId }));
    const s = await (prisma as any).schedule.update({
      where: { id: scheduleId || slotId },
      data:  { status: 'PUBLISHED' },
    });
    return success(s);
  }

  return error('Action tidak valid');
}, ADMIN_ROLES);
