import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext.jsx';
import { api } from '../lib/api.js';
import { ProductCard, ProductSkeleton, EmptyState } from '../components/ui.jsx';
import CustomSelect from '../components/CustomSelect.jsx';

const PAGE_SIZE = 12;
const PRICE_MAX = 500;
const SORTS = ['relevance', 'price-asc', 'price-desc', 'rating-desc', 'name-asc', 'newest'];
const RATINGS = ['4', '3', '2'];

function useDebouncedEffect(fn, deps, delay) {
  useEffect(() => {
    const id = setTimeout(fn, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function Catalog() {
  const { t } = usePrefs();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const categories = (params.get('category') || '').split(',').filter(Boolean);
  const minPrice = Number(params.get('minPrice') || 0);
  const maxPrice = Number(params.get('maxPrice') || PRICE_MAX);
  const rating = params.get('rating') || '';
  const sort = SORTS.includes(params.get('sort')) ? params.get('sort') : 'relevance';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const view = params.get('view') === 'infinite' ? 'infinite' : 'pages';

  const [allCategories, setAllCategories] = useState([]);
  const [search, setSearch] = useState(q);
  const [priceDraft, setPriceDraft] = useState([minPrice, maxPrice]);
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, page: 1, pages: 1 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sentinelRef = useRef(null);
  const headingRef = useRef(null);

  const update = useCallback(
    (changes) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            const empty = value === '' || value == null || (Array.isArray(value) && value.length === 0);
            if (empty) next.delete(key);
            else next.set(key, Array.isArray(value) ? value.join(',') : String(value));
          }
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: !('page' in changes) },
      );
    },
    [setParams],
  );

  useEffect(() => {
    api('/categories').then(setAllCategories).catch(() => {});
  }, []);

  // Keep local inputs in sync when the URL changes (back button, "clear filters").
  useEffect(() => setSearch(q), [q]);
  useEffect(() => setPriceDraft([minPrice, maxPrice]), [minPrice, maxPrice]);

  // Debounced search: only hit the API once the user pauses typing.
  useDebouncedEffect(() => search !== q && update({ q: search }), [search], 400);
  useDebouncedEffect(
    () => {
      if (priceDraft[0] !== minPrice || priceDraft[1] !== maxPrice) {
        update({ minPrice: priceDraft[0] > 0 ? priceDraft[0] : '', maxPrice: priceDraft[1] < PRICE_MAX ? priceDraft[1] : '' });
      }
    },
    [priceDraft],
    300,
  );

  const queryFor = useCallback(
    (p) => {
      const qs = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE), sort });
      if (q) qs.set('q', q);
      if (categories.length) qs.set('category', categories.join(','));
      if (minPrice > 0) qs.set('minPrice', String(minPrice));
      if (maxPrice < PRICE_MAX) qs.set('maxPrice', String(maxPrice));
      if (rating) qs.set('rating', rating);
      return qs.toString();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, categories.join(','), minPrice, maxPrice, rating, sort],
  );

  const effectivePage = view === 'infinite' ? 1 : page;
  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, status: 'loading', items: [] }));
    api(`/products?${queryFor(effectivePage)}`, { signal: ctrl.signal })
      .then((d) => setState({ status: 'success', items: d.items, total: d.total, page: d.page, pages: d.pages }))
      .catch((err) => err.name !== 'AbortError' && setState((s) => ({ ...s, status: 'error', error: err.message })));
    return () => ctrl.abort();
  }, [queryFor, effectivePage, view, reloadKey]);

  const loadMore = useCallback(() => {
    if (loadingMore || state.status !== 'success' || state.page >= state.pages) return;
    const query = queryFor(state.page + 1);
    setLoadingMore(true);
    api(`/products?${query}`)
      .then((d) => setState((s) => (s.status === 'success' ? { ...s, items: [...s.items, ...d.items], page: d.page, pages: d.pages, total: d.total } : s)))
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, state, queryFor]);

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (view !== 'infinite' || state.status !== 'success' || !sentinelRef.current) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMoreRef.current(), { rootMargin: '200px' });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [view, state.status, state.page]);

  const toggleCategory = (name) => update({ category: categories.includes(name) ? categories.filter((c) => c !== name) : [...categories, name] });
  const clearFilters = () => {
    setSearch('');
    setParams(view === 'infinite' ? { view } : {}, { replace: true });
  };
  const goToPage = (p) => {
    update({ page: p > 1 ? p : '' });
    headingRef.current?.focus();
  };

  const hasFilters = q || categories.length || minPrice > 0 || maxPrice < PRICE_MAX || rating;
  const sortOptions = SORTS.map((s) => ({ value: s, label: t(`sort.${s}`) }));
  const from = (state.page - 1) * PAGE_SIZE + 1;

  return (
    <section className="container catalog">
      <h1 ref={headingRef} tabIndex={-1}>
        {t('catalog.title')}
      </h1>

      <div className="catalog-toolbar">
        <div className="search-box">
          <label htmlFor="catalog-search" className="visually-hidden">
            {t('catalog.search')}
          </label>
          <input id="catalog-search" type="search" placeholder={`${t('catalog.search')}…`} value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
        </div>
        <div className="toolbar-controls">
          <div className="native-select">
            <label htmlFor="sort-select">{t('catalog.sortBy')}</label>
            <select id="sort-select" value={sort} onChange={(e) => update({ sort: e.target.value === 'relevance' ? '' : e.target.value })}>
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <CustomSelect label={t('catalog.sortCustom')} options={sortOptions} value={sort} onChange={(v) => update({ sort: v === 'relevance' ? '' : v })} />
          <fieldset className="segmented">
            <legend className="visually-hidden">{t('catalog.view')}</legend>
            {['pages', 'infinite'].map((v) => (
              <label key={v} className={view === v ? 'checked' : ''}>
                <input type="radio" name="view" value={v} checked={view === v} onChange={() => update({ view: v === 'infinite' ? 'infinite' : '' })} />
                {t(`catalog.${v}`)}
              </label>
            ))}
          </fieldset>
          <button type="button" className="btn btn-secondary filters-toggle" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen((o) => !o)}>
            {t('catalog.filters')}
          </button>
        </div>
      </div>

      <div className="catalog-body">
        <aside id="catalog-filters" className={`filters ${filtersOpen ? 'open' : ''}`} aria-label={t('catalog.filters')}>
          <fieldset>
            <legend>{t('catalog.categories')}</legend>
            {allCategories.map((c) => (
              <label key={c.name} className="checkbox">
                <input type="checkbox" checked={categories.includes(c.name)} onChange={() => toggleCategory(c.name)} />
                {c.name} <span className="muted">({c.count})</span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>{t('catalog.price')}</legend>
            <p className="price-range-value" aria-live="polite" data-testid="price-range-value">
              ${priceDraft[0]} – ${priceDraft[1]}
            </p>
            <label htmlFor="min-price">{t('catalog.minPrice')}</label>
            <input
              id="min-price"
              type="range"
              min={0}
              max={PRICE_MAX}
              step={5}
              value={priceDraft[0]}
              aria-valuetext={`$${priceDraft[0]}`}
              onChange={(e) => setPriceDraft(([, hi]) => [Math.min(Number(e.target.value), hi), hi])}
            />
            <label htmlFor="max-price">{t('catalog.maxPrice')}</label>
            <input
              id="max-price"
              type="range"
              min={0}
              max={PRICE_MAX}
              step={5}
              value={priceDraft[1]}
              aria-valuetext={`$${priceDraft[1]}`}
              onChange={(e) => setPriceDraft(([lo]) => [lo, Math.max(Number(e.target.value), lo)])}
            />
          </fieldset>

          <fieldset>
            <legend>{t('catalog.rating')}</legend>
            <label className="radio">
              <input type="radio" name="rating" value="" checked={!rating} onChange={() => update({ rating: '' })} />
              {t('catalog.anyRating')}
            </label>
            {RATINGS.map((r) => (
              <label key={r} className="radio">
                <input type="radio" name="rating" value={r} checked={rating === r} onChange={() => update({ rating: r })} />
                {t('catalog.andUp', { n: r })}
              </label>
            ))}
          </fieldset>

          {hasFilters && (
            <button type="button" className="btn btn-secondary btn-block" onClick={clearFilters}>
              {t('catalog.clearFilters')}
            </button>
          )}
        </aside>

        <div className="catalog-results">
          <p className="results-count" role="status" data-testid="results-count">
            {state.status === 'success' && state.total > 0 &&
              (view === 'infinite'
                ? t('catalog.resultsInfinite', { count: state.items.length, total: state.total })
                : t('catalog.results', { from, to: from + state.items.length - 1, total: state.total }))}
          </p>

          {state.status === 'loading' && (
            <div className="product-grid" aria-busy="true" aria-label="Loading products">
              {Array.from({ length: 6 }, (_, i) => (
                <ProductSkeleton key={i} />
              ))}
            </div>
          )}

          {state.status === 'error' && (
            <div className="error-state" role="alert">
              <p>{t('catalog.error')}</p>
              <button type="button" className="btn btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
                {t('common.retry')}
              </button>
            </div>
          )}

          {state.status === 'success' && state.items.length === 0 && (
            <EmptyState
              title={t('catalog.noResults')}
              action={
                hasFilters && (
                  <button type="button" className="btn btn-primary" onClick={clearFilters}>
                    {t('catalog.clearFilters')}
                  </button>
                )
              }
            >
              {t('catalog.noResultsHint')}
            </EmptyState>
          )}

          {state.status === 'success' && state.items.length > 0 && (
            <>
              <ul className="product-grid" aria-label="Products">
                {state.items.map((p) => (
                  <li key={p.id}>
                    <ProductCard product={p} />
                  </li>
                ))}
              </ul>

              {view === 'pages' && state.pages > 1 && (
                <nav className="pagination" aria-label="Pagination">
                  <button type="button" className="btn btn-secondary" disabled={state.page <= 1} onClick={() => goToPage(state.page - 1)}>
                    Previous
                  </button>
                  <ul>
                    {Array.from({ length: state.pages }, (_, i) => i + 1).map((p) => (
                      <li key={p}>
                        <button type="button" className={`page-btn ${p === state.page ? 'current' : ''}`} aria-label={`Page ${p}`} aria-current={p === state.page ? 'page' : undefined} onClick={() => goToPage(p)}>
                          {p}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="btn btn-secondary" disabled={state.page >= state.pages} onClick={() => goToPage(state.page + 1)}>
                    Next
                  </button>
                </nav>
              )}

              {view === 'infinite' && (
                <div ref={sentinelRef} className="infinite-sentinel" data-testid="infinite-sentinel">
                  {loadingMore && <p role="status">{t('catalog.loadingMore')}</p>}
                  {!loadingMore && state.page >= state.pages && <p className="muted">{t('catalog.end')}</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
