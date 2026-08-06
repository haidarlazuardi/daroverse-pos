export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES, ADMIN_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const limit  = parseInt(searchParams.get('limit') || '30');
  const unread = searchParams.get('unread') === 'true';

  const entries = await (prisma as any).logbookEntry.findMany({
    include: {
      reads: { where: { userId: user.userId }, select: { readAt: true } },
    },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });

  const result = entries.map((e: any) => ({
    ...e,
    isRead: e.reads.length > 0,
    reads: undefined,
  }));

  return success(unread ? result.filter((e: any) => !e.isRead) : result);
}, ALL_ROLES);

export const POST = withAuth(async (req: NextRequest, user) => {
  const { title, body, tag = 'INFO' } = await req.json();
  if (!title?.trim()) return error('Judul wajib diisi');

  const entry = await (prisma as any).logbookEntry.create({
    data: {
      userId:   user.userId,
      userName: user.name || '',
      userRole: user.role,
      tag,
      title: title.trim(),
      body:  body?.trim() || null,
      pinned: tag === 'URGENT',
    },
  });
  return success(entry, 201);
}, ALL_ROLES);

export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { id, action } = await req.json();
  if (!id) return error('ID wajib');

  if (action === 'read') {
    await (prisma as any).logbookRead.upsert({
      where: { entryId_userId: { entryId: id, userId: user.userId } },
      create: { entryId: id, userId: user.userId },
      update: {},
    });
    return success({ read: true });
  }

  if (action === 'pin') {
    const entry = await (prisma as any).logbookEntry.update({
      where: { id }, data: { pinned: true },
    });
    return success(entry);
  }

  return error('Action tidak valid');
}, ALL_ROLES);

export const DELETE = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('ID wajib');
  // Only creator or admin can delete
  const entry = await (prisma as any).logbookEntry.findUnique({ where: { id } });
  if (!entry) return error('Entry tidak ditemukan', 404);
  if (entry.userId !== user.userId && !['SUPER_ADMIN','OWNER','MANAGER'].includes(user.role)) {
    return error('Tidak bisa hapus entry orang lain', 403);
  }
  await (prisma as any).logbookEntry.delete({ where: { id } });
  return success({ deleted: true });
}, ADMIN_ROLES);
