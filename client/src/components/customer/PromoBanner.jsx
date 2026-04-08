import { useState } from 'react';
import { X, Megaphone } from 'lucide-react';
import { useBranding } from './BrandingProvider';

export default function PromoBanner() {
  const { branding } = useBranding() || {};
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('promo_dismissed') === '1'; } catch { return false; }
  });

  if (!branding?.promo_banner_text || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem('promo_dismissed', '1'); } catch {}
  };

  const content = (
    <div className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: `${branding.accent_color || '#e94560'}15`, borderLeft: `3px solid ${branding.accent_color || '#e94560'}` }}>
      <Megaphone size={18} style={{ color: branding.accent_color || '#e94560' }} className="flex-shrink-0" aria-hidden="true" />
      <p className="text-sm flex-1 font-medium" style={{ color: branding.accent_color || '#e94560' }}>
        {branding.promo_banner_text}
      </p>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-full hover:bg-black/5 flex-shrink-0"
        aria-label="Dismiss promotion"
      >
        <X size={14} className="text-gray-400" aria-hidden="true" />
      </button>
    </div>
  );

  if (branding.promo_banner_url) {
    return <a href={branding.promo_banner_url} className="block">{content}</a>;
  }

  return content;
}
