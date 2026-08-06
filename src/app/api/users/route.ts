export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { hashPassword } from '@/lib/auth';
import { ADMIN_ROLES, SENIOR_ROLES } from '@/lib/auth';

export const GET = withAuth(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, employeeType: true, dailyRate: true, bankName: true, bankAccount: true, bankAccountName: true, joinDate: true },
    orderBy: { createdAt: 'desc' },
  });
  return success(users);
}, SENIOR_ROLES);

export const POST = withAuth(async (req) => {
  // POST langsung disabled — buat user via /api/employees action:create_account
  return error('Gunakan menu Karyawan → Buat Akun untuk membuat akun baru', 400);
}, SENIOR_ROLES);

export const PATCH = withAuth(async (req) => {
  const { id, name, email, role, password, active, hasPosAccess } = await req.json();
  if (!id) return error('ID wajib diisi');

  // Hanya auth fields — HR data dikelola di /api/employees
  const updateData: any = {};
  if (name !== undefined)        updateData.name        = name;
  if (email !== undefined)       updateData.email       = email;
  if (role !== undefined)        updateData.role        = role;
  if (active !== undefined)      updateData.active      = active;
  if (hasPosAccess !== undefined) updateData.hasPosAccess = !!hasPosAccess;
  if (password) {
    updateData.password = await hashPassword(password);
  }

  const user = await prisma.user.update({ where: { id }, data: updateData });
  const { password: _, ...safe } = user as any;
  return success(safe);
}, SENIOR_ROLES);

export const DELETE = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const id    = searchParams.get('id');
  const force = searchParams.get('force') === '1';
  if (!id) return error('ID wajib diisi');

  const u = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!u) return error('User tidak ditemukan', 404);
  if (u.role === 'SUPER_ADMIN' || u.role === 'OWNER') {
    const count = await prisma.user.count({ where: { role: { in: ['SUPER_ADMIN', 'OWNER'] }, active: true } });
    if (count <= 1) return error('Tidak bisa hapus satu-satunya akun Owner/Super Admin', 400);
  }

  // Cek data historis yang penting (order saja — absensi bisa ikut dihapus)
  const orderCount = await prisma.order.count({ where: { userId: id } });

  if (orderCount > 0 && !force) {
    await prisma.user.update({ where: { id }, data: { active: false } });
    return success({ deleted: false, deactivated: true, reason: `User punya ${orderCount} order — dinonaktifkan untuk menjaga data historis transaksi` });
  }

  // Hapus/nullify semua relasi pakai Prisma ORM
  // requestedBy sekarang nullable di schema — nullify dulu sebelum delete
  const nullifyPromises = [
    prisma.order.updateMany({ where: { userId: id }, data: { userId: id } }).catch(() => {}),
    prisma.shift.updateMany({ where: { userId: id }, data: { userId: id } }).catch(() => {}),
    (prisma as any).purchaseRequest?.updateMany({ where: { requestedBy: id }, data: { requestedBy: null } }).catch(() => {}),
    (prisma as any).voidRequest?.updateMany({ where: { requestedBy: id }, data: { requestedBy: null } }).catch(() => {}),
    (prisma as any).auditLog?.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {}),
    (prisma as any).loyaltyLedger?.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {}),
    (prisma as any).payrollRecord?.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {}),
    (prisma as any).workSchedule?.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {}),
    (prisma as any).scheduleSlot?.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {}),
    (prisma as any).logbookEntry?.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {}),
    (prisma as any).employee?.updateMany({ where: { userId: id }, data: { userId: null } }).catch(() => {}),
  ];
  await Promise.allSettled(nullifyPromises);

  // Hapus child records
  const deletePromises = [
    (prisma as any).attendance?.deleteMany({ where: { userId: id } }).catch(() => {}),
    (prisma as any).leave?.deleteMany({ where: { userId: id } }).catch(() => {}),
    (prisma as any).kasbon?.deleteMany({ where: { userId: id } }).catch(() => {}),
    (prisma as any).shiftSwap?.deleteMany({ where: { requestedBy: id } }).catch(() => {}),
    (prisma as any).scheduleSlot?.deleteMany({ where: { userId: id } }).catch(() => {}),
  ];
  await Promise.allSettled(deletePromises);

  try {
    await prisma.user.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e: any) {
    await prisma.user.update({ where: { id }, data: { active: false } }).catch(() => {});
    return success({ deleted: false, deactivated: true, reason: 'Masih ada relasi yang tidak bisa dihapus — akun dinonaktifkan' });
  }
}, SENIOR_ROLES);
