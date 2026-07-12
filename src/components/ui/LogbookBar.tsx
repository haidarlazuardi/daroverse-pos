'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/fetch';
import { useAuthStore } from '@/store';

export function LogbookBar() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [unread, setUnread] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const entries = await api.get<any[]>('/api/logbook?unread=true&limit=10');
        setUnread(entries);
      } catch { /* silent */ }
    }
    load();
    const t = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(t);
  }, [user]);

  if (!unread.length) return null;

  const entry = unread[idx];
  const TAG_COLOR: Record<string, string> = { INFO: '#1D6F99', WARNING: '#D4851A', URGENT: '#C0392B' };
  const TAG_BG:    Record<string, string> = { INFO: '#EBF5FB', WARNING: '#FEF9E7', URGENT: '#FDEDEC' };
  const color = TAG_COLOR[entry.tag] || '#374840';
  const bg    = TAG_BG[entry.tag]    || '#F5F4F0';

  async function dismiss() {
    try {
      await api.patch('/api/logbook', { id: entry.id, action: 'read' });
      const next = unread.filter(e => e.id !== entry.id);
      setUnread(next);
      setIdx(Math.min(idx, next.length - 1));
    } catch { /* silent */ }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm"
      style={{ background: bg, borderBottom: `2px solid ${color}` }}>
      <span className="font-bold text-xs px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: color, color: '#fff' }}>{entry.tag}</span>
      <span className="flex-1 font-semibold truncate" style={{ color }}>{entry.title}</span>
      {entry.body && <span className="hidden sm:block text-xs truncate flex-1" style={{ color }}>{entry.body}</span>}
      <div className="flex items-center gap-2 flex-shrink-0">
        {unread.length > 1 && (
          <span className="text-xs" style={{ color }}>
            {idx + 1}/{unread.length}
            <button onClick={() => setIdx((idx + 1) % unread.length)} className="ml-1 font-bold">›</button>
          </span>
        )}
        <button onClick={() => router.push('/logbook')}
          className="text-xs underline font-semibold" style={{ color }}>Lihat</button>
        <button onClick={dismiss} className="text-xs font-bold opacity-60 hover:opacity-100" style={{ color }}>✕</button>
      </div>
    </div>
  );
}
