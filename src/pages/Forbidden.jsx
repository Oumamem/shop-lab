import { Link } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext.jsx';

export default function Forbidden() {
  const { t } = usePrefs();
  return (
    <section className="container status-page" data-testid="forbidden-page">
      <p className="status-code" aria-hidden="true">403</p>
      <h1>{t('forbidden.title')}</h1>
      <p>{t('forbidden.text')}</p>
      <Link to="/" className="btn btn-primary">
        {t('common.goHome')}
      </Link>
    </section>
  );
}
