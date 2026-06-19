'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth, hydrate, user } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (user) {
      router.replace(user.role === 'SUPER_ADMIN' ? '/dashboard' : '/pos');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Login failed');
        return;
      }

      setAuth(data.data.user, data.data.token);
      router.push(data.data.redirect);
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      <div className="relative w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <img src="/soeka-logo.png" alt="Soeka House" className="w-44 mx-auto mb-4 rounded-2xl shadow-lg" />
          <p className="text-surface-400 mt-2 text-sm">Masuk ke akun kamu</p>
        </div>

        {/* Login card */}
        <form onSubmit={handleLogin} className="bg-surface-900 border border-surface-800 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                placeholder="admin@daroverse.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-7 w-full py-3.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all active:scale-[0.98]"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>
                Signing in...
              </span>
            ) : 'Sign in'}
          </button>

          <div className="mt-6 pt-5 border-t border-surface-800">
            <p className="text-surface-500 text-xs text-center">Demo accounts</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setEmail('admin@daroverse.com'); setPassword('admin123'); }}
                className="px-3 py-2 text-xs bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-lg transition-colors"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => { setEmail('cashier@daroverse.com'); setPassword('cashier123'); }}
                className="px-3 py-2 text-xs bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-lg transition-colors"
              >
                Cashier
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
