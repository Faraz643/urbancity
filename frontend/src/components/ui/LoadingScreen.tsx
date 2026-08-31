import { useState, useEffect } from 'react';

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + Math.random() * 15;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-sky-400 to-sky-200 flex flex-col items-center justify-center z-50">
      <div className="text-6xl font-bold text-white mb-4 drop-shadow-lg">AdCity</div>
      <div className="text-xl text-white/80 mb-8">Loading your digital city...</div>
      <div className="w-64 h-2 bg-white/30 rounded-full overflow-hidden">
        <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <div className="mt-4 text-white/60 text-sm">{Math.min(Math.round(progress), 100)}%</div>
    </div>
  );
}
