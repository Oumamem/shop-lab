import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, downloadFile } from '../lib/api.js';
import { formatPrice } from '../lib/pricing.js';
import { Alert, Field, PasswordInput, PasswordStrengthMeter, Spinner } from '../components/ui.jsx';
import { EMAIL_RE, PASSWORD_RE, PASSWORD_RULE } from './Register.jsx';

const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const AVATAR_MAX = 2 * 1024 * 1024;

function AvatarSection() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setMessage('');
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) return setError('Only PNG, JPG or WebP images are allowed.');
    if (file.size > AVATAR_MAX) return setError('The image must be 2 MB or smaller.');
    setError('');
    setBusy(true);
    try {
      const body = new FormData();
      body.append('avatar', file);
      const data = await api('/profile/avatar', { method: 'POST', body });
      setUser(data.user);
      setMessage('Your avatar has been updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const data = await api('/profile/avatar', { method: 'DELETE' });
    setUser(data.user);
    setMessage('Your avatar has been removed.');
  };

  return (
    <section className="card profile-section" aria-labelledby="avatar-heading">
      <h2 id="avatar-heading">Profile picture</h2>
      <div className="avatar-row">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="Your avatar" className="avatar-lg" data-testid="avatar-image" />
        ) : (
          <span className="avatar-lg avatar-initials" role="img" aria-label="No avatar uploaded">
            {user.name[0]}
          </span>
        )}
        <div>
          <label htmlFor="avatar-input" className="btn btn-secondary">
            {busy ? 'Uploading…' : 'Upload avatar'}
          </label>
          <input ref={inputRef} id="avatar-input" type="file" accept="image/png,image/jpeg,image/webp" className="visually-hidden" onChange={onFile} disabled={busy} aria-describedby="avatar-hint" />
          {user.avatarUrl && (
            <button type="button" className="link-btn danger" onClick={remove}>
              Remove avatar
            </button>
          )}
          <p className="field-hint" id="avatar-hint">
            PNG, JPG or WebP, up to 2 MB.
          </p>
        </div>
      </div>
      <Alert data-testid="avatar-error">{error}</Alert>
      <Alert type="success">{message}</Alert>
    </section>
  );
}

function DetailsSection() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone || '', bio: user.bio || '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setFormError('');
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Please enter your full name';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Please enter a valid email address';
    if (form.phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(form.phone.trim())) next.phone = 'Please enter a valid phone number';
    if (form.bio.length > 200) next.bio = 'Bio must be 200 characters or fewer';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const data = await api('/profile', { method: 'PUT', body: form });
      setUser(data.user);
      setMessage('Your profile has been saved.');
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
    }
  };

  return (
    <section className="card profile-section" aria-labelledby="details-heading">
      <h2 id="details-heading">Personal details</h2>
      <form onSubmit={onSubmit} noValidate aria-label="Personal details">
        <div className="form-grid">
          <Field label="Full name" error={errors.name}>
            {(p) => <input {...p} autoComplete="name" value={form.name} onChange={set('name')} />}
          </Field>
          <Field label="Email" error={errors.email}>
            {(p) => <input {...p} type="email" autoComplete="email" value={form.email} onChange={set('email')} />}
          </Field>
        </div>
        <Field label="Phone" error={errors.phone}>
          {(p) => <input {...p} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />}
        </Field>
        <Field label="Bio" error={errors.bio} hint={`${form.bio.length}/200 characters`}>
          {(p) => <textarea {...p} rows={3} value={form.bio} onChange={set('bio')} />}
        </Field>
        <Alert>{formError}</Alert>
        <Alert type="success">{message}</Alert>
        <button type="submit" className="btn btn-primary">
          Save changes
        </button>
      </form>
    </section>
  );
}

function PasswordSection() {
  const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    const next = {};
    if (!form.currentPassword) next.currentPassword = 'Enter your current password';
    if (!PASSWORD_RE.test(form.newPassword)) next.newPassword = PASSWORD_RULE;
    if (form.newPassword !== form.confirmPassword) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await api('/profile/password', { method: 'PUT', body: form });
      setForm(empty);
      setMessage('Your password has been changed.');
    } catch (err) {
      setErrors(Object.keys(err.fields).length ? err.fields : { currentPassword: err.message });
    }
  };

  return (
    <section className="card profile-section" aria-labelledby="password-heading">
      <h2 id="password-heading">Change password</h2>
      <form onSubmit={onSubmit} noValidate aria-label="Change password">
        <Field label="Current password" error={errors.currentPassword}>
          {(p) => <PasswordInput inputProps={p} value={form.currentPassword} onChange={set('currentPassword')} />}
        </Field>
        <Field label="New password" error={errors.newPassword}>
          {(p) => <PasswordInput inputProps={p} autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} />}
        </Field>
        <PasswordStrengthMeter password={form.newPassword} />
        <Field label="Confirm new password" error={errors.confirmPassword}>
          {(p) => <PasswordInput inputProps={p} autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} />}
        </Field>
        <Alert type="success">{message}</Alert>
        <button type="submit" className="btn btn-primary">
          Update password
        </button>
      </form>
    </section>
  );
}

function OrdersSection() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    api('/orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  const download = async (order) => {
    setDownloading(order.id);
    try {
      await downloadFile(`/orders/${order.id}/invoice`, `invoice-${order.number}.pdf`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section className="card profile-section" id="orders" aria-labelledby="orders-heading">
      <h2 id="orders-heading">Order history</h2>
      <Alert>{error}</Alert>
      {!orders && !error && <Spinner label="Loading orders…" />}
      {orders?.length === 0 && <p className="muted">You haven't placed any orders yet.</p>}
      {orders?.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="visually-hidden">Your orders</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Date</th>
                <th scope="col">Items</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <th scope="row">{o.number}</th>
                  <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td>{o.items.reduce((n, i) => n + i.qty, 0)}</td>
                  <td>{formatPrice(o.total)}</td>
                  <td>
                    <span className={`status status-${o.status}`}>{o.status}</span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => download(o)} disabled={downloading === o.id} aria-label={`Download invoice for ${o.number}`}>
                      {downloading === o.id ? 'Preparing…' : 'Download invoice'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DangerZone() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const onDelete = async () => {
    // A native confirm dialog on purpose, so tests can practise page.on('dialog').
    if (!window.confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
    try {
      await api('/profile', { method: 'DELETE' });
      await logout();
      toast.show('Your account has been deleted.', { type: 'success' });
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card profile-section danger-zone" aria-labelledby="danger-heading">
      <h2 id="danger-heading">Delete account</h2>
      <p>Deleting your account removes your profile and signs you out. This cannot be undone.</p>
      <Alert>{error}</Alert>
      <button type="button" className="btn btn-danger" onClick={onDelete} disabled={user.role === 'admin'}>
        Delete account
      </button>
      {user.role === 'admin' && <p className="field-hint">Admin accounts cannot be deleted.</p>}
    </section>
  );
}

export default function Profile() {
  const { user } = useAuth();
  useEffect(() => {
    if (window.location.hash === '#orders') setTimeout(() => document.getElementById('orders')?.scrollIntoView(), 100);
  }, []);
  return (
    <div className="container profile-page">
      <h1>My profile</h1>
      <p className="muted">Signed in as {user.email}</p>
      <AvatarSection />
      <DetailsSection />
      <PasswordSection />
      <OrdersSection />
      <DangerZone />
    </div>
  );
}
