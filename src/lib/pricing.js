// Shared by the client (cart/checkout) and the server (order creation) so totals always match.

export const FREE_SHIPPING_THRESHOLD = 100;
export const MAX_QTY_PER_ITEM = 10;

export const SHIPPING_METHODS = {
  standard: { id: 'standard', label: 'Standard', price: 5.99, days: '5–7 business days' },
  express: { id: 'express', label: 'Express', price: 14.99, days: '1–2 business days' },
};

export const round = (n) => Math.round(n * 100) / 100;

export function formatPrice(n) {
  return `$${Number(n).toFixed(2)}`;
}

export function couponApplies(coupon, subtotal) {
  if (!coupon) return false;
  return !(coupon.minSubtotal && subtotal < coupon.minSubtotal);
}

export function computeTotals(items, coupon = null, shippingMethod = 'standard') {
  const itemCount = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = round(items.reduce((sum, i) => sum + i.price * i.qty, 0));

  const applies = couponApplies(coupon, subtotal);
  let discount = 0;
  if (applies && coupon.type === 'percent') discount = round((subtotal * coupon.value) / 100);
  if (applies && coupon.type === 'fixed') discount = Math.min(coupon.value, subtotal);

  const method = SHIPPING_METHODS[shippingMethod] || SHIPPING_METHODS.standard;
  let shipping = items.length === 0 ? 0 : method.price;
  if (method.id === 'standard' && subtotal >= FREE_SHIPPING_THRESHOLD) shipping = 0;
  if (applies && coupon.type === 'freeship') shipping = 0;

  const total = round(Math.max(0, subtotal - discount + shipping));
  return { itemCount, subtotal, discount: round(discount), shipping, total, couponApplied: applies };
}
