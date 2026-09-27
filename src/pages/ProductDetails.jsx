import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePrefs } from '../context/PrefsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { formatPrice, FREE_SHIPPING_THRESHOLD, MAX_QTY_PER_ITEM } from '../lib/pricing.js';
import { Alert, QuantityStepper, Spinner, Stars, Tabs, Tooltip } from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';
import NotFound from './NotFound.jsx';

function Reviews({ reviews }) {
  if (!reviews.length) return <p className="muted">No reviews yet. Be the first to review this product.</p>;
  return (
    <ul className="review-list" aria-label="Customer reviews">
      {reviews.map((r) => (
        <li key={r.id} className="review">
          <div className="review-head">
            <strong>{r.author}</strong>
            <Stars rating={r.rating} showValue={false} />
            <time dateTime={r.date} className="muted">
              {new Date(r.date).toLocaleDateString()}
            </time>
          </div>
          <p>{r.comment}</p>
        </li>
      ))}
    </ul>
  );
}

function QuestionsAndAnswers({ product }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState(product.questions);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSent(false);
    if (text.trim().length < 10) {
      setError('Your question must be at least 10 characters.');
      return;
    }
    try {
      const q = await api(`/products/${product.id}/questions`, { method: 'POST', body: { question: text } });
      setQuestions((list) => [...list, q]);
      setText('');
      setError('');
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <dl className="qa-list">
        {questions.map((q) => (
          <div key={q.id} className="qa-item">
            <dt>Q: {q.question}</dt>
            <dd>{q.answer ? `A: ${q.answer}` : <span className="muted">Awaiting an answer from the seller.</span>}</dd>
          </div>
        ))}
      </dl>
      {user ? (
        <form onSubmit={onSubmit} className="qa-form" noValidate>
          <label htmlFor="question">Ask a question</label>
          <textarea id="question" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? 'question-error' : undefined} />
          {error && (
            <p className="field-error" id="question-error">
              {error}
            </p>
          )}
          {sent && <Alert type="success">Thanks! Your question has been posted.</Alert>}
          <button type="submit" className="btn btn-secondary">
            Submit question
          </button>
        </form>
      ) : (
        <p>
          <Link to={`/login?redirect=/products/${product.id}`}>Log in</Link> to ask a question.
        </p>
      )}
    </div>
  );
}

