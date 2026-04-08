import bcrypt from 'bcrypt';
import db from '../../config/database.js';
import config from '../../config/index.js';

async function seed() {
  console.log('Seeding database...');

  try {
    // ── Super Admin ───────────────────────────────────────
    const superAdminExists = await db('users').where({ role: 'super_admin' }).first();
    if (!superAdminExists) {
      const hash = await bcrypt.hash(config.superAdmin.password, 12);
      await db('users').insert({
        name: 'Super Admin',
        email: config.superAdmin.email,
        password_hash: hash,
        role: 'super_admin',
        tenant_id: null,
      });
      console.log(`  Super admin created: ${config.superAdmin.email}`);
    }

    // ── Demo Restaurant: Spice Garden ─────────────────────
    let tenant = await db('tenants').where({ slug: 'spice-garden' }).first();
    if (!tenant) {
      [tenant] = await db('tenants').insert({
        name: 'Spice Garden',
        slug: 'spice-garden',
        address: '123 Food Street, Mumbai',
        phone: '+91-9876543210',
        email: 'hello@spicegarden.com',
        currency: 'INR',
        tax_config: JSON.stringify({ cgst: 2.5, sgst: 2.5 }),
        service_charge_percent: 5,
      }).returning('*');

      await db('tenant_branding').insert({
        tenant_id: tenant.id,
        primary_color: '#1a1a2e',
        secondary_color: '#16213e',
        accent_color: '#e94560',
        font_family: 'Poppins',
        template: 'modern_minimalist',
      });

      console.log('  Restaurant "Spice Garden" created');
    }

    // ── Demo Users ────────────────────────────────────────
    const users = [
      { name: 'Raj Kumar', email: 'owner@spicegarden.com', role: 'owner', password: 'Owner@123' },
      { name: 'Priya Sharma', email: 'manager@spicegarden.com', role: 'manager', password: 'Manager@123' },
      { name: 'Amit Waiter', email: 'waiter@spicegarden.com', role: 'waiter', password: 'Waiter@123' },
      { name: 'Chef Rajan', email: 'chef@spicegarden.com', role: 'chef', password: 'Chef@1234' },
      { name: 'Neha Counter', email: 'counter@spicegarden.com', role: 'counter', password: 'Counter@123' },
    ];

    for (const u of users) {
      const exists = await db('users').where({ email: u.email, tenant_id: tenant.id }).first();
      if (!exists) {
        const hash = await bcrypt.hash(u.password, 12);
        await db('users').insert({
          tenant_id: tenant.id,
          name: u.name,
          email: u.email,
          password_hash: hash,
          role: u.role,
        });
      }
    }
    console.log('  Demo users created');

    // ── Categories ────────────────────────────────────────
    const categoryData = [
      { name: 'Appetizers', slug: 'appetizers', type: 'mixed', sort_order: 0 },
      { name: 'Main Course', slug: 'main-course', type: 'mixed', sort_order: 1 },
      { name: 'Breads', slug: 'breads', type: 'veg', sort_order: 2 },
      { name: 'Rice & Biryani', slug: 'rice-biryani', type: 'mixed', sort_order: 3 },
      { name: 'Desserts', slug: 'desserts', type: 'veg', sort_order: 4 },
      { name: 'Beverages', slug: 'beverages', type: 'veg', sort_order: 5 },
    ];

    const categories = {};
    for (const cat of categoryData) {
      let existing = await db('menu_categories').where({ tenant_id: tenant.id, slug: cat.slug }).first();
      if (!existing) {
        [existing] = await db('menu_categories').insert({
          tenant_id: tenant.id,
          ...cat,
        }).returning('*');
      }
      categories[cat.slug] = existing.id;
    }
    console.log('  Categories created');

    // ── Menu Items ────────────────────────────────────────
    const menuItems = [
      // Appetizers
      { category: 'appetizers', name: 'Paneer Tikka', price: 280, food_type: 'veg', prep: 15, popular: true, desc: 'Cottage cheese marinated in spices and grilled to perfection', allergens: ['Dairy'] },
      { category: 'appetizers', name: 'Chicken 65', price: 320, food_type: 'non_veg', prep: 15, popular: true, desc: 'Deep-fried chicken with spicy red chili marinade', allergens: [] },
      { category: 'appetizers', name: 'Veg Spring Rolls', price: 220, food_type: 'veg', prep: 12, popular: false, desc: 'Crispy rolls stuffed with mixed vegetables', allergens: ['Gluten'] },
      { category: 'appetizers', name: 'Fish Amritsari', price: 350, food_type: 'non_veg', prep: 18, popular: false, desc: 'Batter-fried fish with traditional Amritsari spices', allergens: ['Fish', 'Gluten'] },
      { category: 'appetizers', name: 'Hara Bhara Kebab', price: 240, food_type: 'veg', prep: 15, popular: false, desc: 'Spinach and pea patties pan-fried until golden', allergens: [] },

      // Main Course
      { category: 'main-course', name: 'Butter Chicken', price: 380, food_type: 'non_veg', prep: 25, popular: true, chef: true, desc: 'Tender chicken in rich buttery tomato gravy', allergens: ['Dairy'] },
      { category: 'main-course', name: 'Paneer Butter Masala', price: 320, food_type: 'veg', prep: 20, popular: true, desc: 'Paneer cubes in creamy tomato-based gravy', allergens: ['Dairy'] },
      { category: 'main-course', name: 'Dal Makhani', price: 260, food_type: 'veg', prep: 30, popular: true, desc: 'Black lentils slow-cooked with butter and cream', allergens: ['Dairy'] },
      { category: 'main-course', name: 'Chicken Biryani', price: 350, food_type: 'non_veg', prep: 30, popular: true, chef: true, desc: 'Aromatic basmati rice layered with spiced chicken', allergens: [] },
      { category: 'main-course', name: 'Mutton Rogan Josh', price: 450, food_type: 'non_veg', prep: 35, popular: false, desc: 'Kashmiri-style slow-cooked lamb curry', allergens: [] },
      { category: 'main-course', name: 'Palak Paneer', price: 280, food_type: 'veg', prep: 20, popular: false, desc: 'Cottage cheese in creamy spinach gravy', allergens: ['Dairy'] },
      { category: 'main-course', name: 'Chole Bhature', price: 220, food_type: 'veg', prep: 18, popular: false, desc: 'Spiced chickpeas served with fluffy fried bread', allergens: ['Gluten'] },

      // Breads
      { category: 'breads', name: 'Butter Naan', price: 60, food_type: 'veg', prep: 8, popular: true, desc: 'Soft leavened bread brushed with butter', allergens: ['Gluten', 'Dairy'] },
      { category: 'breads', name: 'Garlic Naan', price: 80, food_type: 'veg', prep: 8, popular: true, desc: 'Naan topped with garlic and cilantro', allergens: ['Gluten', 'Dairy'] },
      { category: 'breads', name: 'Tandoori Roti', price: 40, food_type: 'veg', prep: 6, popular: false, desc: 'Whole wheat bread baked in tandoor', allergens: ['Gluten'] },
      { category: 'breads', name: 'Cheese Naan', price: 100, food_type: 'veg', prep: 10, popular: false, desc: 'Naan stuffed with melted cheese', allergens: ['Gluten', 'Dairy'] },

      // Rice
      { category: 'rice-biryani', name: 'Jeera Rice', price: 160, food_type: 'veg', prep: 12, popular: false, desc: 'Cumin-tempered basmati rice', allergens: [] },
      { category: 'rice-biryani', name: 'Veg Biryani', price: 280, food_type: 'veg', prep: 25, popular: false, desc: 'Fragrant rice with mixed vegetables and spices', allergens: [] },

      // Desserts
      { category: 'desserts', name: 'Gulab Jamun', price: 120, food_type: 'veg', prep: 5, popular: true, desc: 'Deep-fried milk dumplings in sugar syrup', allergens: ['Dairy'] },
      { category: 'desserts', name: 'Rasmalai', price: 150, food_type: 'veg', prep: 5, popular: false, desc: 'Soft paneer balls soaked in sweetened milk', allergens: ['Dairy'] },
      { category: 'desserts', name: 'Kulfi', price: 100, food_type: 'veg', prep: 5, popular: false, desc: 'Traditional Indian ice cream with pistachios', allergens: ['Dairy', 'Nuts'] },

      // Beverages
      { category: 'beverages', name: 'Masala Chai', price: 60, food_type: 'veg', prep: 5, popular: true, desc: 'Indian spiced tea with milk', allergens: ['Dairy'] },
      { category: 'beverages', name: 'Mango Lassi', price: 120, food_type: 'veg', prep: 5, popular: true, desc: 'Sweet yogurt drink blended with mango', allergens: ['Dairy'] },
      { category: 'beverages', name: 'Fresh Lime Soda', price: 80, food_type: 'veg', prep: 3, popular: false, desc: 'Refreshing lime juice with soda water', allergens: [] },
      { category: 'beverages', name: 'Cold Coffee', price: 140, food_type: 'veg', prep: 5, popular: false, desc: 'Chilled coffee blended with ice cream', allergens: ['Dairy'] },
    ];

    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      const slug = item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const exists = await db('menu_items').where({ tenant_id: tenant.id, slug }).first();
      if (!exists) {
        const [created] = await db('menu_items').insert({
          tenant_id: tenant.id,
          category_id: categories[item.category],
          name: item.name,
          slug,
          description: item.desc,
          base_price: item.price,
          food_type: item.food_type,
          prep_time_minutes: item.prep,
          is_popular: item.popular || false,
          is_chef_special: item.chef || false,
          allergens: JSON.stringify(item.allergens || []),
          sort_order: i,
        }).returning('*');

        // Add variants for select items
        if (item.name === 'Chicken Biryani' || item.name === 'Veg Biryani') {
          await db('item_variants').insert([
            { menu_item_id: created.id, name: 'Regular', price: item.price, is_default: true, sort_order: 0 },
            { menu_item_id: created.id, name: 'Family Pack', price: item.price * 2.5, is_default: false, sort_order: 1 },
          ]);
        }

        // Add spice level customization for main course
        if (item.category === 'main-course') {
          const [group] = await db('customization_groups').insert({
            menu_item_id: created.id,
            name: 'Spice Level',
            min_selections: 0,
            max_selections: 1,
            is_required: false,
          }).returning('*');

          await db('customization_options').insert([
            { group_id: group.id, name: 'Mild', price_adjustment: 0, is_default: false, sort_order: 0 },
            { group_id: group.id, name: 'Medium', price_adjustment: 0, is_default: true, sort_order: 1 },
            { group_id: group.id, name: 'Spicy', price_adjustment: 0, is_default: false, sort_order: 2 },
            { group_id: group.id, name: 'Extra Spicy', price_adjustment: 20, is_default: false, sort_order: 3 },
          ]);
        }
      }
    }
    console.log('  Menu items created with variants and customizations');

    // ── Tables ────────────────────────────────────────────
    for (let i = 1; i <= 12; i++) {
      const exists = await db('tables').where({ tenant_id: tenant.id, table_number: i }).first();
      if (!exists) {
        const labels = {
          1: 'Window', 2: 'Window', 3: 'Center', 4: 'Center',
          5: 'Center', 6: 'Center', 7: 'Patio', 8: 'Patio',
          9: 'Private', 10: 'Private', 11: 'Bar', 12: 'Bar',
        };
        const capacities = {
          1: 2, 2: 2, 3: 4, 4: 4, 5: 4, 6: 6, 7: 4, 8: 4, 9: 6, 10: 8, 11: 2, 12: 2,
        };
        await db('tables').insert({
          tenant_id: tenant.id,
          table_number: i,
          label: labels[i],
          capacity: capacities[i],
        });
      }
    }
    console.log('  12 tables created');

    // ── Second Demo Restaurant: The Brew House ────────────
    let tenant2 = await db('tenants').where({ slug: 'brew-house' }).first();
    if (!tenant2) {
      [tenant2] = await db('tenants').insert({
        name: 'The Brew House',
        slug: 'brew-house',
        address: '456 Cafe Lane, Bangalore',
        phone: '+91-9876543211',
        email: 'hello@brewhouse.com',
        currency: 'INR',
        tax_config: JSON.stringify({ cgst: 2.5, sgst: 2.5 }),
        service_charge_percent: 0,
      }).returning('*');

      await db('tenant_branding').insert({
        tenant_id: tenant2.id,
        primary_color: '#2c1810',
        secondary_color: '#4a3228',
        accent_color: '#c89b3c',
        font_family: 'Playfair Display',
        template: 'classic_elegant',
      });

      const hash = await bcrypt.hash('Owner@123', 12);
      await db('users').insert({
        tenant_id: tenant2.id,
        name: 'Vikram Singh',
        email: 'owner@brewhouse.com',
        password_hash: hash,
        role: 'owner',
      });

      console.log('  Restaurant "The Brew House" created');
    }

    console.log('\nSeed complete! Test credentials:');
    console.log('──────────────────────────────────');
    console.log(`Super Admin:  ${config.superAdmin.email} / ${config.superAdmin.password}`);
    console.log('Owner:        owner@spicegarden.com / Owner@123');
    console.log('Manager:      manager@spicegarden.com / Manager@123');
    console.log('Waiter:       waiter@spicegarden.com / Waiter@123');
    console.log('Chef:         chef@spicegarden.com / Chef@1234');
    console.log('Counter:      counter@spicegarden.com / Counter@123');
    console.log('──────────────────────────────────');

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
