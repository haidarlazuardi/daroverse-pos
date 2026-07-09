'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { api } from '@/lib/fetch';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const router = useRouter();
  const { setAuth } = useAuthStore();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post<any>('/api/auth/login', { email, password });
      setAuth(res.user, res.token);
      router.replace(res.redirect || '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Email atau password salah');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}>

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: 'absolute', top: '-10%', left: '30%',
          width: '600px', height: '600px',
          background: 'radial-gradient(ellipse, rgba(34,197,94,0.08) 0%, transparent 65%)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', right: '20%',
          width: '500px', height: '500px',
          background: 'radial-gradient(ellipse, rgba(74,222,128,0.05) 0%, transparent 65%)',
          borderRadius: '50%',
        }} />
      </div>

      <div className="w-full max-w-[400px] relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--green-2), var(--green))',
              boxShadow: '0 0 40px var(--green-glow), 0 0 80px var(--green-glow-sm)',
            }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-center"
            style={{ color: 'var(--text-1)', letterSpacing: '-0.04em' }}>
            Soeka House
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: 'var(--text-3)' }}>
            Point of Sale System
          </p>
        </div>

        {/* Card */}
        <div className="p-8 rounded-3xl"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-md)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
          }}>
          <h2 className="text-lg font-extrabold mb-1" style={{ color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
            Selamat datang
          </h2>
          <p className="text-sm mb-7" style={{ color: 'var(--text-3)' }}>
            Masuk ke akun kamu untuk melanjutkan
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
              style={{ background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--red)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="nama@email.com" required
                className="input"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="input"
              />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 text-sm font-black rounded-xl transition-all mt-2 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, var(--green-2), var(--green))',
                color: '#000',
                letterSpacing: '-0.01em',
                boxShadow: loading ? 'none' : '0 0 24px var(--green-glow)',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget.style.boxShadow = '0 0 40px var(--green-glow), 0 0 80px var(--green-glow-sm)'); }}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = loading ? 'none' : '0 0 24px var(--green-glow)')}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Masuk...
                </span>
              ) : 'Masuk'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--text-3)' }}>
          Daroverse POS · Soeka House © 2025
        </p>
      </div>
    </div>
  );
}
