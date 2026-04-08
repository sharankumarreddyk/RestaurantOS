import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Plus } from 'lucide-react';
import { get } from '../../api/client';
import useCartStore from '../../store/cartStore';
import { useBranding } from '../../components/customer/BrandingProvider';
import BrandedHeader from '../../components/customer/BrandedHeader';
import HeroBanner from '../../components/customer/HeroBanner';
import PromoBanner from '../../components/customer/PromoBanner';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { FoodTypeBadge } from '../../components/ui/Badge';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import CallWaiterButton from '../../components/customer/CallWaiterButton';
import OrderReadyAlert from '../../components/customer/OrderReadyAlert';
import WaitTimeIndicator from '../../components/customer/WaitTimeIndicator';
import ComboSection from '../../components/customer/ComboSection';
import LanguageSwitcher from '../../components/customer/LanguageSwitcher';

export default function CustomerMenu() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [menuData, setMenuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [foodFilter, setFoodFilter] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [currentLang, setCurrentLang] = useState('en');
  const [selectedCustomizations, setSelectedCustomizations] = useState([]);
  const cart = useCartStore();
  const brandCtx = useBranding();

  useEffect(() => {
    async function fetchMenu() {
      try {
        const data = await get(`/public/menu/${slug}`);
        setMenuData(data);
        if (data.categories?.length) setActiveCategory(data.categories[0].id);
        // Branding is now handled by BrandingProvider — no inline CSS var setting
      } catch (err) {
        console.error('Failed to load menu:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, [slug]);

  const filteredItems = useMemo(() => {
    if (!menuData?.items) return [];
    let items = menuData.items;
    if (activeCategory) items = items.filter((i) => i.category_id === activeCategory);
    if (foodFilter) items = items.filter((i) => i.food_type === foodFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) =>
        i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [menuData, activeCategory, foodFilter, search]);

  const openItemDetail = (item) => {
    setSelectedItem(item);
    setSelectedVariant(item.variants?.find((v) => v.is_default) || item.variants?.[0] || null);
    setSelectedCustomizations([]);
  };

  const handleAddToCart = () => {
    if (!selectedItem) return;
    cart.addItem(selectedItem, selectedVariant, selectedCustomizations, 1);
    setSelectedItem(null);
  };

  const getItemPrice = () => {
    if (!selectedItem) return 0;
    let price = selectedVariant ? parseFloat(selectedVariant.price) : parseFloat(selectedItem.base_price);
    price += selectedCustomizations.reduce((s, c) => s + (c.priceAdjustment || 0), 0);
    return price;
  };

  const currency = menuData?.restaurant?.currency === 'INR' ? '₹' : '$';

  // Translation helper
  const t = (type, id, field) => {
    if (currentLang === 'en' || !menuData?.translations?.[currentLang]) return null;
    return menuData.translations[currentLang]?.[type]?.[id]?.[field] || null;
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="skeleton h-10 w-48" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (!menuData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Restaurant not found</p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Branded header with logo */}
      <BrandedHeader />

      {/* Cover image hero */}
      <HeroBanner />

      {/* Kitchen wait time indicator */}
      <WaitTimeIndicator slug={slug} />

      {/* Combo deals (horizontal scroll) */}
      {menuData.combos?.length > 0 && (
        <ComboSection combos={menuData.combos} currency={currency} />
      )}

      {/* Promotional banner */}
      <PromoBanner />

      {/* Search */}
      <div className="sticky top-0 z-30 px-4 py-3 shadow-sm" style={{ backgroundColor: 'var(--page-bg, #f9fafb)' }}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu..."
            className="search-bar w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-accent"
            aria-label="Search menu items"
          />
        </div>

        {/* Food type filter + language switcher */}
        <div className="flex items-center gap-2 mt-3" role="group" aria-label="Food type filter">
          {/* Language switcher (right-aligned) */}
          {menuData.restaurant?.supportedLanguages?.length > 1 && (
            <LanguageSwitcher
              supportedLanguages={menuData.restaurant.supportedLanguages}
              currentLanguage={currentLang}
              onLanguageChange={setCurrentLang}
            />
          )}
        </div>
        <div className="flex gap-2 mt-2" role="group" aria-label="Food type filter">
          {[
            { value: null, label: 'All' },
            { value: 'veg', label: 'Veg' },
            { value: 'non_veg', label: 'Non-Veg' },
            { value: 'vegan', label: 'Vegan' },
          ].map((f) => (
            <button
              key={f.label}
              onClick={() => setFoodFilter(f.value)}
              aria-pressed={foodFilter === f.value}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                foodFilter === f.value
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="sticky top-[108px] z-20 border-b" style={{ backgroundColor: 'var(--page-bg, white)' }}>
        <div className="flex overflow-x-auto px-4 gap-1 py-2 no-scrollbar" role="tablist" aria-label="Menu categories">
          {menuData.categories.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`category-tab px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'category-tab-active bg-primary text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
              style={{ borderRadius: 'var(--category-radius, 9999px)' }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu items grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => openItemDetail(item)}
            className="menu-item-card cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`${item.name}, ${currency}${parseFloat(item.base_price).toFixed(0)}`}
            onKeyDown={(e) => { if (e.key === 'Enter') openItemDetail(item); }}
          >
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-32 flex items-center justify-center" style={{ backgroundColor: 'var(--card-bg, #f3f4f6)' }}>
                <span className="text-3xl" aria-hidden="true">🍽️</span>
              </div>
            )}
            <div className="p-3">
              <div className="flex items-start justify-between gap-1">
                <FoodTypeBadge type={item.food_type} />
                {item.is_popular && <Badge variant="popular">Popular</Badge>}
              </div>
              <h3 className="menu-item-name font-medium text-sm mt-1 line-clamp-2">{item.name}</h3>
              <div className="flex items-center justify-between mt-2">
                <span className="menu-item-price font-bold text-sm">
                  {currency}{parseFloat(item.base_price).toFixed(0)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.variants?.length || item.customizations?.length) {
                      openItemDetail(item);
                    } else {
                      cart.addItem(item, null, [], 1);
                    }
                  }}
                  className="bg-accent text-white w-8 h-8 rounded-full flex items-center justify-center"
                  aria-label={`Add ${item.name} to cart`}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-muted">No items found</div>
      )}

      {/* Item detail modal */}
      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.name}>
        {selectedItem && (
          <div className="space-y-4">
            {selectedItem.image_url && (
              <img src={selectedItem.image_url} alt="" className="w-full h-48 object-cover rounded-lg" />
            )}
            {selectedItem.description && (
              <p className="text-sm text-muted">{selectedItem.description}</p>
            )}

            {selectedItem.variants?.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Size / Variant</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                        selectedVariant?.id === v.id ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200'
                      }`}
                    >
                      {v.name} — {currency}{parseFloat(v.price).toFixed(0)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedItem.customizations?.map((group) => (
              <div key={group.id}>
                <h4 className="font-medium text-sm mb-2">
                  {group.name}
                  {group.is_required && <span className="text-red-500 ml-1">*</span>}
                </h4>
                <div className="space-y-2">
                  {group.options.map((opt) => {
                    const isSelected = selectedCustomizations.some((c) => c.optionId === opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCustomizations((c) => c.filter((x) => x.optionId !== opt.id));
                          } else {
                            if (group.max_selections === 1) {
                              setSelectedCustomizations((c) => [
                                ...c.filter((x) => x.groupId !== group.id),
                                { groupId: group.id, groupName: group.name, optionId: opt.id, optionName: opt.name, priceAdjustment: parseFloat(opt.price_adjustment) },
                              ]);
                            } else {
                              setSelectedCustomizations((c) => [
                                ...c,
                                { groupId: group.id, groupName: group.name, optionId: opt.id, optionName: opt.name, priceAdjustment: parseFloat(opt.price_adjustment) },
                              ]);
                            }
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                          isSelected ? 'border-accent bg-accent/10' : 'border-gray-200'
                        }`}
                      >
                        <span>{opt.name}</span>
                        {parseFloat(opt.price_adjustment) > 0 && (
                          <span className="text-muted">+{currency}{parseFloat(opt.price_adjustment).toFixed(0)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {selectedItem.allergens?.length > 0 && (
              <div className="text-xs text-muted">
                Allergens: {(typeof selectedItem.allergens === 'string' ? JSON.parse(selectedItem.allergens) : selectedItem.allergens).join(', ')}
              </div>
            )}

            <button onClick={handleAddToCart} className="w-full bg-accent text-white py-3 rounded-xl font-medium text-sm">
              Add to Cart — {currency}{getItemPrice().toFixed(0)}
            </button>
          </div>
        )}
      </Modal>

      {/* Customer notifications: call waiter + order ready alerts */}
      <OrderReadyAlert />
      <CallWaiterButton />

      {/* Cart bar */}
      {cart.getItemCount() > 0 && (
        <div
          onClick={() => navigate(`/r/${slug}/cart`)}
          className="cart-bar fixed bottom-0 left-0 right-0 bg-accent text-white p-4 flex items-center justify-between cursor-pointer z-40"
          role="button"
          tabIndex={0}
          aria-label={`View cart: ${cart.getItemCount()} items, ${currency}${cart.getTotal().toFixed(0)}`}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/r/${slug}/cart`); }}
        >
          <div className="flex items-center gap-3">
            <ShoppingCart size={20} aria-hidden="true" />
            <span className="font-medium">{cart.getItemCount()} items</span>
          </div>
          <span className="font-bold">{currency}{cart.getTotal().toFixed(0)} →</span>
        </div>
      )}
    </div>
  );
}
