'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';

export default function AttendancePage() {
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoModal, setPhotoModal] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    api.get<any[]>(`/api/attendance?date=${date}`)
      .then(setRecords)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  // Group by user
  const grouped = records.reduce((acc: Record<string, any[]>, r: any) => {
    const name = r.user?.name || r.userId;
    if (!acc[name]) acc[name] = [];
    acc[name].push(r);
    return acc;
  }, {});

  const summary = Object.entries(grouped).map(([name, recs]: [string, any[]]) => {
    const checkIn  = recs.find(r => r.type === 'CHECK_IN');
    const checkOut = recs.filter(r => r.type === 'CHECK_OUT').pop();
    let duration = '';
    if (checkIn && checkOut) {
      const diff = Math.round((new Date(checkOut.createdAt).getTime() - new Date(checkIn.createdAt).getTime()) / 60000);
      const h = Math.floor(diff / 60), m = diff % 60;
      duration = `${h}j ${m}m`;
    }
    return { name, checkIn, checkOut, duration, role: recs[0]?.user?.role };
  });

  const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: 'Super Admin', OWNER: 'Owner', MANAGER: 'Manager', STAFF: 'Staff', CASHIER: 'Kasir' };

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Absensi Karyawan</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>{summary.length} karyawan hadir</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="input text-sm py-2"/>
            <a href="/absensi" target="_blank"
              className="btn btn-secondary btn-sm text-xs">🔗 Link Absensi</a>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}/>
          </div>
        ) : summary.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-3xl mb-3">📋</p>
            <p className="font-semibold" style={{ color: 'var(--text-3)' }}>Belum ada absensi hari ini</p>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.map(({ name, checkIn, checkOut, duration, role }) => (
              <div key={name} className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-base flex-shrink-0"
                    style={{ background: 'var(--brand)' }}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold" style={{ color: 'var(--text-1)' }}>{name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{ROLE_LABEL[role] || role}</p>
                  </div>
                  {duration && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                      ⏱ {duration}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Check In */}
                  <div className="rounded-xl p-3 border" style={{ borderColor: '#D1FAE5', background: '#F0FDF4' }}>
                    <p className="text-xs font-bold mb-1 text-green-700">Masuk</p>
                    {checkIn ? (
                      <div>
                        <p className="text-lg font-black text-green-800 tabular-nums">
                          {new Date(checkIn.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {checkIn.photo && (
                          <button onClick={() => setPhotoModal(checkIn.photo)}
                            className="mt-1.5 w-full">
                            <img src={checkIn.photo} alt="selfie masuk"
                              className="w-full h-16 object-cover rounded-lg" style={{ transform: 'scaleX(-1)' }}/>
                          </button>
                        )}
                        {checkIn.latitude && (
                          <a href={`https://maps.google.com/?q=${checkIn.latitude},${checkIn.longitude}`}
                            target="_blank" rel="noopener noreferrer"
                            className="mt-1 flex items-center gap-1 text-xs text-green-600 underline">
                            📍 Lihat peta
                          </a>
                        )}
                      </div>
                    ) : <p className="text-sm text-gray-400">—</p>}
                  </div>

                  {/* Check Out */}
                  <div className="rounded-xl p-3 border" style={{ borderColor: checkOut ? '#FECACA' : '#E5E7EB', background: checkOut ? '#FFF5F5' : '#F9FAFB' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: checkOut ? '#DC2626' : '#9CA3AF' }}>Pulang</p>
                    {checkOut ? (
                      <div>
                        <p className="text-lg font-black tabular-nums" style={{ color: '#DC2626' }}>
                          {new Date(checkOut.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {checkOut.photo && (
                          <button onClick={() => setPhotoModal(checkOut.photo)}
                            className="mt-1.5 w-full">
                            <img src={checkOut.photo} alt="selfie pulang"
                              className="w-full h-16 object-cover rounded-lg" style={{ transform: 'scaleX(-1)' }}/>
                          </button>
                        )}
                        {checkOut.latitude && (
                          <a href={`https://maps.google.com/?q=${checkOut.latitude},${checkOut.longitude}`}
                            target="_blank" rel="noopener noreferrer"
                            className="mt-1 flex items-center gap-1 text-xs text-red-500 underline">
                            📍 Lihat peta
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: '#9CA3AF' }}>Belum pulang</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Photo modal */}
        {photoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPhotoModal('')}>
            <div className="relative max-w-sm w-full">
              <img src={photoModal} alt="selfie" className="w-full rounded-2xl" style={{ transform: 'scaleX(-1)' }}/>
              <button className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">✕</button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
