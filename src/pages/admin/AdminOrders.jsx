import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { formatPrice } from '../../lib/pricing.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Spinner } from '../../components/ui.jsx';
import { useAdminEvents } from './AdminLayout.jsx';

const COLUMNS = [
  { id: 'pending', title: 'Pending' },
  { id: 'shipped', title: 'Shipped' },
  { id: 'delivered', title: 'Delivered' },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const lastEvent = useAdminEvents();
  const toast = useToast();

  useEffect(() => {
    api('/admin/orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  // Merge live updates from the WebSocket.
  useEffect(() => {
    if (!lastEvent?.order) return;
    setOrders((list) => {
      if (!list) return list;
      const exists = list.some((o) => o.id === lastEvent.order.id);
      return exists ? list.map((o) => (o.id === lastEvent.order.id ? lastEvent.order : o)) : [lastEvent.order, ...list];
    });
  }, [lastEvent]);

  const move = async (orderId, status) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === status) return;
    const previous = order.status;
    setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status } : o)));
    setAnnouncement(`${order.number} moved to ${status}`);
    try {
      await api(`/admin/orders/${orderId}`, { method: 'PATCH', body: { status } });
    } catch (e) {
      setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status: previous } : o)));
      toast.show(`Could not move ${order.number}: ${e.message}`, { type: 'error' });
    }
  };

  if (error) return <Alert>{error}</Alert>;
  if (!orders) return <Spinner label="Loading orders…" />;

  return (
    <section aria-labelledby="orders-heading">
      <div className="page-head">
        <h1 id="orders-heading">Orders</h1>
        <p className="muted">Drag cards between columns, or use the status menu on each card.</p>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className="kanban">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.id);
          return (
            <section
              key={col.id}
              className={`kanban-column ${dragOver === col.id ? 'drag-over' : ''}`}
              aria-labelledby={`col-${col.id}`}
              data-testid={`column-${col.id}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOver(col.id);
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = Number(e.dataTransfer.getData('text/plain'));
                if (id) move(id, col.id);
              }}
            >
              <h2 id={`col-${col.id}`} className="kanban-title">
                {col.title} <span className="badge" data-testid={`count-${col.id}`}>{list.length}</span>
              </h2>
              <ul className="kanban-list" aria-label={`${col.title} orders`}>
                {list.map((o) => (
                  <li
                    key={o.id}
                    className="kanban-card"
                    draggable
                    data-testid={`order-card-${o.number}`}
                    aria-label={`${o.number}, ${o.customerName}, ${formatPrice(o.total)}`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(o.id));
                      e.dataTransfer.effectAllowed = 'move';
                      e.currentTarget.classList.add('dragging');
                    }}
                    onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
                  >
                    <div className="kanban-card-head">
                      <strong>{o.number}</strong>
                      <span>{formatPrice(o.total)}</span>
                    </div>
                    <p>{o.customerName}</p>
                    <p className="muted">
                      {o.items.reduce((n, i) => n + i.qty, 0)} items · {new Date(o.createdAt).toLocaleDateString()}
                    </p>
                    <label className="visually-hidden" htmlFor={`status-${o.id}`}>
                      Status for {o.number}
                    </label>
                    <select id={`status-${o.id}`} value={o.status} onChange={(e) => move(o.id, e.target.value)} className="kanban-select">
                      {COLUMNS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
                {!list.length && <li className="kanban-empty muted">No orders</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
