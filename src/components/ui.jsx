import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../lib/pricing.js';
import { usePrefs } from '../context/PrefsContext.jsx';

export function Field({ label, error, hint, children, id: givenId }) {
  const autoId = useId();
  const id = givenId || autoId;
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordInput({ inputProps, value, onChange, autoComplete = 'current-password', name }) {
  const [visible, setVisible] = useState(false);
  const { t } = usePrefs();
  return (
    <div className="password-input">
      <input {...inputProps} name={name} type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} />
      <button type="button" className="link-btn" onClick={() => setVisible((v) => !v)} aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')} aria-pressed={visible}>
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

export function Alert({ type = 'error', children, ...rest }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'} {...rest}>
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export function Stars({ rating, showValue = true }) {
  const full = Math.round(rating);
  return (
    <span className="stars" role="img" aria-label={`Rated ${rating} out of 5`}>
      <span aria-hidden="true">
        {'★'.repeat(full)}
        <span className="stars-empty">{'★'.repeat(5 - full)}</span>
      </span>
      {showValue && (
        <span className="stars-value" aria-hidden="true">
          {rating.toFixed(1)}
        </span>
      )}
    </span>
  );
}

export function ProductCard({ product }) {
  const { t } = usePrefs();
  const soldOut = product.stock === 0;
  return (
    <article className="product-card" data-testid="product-card" aria-labelledby={`product-${product.id}-name`}>
      <Link to={`/products/${product.id}`} className="product-card-link">
        <img src={product.image} alt="" width="300" height="300" loading="lazy" />
        {soldOut && <span className="badge badge-muted product-badge">{t('catalog.outOfStock')}</span>}
        <span className="product-card-category">{product.category}</span>
        <h3 id={`product-${product.id}-name`} className="product-card-name">
          {product.name}
        </h3>
      </Link>
      <div className="product-card-meta">
        <Stars rating={product.rating} />
        <span className="price" data-testid="product-price">
          {formatPrice(product.price)}
        </span>
      </div>
    </article>
  );
}

export function ProductSkeleton() {
  return (
    <div className="product-card skeleton-card" data-testid="product-skeleton" aria-hidden="true">
      <div className="skeleton skeleton-img" />
      <div className="skeleton skeleton-line short" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line half" />
    </div>
  );
}

export function QuantityStepper({ value, min = 1, max, onChange, label = 'Quantity', id }) {
  const clamp = (n) => Math.max(min, Math.min(max, n));
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = parseInt(draft, 10);
    const next = Number.isNaN(n) ? value : clamp(n);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper-btn" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
      />
      <button type="button" className="stepper-btn" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>
        +
      </button>
    </div>
  );
}

export function Tooltip({ content, children, label }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <span className="tooltip-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="tooltip-trigger" aria-label={label} aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        {children}
      </button>
      {open && (
        <span role="tooltip" id={id} className="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}

export function Tabs({ tabs, label }) {
  const [active, setActive] = useState(tabs[0].id);
  const refs = useRef({});
  const baseId = useId();
  const onKeyDown = (e) => {
    const idx = tabs.findIndex((t) => t.id === active);
    const rtl = document.documentElement.dir === 'rtl';
    const map = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 };
    let next = null;
    if (e.key in map) next = tabs[(idx + map[e.key] + tabs.length) % tabs.length];
    if (e.key === 'Home') next = tabs[0];
    if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) {
      e.preventDefault();
      setActive(next.id);
      refs.current[next.id]?.focus();
    }
  };
  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tablist" onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => (refs.current[tab.id] = el)}
            role="tab"
            type="button"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`${baseId}-panel-${tab.id}`} aria-labelledby={`${baseId}-tab-${tab.id}`} hidden={active !== tab.id} tabIndex={0} className="tabpanel">
          {active === tab.id && tab.content}
        </div>
      ))}
    </div>
  );
}

export function passwordStrength(password) {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  score = Math.min(4, score);
  if (password.length < 8) score = Math.min(score, 1);
  return { score, label: ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][score] };
}

export function PasswordStrengthMeter({ password }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;
  return (
    <div className="strength" data-strength={score}>
      <div className="strength-bar" role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={label}>
        <span style={{ width: `${(score / 4) * 100}%` }} />
      </div>
      <p className="strength-label" aria-live="polite">
        Password strength: <strong>{label}</strong>
      </p>
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
