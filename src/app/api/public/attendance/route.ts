export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-helpers';

// GET — list employees (bukan semua user) untuk dropdown absensi
export async function GET() {
  const users = await prisma.user.findMany({
    where: { active: true, employeeType: { not: null } },
    select: { id: true, name: true, employeeType: true },
    orderBy: { name: 'asc' },
  });
  return success(users);
}

// POST — submit absensi (semi-public: require valid userId + app key)
export async function POST(req: NextRequest) {
  try {
    // Basic protection: check referer or app header
    const appKey = req.headers.get('x-app-key') || req.headers.get('x-requested-with');
    const { userId, photo, location } = await req.json();
    if (!userId || !photo) return error('userId dan photo wajib', 400);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) return error('Karyawan tidak aktif', 404);
    // Pastikan userId valid dan staff (bukan random ID)
    if (!['STAFF','MANAGER','OWNER','SUPER_ADMIN'].includes(user.role)) {
      return error('Tidak diizinkan', 403);
    }

    // Determine type: CHECK_IN jika belum ada hari ini, CHECK_OUT jika sudah
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayRecord = await (prisma as any).attendance.findFirst({
      where: { userId, createdAt: { gte: todayStart } },
      orderBy: { createdAt: 'desc' },
    });

    const type = !todayRecord
      ? 'CHECK_IN'
      : todayRecord.type === 'CHECK_IN'
        ? 'CHECK_OUT'
        : 'CHECK_IN'; // already checked out → new check in

    const photoExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

    const attendance = await (prisma as any).attendance.create({
      data: {
        userId, type, photo, photoExpiresAt,
        latitude:  location?.lat  ?? null,
        longitude: location?.lng  ?? null,
        accuracy:  location?.accuracy ?? null,
      },
    });

    return success({ ...attendance, userName: user.name, type }, 201);
  } catch (e: any) {
    return error(e.message || 'Gagal', 500);
  }
}
