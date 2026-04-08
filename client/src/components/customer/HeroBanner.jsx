import { useBranding } from './BrandingProvider';

export default function HeroBanner() {
  const { restaurant, branding } = useBranding() || {};

  if (!branding?.cover_image_url) return null;

  return (
    <div className="relative w-full h-44 overflow-hidden">
      <img
        src={branding.cover_image_url}
        alt={`${restaurant?.name || 'Restaurant'} cover`}
        className="w-full h-full object-cover"
        loading="eager"
      />
      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <h2 className="text-xl font-bold brand-heading drop-shadow-sm">
          {restaurant?.name}
        </h2>
        {branding?.tagline && (
          <p className="text-sm opacity-90 mt-0.5 drop-shadow-sm">{branding.tagline}</p>
        )}
      </div>
    </div>
  );
}
