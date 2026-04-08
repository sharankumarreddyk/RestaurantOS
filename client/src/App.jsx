import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import useAuthStore from './store/authStore';

// Layout — not lazy (needed immediately)
import StaffLayout from './components/layout/StaffLayout';
import BrandingProvider from './components/customer/BrandingProvider';

// Lazy-loaded pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const CustomerSession = lazy(() => import('./pages/customer/CustomerSession'));
const CustomerMenu = lazy(() => import('./pages/customer/CustomerMenu'));
const Cart = lazy(() => import('./pages/customer/Cart'));
const OrderTracking = lazy(() => import('./pages/customer/OrderTracking'));
const KitchenDisplay = lazy(() => import('./pages/kitchen/KitchenDisplay'));
const Dashboard = lazy(() => import('./pages/owner/Dashboard'));
const MenuManagement = lazy(() => import('./pages/manager/MenuManagement'));
const TableOverview = lazy(() => import('./pages/waiter/TableOverview'));
const OrderList = lazy(() => import('./pages/manager/OrderList'));
const BillingPage = lazy(() => import('./pages/counter/BillingPage'));
const Analytics = lazy(() => import('./pages/owner/Analytics'));
const StaffManagement = lazy(() => import('./pages/owner/StaffManagement'));
const Settings = lazy(() => import('./pages/owner/Settings'));
const SuperAdmin = lazy(() => import('./pages/admin/SuperAdmin'));
const InventoryPage = lazy(() => import('./pages/manager/InventoryPage'));
const ReservationsPage = lazy(() => import('./pages/manager/ReservationsPage'));
const CafeOperatorDashboard = lazy(() => import('./pages/cafe/CafeOperatorDashboard'));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" role="status" aria-label="Loading" />
        <p className="mt-3 text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary message="The application encountered an error. Please refresh the page.">
        <ToastProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />

              {/* Customer routes — all wrapped in BrandingProvider for consistent branding */}
              <Route path="/r/:slug/t/:tableId" element={
                <BrandingProvider>
                  <ErrorBoundary message="Failed to start your session. Please scan the QR code again.">
                    <CustomerSession />
                  </ErrorBoundary>
                </BrandingProvider>
              } />
              <Route path="/r/:slug" element={
                <BrandingProvider>
                  <ErrorBoundary message="Menu failed to load. Pull down to refresh.">
                    <CustomerMenu />
                  </ErrorBoundary>
                </BrandingProvider>
              } />
              <Route path="/r/:slug/cart" element={
                <BrandingProvider><Cart /></BrandingProvider>
              } />
              <Route path="/r/:slug/orders" element={
                <BrandingProvider><OrderTracking /></BrandingProvider>
              } />

              {/* Kitchen (full-screen, no sidebar — wrapped in own ErrorBoundary) */}
              <Route path="/kitchen" element={
                <ProtectedRoute roles={['super_admin', 'owner', 'manager', 'chef']}>
                  <ErrorBoundary message="Kitchen display error. Orders are still being received — please refresh.">
                    <KitchenDisplay />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />

              {/* Staff routes (with sidebar) */}
              <Route element={
                <ProtectedRoute roles={['super_admin', 'owner', 'manager', 'waiter', 'counter', 'cafe_operator']}>
                  <StaffLayout />
                </ProtectedRoute>
              }>
                <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                <Route path="/menu" element={<ErrorBoundary><MenuManagement /></ErrorBoundary>} />
                <Route path="/tables" element={<ErrorBoundary><TableOverview /></ErrorBoundary>} />
                <Route path="/orders" element={<ErrorBoundary><OrderList /></ErrorBoundary>} />
                <Route path="/billing" element={<ErrorBoundary><BillingPage /></ErrorBoundary>} />
                <Route path="/analytics" element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
                <Route path="/staff" element={<ErrorBoundary><StaffManagement /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                <Route path="/inventory" element={<ErrorBoundary><InventoryPage /></ErrorBoundary>} />
                <Route path="/reservations" element={<ErrorBoundary><ReservationsPage /></ErrorBoundary>} />
                <Route path="/cafe" element={<ErrorBoundary><CafeOperatorDashboard /></ErrorBoundary>} />
              </Route>

              {/* Super Admin routes */}
              <Route element={
                <ProtectedRoute roles={['super_admin']}>
                  <StaffLayout />
                </ProtectedRoute>
              }>
                <Route path="/admin" element={<ErrorBoundary><SuperAdmin /></ErrorBoundary>} />
                <Route path="/admin/restaurants" element={<ErrorBoundary><SuperAdmin /></ErrorBoundary>} />
              </Route>

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
