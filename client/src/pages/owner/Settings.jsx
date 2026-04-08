import { useState, useEffect } from 'react';
import { get, put, post } from '../../api/client';
import { useToast } from '../../components/ui/Toast';
import { Palette, Type, Image } from 'lucide-react';

const templates = [
  { value: 'modern_minimalist', label: 'Modern Minimalist', colors: ['#1a1a2e', '#16213e', '#e94560'] },
  { value: 'classic_elegant', label: 'Classic Elegant', colors: ['#2c1810', '#4a3228', '#c89b3c'] },
  { value: 'vibrant_colorful', label: 'Vibrant Colorful', colors: ['#6c5ce7', '#a29bfe', '#fd79a8'] },
  { value: 'fast_food_casual', label: 'Fast Food Casual', colors: ['#d63031', '#e17055', '#fdcb6e'] },
  { value: 'fine_dining_premium', label: 'Fine Dining', colors: ['#0a0a0a', '#1a1a2e', '#c89b3c'] },
];

const fonts = ['Inter', 'Playfair Display', 'Poppins', 'Roboto', 'Merriweather'];

export default function Settings() {
  const [tenant, setTenant] = useState(null);
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    async function fetch() {
      try {
        const data = await get('/tenant/profile');
        setTenant(data);
        setBranding(data.branding || {});
      } catch (err) {
        addToast('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  const saveTenant = async () => {
    setSaving(true);
    try {
      await put('/tenant/profile', {
        name: tenant.name,
        address: tenant.address,
        phone: tenant.phone,
        email: tenant.email,
        taxConfig: tenant.tax_config,
        serviceChargePercent: parseFloat(tenant.service_charge_percent) || 0,
        sessionTimeoutMinutes: parseInt(tenant.session_timeout_minutes, 10) || 120,
      });
      addToast('Settings saved', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveBranding = async () => {
    setSaving(true);
    try {
      await put('/tenant/branding', {
        primaryColor: branding.primary_color,
        secondaryColor: branding.secondary_color,
        accentColor: branding.accent_color,
        fontFamily: branding.font_family,
        template: branding.template,
      });
      addToast('Branding saved', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const result = await post('/upload/logo', formData);
      setBranding({ ...branding, logo_url: result.logoUrl });
      await put('/tenant/branding', { logoUrl: result.logoUrl });
      addToast('Logo uploaded', 'success');
    } catch (err) {
      addToast('Upload failed', 'error');
    }
  };

  if (loading) return <div className="p-6"><div className="skeleton h-8 w-48" /></div>;

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Restaurant Info */}
      <section className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold mb-4">Restaurant Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={tenant?.name || ''} onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input value={tenant?.phone || ''} onChange={(e) => setTenant({ ...tenant, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input value={tenant?.email || ''} onChange={(e) => setTenant({ ...tenant, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input value={tenant?.address || ''} onChange={(e) => setTenant({ ...tenant, address: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Service Charge (%)</label>
            <input type="number" value={tenant?.service_charge_percent || 0}
              onChange={(e) => setTenant({ ...tenant, service_charge_percent: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Session Timeout (min)</label>
            <input type="number" value={tenant?.session_timeout_minutes || 120}
              onChange={(e) => setTenant({ ...tenant, session_timeout_minutes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <button onClick={saveTenant} disabled={saving}
          className="mt-4 px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
          Save Changes
        </button>
      </section>

      {/* Branding */}
      <section className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Palette size={18} /> Branding</h2>

        {/* Templates */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Template</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {templates.map((t) => (
              <button key={t.value}
                onClick={() => {
                  setBranding({
                    ...branding,
                    template: t.value,
                    primary_color: t.colors[0],
                    secondary_color: t.colors[1],
                    accent_color: t.colors[2],
                  });
                }}
                className={`p-3 rounded-lg border text-center text-xs ${branding?.template === t.value ? 'border-accent ring-2 ring-accent/20' : ''}`}
              >
                <div className="flex gap-1 justify-center mb-2">
                  {t.colors.map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Primary</label>
            <div className="flex items-center gap-2">
              <input type="color" value={branding?.primary_color || '#1a1a2e'}
                onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer" />
              <input value={branding?.primary_color || '#1a1a2e'}
                onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                className="flex-1 px-2 py-1 border rounded text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Secondary</label>
            <div className="flex items-center gap-2">
              <input type="color" value={branding?.secondary_color || '#16213e'}
                onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer" />
              <input value={branding?.secondary_color || '#16213e'}
                onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                className="flex-1 px-2 py-1 border rounded text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Accent</label>
            <div className="flex items-center gap-2">
              <input type="color" value={branding?.accent_color || '#e94560'}
                onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer" />
              <input value={branding?.accent_color || '#e94560'}
                onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                className="flex-1 px-2 py-1 border rounded text-sm" />
            </div>
          </div>
        </div>

        {/* Font */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1"><Type size={14} className="inline mr-1" />Font Family</label>
          <select value={branding?.font_family || 'Inter'}
            onChange={(e) => setBranding({ ...branding, font_family: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm">
            {fonts.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
          </select>
        </div>

        {/* Logo */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1"><Image size={14} className="inline mr-1" />Logo</label>
          <div className="flex items-center gap-4">
            {branding?.logo_url && (
              <img src={branding.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-lg border" />
            )}
            <label className="px-4 py-2 border rounded-lg text-sm cursor-pointer hover:bg-gray-50">
              Upload Logo
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>
        </div>

        <button onClick={saveBranding} disabled={saving}
          className="px-6 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-50">
          Save Branding
        </button>
      </section>

      {/* Customer Experience */}
      <section className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold mb-4">Customer Experience</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tagline</label>
            <input value={branding?.tagline || ''}
              onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
              placeholder="e.g. Authentic North Indian Cuisine Since 1985"
              maxLength={200}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
            <p className="text-xs text-gray-400 mt-1">Shown below restaurant name on the customer menu</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Promotional Banner</label>
            <input value={branding?.promo_banner_text || ''}
              onChange={(e) => setBranding({ ...branding, promo_banner_text: e.target.value })}
              placeholder="e.g. 20% off all biryanis this week!"
              maxLength={300}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
            <p className="text-xs text-gray-400 mt-1">Displayed as a dismissible banner on the menu page</p>
          </div>

          {branding?.promo_banner_text && (
            <div>
              <label className="block text-sm font-medium mb-1">Banner Link (optional)</label>
              <input value={branding?.promo_banner_url || ''}
                onChange={(e) => setBranding({ ...branding, promo_banner_url: e.target.value })}
                placeholder="https://..."
                maxLength={500}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Cover Image</label>
            <div className="flex items-center gap-4">
              {branding?.cover_image_url && (
                <img src={branding.cover_image_url} alt="Cover" className="w-32 h-20 object-cover rounded-lg border" />
              )}
              <label className="px-4 py-2 border rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                Upload Cover
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  try {
                    const result = await post('/upload/image', formData);
                    setBranding({ ...branding, cover_image_url: result.imageUrl });
                    await put('/tenant/branding', { coverImageUrl: result.imageUrl });
                    addToast('Cover image uploaded', 'success');
                  } catch (err) {
                    addToast('Upload failed', 'error');
                  }
                }} className="hidden" />
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">Displayed as hero banner on the menu page (recommended: 800x400)</p>
          </div>
        </div>

        <button onClick={saveBranding} disabled={saving}
          className="mt-4 px-6 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-50">
          Save Customer Experience
        </button>
      </section>
    </div>
  );
}
