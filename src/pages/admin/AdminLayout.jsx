import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { getToken } from '../../lib/api.js';
import { formatPrice } from '../../lib/pricing.js';
import { useToast } from '../../context/ToastContext.jsx';

const AdminEventsContext = createContext(null);
export const useAdminEvents = () => useContext(AdminEventsContext);

// Live updates over WebSocket, with automatic reconnection.
function useLiveOrders(onEvent) {
  const [status, setStatus] = useState('connecting');
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    let socket;
    let retry;
    let closed = false;
    const connect = () => {
      setStatus('connecting');
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(getToken() || '')}`);
      socket.onopen = () => setStatus('live');
      socket.onmessage = (e) => {
        try {
          handler.current(JSON.parse(e.data));
        } catch {}
      };
      socket.onclose = (e) => {
        if (closed) return;
        setStatus('offline');
        if (e.code !== 4401) retry = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, []);
  return status;
}

export default function AdminLayout() {
  const toast = useToast();
  const [lastEvent, setLastEvent] = useState(null);

  const status = useLiveOrders((msg) => {
    if (msg.type === 'order:new') {
      toast.show(`${msg.order.number} from ${msg.order.customerName} · ${formatPrice(msg.order.total)}`, { type: 'info', title: 'New order received', duration: 6000 });
    }
    if (msg.type.startsWith('order:')) setLastEvent({ ...msg, at: Date.now() });
  });

  const linkClass = ({ isActive }) => `admin-link ${isActive ? 'active' : ''}`;

  return (
    <div className="container admin-shell">
      <aside className="admin-sidebar">
        <p className="admin-title">Admin</p>
        <nav aria-label="Admin navigation">
          <ul>
            <li>
              <NavLink to="/admin" end className={linkClass}>
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/products" className={linkClass}>
                Products
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/orders" className={linkClass}>
                Orders
              </NavLink>
            </li>
          </ul>
        </nav>
        <p className={`live-status live-${status}`} data-testid="live-status">
          <span className="live-dot" aria-hidden="true" />
          {status === 'live' ? 'Live updates on' : status === 'connecting' ? 'Connecting…' : 'Live updates offline'}
        </p>
      </aside>
      <div className="admin-content">
        <AdminEventsContext.Provider value={lastEvent}>
          <Outlet />
        </AdminEventsContext.Provider>
      </div>
    </div>
  );
}
