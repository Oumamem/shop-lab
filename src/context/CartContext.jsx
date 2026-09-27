import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { computeTotals, MAX_QTY_PER_ITEM } from '../lib/pricing.js';

const CartContext = createContext(null);
export const CART_KEY = 'shoplab.cart';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY));
    if (saved && Array.isArray(saved.items)) return { items: saved.items, coupon: saved.coupon || null };
  } catch {}
  return { items: [], coupon: null };
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // Keep carts in sync across tabs.
  useEffect(() => {
    const onStorage = (e) => e.key === CART_KEY && setCart(load());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addItem = useCallback(({ product, size = null, color = null, qty = 1, maxQty }) => {
    const key = [product.id, size, color].filter(Boolean).join('-');
    const limit = Math.min(maxQty ?? MAX_QTY_PER_ITEM, MAX_QTY_PER_ITEM);
    setCart((c) => {
      const existing = c.items.find((i) => i.key === key);
      if (existing) {
        return { ...c, items: c.items.map((i) => (i.key === key ? { ...i, qty: Math.min(i.qty + qty, limit) } : i)) };
      }
      const item = { key, productId: product.id, name: product.name, price: product.price, image: product.image || product.images?.[0], size, color, qty: Math.min(qty, limit), maxQty: limit };
      return { ...c, items: [...c.items, item] };
    });
  }, []);

  const updateQty = useCallback((key, qty) => {
    setCart((c) => ({ ...c, items: c.items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(qty, i.maxQty)) } : i)) }));
  }, []);

  const removeItem = useCallback((key) => setCart((c) => ({ ...c, items: c.items.filter((i) => i.key !== key) })), []);
  const applyCoupon = useCallback((coupon) => setCart((c) => ({ ...c, coupon })), []);
  const removeCoupon = useCallback(() => setCart((c) => ({ ...c, coupon: null })), []);
  const clear = useCallback(() => setCart({ items: [], coupon: null }), []);

  const value = useMemo(
    () => ({ items: cart.items, coupon: cart.coupon, totals: computeTotals(cart.items, cart.coupon), addItem, updateQty, removeItem, applyCoupon, removeCoupon, clear }),
    [cart, addItem, updateQty, removeItem, applyCoupon, removeCoupon, clear],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
