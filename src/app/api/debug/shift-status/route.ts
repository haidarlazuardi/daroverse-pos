export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';

export async function GET() {
  const [openShifts, lastClosed, pendingRequests] = await Promise.all([
    prisma.shift.findMany({
      where: { status: { in: ['OPEN', 'PENDING_CLOSE'] } },
      include: { user: { select: { name: true } } },
      orderBy: { openedAt: 'desc' },
    }),
    prisma.shift.findFirst({
      where: { status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      include: { user: { select: { name: true } } },
    }),
    (prisma as any).purchaseRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        user: { select: { name: true } },
        items: {
          include: {
            ingredient: { select: { name: true } },
            supplyItem: { select: { name: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }).catch(() => []),
  ]);

  return Response.json({
    openShifts: openShifts.map((s: any) => ({
      id: s.id,
      status: s.status,
      openedBy: s.user?.name,
      openedAt: s.openedAt,
      ageHours: Math.round((Date.now() - new Date(s.openedAt).getTime()) / 3600000),
    })),
    lastClosed: lastClosed ? {
      closedAt: lastClosed.closedAt,
      closedBy: (lastClosed as any).user?.name,
      totalSales: lastClosed.totalSales,
      difference: lastClosed.difference,
    } : null,
    pendingPurchaseRequests: pendingRequests.map((r: any) => ({
      id: r.id,
      requestedBy: r.user?.name,
      createdAt: r.createdAt,
      itemCount: r.items.length,
      items: r.items.map((i: any) => ({
        name: i.ingredient?.name || i.supplyItem?.name || '???',
        quantity: i.quantity,
        unit: i.unit,
      })),
    })),
  });
}
