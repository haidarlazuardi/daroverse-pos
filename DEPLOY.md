# 🚀 Panduan Deploy Daroverse POS — Gratis (Vercel + Neon)

Hasil akhir: POS jalan di internet, kasir akses dari tablet Android (berasa app native),
lu akses dashboard dari laptop/HP mana aja. Biaya: Rp 0.

> ⚠️ Catatan penting sebelum mulai:
> 1. Kalau internet kedai mati, kasir tidak bisa transaksi. Siapkan plan B
>    (catat manual / tethering HP) untuk jaga-jaga.
> 2. Database gratis Neon "tidur" kalau tidak dipakai ±5 menit. Transaksi
>    pertama setelah sepi bisa delay 1-2 detik. Setelah itu normal.
> 3. Vercel Hobby (gratis) secara aturan untuk penggunaan non-komersial.
>    Praktiknya banyak usaha kecil pakai tanpa masalah, tapi kalau nanti
>    Soeka House sudah stabil, upgrade ke Pro ($20/bln) atau pindah hosting.

---

## LANGKAH 0 — Terapkan Update Ini Dulu

Copy semua file dari folder update ini ke project lu (timpa yang lama):

```
src/lib/stock-engine.ts        → ganti
src/lib/auth.ts                → ganti
src/app/api/orders/route.ts    → ganti
src/app/api/purchase-orders/route.ts → ganti
src/app/layout.tsx             → ganti
public/manifest.json           → baru (bikin folder public/ kalau belum ada)
public/icon-192.png            → baru
public/icon-512.png            → baru
```

Tes lokal dulu: `rm -rf .next && npm run build` — harus sukses tanpa error.

---

## LANGKAH 1 — Push ke GitHub

1. Buka **github.com** → daftar/login → klik **New repository**
2. Nama: `daroverse-pos`, set **Private**, klik Create
3. Di terminal, dari folder project:

```bash
cd daroverse-pos

# Pastikan .env TIDAK ikut ke-push (cek file .gitignore ada baris ".env")
echo -e "node_modules\n.next\n.env" > .gitignore

git init
git add .
git commit -m "Daroverse POS - initial"
git branch -M main
git remote add origin https://github.com/USERNAME_LU/daroverse-pos.git
git push -u origin main
```

---

## LANGKAH 2 — Database Gratis di Neon

1. Buka **neon.tech** → Sign up pakai akun GitHub (paling cepat)
2. **Create project** → nama: `daroverse-pos`, region: **Singapore (ap-southeast-1)** ← penting, paling dekat dari Bogor
3. Setelah jadi, di halaman dashboard cari **Connection string**
4. Pilih yang **"Pooled connection"** → copy. Bentuknya:
   ```
   postgresql://user:password@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
5. Simpan string ini — dipakai 2 kali di bawah.

---

## LANGKAH 3 — Isi Database (sekali saja, dari laptop lu)

Di laptop, edit file `.env` di project — ganti `DATABASE_URL` dengan string Neon tadi:

```
DATABASE_URL="postgresql://user:password@ep-xxx-pooler...neon.tech/neondb?sslmode=require"
```

Lalu jalankan:

```bash
npx prisma db push
npx tsx prisma/seed.ts
```

Kalau sukses, muncul "🎉 Seeding complete!" — database online lu sudah terisi
produk, kategori, user admin & kasir.

> Setelah ini, `.env` lokal bisa lu balikin ke database lokal kalau masih mau
> develop di laptop. Database Neon dan lokal itu terpisah.

---

## LANGKAH 4 — Deploy ke Vercel

1. Buka **vercel.com** → Sign up pakai akun GitHub
2. Klik **Add New → Project** → pilih repo `daroverse-pos` → **Import**
3. Di bagian **Environment Variables**, tambahkan 2 variable:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | string Neon (yang pooled) dari Langkah 2 |
   | `JWT_SECRET` | karangan lu sendiri, panjang & acak, misal: `soeka-house-2026-Xk9mP2qR7vN4` |

4. Klik **Deploy** → tunggu ±2 menit
5. Selesai! Lu dapat URL: `https://daroverse-pos-xxx.vercel.app`

Tes: buka URL itu → login `admin@daroverse.com` / `admin123` → harus masuk dashboard.

> 🔒 Setelah berhasil login, SEGERA ganti password default lewat menu Users,
> karena URL ini bisa diakses siapa saja di internet.

---

## LANGKAH 5 — Setup Tablet Android (Kasir)

