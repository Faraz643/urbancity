import { useState } from 'react';
import { api } from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';
import { X } from './Icons';

export default function AuthModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login'
        ? { email, password }
        : { email, username, password, displayName: displayName || username };
      const res = await api.post(endpoint, payload);
      login(res.data.token, res.data.user);
      setIsOpen(false);
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally { setLoading(false); }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="fixed top-4 right-20 z-20 glass-panel px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors">
        Login
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{mode === 'login' ? 'Login' : 'Register'}</h2>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" required />
            {mode === 'register' && (
              <>
                <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="input-field" required />
                <input type="text" placeholder="Display Name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-field" />
              </>
            )}
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" required />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>
          <p className="text-center text-sm text-white/60 mt-4">
            {mode === 'login' ? (
              <>No account? <button onClick={() => setMode('register')} className="text-primary-400 hover:underline">Register</button></>
            ) : (
              <>Already have an account? <button onClick={() => setMode('login')} className="text-primary-400 hover:underline">Login</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
