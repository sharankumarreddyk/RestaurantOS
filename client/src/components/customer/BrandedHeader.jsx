import { useBranding } from './BrandingProvider';
import useAuthStore from '../../store/authStore';

export default function BrandedHeader({ showTable = true }) {
  const { restaurant, branding } = useBranding() || {};
  const { user } = useAuthStore();

  return (
    <header className="brand-header bg-primary text-white p-4" role="banner">
      <div className="flex items-center gap-3">
        {/* Logo or fallback initial */}
        {branding?.logo_url ? (
          <img
            src={branding.logo_url}
            alt={`${restaurant?.name || 'Restaurant'} logo`}
            className="w-9 h-9 rounded-lg object-contain bg-white/10 p-0.5 flex-shrink-0"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{ backgroundColor: branding?.accent_color || '#e94560' }}
            aria-hidden="true"
          >
            {restaurant?.name?.[0] || '?'}
          </div>
        )}

        <div className="min-w-0">
          <h1 className="text-lg font-bold brand-heading truncate">
            {restaurant?.name || 'Restaurant'}
          </h1>
          {branding?.tagline && (
            <p className="text-xs opacity-70 truncate">{branding.tagline}</p>
          )}
          {showTable && user?.tableNumber && !branding?.tagline && (
            <p className="text-sm opacity-80">Table {user.tableNumber}</p>
          )}
        </div>
      </div>

      {showTable && user?.tableNumber && branding?.tagline && (
        <p className="text-xs opacity-70 mt-1 ml-12">Table {user.tableNumber}</p>
      )}
    </header>
  );
}
