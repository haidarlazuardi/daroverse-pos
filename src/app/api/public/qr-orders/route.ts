export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-helpers';

function generateOrderNumber() {
  const now = new Date();
  const d = `${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const r = Math.random().toString(36).slice(2,6).toUpperCase();
  return `QR-${d}-${r}`;
}

// POST — create order from customer
export async function POST(req: NextRequest) {
  try {
    const { tableId, customerName, customerPhone, items } = await req.json();
    if (!customerName?.trim() || !customerPhone?.trim() || !items?.length) {
      return error('Nama, No HP, dan item wajib diisi', 400);
    }

    const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    const order = await (prisma as any).qROrder.create({
      data: {
        orderNumber: generateOrderNumber(),
        tableId: tableId || '1',
        customerName: customerName.trim(),
        customerPhone: customerPhone?.trim() || null,
        status: 'PENDING_PAYMENT',
        items,
        subtotal,
        total: subtotal,
        expiresAt,
      },
    });

    // Auto-cancel after 10 minutes via background check (best effort)
    return success(order, 201);
  } catch (e: any) {
    return error(e.message || 'Gagal membuat order', 500);
  }
}

// PATCH — upload proof or get status
export async function PATCH(req: NextRequest) {
  try {
    const { id, action, proofB64 } = await req.json();
    if (!id || !action) return error('id dan action wajib', 400);

    const order = await (prisma as any).qROrder.findUnique({ where: { id } });
    if (!order) return error('Order tidak ditemukan', 404);

    if (action === 'upload_proof') {
      if (!proofB64) return error('Bukti bayar wajib', 400);
      // Check expired
      if (new Date() > new Date(order.expiresAt)) {
        await (prisma as any).qROrder.update({ where: { id }, data: { status: 'CANCELLED' } });
        return error('Order sudah expired', 400);
      }
      const proofExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const updated = await (prisma as any).qROrder.update({
        where: { id },
        data: { status: 'PAYMENT_UPLOADED', paymentProof: proofB64, proofExpiresAt },
      });
      return success(updated);
    }

    return error('Action tidak valid', 400);
  } catch (e: any) {
    return error(e.message || 'Gagal', 500);
  }
}

// GET — check order status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('id wajib', 400);
  const order = await (prisma as any).qROrder.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, status: true, expiresAt: true, total: true, customerName: true },
  });
  if (!order) return error('Order tidak ditemukan', 404);

  // Auto-cancel if expired
  if (order.status === 'PENDING_PAYMENT' && new Date() > new Date(order.expiresAt)) {
    await (prisma as any).qROrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    return success({ ...order, status: 'CANCELLED' });
  }
  return success(order);
}
