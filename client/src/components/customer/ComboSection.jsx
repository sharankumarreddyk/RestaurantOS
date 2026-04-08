import { Tag } from 'lucide-react';
import useCartStore from '../../store/cartStore';
import { FoodTypeBadge } from '../ui/Badge';

export default function ComboSection({ combos = [], currency = '₹' }) {
  const cart = useCartStore();

  if (combos.length === 0) return null;

  return (
    <div className="px-4 mt-4">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
        <Tag size={14} aria-hidden="true" /> Combo Deals
      </h2>
      <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar">
        {combos.map((combo) => (
          <div key={combo.id}
            className="menu-item-card flex-shrink-0 w-64 p-3"
            role="article" aria-label={`${combo.name} combo deal`}>
            {combo.image_url && (
              <img src={combo.image_url} alt={combo.name}
                className="w-full h-28 object-cover rounded-lg mb-2" loading="lazy" />
            )}
            <h3 className="font-medium text-sm">{combo.name}</h3>
            {combo.description && (
              <p className="text-xs text-muted mt-0.5 line-clamp-2">{combo.description}</p>
            )}
            <div className="flex items-center gap-1 mt-1 text-xs text-muted">
              {combo.items?.map((item, i) => (
                <span key={i}>
                  {i > 0 && ' + '}
                  <FoodTypeBadge type={item.food_type} />
                  {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.item_name}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <div>
                <span className="font-bold text-sm">{currency}{parseFloat(combo.combo_price).toFixed(0)}</span>
                {combo.savings > 0 && (
                  <span className="text-xs text-green-600 ml-1.5">
                    Save {currency}{combo.savings.toFixed(0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
