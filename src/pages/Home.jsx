import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext.jsx';
import { api } from '../lib/api.js';
import { ProductCard, ProductSkeleton } from '../components/ui.jsx';

export default function Home() {
  const { t } = usePrefs();
  const [products, setProducts] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api('/products?sort=rating-desc&limit=4', { signal: ctrl.signal })
      .then((d) => setProducts(d.items))
      .catch((e) => e.name !== 'AbortError' && setProducts([]));
    return () => ctrl.abort();
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <h1>{t('home.title')}</h1>
          <p>{t('home.subtitle')}</p>
          <Link to="/products" className="btn btn-primary btn-lg">
            {t('home.cta')}
          </Link>
        </div>
      </section>
      <section className="container section" aria-labelledby="featured-heading">
        <h2 id="featured-heading">{t('home.featured')}</h2>
        <div className="product-grid" aria-busy={!products}>
          {products ? products.map((p) => <ProductCard key={p.id} product={p} />) : Array.from({ length: 4 }, (_, i) => <ProductSkeleton key={i} />)}
        </div>
      </section>
    </>
  );
}
