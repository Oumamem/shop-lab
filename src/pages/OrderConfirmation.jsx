import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/pricing.js';
import { Alert, Spinner } from '../components/ui.jsx';

export default function OrderConfirmation() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="container"><Alert>{error}</Alert></div>;
  if (!order) return <Spinner />;

  return (
    <section className="container confirmation">
      <div className="card">
        <p className="confirmation-icon" aria-hidden="true">✓</p>
        <h1>Thank you for your order!</h1>
        <p>
          Your order number is <strong data-testid="order-number">{order.number}</strong>. We'll email you when it ships.
        </p>
        <dl className="summary-lines">
          <div>
            <dt>Delivery date</dt>
            <dd>{new Date(`${order.deliveryDate}T00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</dd>
          </div>
          <div>
            <dt>Items</dt>
            <dd>{order.items.reduce((n, i) => n + i.qty, 0)}</dd>
          </div>
          <div className="summary-total">
            <dt>Total paid</dt>
            <dd data-testid="order-total">{formatPrice(order.total)}</dd>
          </div>
        </dl>
        <div className="step-actions">
          <Link to="/profile#orders" className="btn btn-secondary">
            View order history
          </Link>
          <Link to="/products" className="btn btn-primary">
            Continue shopping
          </Link>
        </div>
      </div>
    </section>
  );
}
