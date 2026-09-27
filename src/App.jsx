import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Catalog from './pages/Catalog.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import Share from './pages/Share.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderConfirmation from './pages/OrderConfirmation.jsx';
import Profile from './pages/Profile.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import Forbidden from './pages/Forbidden.jsx';
import NotFound from './pages/NotFound.jsx';

const TITLES = [
  [/^\/$/, 'Home'],
  [/^\/login/, 'Log in'],
  [/^\/register/, 'Sign up'],
  [/^\/forgot-password/, 'Forgot password'],
  [/^\/products\/\d+/, 'Product'],
  [/^\/products/, 'Shop'],
  [/^\/cart/, 'Cart'],
  [/^\/checkout/, 'Checkout'],
  [/^\/orders/, 'Order confirmation'],
  [/^\/profile/, 'Profile'],
  [/^\/admin\/products/, 'Admin · Products'],
  [/^\/admin\/orders/, 'Admin · Orders'],
  [/^\/admin/, 'Admin · Dashboard'],
];

function useDocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = TITLES.find(([re]) => re.test(pathname));
    document.title = match ? `${match[1]} | ShopLab` : 'ShopLab';
    window.scrollTo(0, 0);
  }, [pathname]);
}

export default function App() {
  useDocumentTitle();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="products" element={<Catalog />} />
        <Route path="products/:id" element={<ProductDetails />} />
        <Route path="share/:id" element={<Share />} />
        <Route path="cart" element={<Cart />} />
        <Route element={<ProtectedRoute />}>
          <Route path="checkout" element={<Checkout />} />
          <Route path="orders/:id/confirmation" element={<OrderConfirmation />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route element={<ProtectedRoute role="admin" />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
          </Route>
        </Route>
        <Route path="403" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
