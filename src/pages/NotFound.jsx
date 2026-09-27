import { Link } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext.jsx';

export default function NotFound({ title, text }) {
  const { t } = usePrefs();
  return (
    <section className="container status-page">
      <p className="status-code" aria-hidden="true">404</p>
      <h1>{title || t('notFound.title')}</h1>
      <p>{text || t('notFound.text')}</p>
      <Link to="/" className="btn btn-primary">
        {t('common.goHome')}
      </Link>
    </section>
  );
}