1. Di tablet, buka **Chrome** → masuk ke `https://daroverse-pos-xxx.vercel.app`
2. Login akun kasir → otomatis masuk halaman POS
3. Tap menu Chrome (⋮) → **"Tambahkan ke layar utama" / "Add to Home Screen"**
4. Akan muncul icon **Daroverse** di home screen tablet
5. Buka dari icon itu → app jalan **fullscreen tanpa address bar**, landscape,
   persis kayak app native (ini berkat manifest PWA yang baru ditambahkan)

Tips tablet kasir:
- Settings → Display → Screen timeout → set 30 menit / Never
- Kunci tablet cuma untuk app ini (Android "Screen pinning" / "App pinning")

## LANGKAH 6 — Dashboard di Laptop/PC

Tinggal buka URL yang sama dari browser laptop → login admin → dashboard.
Bisa dari rumah, dari kedai, dari mana aja.

---

## Update Aplikasi ke Depannya

Setiap kali ada perubahan kode:

```bash
git add .
git commit -m "update fitur X"
git push
```

Vercel otomatis deploy ulang dalam ±2 menit. Gak perlu ngapa-ngapain lagi.

Kalau ada perubahan **schema database** (file `prisma/schema.prisma`),
jalankan juga dari laptop (dengan `.env` menunjuk ke Neon):

```bash
npx prisma db push
```

---

## Yang Berubah di Update Ini (selain deploy-ready)

1. **Checkout 5-10x lebih cepat** — dari 40+ query berurutan jadi ~5 query
   paralel + 1 transaksi. Krusial di hosting cloud yang latency-nya tinggi.
2. **Stok sekarang anti-rusak** — order, payment, dan pemotongan stok terjadi
   dalam SATU transaksi database. Gagal satu = batal semua, gak ada lagi
   order sukses tapi stok gak kepotong.
3. **Double-counting biaya dihapus** — PO completed TIDAK lagi bikin record
   expense. Pembelian bahan = inventory; biayanya diakui saat terjual (COGS).
   Expense sekarang murni untuk opex (listrik, gas, gaji). Net Profit di
   dashboard sekarang angkanya benar.
4. **Login lebih cepat** — bcrypt cost 12→10 (~80ms vs ~400ms). Catatan:
   user lama masih pakai hash lama; kalau mau ikut cepat, re-seed atau
   buat ulang usernya.
5. **COGS konsisten** — perhitungan biaya prepped ingredient sekarang satu
   sumber kebenaran, dipakai checkout maupun recalculation setelah PO.
6. **PWA manifest** — tablet Android bisa install sebagai app fullscreen.

## Checklist Kalau Ada Masalah

| Gejala | Penyebab umum | Solusi |
|--------|--------------|--------|
| Build gagal di Vercel | Prisma generate | Pastikan `postinstall: prisma generate` ada di package.json |
| Error 500 semua API | DATABASE_URL salah | Cek env var di Vercel → Settings → Environment Variables, redeploy |
| Transaksi pertama lambat | Neon tidur | Normal di free tier; transaksi berikutnya cepat |
| Gak bisa login | Belum seed | Ulangi Langkah 3 |
| Icon gak muncul di tablet | Cache | Hapus dan add to home screen ulang |

---

## BONUS — Install Sebagai App Beneran di Tablet (PWA Penuh)

Update ini sudah termasuk **service worker** (`public/sw.js` + `src/components/SWRegister.tsx`).
Akibatnya, setelah deploy:

1. Buka URL Vercel di Chrome tablet
2. Chrome akan menampilkan prompt **"Install app"** (bukan cuma "Add to Home Screen")
3. Tap Install → Chrome men-generate APK otomatis di belakang layar (WebAPK)
4. App muncul di **app drawer** dan **Settings → Apps** seperti app native,
   fullscreen, ada splash screen hijau

> File tambahan yang harus di-copy: `public/sw.js`, `src/components/SWRegister.tsx`,
> dan `src/app/layout.tsx` versi baru (sudah ada registrasi service worker-nya).

### Kalau Mau File APK Fisik (opsional)

Untuk sideload ke banyak tablet atau publish ke Play Store:

1. Deploy dulu sampai jalan di Vercel
2. Buka **pwabuilder.com** → masukkan URL Vercel lu → **Start**
3. Pilih **Android** → Generate → download `.apk` (atau `.aab` untuk Play Store)
4. Sideload APK ke tablet (transfer file → tap → install, izinkan "unknown sources")
5. Play Store opsional: butuh akun developer Google ($25 sekali bayar)

Catatan: APK ini cuma "bungkus" dari web app lu. Update aplikasi tetap lewat
`git push` → Vercel — APK gak perlu di-build ulang, isinya selalu versi terbaru.

### Batasan Offline

Service worker bikin app-nya **terbuka** walau offline, tapi transaksi tetap
butuh internet (data di server). Kalau internet kedai mati: tethering HP.