function OptionGroup({ legend, options, value, onChange, renderLabel, name }) {
  return (
    <fieldset className="option-group">
      <legend>
        {legend}: <strong>{value || 'Select one'}</strong>
      </legend>
      <div className="option-list">
        {options.map((o) => {
          const soldOut = o.stock === 0;
          return (
            <label key={o.name} className={`option ${value === o.name ? 'selected' : ''} ${soldOut ? 'disabled' : ''}`} title={soldOut ? `${o.name} is out of stock` : o.name}>
              <input type="radio" name={name} value={o.name} checked={value === o.name} disabled={soldOut} onChange={() => onChange(o.name)} aria-label={soldOut ? `${o.name} (out of stock)` : o.name} />
              {renderLabel(o)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function ProductDetails() {
  const { id } = useParams();
  const { t } = usePrefs();
  const { addItem, items } = useCart();
  const toast = useToast();
  const [state, setState] = useState({ status: 'loading' });
  const [imageIndex, setImageIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  const zoomButtonRef = useRef(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    setImageIndex(0);
    setSize(null);
    setColor(null);
    setQty(1);
    setError('');
    api(`/products/${id}`, { signal: ctrl.signal })
      .then((product) => {
        setState({ status: 'success', product });
        document.title = `${product.name} | ShopLab`;
      })
      .catch((err) => err.name !== 'AbortError' && setState({ status: err.status === 404 ? 'not-found' : 'error', error: err.message }));
    return () => ctrl.abort();
  }, [id]);

  if (state.status === 'loading') return <Spinner label="Loading product…" />;
  if (state.status === 'not-found') return <NotFound title="Product not found" text="This product doesn't exist or has been removed." />;
  if (state.status === 'error')
    return (
      <div className="container">
        <Alert>{state.error}</Alert>
      </div>
    );

  const { product } = state;
  const sizeStock = size ? product.sizes.find((s) => s.name === size)?.stock : Infinity;
  const colorStock = color ? product.colors.find((c) => c.name === color)?.stock : Infinity;
  const available = Math.min(product.stock, sizeStock, colorStock);
  const inCart = items.filter((i) => i.productId === product.id && i.size === size && i.color === color).reduce((n, i) => n + i.qty, 0);
  const maxQty = Math.max(1, Math.min(available, MAX_QTY_PER_ITEM) - inCart);
  const soldOut = product.stock === 0;

  const onAdd = () => {
    if (product.sizes.length && !size) return setError('Please select a size.');
    if (product.colors.length && !color) return setError('Please select a colour.');
    if (inCart >= Math.min(available, MAX_QTY_PER_ITEM)) return setError('You already have the maximum quantity of this item in your cart.');
    setError('');
    addItem({ product, size, color, qty: Math.min(qty, maxQty), maxQty: Math.min(available, MAX_QTY_PER_ITEM) });
    toast.show(`${product.name} was added to your cart.`, { type: 'success', title: 'Added to cart' });
    setQty(1);
  };

  const share = () => {
    window.open(`/share/${product.id}`, '_blank', 'noopener');
  };

  return (
    <div className="container product-page">
      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <ol>
          <li>
            <Link to="/">{t('nav.home')}</Link>
          </li>
          <li>
            <Link to={`/products?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
          </li>
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <div className="product-layout">
        <section className="gallery" aria-label="Product images">
          <button ref={zoomButtonRef} type="button" className="gallery-main" onClick={() => setZoomOpen(true)} aria-label="Zoom image">
            <img src={product.images[imageIndex]} alt={`${product.name}, view ${imageIndex + 1} of ${product.images.length}`} width="600" height="600" data-testid="main-image" />
          </button>
          <ul className="thumbnails">
            {product.images.map((src, i) => (
              <li key={src}>
                <button type="button" className={`thumb ${i === imageIndex ? 'active' : ''}`} aria-label={`Show image ${i + 1}`} aria-pressed={i === imageIndex} onClick={() => setImageIndex(i)}>
                  <img src={src} alt="" width="80" height="80" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="product-info" aria-labelledby="product-title">
          <p className="product-category">{product.category}</p>
          <h1 id="product-title">{product.name}</h1>
          <div className="product-rating">
            <Stars rating={product.rating} />
            <span className="muted">({product.reviewCount} reviews)</span>
          </div>
          <p className="price price-lg" data-testid="product-price">
            {formatPrice(product.price)}
          </p>
          <p className={`stock ${soldOut ? 'out' : ''}`} data-testid="stock-status">
            {soldOut ? t('catalog.outOfStock') : product.stock < 5 ? `Only ${product.stock} left in stock` : t('product.inStock')}
          </p>

          <p className="shipping-note">
            Free shipping on orders over {formatPrice(FREE_SHIPPING_THRESHOLD)}{' '}
            <Tooltip label="Shipping information" content={`Standard shipping is free for orders of ${formatPrice(FREE_SHIPPING_THRESHOLD)} or more. Express shipping is always $14.99.`}>
              <span aria-hidden="true">ⓘ</span>
            </Tooltip>
          </p>

          {product.sizes.length > 0 && (
            <OptionGroup legend={t('product.size')} name="size" options={product.sizes} value={size} onChange={(v) => { setSize(v); setQty(1); setError(''); }} renderLabel={(o) => <span>{o.name}</span>} />
          )}
          {product.colors.length > 0 && (
            <OptionGroup
              legend={t('product.color')}
              name="color"
              options={product.colors}
              value={color}
              onChange={(v) => { setColor(v); setQty(1); setError(''); }}
              renderLabel={(o) => (
                <>
                  <span className="swatch" style={{ background: o.hex }} aria-hidden="true" />
                  <span>{o.name}</span>
                </>
              )}
            />
          )}

          <div className="buy-row">
            <QuantityStepper label={t('product.quantity')} value={Math.min(qty, maxQty)} max={maxQty} onChange={setQty} />
            <button type="button" className="btn btn-primary btn-lg" onClick={onAdd} disabled={soldOut}>
              {soldOut ? t('catalog.outOfStock') : t('product.addToCart')}
            </button>
          </div>
          <Alert data-testid="add-to-cart-error">{error}</Alert>

          <button type="button" className="btn btn-secondary" onClick={share}>
            {t('product.share')} ↗
          </button>
        </section>
      </div>

      <Tabs
        label="Product information"
        tabs={[
          {
            id: 'description',
            label: t('product.description'),
            content: (
              <>
                <p>{product.description}</p>
                <ul>
                  {product.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            ),
          },
          { id: 'reviews', label: `${t('product.reviews')} (${product.reviews.length})`, content: <Reviews reviews={product.reviews} /> },
          { id: 'qa', label: t('product.qa'), content: <QuestionsAndAnswers product={product} /> },
        ]}
      />

      <Modal open={zoomOpen} onClose={() => setZoomOpen(false)} returnFocusRef={zoomButtonRef} title={`${product.name} – image ${imageIndex + 1}`} size="lg">
        <div className="zoom-view">
          <img src={product.images[imageIndex]} alt={`${product.name}, enlarged view ${imageIndex + 1}`} />
          <div className="zoom-nav">
            <button type="button" className="btn btn-secondary" onClick={() => setImageIndex((i) => (i - 1 + product.images.length) % product.images.length)}>
              Previous image
            </button>
            <span>
              {imageIndex + 1} / {product.images.length}
            </span>
            <button type="button" className="btn btn-secondary" onClick={() => setImageIndex((i) => (i + 1) % product.images.length)}>
              Next image
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
