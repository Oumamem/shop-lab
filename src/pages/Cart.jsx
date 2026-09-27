import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { usePrefs } from '../context/PrefsContext.jsx';
import { api } from '../lib/api.js';
import { formatPrice, FREE_SHIPPING_THRESHOLD } from '../lib/pricing.js';
import { Alert, EmptyState, QuantityStepper } from '../components/ui.jsx';

export function OrderSummary({ totals, coupon, children, shippingLabel }) {
  const { t } = usePrefs();
  return (
    <section className="card order-summary" aria-labelledby="summary-heading">
      <h2 id="summary-heading">{t('cart.summary')}</h2>
      <dl className="summary-lines">
        <div>
          <dt>{t('cart.subtotal')}</dt>
          <dd data-testid="summary-subtotal">{formatPrice(totals.subtotal)}</dd>
        </div>
        {totals.discount > 0 && (
          <div className="discount">
            <dt>
              {t('cart.discount')} {coupon && <span className="badge">{coupon.code}</span>}
            </dt>
            <dd data-testid="summary-discount">−{formatPrice(totals.discount)}</dd>
          </div>
        )}
        <div>
          <dt>{shippingLabel || t('cart.shipping')}</dt>
          <dd data-testid="summary-shipping">{totals.shipping === 0 ? t('common.free') : formatPrice(totals.shipping)}</dd>
        </div>
        <div className="summary-total">
          <dt>{t('cart.total')}</dt>
          <dd data-testid="summary-total">{formatPrice(totals.total)}</dd>
        </div>
      </dl>
      {children}
    </section>
  );
}

function CouponForm() {
  const { t } = usePrefs();
  const { coupon, applyCoupon, removeCoupon, totals } = useCart();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!code.trim()) return setError('Please enter a coupon code.');
    setBusy(true);
    try {
      const c = await api('/coupons/validate', { method: 'POST', body: { code, subtotal: totals.subtotal } });
      applyCoupon(c);
      setError('');
      setCode('');
      setMessage(`Coupon ${c.code} applied: ${c.description}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (coupon) {
    return (
      <div className="coupon-applied">
        <p>
          Coupon <strong data-testid="applied-coupon">{coupon.code}</strong> – {coupon.description}
        </p>
        {!totals.couponApplied && <Alert type="warning">Add more items to use this coupon (minimum order {formatPrice(coupon.minSubtotal)}).</Alert>}
        {message && <Alert type="success">{message}</Alert>}
        <button type="button" className="link-btn" onClick={() => { removeCoupon(); setMessage(''); }}>
          Remove coupon
        </button>
      </div>
    );
  }

  return (
    <form className="coupon-form" onSubmit={onSubmit} noValidate>
      <label htmlFor="coupon">{t('cart.coupon')}</label>
      <div className="inline-form">
        <input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" aria-invalid={error ? true : undefined} aria-describedby={error ? 'coupon-error' : undefined} />
        <button type="submit" className="btn btn-secondary" disabled={busy}>
          {t('cart.apply')}
        </button>
      </div>
      {error && (
        <p className="field-error" id="coupon-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export default function Cart() {
  const { t } = usePrefs();
  const { items, totals, coupon, updateQty, removeItem } = useCart();

  if (!items.length) {
    return (
      <section className="container">
        <h1>{t('cart.title')}</h1>
        <EmptyState
          title={t('cart.empty')}
          action={
            <Link to="/products" className="btn btn-primary">
              {t('cart.continue')}
            </Link>
          }
        />
      </section>
    );
  }

  const remaining = FREE_SHIPPING_THRESHOLD - totals.subtotal;

  return (
    <section className="container cart-page">
      <h1>{t('cart.title')}</h1>
      {remaining > 0 ? (
        <p className="free-shipping-hint">Add {formatPrice(remaining)} more to get free standard shipping.</p>
      ) : (
        <p className="free-shipping-hint success">You qualify for free standard shipping!</p>
      )}
      <div className="cart-layout">
        <ul className="cart-items" aria-label="Cart items">
          {items.map((item) => (
            <li key={item.key} className="cart-item" data-testid="cart-item">
              <img src={item.image} alt="" width="96" height="96" />
              <div className="cart-item-info">
                <Link to={`/products/${item.productId}`} className="cart-item-name">
                  {item.name}
                </Link>
                {(item.size || item.color) && (
                  <p className="muted">
                    {[item.size && `Size: ${item.size}`, item.color && `Colour: ${item.color}`].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="muted">{formatPrice(item.price)} each</p>
              </div>
              <QuantityStepper label={`Quantity for ${item.name}`} value={item.qty} max={item.maxQty} onChange={(q) => updateQty(item.key, q)} />
              <p className="cart-item-total" data-testid="line-total">
                {formatPrice(item.price * item.qty)}
              </p>
              <button type="button" className="link-btn danger" onClick={() => removeItem(item.key)} aria-label={`Remove ${item.name} from cart`}>
                {t('cart.remove')}
              </button>
            </li>
          ))}
        </ul>
        <div className="cart-side">
          <OrderSummary totals={totals} coupon={coupon} shippingLabel="Shipping (standard)">
            <CouponForm />
            <Link to="/checkout" className="btn btn-primary btn-block">
              {t('cart.checkout')}
            </Link>
            <Link to="/products" className="btn btn-secondary btn-block">
              {t('cart.continue')}
            </Link>
          </OrderSummary>
        </div>
      </div>
    </section>
  );
}
