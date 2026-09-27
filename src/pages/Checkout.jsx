import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { usePrefs } from '../context/PrefsContext.jsx';
import { api } from '../lib/api.js';
import { computeTotals, formatPrice, SHIPPING_METHODS, FREE_SHIPPING_THRESHOLD } from '../lib/pricing.js';
import { Alert, EmptyState, Field } from '../components/ui.jsx';
import DatePicker, { toIso } from '../components/DatePicker.jsx';
import { OrderSummary } from './Cart.jsx';

const STEPS = ['Address', 'Shipping', 'Payment', 'Review'];
const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'France', 'Germany', 'Morocco', 'Tunisia', 'United Arab Emirates'];

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toIso(d);
};

function validateAddress(a) {
  const e = {};
  if (a.fullName.trim().length < 2) e.fullName = 'Full name is required';
  if (!a.street.trim()) e.street = 'Street address is required';
  if (!a.city.trim()) e.city = 'City is required';
  if (!a.postalCode.trim()) e.postalCode = 'Postal code is required';
  else if (!/^[A-Za-z0-9 -]{3,10}$/.test(a.postalCode.trim())) e.postalCode = 'Please enter a valid postal code';
  if (!a.country) e.country = 'Please select a country';
  if (a.phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(a.phone.trim())) e.phone = 'Please enter a valid phone number';
  return e;
}

function Stepper({ step }) {
  return (
    <ol className="stepper-nav" aria-label="Checkout progress">
      {STEPS.map((label, i) => (
        <li key={label} className={i < step ? 'done' : i === step ? 'current' : ''} aria-current={i === step ? 'step' : undefined}>
          <span className="step-index" aria-hidden="true">
            {i < step ? '✓' : i + 1}
          </span>
          <span>{label}</span>
          {i < step && <span className="visually-hidden"> (completed)</span>}
        </li>
      ))}
    </ol>
  );
}

function AddressStep({ value, onChange, onNext }) {
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const errs = validateAddress(value);
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`addr-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    onNext();
  };
  return (
    <form onSubmit={submit} noValidate aria-labelledby="step-heading">
      <h2 id="step-heading" tabIndex={-1}>
        Shipping address
      </h2>
      <Field label="Full name" error={errors.fullName} id="addr-fullName">
        {(p) => <input {...p} autoComplete="name" value={value.fullName} onChange={set('fullName')} />}
      </Field>
      <Field label="Street address" error={errors.street} id="addr-street">
        {(p) => <input {...p} autoComplete="street-address" value={value.street} onChange={set('street')} />}
      </Field>
      <div className="form-grid">
        <Field label="City" error={errors.city} id="addr-city">
          {(p) => <input {...p} autoComplete="address-level2" value={value.city} onChange={set('city')} />}
        </Field>
        <Field label="Postal code" error={errors.postalCode} id="addr-postalCode">
          {(p) => <input {...p} autoComplete="postal-code" value={value.postalCode} onChange={set('postalCode')} />}
        </Field>
      </div>
      <div className="form-grid">
        <Field label="Country" error={errors.country} id="addr-country">
          {(p) => (
            <select {...p} autoComplete="country-name" value={value.country} onChange={set('country')}>
              <option value="">Select a country</option>
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Phone (optional)" error={errors.phone} id="addr-phone">
          {(p) => <input {...p} type="tel" autoComplete="tel" value={value.phone} onChange={set('phone')} />}
        </Field>
      </div>
      <div className="step-actions">
        <Link to="/cart" className="btn btn-secondary">
          Back to cart
        </Link>
        <button type="submit" className="btn btn-primary">
          Continue to shipping
        </button>
      </div>
    </form>
  );
}

function ShippingStep({ value, onChange, onNext, onBack, subtotal }) {
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!value.deliveryDate) {
      setError('Please choose a delivery date');
      return;
    }
    onNext();
  };
  return (
    <form onSubmit={submit} noValidate aria-labelledby="step-heading">
      <h2 id="step-heading" tabIndex={-1}>
        Shipping method
      </h2>
      <fieldset className="shipping-options">
        <legend>Choose a shipping speed</legend>
        {Object.values(SHIPPING_METHODS).map((m) => {
          const price = m.id === 'standard' && subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : m.price;
          return (
            <label key={m.id} className={`shipping-option ${value.method === m.id ? 'selected' : ''}`}>
              <input type="radio" name="shipping" value={m.id} checked={value.method === m.id} onChange={() => onChange({ ...value, method: m.id })} />
              <span className="shipping-option-label">
                <strong>{m.label}</strong>
                <span className="muted">{m.days}</span>
              </span>
              <span className="shipping-option-price">{price === 0 ? 'Free' : formatPrice(price)}</span>
            </label>
          );
        })}
      </fieldset>
      <DatePicker
        label="Delivery date"
        value={value.deliveryDate}
        onChange={(d) => {
          onChange({ ...value, deliveryDate: d });
          setError('');
        }}
        min={addDays(1)}
        max={addDays(60)}
        error={error}
        describedBy={error ? 'delivery-error' : 'delivery-hint'}
      />
      <p className="field-hint" id="delivery-hint">
        Choose any day from tomorrow up to 60 days ahead.
      </p>
      {error && (
        <p className="field-error" id="delivery-error">
          {error}
        </p>
      )}
      <div className="step-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn btn-primary">
          Continue to payment
        </button>
      </div>
    </form>
  );
}

function PaymentStep({ card, onCard, onNext, onBack }) {
  const { theme } = usePrefs();
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(!card);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'shoplab:card-saved') return;
      onCard(e.data.card);
      setEditing(false);
      setError('');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onCard]);

  const submit = (e) => {
    e.preventDefault();
    if (!card) {
      setError('Please enter and save your card details');
      return;
    }
    onNext();
  };

  return (
    <form onSubmit={submit} noValidate aria-labelledby="step-heading">
      <h2 id="step-heading" tabIndex={-1}>
        Payment
      </h2>
      <p className="muted">Card details are entered in a secure payment frame. Use 4242 4242 4242 4242 for a successful payment, or 4000 0000 0000 0002 for a declined card.</p>
      {card && !editing ? (
        <div className="saved-card" data-testid="saved-card">
          <p>
            <strong>{card.brand}</strong> ending in <strong>{card.last4}</strong> (expires {card.expiry})
          </p>
          <button type="button" className="link-btn" onClick={() => setEditing(true)}>
            Use a different card
          </button>
        </div>
      ) : (
        <iframe title="Secure payment form" className="payment-frame" src={`/payment-frame.html?theme=${theme}`} />
      )}
      {error && <Alert>{error}</Alert>}
      <div className="step-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn btn-primary">
          Review order
        </button>
      </div>
    </form>
  );
}

function ReviewStep({ address, shipping, card, items, totals, coupon, onBack, onEdit, onPlace, placing, error }) {
  return (
    <div aria-labelledby="step-heading">
      <h2 id="step-heading" tabIndex={-1}>
        Review your order
      </h2>
      <div className="review-grid">
        <section className="review-block" aria-labelledby="rev-address">
          <h3 id="rev-address">Shipping address</h3>
          <address>
            {address.fullName}
            <br />
            {address.street}
            <br />
            {address.city} {address.postalCode}
            <br />
            {address.country}
          </address>
          <button type="button" className="link-btn" onClick={() => onEdit(0)}>
            Edit address
          </button>
        </section>
        <section className="review-block" aria-labelledby="rev-shipping">
          <h3 id="rev-shipping">Delivery</h3>
          <p>
            {SHIPPING_METHODS[shipping.method].label} – {new Date(`${shipping.deliveryDate}T00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <button type="button" className="link-btn" onClick={() => onEdit(1)}>
            Edit delivery
          </button>
        </section>
        <section className="review-block" aria-labelledby="rev-payment">
          <h3 id="rev-payment">Payment</h3>
          <p>
            {card.brand} ending in {card.last4}
          </p>
          <button type="button" className="link-btn" onClick={() => onEdit(2)}>
            Edit payment
          </button>
        </section>
      </div>
      <h3>Items</h3>
      <ul className="review-items">
        {items.map((i) => (
          <li key={i.key}>
            <span>
              {i.qty} × {i.name}
              {i.size && ` (size ${i.size})`}
              {i.color && ` (${i.color})`}
            </span>
            <span>{formatPrice(i.price * i.qty)}</span>
          </li>
        ))}
      </ul>
      {coupon && !totals.couponApplied && <Alert type="warning">Coupon {coupon.code} does not apply to this order.</Alert>}
      <Alert data-testid="place-order-error">{error}</Alert>
      <div className="step-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={placing}>
          Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={onPlace} disabled={placing}>
          {placing ? 'Placing order…' : `Place order · ${formatPrice(totals.total)}`}
        </button>
      </div>
    </div>
  );
}

