export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET — list karyawan
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');

  const employees = await (prisma as any).employee.findMany({
    where: active !== null ? { active: active === '1' || active === 'true' } : {},
    include: { user: { select: { id: true, email: true, role: true, active: true, hasPosAccess: true } } },
    orderBy: { name: 'asc' },
  });
  return success(employees);
}, ADMIN_ROLES);

// POST — tambah karyawan baru
export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json();
  const { name, email, nik, phone, address, position, employeeType, joinDate, dailyRate,
          bankName, bankAccount, bankAccountName, emergencyContact, emergencyPhone,
          serviceChargeEligible, notes } = body;

  if (!name?.trim()) return error('Nama karyawan wajib diisi');

  const emp = await (prisma as any).employee.create({
    data: {
      name: name.trim(),
      email: email?.trim() || null,
      nik: nik || null,
      phone: phone || null,
      address: address || null,
      position: position || null,
      employeeType: employeeType || null,
      joinDate: joinDate ? new Date(joinDate) : null,
      dailyRate: parseFloat(String(dailyRate)) || 0,
      bankName: bankName || null,
      bankAccount: bankAccount || null,
      bankAccountName: bankAccountName || null,
      emergencyContact: emergencyContact || null,
      emergencyPhone: emergencyPhone || null,
      serviceChargeEligible: serviceChargeEligible !== false,
      notes: notes || null,
    },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
  return success(emp, 201);
}, ADMIN_ROLES);

// PATCH — update karyawan atau buat akun user
export const PATCH = withAuth(async (req: NextRequest) => {
  const body = await req.json();
  const { id, action } = body;
  if (!id) return error('id wajib');

  // Action: buat akun login dari data karyawan
  if (action === 'create_account') {
    const emp = await (prisma as any).employee.findUnique({ where: { id } });
    if (!emp) return error('Karyawan tidak ditemukan');
    if (emp.userId) return error('Karyawan sudah punya akun');
    // Pakai email dari Employee kalau tidak di-override
    const { password, role } = body;
    const email = body.email || emp.email;
    if (!email || !password) return error('email dan password wajib');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error('Email sudah digunakan');

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: emp.name,
        email,
        password: hashed,
        role: role || 'STAFF',
        active: true,
      },
    });

    const updated = await (prisma as any).employee.update({
      where: { id },
      data: { userId: user.id },
      include: { user: { select: { id: true, email: true, role: true, active: true } } },
    });
    return success(updated);
  }

  // Action: unlink akun
  if (action === 'unlink_account') {
    const updated = await (prisma as any).employee.update({
      where: { id },
      data: { userId: null },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
    return success(updated);
  }

  // Default: update data karyawan
  const { name, email, nik, phone, address, position, employeeType, joinDate, dailyRate,
          bankName, bankAccount, bankAccountName, emergencyContact, emergencyPhone,
          serviceChargeEligible, notes, active, endDate } = body;

  const updated = await (prisma as any).employee.update({
    where: { id },
    data: {
      ...(name !== undefined        && { name }),
      ...(email !== undefined       && { email: email?.trim() || null }),
      ...(nik !== undefined         && { nik: nik || null }),
      ...(phone !== undefined       && { phone: phone || null }),
      ...(address !== undefined     && { address: address || null }),
      ...(position !== undefined    && { position: position || null }),
      ...(employeeType !== undefined && { employeeType: employeeType || null }),
      ...(joinDate !== undefined    && { joinDate: joinDate ? new Date(joinDate) : null }),
      ...(endDate !== undefined     && { endDate: endDate ? new Date(endDate) : null }),
      ...(dailyRate !== undefined   && { dailyRate: parseFloat(String(dailyRate)) || 0 }),
      ...(bankName !== undefined    && { bankName: bankName || null }),
      ...(bankAccount !== undefined && { bankAccount: bankAccount || null }),
      ...(bankAccountName !== undefined && { bankAccountName: bankAccountName || null }),
      ...(emergencyContact !== undefined && { emergencyContact: emergencyContact || null }),
      ...(emergencyPhone !== undefined   && { emergencyPhone: emergencyPhone || null }),
      ...(serviceChargeEligible !== undefined && { serviceChargeEligible }),
      ...(notes !== undefined       && { notes: notes || null }),
      ...(active !== undefined      && { active }),
    },
    include: { user: { select: { id: true, email: true, role: true, active: true, hasPosAccess: true } } },
  });
  return success(updated);
}, ADMIN_ROLES);

// DELETE — nonaktifkan karyawan (soft delete)
export const DELETE = withAuth(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return error('id wajib');
  await (prisma as any).employee.update({ where: { id }, data: { active: false } });
  return success({ deactivated: true });
}, ADMIN_ROLES);
