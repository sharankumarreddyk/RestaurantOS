import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, GripVertical, Upload } from 'lucide-react';
import { get, post, put, del } from '../../api/client';
import { FoodTypeBadge } from '../../components/ui/Badge';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ListSkeleton } from '../../components/ui/Skeleton';

export default function MenuManagement() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const { addToast } = useToast();

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', categoryId: '', basePrice: '', prepTimeMinutes: 15,
    foodType: 'veg', isAvailable: true, isPopular: false, isChefSpecial: false,
    allergens: '',
  });
  const [catForm, setCatForm] = useState({ name: '', type: 'mixed' });

  const fetchData = async () => {
    try {
      const cats = await get('/menu/categories');
      setCategories(Array.isArray(cats) ? cats : []);
      const itemData = await get('/menu/items?limit=100');
      setItems(itemData?.data || []);
    } catch (err) {
      addToast('Failed to load menu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredItems = activeCategory
    ? items.filter((i) => i.category_id === activeCategory)
    : items;

  const handleSaveCategory = async () => {
    try {
      if (editingCategory) {
        await put(`/menu/categories/${editingCategory.id}`, catForm);
      } else {
        await post('/menu/categories', catForm);
      }
      await fetchData();
      setShowCategoryForm(false);
      setEditingCategory(null);
      setCatForm({ name: '', type: 'mixed' });
      addToast('Category saved', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await del(`/menu/categories/${id}`);
      await fetchData();
      addToast('Category deleted', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleSaveItem = async () => {
    try {
      const data = {
        ...form,
        categoryId: form.categoryId,
        basePrice: parseFloat(form.basePrice),
        prepTimeMinutes: parseInt(form.prepTimeMinutes, 10),
        allergens: form.allergens ? form.allergens.split(',').map((s) => s.trim()) : [],
      };

      if (editingItem) {
        await put(`/menu/items/${editingItem.id}`, data);
      } else {
        await post('/menu/items', data);
      }
      await fetchData();
      setShowItemForm(false);
      setEditingItem(null);
      resetForm();
      addToast('Item saved', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      await del(`/menu/items/${id}`);
      await fetchData();
      addToast('Item deleted', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const toggleAvailability = async (id) => {
    try {
      await put(`/menu/items/${id}/availability`);
      await fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const resetForm = () => {
    setForm({
      name: '', description: '', categoryId: categories[0]?.id || '', basePrice: '',
      prepTimeMinutes: 15, foodType: 'veg', isAvailable: true, isPopular: false,
      isChefSpecial: false, allergens: '',
    });
  };

  const startEditItem = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description || '',
      categoryId: item.category_id,
      basePrice: item.base_price,
      prepTimeMinutes: item.prep_time_minutes,
      foodType: item.food_type,
      isAvailable: item.is_available,
      isPopular: item.is_popular,
      isChefSpecial: item.is_chef_special,
      allergens: Array.isArray(item.allergens) ? item.allergens.join(', ') : '',
    });
    setShowItemForm(true);
  };

  if (loading) return <div className="p-6"><ListSkeleton rows={8} /></div>;

  const flatCategories = [];
  const flatten = (cats) => {
    for (const cat of cats) {
      flatCategories.push(cat);
      if (cat.children?.length) flatten(cat.children);
    }
  };
  flatten(categories);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Menu Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setCatForm({ name: '', type: 'mixed' }); setEditingCategory(null); setShowCategoryForm(true); }}
            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            + Category
          </button>
          <button
            onClick={() => { resetForm(); setEditingItem(null); setShowItemForm(true); }}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus size={16} className="inline mr-1" /> Add Item
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${!activeCategory ? 'bg-primary text-white' : 'bg-gray-100'}`}
        >
          All ({items.length})
        </button>
        {flatCategories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-1">
            <button
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${activeCategory === cat.id ? 'bg-primary text-white' : 'bg-gray-100'}`}
            >
              {cat.name} ({items.filter((i) => i.category_id === cat.id).length})
            </button>
            <button onClick={() => { setEditingCategory(cat); setCatForm({ name: cat.name, type: cat.type }); setShowCategoryForm(true); }} className="p-1 text-gray-400 hover:text-gray-600">
              <Edit2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Items list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-sm text-gray-500">
            <tr>
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3 hidden md:table-cell">Category</th>
              <th className="text-left p-3">Price</th>
              <th className="text-left p-3 hidden md:table-cell">Prep Time</th>
              <th className="text-center p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <FoodTypeBadge type={item.food_type} />
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <div className="flex gap-1 mt-0.5">
                        {item.is_popular && <Badge variant="popular">Popular</Badge>}
                        {item.is_chef_special && <Badge variant="chef_special">Chef's Special</Badge>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3 hidden md:table-cell text-sm text-gray-500">
                  {flatCategories.find((c) => c.id === item.category_id)?.name || '-'}
                </td>
                <td className="p-3 font-medium text-sm">₹{parseFloat(item.base_price).toFixed(0)}</td>
                <td className="p-3 hidden md:table-cell text-sm text-gray-500">{item.prep_time_minutes}m</td>
                <td className="p-3 text-center">
                  <button onClick={() => toggleAvailability(item.id)}>
                    {item.is_available ? (
                      <Badge variant="available">Available</Badge>
                    ) : (
                      <Badge variant="cancelled">Unavailable</Badge>
                    )}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEditItem(item)} className="p-2 text-gray-400 hover:text-blue-600">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-400">No menu items</div>
        )}
      </div>

      {/* Category Form Modal */}
      <Modal isOpen={showCategoryForm} onClose={() => setShowCategoryForm(false)} title={editingCategory ? 'Edit Category' : 'New Category'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select value={catForm.type} onChange={(e) => setCatForm({ ...catForm, type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm">
              {['mixed', 'veg', 'non_veg', 'vegan', 'egg'].map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveCategory} className="flex-1 bg-accent text-white py-2 rounded-lg text-sm font-medium">Save</button>
            {editingCategory && (
              <button onClick={() => handleDeleteCategory(editingCategory.id)} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm">Delete</button>
            )}
          </div>
        </div>
      </Modal>

      {/* Item Form Modal */}
      <Modal isOpen={showItemForm} onClose={() => setShowItemForm(false)} title={editingItem ? 'Edit Item' : 'New Item'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm h-20 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select category</option>
                {flatCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Price (₹)</label>
              <input type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Food Type</label>
              <select value={form.foodType} onChange={(e) => setForm({ ...form, foodType: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                {['veg', 'non_veg', 'vegan', 'egg'].map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prep Time (min)</label>
              <input type="number" value={form.prepTimeMinutes} onChange={(e) => setForm({ ...form, prepTimeMinutes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Allergens (comma separated)</label>
              <input value={form.allergens} onChange={(e) => setForm({ ...form, allergens: e.target.value })}
                placeholder="e.g. Dairy, Nuts, Gluten"
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPopular} onChange={(e) => setForm({ ...form, isPopular: e.target.checked })} />
              Popular
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isChefSpecial} onChange={(e) => setForm({ ...form, isChefSpecial: e.target.checked })} />
              Chef's Special
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />
              Available
            </label>
          </div>
          <button onClick={handleSaveItem} className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-medium">
            {editingItem ? 'Update Item' : 'Create Item'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