export default function Checkout() {
  const { user } = useAuth();
  const { items, coupon, clear } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState({ fullName: user?.name || '', street: '', city: '', postalCode: '', country: '', phone: user?.phone || '' });
  const [shipping, setShipping] = useState({ method: 'standard', deliveryDate: '' });
  const [card, setCard] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const firstRender = useRef(true);

  // Move focus to the step heading whenever the step changes, for screen reader and keyboard users.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('step-heading')?.focus();
  }, [step]);

  const totals = computeTotals(items, coupon, shipping.method);

  if (!items.length && !placing) {
    return (
      <section className="container">
        <h1>Checkout</h1>
        <EmptyState
          title="Your cart is empty"
          action={
            <Link to="/products" className="btn btn-primary">
              Continue shopping
            </Link>
          }
        >
          Add some products before checking out.
        </EmptyState>
      </section>
    );
  }

  const placeOrder = async () => {
    setPlacing(true);
    setError('');
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: {
          items: items.map((i) => ({ productId: i.productId, qty: i.qty, size: i.size, color: i.color })),
          address,
          shippingMethod: shipping.method,
          deliveryDate: shipping.deliveryDate,
          coupon: coupon?.code || null,
          payment: card,
        },
      });
      navigate(`/orders/${order.id}/confirmation`, { replace: true });
      clear();
    } catch (err) {
      setError(err.message);
      setPlacing(false);
    }
  };

  return (
    <section className="container checkout-page">
      <h1>Checkout</h1>
      <Stepper step={step} />
      <div className="checkout-layout">
        <div className="card checkout-step" data-testid={`checkout-step-${step + 1}`}>
          {step === 0 && <AddressStep value={address} onChange={setAddress} onNext={() => setStep(1)} />}
          {step === 1 && <ShippingStep value={shipping} onChange={setShipping} onNext={() => setStep(2)} onBack={() => setStep(0)} subtotal={totals.subtotal} />}
          {step === 2 && <PaymentStep card={card} onCard={setCard} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && (
            <ReviewStep address={address} shipping={shipping} card={card} items={items} totals={totals} coupon={coupon} onBack={() => setStep(2)} onEdit={setStep} onPlace={placeOrder} placing={placing} error={error} />
          )}
        </div>
        <OrderSummary totals={totals} coupon={coupon} shippingLabel={`Shipping (${SHIPPING_METHODS[shipping.method].label.toLowerCase()})`} />
      </div>
    </section>
  );
}
