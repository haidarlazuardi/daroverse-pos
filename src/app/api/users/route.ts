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
  const { name, email, password, role, pin, employeeType, dailyRate, bankName, bankAccount, bankAccountName, joinDate } = await req.json();

  if (!name || !email || !password) return error('Name, email, and password are required');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return error('Email already exists');

  const user = await prisma.user.create({
    data: {
      name, email,
      password: await hashPassword(password),
      role: role || 'CASHIER',
      pin: pin || null,
      employeeType: employeeType || null,
      dailyRate: dailyRate || null,
      bankName: bankName || null,
      bankAccount: bankAccount || null,
      bankAccountName: bankAccountName || null,
      joinDate: joinDate ? new Date(joinDate) : null,
    } as any,
    select: { id: true, name: true, email: true, role: true },
  });

  return success(user, 201);
}, SENIOR_ROLES);

export const PATCH = withAuth(async (req) => {
  const { id, name, email, role, password, active, employeeType, dailyRate, bankName, bankAccount, bankAccountName, joinDate } = await req.json();
  if (!id) return error('ID wajib diisi');
  const updateData: any = {};
  if (name !== undefined)            updateData.name            = name;
  if (email !== undefined)           updateData.email           = email;
  if (role !== undefined)            updateData.role            = role;
  if (active !== undefined)          updateData.active          = active;
  if (employeeType !== undefined)    updateData.employeeType    = employeeType;
  if (dailyRate !== undefined)       updateData.dailyRate       = dailyRate;
  if (bankName !== undefined)        updateData.bankName        = bankName;
  if (bankAccount !== undefined)     updateData.bankAccount     = bankAccount;
  if (bankAccountName !== undefined) updateData.bankAccountName = bankAccountName;
  if (joinDate !== undefined)        updateData.joinDate        = joinDate ? new Date(joinDate) : null;
  if (password) {
    updateData.password = await hashPassword(password);
  }
  const user = await prisma.user.update({ where: { id }, data: updateData });
  const { password: _, ...safe } = user as any;
  return success(safe);
}, SENIOR_ROLES);

export const DELETE = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('ID wajib diisi');
  await prisma.user.update({ where: { id }, data: { active: false } });
  return success({ deleted: true });
}, SENIOR_ROLES);
