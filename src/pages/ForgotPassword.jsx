import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext.jsx';
import { api } from '../lib/api.js';
import { Alert, Field } from '../components/ui.jsx';
import { EMAIL_RE } from './Register.jsx';

export default function ForgotPassword() {
  const { t } = usePrefs();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const data = await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="container auth-page">
      <div className="card auth-card">
        <h1>{t('auth.forgotTitle')}</h1>
        <p className="muted">Enter the email address you signed up with and we'll send you a link to reset your password.</p>
        <Alert type="success">{message}</Alert>
        <form onSubmit={onSubmit} noValidate aria-label="Reset password">
          <Field label={t('auth.email')} error={error}>
            {(p) => <input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Sending…' : t('auth.sendReset')}
          </button>
        </form>
        <p className="auth-switch">
          <Link to="/login">{t('auth.backToLogin')}</Link>
        </p>
      </div>
    </section>
  );
}
