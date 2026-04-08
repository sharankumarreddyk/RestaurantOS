import { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get } from '../../api/client';

const BrandingContext = createContext(null);

export function useBranding() {
  return useContext(BrandingContext);
}

export default function BrandingProvider({ children }) {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const result = await get(`/public/tenant/${slug}`);
        if (!cancelled) setData(result);
      } catch {
        // branding fetch failure — continue with defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Apply branding to DOM
  useEffect(() => {
    if (!data) return;
    const b = data.branding;
    const root = document.documentElement;

    // CSS custom properties
    if (b?.primary_color) root.style.setProperty('--color-primary', b.primary_color);
    if (b?.secondary_color) root.style.setProperty('--color-secondary', b.secondary_color);
    if (b?.accent_color) root.style.setProperty('--color-accent', b.accent_color);
    if (b?.font_family) root.style.setProperty('--font-brand', b.font_family);

    // Page title
    document.title = data.name || 'Restaurant';

    // Theme-color meta tag (affects mobile browser chrome)
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = b?.primary_color || '#1a1a2e';

    // Dynamic favicon
    if (b?.favicon_url || b?.logo_url) {
      let link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = b.favicon_url || b.logo_url;
    }

    // Cleanup on unmount
    return () => {
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-secondary');
      root.style.removeProperty('--color-accent');
      root.style.removeProperty('--font-brand');
      document.title = 'RestaurantOS';
    };
  }, [data]);

  const templateClass = data?.branding?.template
    ? `template-${data.branding.template}`
    : 'template-modern_minimalist';

  if (loading) {
    // Branded splash screen
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        {data?.branding?.logo_url ? (
          <img src={data.branding.logo_url} alt="" className="w-16 h-16 rounded-xl mb-4 object-contain" />
        ) : (
          <div className="w-16 h-16 rounded-xl mb-4 bg-primary flex items-center justify-center text-white text-2xl font-bold">
            {data?.name?.[0] || '?'}
          </div>
        )}
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" role="status" aria-label="Loading restaurant" />
        {data?.name && <p className="mt-3 text-sm text-gray-500">{data.name}</p>}
      </div>
    );
  }

  const contextValue = {
    restaurant: data ? {
      id: data.id,
      name: data.name,
      slug: data.slug,
      address: data.address,
      phone: data.phone,
      currency: data.currency || 'INR',
    } : null,
    branding: data?.branding || {},
  };

  return (
    <BrandingContext.Provider value={contextValue}>
      <div className={`${templateClass} brand-page font-brand`}>
        {children}
      </div>
    </BrandingContext.Provider>
  );
}
