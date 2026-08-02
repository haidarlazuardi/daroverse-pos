export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, withAuth } from '@/lib/api-helpers';
import { nowWIB, startOfMonthWIB } from '@/lib/wib';

export const GET = withAuth(async (_req: NextRequest) => {
  const checks: { name:string; status:'ok'|'warn'|'error'; message:string; count?:number; items?:string[] }[] = [];
  const ok   = (n:string,m:string)                      => checks.push({name:n,status:'ok',   message:m});
  const warn = (n:string,m:string,c=0,i?:string[])      => checks.push({name:n,status:'warn', message:m,count:c,items:i});
  const fail = (n:string,m:string,c=0,i?:string[])      => checks.push({name:n,status:'error',message:m,count:c,items:i});

  const wib        = nowWIB();
  const monthStart = startOfMonthWIB();
  const yesterday  = new Date(Date.now() - 24*3600*1000);

  await Promise.allSettled([
    // DB
    prisma.$queryRaw`SELECT 1`.then(() => ok('DB Connection','Database terhubung')).catch(() => fail('DB Connection','Tidak bisa konek')),

    // Order tanpa payment
    prisma.order.count({ where:{ status:'COMPLETED', payment:null } }).then(n =>
      n===0 ? ok('Order Payment','Semua completed order punya payment') : warn('Order Payment',`${n} completed order tanpa payment`,n)),

    // Order tanpa nama
    prisma.order.count({ where:{ status:'COMPLETED', billName:null, customerId:null } }).then(n =>
      n===0 ? ok('Nama Customer','Semua order punya nama') : warn('Nama Customer',`${n} order tanpa nama customer`,n)),

    // Stok negatif
    (prisma as any).stockLevel.findMany({ where:{ quantity:{ lt:0 } }, include:{ ingredient:{ select:{ name:true } } }, take:10 }).then((rows: any[]) =>
      rows.length===0 ? ok('Stok Negatif','Tidak ada stok negatif') : warn('Stok Negatif',`${rows.length} bahan stok negatif`,rows.length,
        rows.map((r:any)=>`${r.ingredient.name} @ ${r.location}: ${r.quantity}`))),

    // HPP 0
    prisma.order.count({ where:{ status:'COMPLETED', costTotal:0, total:{ gt:0 } } }).then(n =>
      n===0 ? ok('HPP (costTotal)','Semua order punya HPP') : warn('HPP (costTotal)',`${n} order dengan HPP = 0`,n)),

    // Produk tanpa resep
    prisma.product.count({ where:{ active:true, recipe:null } }).then(n =>
      n===0 ? ok('Resep Produk','Semua produk aktif punya resep') : warn('Resep Produk',`${n} produk aktif tanpa resep`,n)),

    // Bahan tanpa harga
    prisma.ingredient.count({ where:{ active:true, latestPrice:0, type:'RAW' } }).then(n =>
      n===0 ? ok('Harga Bahan','Semua bahan RAW punya harga') : warn('Harga Bahan',`${n} bahan RAW tanpa harga`,n)),

    // Staff tanpa daily rate
    prisma.user.findMany({ where:{ active:true, role:'STAFF', OR:[{ dailyRate:null },{ dailyRate:0 }] }, select:{ name:true } }).then(rows =>
      rows.length===0 ? ok('Daily Rate','Semua staff punya daily rate') : warn('Daily Rate',`${rows.length} staff tanpa daily rate`,rows.length,rows.map((u:any)=>u.name))),

    // Shift lama
    prisma.shift.findFirst({ where:{ status:'OPEN' } }).then(shift => {
      if (!shift) return ok('Shift','Tidak ada shift aktif (di luar jam operasional)');
      const ageH = (Date.now() - new Date(shift.openedAt).getTime()) / 3600000;
      if (ageH > 16) fail('Shift',`Shift sudah ${Math.round(ageH)} jam — kemungkinan lupa ditutup`);
      else ok('Shift',`Ada 1 shift aktif (${Math.round(ageH)} jam)`);
    }),

    // Open bill lama
    prisma.order.count({ where:{ status:'OPEN', createdAt:{ lt:yesterday } } }).then(n =>
      n===0 ? ok('Open Bill','Tidak ada open bill > 24 jam') : warn('Open Bill',`${n} open bill lebih dari 24 jam`,n)),

    // Payroll bulan ini
    (prisma as any).payrollPeriod.findFirst({ where:{ year:wib.getUTCFullYear(), month:wib.getUTCMonth()+1 } }).then((p:any) => {
      if (!p) warn('Payroll',`Payroll ${wib.getUTCMonth()+1}/${wib.getUTCFullYear()} belum digenerate`);
      else if (p.status==='DRAFT') warn('Payroll',`Payroll bulan ini masih DRAFT`);
      else ok('Payroll',`Payroll bulan ini: ${p.status}`);
    }),

    // SC consistency
    prisma.order.findMany({ where:{ status:'COMPLETED', createdAt:{ gte:monthStart } }, select:{ serviceCharge:true, serviceEnabled:true, subtotal:true } }).then(orders => {
      const expected = orders.filter(o=>o.serviceEnabled).reduce((s,o)=>s+o.subtotal*0.05,0);
      const actual   = orders.reduce((s,o)=>s+(o.serviceCharge||0),0);
      const diff = Math.abs(expected-actual);
      if (diff < 1000) ok('SC Pool',`Konsisten (selisih Rp${Math.round(diff)})`);
      else warn('SC Pool',`Selisih Rp${Math.round(diff).toLocaleString('id-ID')} dari expected`);
    }),

    // Duplicate order number
    prisma.order.groupBy({ by:['orderNumber'], having:{ orderNumber:{ _count:{ gt:1 } } } }).then(rows =>
      rows.length===0 ? ok('Order Number','Tidak ada duplicate order number') : fail('Order Number',`${rows.length} duplicate order number`,rows.length)),

    // Void requests pending
    (prisma as any).voidRequest.count({ where:{ status:'PENDING' } }).then((n:number) =>
      n===0 ? ok('Void Request','Tidak ada void request pending') : warn('Void Request',`${n} void request menunggu approval`,n)),

    // Leave pending
    (prisma as any).leave.count({ where:{ status:'PENDING' } }).then((n:number) =>
      n===0 ? ok('Izin/Cuti','Tidak ada pengajuan izin pending') : warn('Izin/Cuti',`${n} pengajuan izin menunggu approval`,n)),
  ]);

  const sorted = [
    ...checks.filter(c=>c.status==='error'),
    ...checks.filter(c=>c.status==='warn'),
    ...checks.filter(c=>c.status==='ok'),
  ];

  return success({
    checks: sorted,
    summary: {
      ok:    checks.filter(c=>c.status==='ok').length,
      warn:  checks.filter(c=>c.status==='warn').length,
      error: checks.filter(c=>c.status==='error').length,
      total: checks.length,
    },
    runAt: new Date().toISOString(),
  });
}, ['SUPER_ADMIN','OWNER','MANAGER']);
