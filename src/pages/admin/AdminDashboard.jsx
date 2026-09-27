import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { formatPrice } from '../../lib/pricing.js';
import { usePrefs } from '../../context/PrefsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Spinner } from '../../components/ui.jsx';
import { useAdminEvents } from './AdminLayout.jsx';

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Draws a simple bar chart on a <canvas>. Canvas content is invisible to the DOM,
// so the chart also exposes its data through aria-label and a hidden table.
function BarChart({ data, label, format = (v) => v, colors }) {
  const ref = useRef(null);
  const { theme } = usePrefs();

  useEffect(() => {
    const canvas = ref.current;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const text = cssVar('--text-muted');
      const grid = cssVar('--border');
      const accent = cssVar('--accent');
      const pad = { top: 16, right: 12, bottom: 32, left: 56 };
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom;
      const max = Math.max(1, ...data.map((d) => d.value));

      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = text;
      ctx.strokeStyle = grid;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + plotH - (plotH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.fillText(format((max * i) / 4), pad.left - 8, y);
      }

      const slot = plotW / data.length;
      const barW = Math.min(48, slot * 0.6);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      data.forEach((d, i) => {
        const x = pad.left + slot * i + (slot - barW) / 2;
        const h = (d.value / max) * plotH;
        ctx.fillStyle = colors?.[i] ? cssVar(colors[i]) : accent;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, pad.top + plotH - h, barW, h, [4, 4, 0, 0]) : ctx.rect(x, pad.top + plotH - h, barW, h);
        ctx.fill();
        ctx.fillStyle = text;
        ctx.fillText(d.label, pad.left + slot * i + slot / 2, height - pad.bottom + 8);
      });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [data, theme, colors, format]);

  const summary = data.map((d) => `${d.label}: ${format(d.value)}`).join(', ');
  return (
    <figure className="chart">
      <figcaption>{label}</figcaption>
      <canvas ref={ref} role="img" aria-label={`${label}. ${summary}`} data-testid={`chart-${label.toLowerCase().replace(/\W+/g, '-')}`} />
      <table className="visually-hidden">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const money = (v) => `$${Math.round(v)}`;
const count = (v) => String(Math.round(v));
const STATUS_COLORS = ['--status-pending', '--status-shipped', '--status-delivered'];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [simulating, setSimulating] = useState(false);
  const lastEvent = useAdminEvents();
  const toast = useToast();

  const load = useCallback(() => {
    api('/admin/stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load, lastEvent]);

  const simulate = async () => {
    setSimulating(true);
    try {
      await api('/admin/simulate-order', { method: 'POST' });
    } catch (e) {
      toast.show(e.message, { type: 'error' });
    } finally {
      setSimulating(false);
    }
  };

  if (error) return <Alert>{error}</Alert>;
  if (!stats) return <Spinner label="Loading dashboard…" />;

  const sales = stats.salesByDay.map((d) => ({ label: new Date(`${d.date}T00:00`).toLocaleDateString('en-US', { weekday: 'short' }), value: d.total }));
  const byStatus = Object.entries(stats.ordersByStatus).map(([label, value]) => ({ label: label[0].toUpperCase() + label.slice(1), value }));

  return (
    <section aria-labelledby="dash-heading">
      <div className="page-head">
        <h1 id="dash-heading">Dashboard</h1>
        <button type="button" className="btn btn-secondary" onClick={simulate} disabled={simulating}>
          {simulating ? 'Simulating…' : 'Simulate new order'}
        </button>
      </div>
      <ul className="stat-grid" aria-label="Key figures">
        <li className="stat-tile">
          <span className="stat-label">Revenue</span>
          <span className="stat-value" data-testid="stat-revenue">
            {formatPrice(stats.revenue)}
          </span>
        </li>
        <li className="stat-tile">
          <span className="stat-label">Orders</span>
          <span className="stat-value" data-testid="stat-orders">
            {stats.orderCount}
          </span>
        </li>
        <li className="stat-tile">
          <span className="stat-label">Customers</span>
          <span className="stat-value" data-testid="stat-customers">
            {stats.customerCount}
          </span>
        </li>
        <li className="stat-tile">
          <span className="stat-label">Products</span>
          <span className="stat-value" data-testid="stat-products">
            {stats.productCount}
          </span>
          <span className="stat-note">{stats.lowStockCount} low in stock</span>
        </li>
      </ul>
      <div className="chart-grid">
        <div className="card">
          <BarChart data={sales} label="Revenue last 7 days" format={money} />
        </div>
        <div className="card">
          <BarChart data={byStatus} label="Orders by status" format={count} colors={STATUS_COLORS} />
        </div>
      </div>
      <div className="card">
        <div className="page-head">
          <h2>Recent orders</h2>
          <Link to="/admin/orders">View all orders</Link>
        </div>
        <ul className="recent-orders">
          {stats.recentOrders.map((o) => (
            <li key={o.id}>
              <strong>{o.number}</strong>
              <span>{o.customerName}</span>
              <span className={`status status-${o.status}`}>{o.status}</span>
              <span>{formatPrice(o.total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
