import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { usePrefs } from '../context/PrefsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { LANGUAGES } from '../lib/i18n.js';

function OfflineBanner() {
  const { t } = usePrefs();
  const [online, setOnline] = useState(navigator.onLine);
  const [showBack, setShowBack] = useState(false);
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setShowBack(true);
      setTimeout(() => setShowBack(false), 3000);
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  if (online && !showBack) return null;
  return (
    <div className={`offline-banner ${online ? 'is-online' : ''}`} role="status" data-testid="offline-banner">
      {online ? t('common.backOnline') : t('common.offline')}
    </div>
  );
}

export default function Layout() {
  const { t, theme, toggleTheme, lang, setLang } = usePrefs();
  const { user, isAdmin, logout } = useAuth();
  const { totals } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu on navigation and move focus to the top of the new page.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    toast.show('You have been logged out.', { type: 'success' });
    navigate('/login');
  };

  const navClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        {t('common.skip')}
      </a>
      <OfflineBanner />
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="logo" aria-label="ShopLab home">
            <img src="/favicon.svg" alt="" width="28" height="28" />
            <span>ShopLab</span>
          </Link>

          <button type="button" className="icon-btn hamburger" aria-label={t('nav.menu')} aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen((o) => !o)}>
            <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>

          <nav id="main-nav" aria-label={t('nav.main')} className={`main-nav ${menuOpen ? 'open' : ''}`}>
            <ul>
              <li>
                <NavLink to="/" end className={navClass}>
                  {t('nav.home')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/products" className={navClass}>
                  {t('nav.shop')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/cart" className={navClass} aria-label={`${t('nav.cart')}, ${totals.itemCount} items`}>
                  {t('nav.cart')}
                  <span className="cart-count" data-testid="cart-count" aria-hidden="true">
                    {totals.itemCount}
                  </span>
                </NavLink>
              </li>
              {isAdmin && (
                <li>
                  <NavLink to="/admin" className={navClass}>
                    {t('nav.admin')}
                  </NavLink>
                </li>
              )}
              {user ? (
                <>
                  <li>
                    <NavLink to="/profile" className={navClass}>
                      {t('nav.profile')}
                    </NavLink>
                  </li>
                  <li>
                    <button type="button" className="nav-link link-btn" onClick={handleLogout}>
                      {t('nav.logout')}
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <NavLink to="/login" className={navClass}>
                      {t('nav.login')}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/register" className={navClass}>
                      {t('nav.register')}
                    </NavLink>
                  </li>
                </>
              )}
            </ul>
            <div className="header-tools">
              <label className="visually-hidden" htmlFor="language-select">
                {t('lang.label')}
              </label>
              <select id="language-select" value={lang} onChange={(e) => setLang(e.target.value)} className="lang-select">
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button type="button" className="icon-btn theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')} title={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}>
                <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
              </button>
            </div>
          </nav>
          {user && (
            <span className="header-user" data-testid="current-user">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="avatar-xs" /> : <span className="avatar-xs avatar-initials" aria-hidden="true">{user.name[0]}</span>}
              <span className="header-user-name">{user.name}</span>
            </span>
          )}
        </div>
      </header>

      <main id="main" tabIndex={-1} className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>{t('footer.text')}</p>
          <p className="muted">© {new Date().getFullYear()} ShopLab</p>
        </div>
      </footer>
    </div>
  );
}
