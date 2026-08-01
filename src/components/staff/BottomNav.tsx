'use client';
import { usePathname, useRouter } from 'next/navigation';

export default function BottomNav({ hasPosAccess }: { hasPosAccess?: boolean }) {
  const pathname = usePathname();
  const router   = useRouter();

  const tabs = [
    {
      path: '/staff-dashboard',
      label: 'Saya',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      path: '/staff-hub',
      label: 'Kerja',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50"
      style={{ background: 'white', borderTop: '1px solid #E8E2D9', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex">
        {tabs.map(tab => {
          const active = pathname === tab.path;
          return (
            <button key={tab.path} onClick={() => router.push(tab.path)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all active:scale-95"
              style={{ color: active ? '#48654D' : '#A0A0A0' }}>
              {tab.icon(active)}
              <span className="text-xs font-bold">{tab.label}</span>
              {active && <div className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ background: '#48654D' }}/>}
            </button>
          );
        })}
        {hasPosAccess && (
          <button onClick={() => router.push('/pos')}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all active:scale-95"
            style={{ color: '#A0A0A0' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
            <span className="text-xs font-bold">POS</span>
          </button>
        )}
      </div>
    </div>
  );
}
