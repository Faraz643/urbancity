import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/utils/api';
import { X } from './Icons';

export default function BillboardPanel() {
  const billboard = useGameStore((s) => s.selectedBillboard);
  const setBillboardPanelOpen = useGameStore((s) => s.setBillboardPanelOpen);
  const nearbyVisitors = useGameStore((s) => billboard ? s.nearbyBillboards.get(billboard.id) || 0 : 0);
  const user = useAuthStore((s) => s.user);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!billboard) return null;

  const minNextBid = billboard.currentBid ? Number(billboard.currentBid) * 1.05 : Number(billboard.minBid);

  const handlePlaceBid = async () => {
    if (!user) { setError('Please login to place a bid'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const auction = billboard.auctions?.[0];
      if (!auction) { setError('No active auction'); return; }
      await api.post('/bids', { auctionId: auction.id, amount: parseFloat(bidAmount) });
      setSuccess('Bid placed successfully!'); setBidAmount('');
      const res = await api.get(`/billboards/${billboard.id}`);
      useGameStore.getState().setSelectedBillboard(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to place bid');
    } finally { setLoading(false); }
  };

  const trafficEmoji: Record<string, string> = { VERY_LOW: '❄️', LOW: '🌱', MEDIUM: '📊', HIGH: '🔥', VERY_HIGH: '🔥🔥' };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold">{billboard.name}</h2>
              <p className="text-white/60 text-sm mt-1">{billboard.location}</p>
            </div>
            <button onClick={() => setBillboardPanelOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-white/60 text-xs mb-1">Nearby Visitors</div>
              <div className="text-xl font-bold flex items-center gap-2">👥 {nearbyVisitors}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-white/60 text-xs mb-1">Live Traffic</div>
              <div className="text-xl font-bold flex items-center gap-2">{trafficEmoji[billboard.trafficRating] || '📊'} {billboard.trafficRating.replace('_', ' ')}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-white/60 text-xs mb-1">Current Bid</div>
              <div className="text-xl font-bold text-primary-400">₹{(billboard.currentBid || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-white/60 text-xs mb-1">Min Next Bid</div>
              <div className="text-xl font-bold text-accent-400">₹{minNextBid.toLocaleString()}</div>
            </div>
          </div>
          {billboard.campaigns && billboard.campaigns.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white/80 mb-2">Current Advertisement</h3>
              <div className="bg-white/5 rounded-xl p-4">
                <img src={billboard.campaigns[0].advertisement?.imageUrl} alt="Ad" className="w-full h-32 object-cover rounded-lg mb-2" />
                <p className="font-medium">{billboard.campaigns[0].advertisement?.title}</p>
              </div>
            </div>
          )}
          {user && billboard.isAvailable && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Place a Bid</h3>
              <input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`Minimum ₹${minNextBid.toLocaleString()}`} className="input-field" />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {success && <p className="text-green-400 text-sm">{success}</p>}
              <button onClick={handlePlaceBid} disabled={loading} className="btn-primary w-full disabled:opacity-50">
                {loading ? 'Placing Bid...' : 'Place Bid'}
              </button>
            </div>
          )}
          {!user && <div className="text-center py-4"><p className="text-white/60 mb-3">Login to place bids and manage advertisements</p></div>}
        </div>
      </div>
    </div>
  );
}
