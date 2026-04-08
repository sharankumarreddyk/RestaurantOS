const variants = {
  veg: 'border-green-600 text-green-700',
  non_veg: 'border-red-600 text-red-700',
  vegan: 'border-green-600 text-green-700',
  egg: 'border-amber-500 text-amber-600',
  popular: 'bg-orange-100 text-orange-700 border-orange-200',
  chef_special: 'bg-purple-100 text-purple-700 border-purple-200',
  available: 'bg-green-100 text-green-700',
  occupied: 'bg-red-100 text-red-700',
  reserved: 'bg-blue-100 text-blue-700',
  cleaning: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-orange-100 text-orange-700',
  ready: 'bg-green-100 text-green-700',
  served: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  open: 'bg-blue-100 text-blue-700',
};

export default function Badge({ variant, children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${variants[variant] || 'bg-gray-100 text-gray-700'} ${className}`}>
      {children}
    </span>
  );
}

export function FoodTypeBadge({ type }) {
  const colors = {
    veg: '#22c55e',
    non_veg: '#ef4444',
    vegan: '#22c55e',
    egg: '#f59e0b',
  };
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className="w-3 h-3 border-2 rounded-sm"
        style={{ borderColor: colors[type] || '#666' }}
      >
        <span
          className="block w-1.5 h-1.5 rounded-full m-auto mt-0.5"
          style={{ backgroundColor: colors[type] || '#666' }}
        />
      </span>
    </span>
  );
}
