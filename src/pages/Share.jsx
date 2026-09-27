import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/pricing.js';
import { Alert, Spinner } from '../components/ui.jsx';

export default function Share() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const productUrl = `${window.location.origin}/products/${id}`;

  useEffect(() => {
    api(`/products/${id}?delay=0`)
      .then((p) => {
        setProduct(p);
        document.title = `Share ${p.name} | ShopLab`;
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (error) return <div className="container"><Alert>{error}</Alert></div>;
  if (!product) return <Spinner />;

  const text = encodeURIComponent(`Check out ${product.name} on ShopLab`);
  const url = encodeURIComponent(productUrl);

  return (
    <section className="container share-page">
      <div className="card">
        <h1>Share this product</h1>
        <div className="share-product">
          <img src={product.image} alt="" width="120" height="120" />
          <div>
            <h2>{product.name}</h2>
            <p className="price">{formatPrice(product.price)}</p>
          </div>
        </div>
        <label htmlFor="share-link">Product link</label>
        <div className="copy-row">
          <input id="share-link" readOnly value={productUrl} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn btn-primary" onClick={copy}>
            Copy link
          </button>
        </div>
        {copied && <Alert type="success">Link copied to clipboard</Alert>}
        <ul className="share-links">
          <li>
            <a href={`mailto:?subject=${text}&body=${url}`}>Share by email</a>
          </li>
          <li>
            <a href={`https://twitter.com/intent/tweet?text=${text}&url=${url}`} target="_blank" rel="noreferrer">
              Share on X
            </a>
          </li>
          <li>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${url}`} target="_blank" rel="noreferrer">
              Share on Facebook
            </a>
          </li>
        </ul>
        <Link to={`/products/${product.id}`}>Back to product</Link>
      </div>
    </section>
  );
}
