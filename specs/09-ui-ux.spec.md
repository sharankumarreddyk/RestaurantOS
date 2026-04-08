# Spec: UI/UX Requirements

## Overview
Mobile-first responsive design with role-specific interfaces. Theme system supports per-tenant customization.

## Customer-Facing (Mobile Web App)
### Menu Browsing
- Horizontal scrollable category tabs (sticky top)
- Card-based item display with image, name, price, veg/non-veg badge
- Item detail modal: full image, description, variants, customizations
- Search bar with instant filter
- Veg/Non-veg toggle filter
- Loading skeletons for all data-dependent sections

### Cart & Ordering
- Sticky bottom cart summary bar (item count + total)
- Full cart view as slide-up sheet
- Quantity adjustment (+/- buttons, min touch target 44px)
- Customization display per item
- Clear "Place Order" CTA
- Order confirmation with animation

### Order Tracking
- Status timeline: Placed → Confirmed → Preparing → Ready → Served
- Animated status indicator
- Item-level status visibility
- Estimated wait time (based on prep_time_minutes)

## Kitchen Display
- Full-screen dark theme (easy on eyes in kitchen lighting)
- Order cards in columns: New | Preparing | Ready
- Each card: order #, table #, items with customizations, time elapsed
- Large touch targets for status buttons
- Sound notification for new orders (configurable)
- Color-coded priority (time-based: green <10min, yellow 10-20min, red >20min)

## Staff Dashboards
### Waiter
- Table grid showing all tables with status (color-coded)
- Quick-action: tap table → see orders or place new order
- Notification badges for ready orders

### Counter
- Active bills list with table number and total
- Quick payment recording
- Bill detail with print option

### Manager/Owner
- Analytics dashboard with charts
- Menu management interface
- Staff management
- Table management

### Super Admin
- Restaurant list with status
- Create/edit restaurant form
- Global statistics

## Theme System
- CSS custom properties for all theme values
- Theme loaded from tenant branding on app init
- Template class applied to root element
- Smooth transitions on theme changes

## Responsive Breakpoints
- Mobile: < 640px (primary for customers)
- Tablet: 640-1024px (waiters, kitchen)
- Desktop: > 1024px (management, admin)

## Acceptance Criteria
- [ ] Customer menu works smoothly on mobile (iOS Safari, Chrome)
- [ ] Touch targets minimum 44px
- [ ] Kitchen display readable from 3 feet away
- [ ] Theme customization applies to all customer-facing pages
- [ ] Loading states use skeletons, not spinners
- [ ] All interfaces are responsive
