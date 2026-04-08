import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { get } from '../../api/client';

export default function WaitTimeIndicator({ slug }) {
  const [waitData, setWaitData] = useState(null);

  useEffect(() => {
    if (!slug) return;
    get(`/public/wait-time/${slug}`)
      .then(setWaitData)
      .catch(() => {});
  }, [slug]);

  if (!waitData || waitData.busyLevel === 'low') return null;

  const colors = {
    medium: 'bg-amber-50 border-amber-200 text-amber-700',
    high: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={`mx-4 mt-3 px-4 py-2.5 rounded-xl border flex items-center gap-2 text-sm ${colors[waitData.busyLevel]}`}
      role="status" aria-live="polite">
      <Clock size={16} className="flex-shrink-0" aria-hidden="true" />
      <span>{waitData.message}</span>
    </div>
  );
}
