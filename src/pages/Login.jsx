import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePrefs } from '../context/PrefsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Alert, Field, PasswordInput } from '../components/ui.jsx';

export function safeRedirect(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export default function Login() {
  const { t } = usePrefs();
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user && !submitting) return <Navigate to={redirect} replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.email.trim()) next.email = 'Email is required';
    if (!form.password) next.password = 'Password is required';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const u = await login(form);
      toast.show(`Welcome back, ${u.name}!`, { type: 'success' });
      navigate(redirect, { replace: true });
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <section className="container auth-page">
      <div className="card auth-card">
        <h1>{t('auth.loginTitle')}</h1>
        {params.get('expired') && <Alert type="warning">{t('auth.expired')}</Alert>}
        {params.get('redirect') && !params.get('expired') && <Alert type="info">Please log in to continue.</Alert>}
        <Alert data-testid="login-error">{formError}</Alert>
        <form onSubmit={onSubmit} noValidate aria-label="Log in">
          <Field label={t('auth.email')} error={errors.email}>
            {(p) => <input {...p} type="email" name="email" autoComplete="email" value={form.email} onChange={set('email')} />}
          </Field>
          <Field label={t('auth.password')} error={errors.password}>
            {(p) => <PasswordInput inputProps={p} name="password" value={form.password} onChange={set('password')} />}
          </Field>
          <div className="form-row-between">
            <label className="checkbox">
              <input type="checkbox" checked={form.remember} onChange={set('remember')} />
              {t('auth.remember')}
            </label>
            <Link to="/forgot-password">{t('auth.forgot')}</Link>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Logging in…' : t('auth.submitLogin')}
          </button>
        </form>
        <p className="auth-switch">
          {t('auth.noAccount')} <Link to={`/register${params.get('redirect') ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>{t('nav.register')}</Link>
        </p>
        <details className="demo-accounts">
          <summary>Demo accounts</summary>
          <ul>
            <li>
              <code>user@shoplab.test</code> / <code>Password123!</code>
            </li>
            <li>
              <code>admin@shoplab.test</code> / <code>Admin123!</code>
            </li>
            <li>
              <code>locked@shoplab.test</code> (locked)
            </li>
          </ul>
        </details>
      </div>
    </section>
  );
}
