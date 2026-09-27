import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePrefs } from '../context/PrefsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Alert, Field, PasswordInput, PasswordStrengthMeter } from '../components/ui.jsx';
import { safeRedirect } from './Login.jsx';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_RULE = 'Password must be at least 8 characters and include uppercase, lowercase and a number';

export default function Register() {
  const { t } = usePrefs();
  const { user, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', acceptTerms: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user && !submitting) return <Navigate to={redirect} replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Please enter your full name';
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Please enter a valid email address';
    if (!PASSWORD_RE.test(form.password)) next.password = PASSWORD_RULE;
    if (!form.confirmPassword) next.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match';
    if (!form.acceptTerms) next.acceptTerms = 'You must accept the terms and conditions';
    return next;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) {
      document.getElementById(`reg-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const u = await register(form);
      toast.show(`Welcome to ShopLab, ${u.name}!`, { type: 'success' });
      navigate(redirect, { replace: true });
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <section className="container auth-page">
      <div className="card auth-card">
        <h1>{t('auth.registerTitle')}</h1>
        <Alert>{formError}</Alert>
        <form onSubmit={onSubmit} noValidate aria-label="Sign up">
          <Field label={t('auth.name')} error={errors.name} id="reg-name">
            {(p) => <input {...p} name="name" autoComplete="name" value={form.name} onChange={set('name')} />}
          </Field>
          <Field label={t('auth.email')} error={errors.email} id="reg-email">
            {(p) => <input {...p} type="email" name="email" autoComplete="email" value={form.email} onChange={set('email')} />}
          </Field>
          <Field label={t('auth.password')} error={errors.password} id="reg-password" hint="At least 8 characters, with uppercase, lowercase and a number.">
            {(p) => <PasswordInput inputProps={p} name="password" autoComplete="new-password" value={form.password} onChange={set('password')} />}
          </Field>
          <PasswordStrengthMeter password={form.password} />
          <Field label={t('auth.confirmPassword')} error={errors.confirmPassword} id="reg-confirmPassword">
            {(p) => <PasswordInput inputProps={p} name="confirmPassword" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} />}
          </Field>
          <div className={`field ${errors.acceptTerms ? 'has-error' : ''}`}>
            <label className="checkbox">
              <input
                id="reg-acceptTerms"
                type="checkbox"
                checked={form.acceptTerms}
                onChange={set('acceptTerms')}
                aria-invalid={errors.acceptTerms ? true : undefined}
                aria-describedby={errors.acceptTerms ? 'reg-acceptTerms-error' : undefined}
              />
              {t('auth.terms')}
            </label>
            {errors.acceptTerms && (
              <p className="field-error" id="reg-acceptTerms-error">
                {errors.acceptTerms}
              </p>
            )}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Creating account…' : t('auth.submitRegister')}
          </button>
        </form>
        <p className="auth-switch">
          {t('auth.haveAccount')} <Link to="/login">{t('nav.login')}</Link>
        </p>
      </div>
    </section>
  );
}
