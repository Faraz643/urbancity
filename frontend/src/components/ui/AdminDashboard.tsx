import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [billboards, setBillboards] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') { navigate('/'); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [statsRes, usersRes, billboardsRes, adsRes] = await Promise.all([
        api.get('/admin/stats'), api.get('/admin/users'),
        api.get('/billboards?status=all'), api.get('/admin/advertisements'),
      ]);
      setStats(statsRes.data); setUsers(usersRes.data);
      setBillboards(billboardsRes.data); setAds(adsRes.data);
    } catch (err) { console.error('Failed to load admin data', err); }
  };

  if (!user || user.role !== 'ADMIN') return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <button onClick={() => navigate('/')} className="btn-secondary">Back to City</button>
        </div>
        <div className="flex gap-4 mb-8 border-b border-white/10">
          {['overview', 'users', 'billboards', 'advertisements', 'transactions'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 px-4 capitalize ${activeTab === tab ? 'border-b-2 border-primary-500 text-white' : 'text-white/60'}`}>
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 'overview' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats).map(([key, value]: [string, any]) => (
              <div key={key} className="glass-panel p-6">
                <p className="text-white/60 text-sm capitalize mb-1">{key.replace(/([A-Z])/g, ' $1')}</p>
                <p className="text-3xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'users' && (
          <div className="glass-panel overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5"><tr>
                <th className="text-left p-4 text-sm font-medium text-white/60">User</th>
                <th className="text-left p-4 text-sm font-medium text-white/60">Role</th>
                <th className="text-left p-4 text-sm font-medium text-white/60">Balance</th>
                <th className="text-left p-4 text-sm font-medium text-white/60">Joined</th>
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-white/5">
                    <td className="p-4">{u.displayName || u.username}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${u.role === 'ADMIN' ? 'bg-primary-500/20 text-primary-400' : 'bg-white/10'}`}>{u.role}</span></td>
                    <td className="p-4">₹{(u.wallet?.balance || 0).toLocaleString()}</td>
                    <td className="p-4 text-white/60 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === 'billboards' && (
          <div className="space-y-4">
            {billboards.map((b) => (
              <div key={b.id} className="glass-panel p-4 flex justify-between items-center">
                <div><p className="font-semibold">{b.name}</p><p className="text-sm text-white/60">{b.location}</p></div>
                <div className="text-right"><p className="text-primary-400 font-medium">₹{(b.currentBid || b.minBid).toLocaleString()}</p><p className="text-xs text-white/60">{b.type}</p></div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'advertisements' && (
          <div className="space-y-4">
            {ads.map((ad) => (
              <div key={ad.id} className="glass-panel p-4 flex gap-4">
                <img src={ad.imageUrl} alt="" className="w-24 h-16 object-cover rounded-lg" />
                <div className="flex-1">
                  <p className="font-semibold">{ad.title}</p>
                  <p className="text-sm text-white/60">{ad.user?.username}</p>
                  <span className={`inline-block mt-2 px-2 py-1 rounded text-xs ${ad.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : ad.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{ad.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
