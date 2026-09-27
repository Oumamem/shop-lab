import { useEffect, useMemo, useRef, useState } from 'react';
import { api, downloadFile } from '../../lib/api.js';
import { formatPrice } from '../../lib/pricing.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Field, Spinner } from '../../components/ui.jsx';
import Modal from '../../components/Modal.jsx';

const CATEGORIES = ['Electronics', 'Clothing', 'Home', 'Books', 'Sports', 'Toys'];
const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'price', label: 'Price', numeric: true },
  { key: 'stock', label: 'Stock', numeric: true },
];

function ProductForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({ name: '', category: '', price: '', stock: '', description: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters';
    if (!form.category) next.category = 'Please choose a category';
    if (!(Number(form.price) > 0)) next.price = 'Price must be a positive number';
    if (form.stock === '' || !Number.isInteger(Number(form.stock)) || Number(form.stock) < 0) next.stock = 'Stock must be a whole number of 0 or more';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const product = await api('/admin/products', { method: 'POST', body: { ...form, price: Number(form.price), stock: Number(form.stock) } });
      onSaved(product);
    } catch (err) {
      setErrors(err.fields || { name: err.message });
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate id="product-form" aria-label="New product">
      <Field label="Product name" error={errors.name}>
        {(p) => <input {...p} autoFocus value={form.name} onChange={set('name')} />}
      </Field>
      <Field label="Category" error={errors.category}>
        {(p) => (
          <select {...p} value={form.category} onChange={set('category')}>
            <option value="">Choose a category</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </Field>
      <div className="form-grid">
        <Field label="Price (USD)" error={errors.price}>
          {(p) => <input {...p} type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />}
        </Field>
        <Field label="Stock" error={errors.stock}>
          {(p) => <input {...p} type="number" min="0" step="1" value={form.stock} onChange={set('stock')} />}
        </Field>
      </div>
      <Field label="Description">{(p) => <textarea {...p} rows={3} value={form.description} onChange={set('description')} />}</Field>
      <div className="modal-footer-inline">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Create product'}
        </button>
      </div>
    </form>
  );
}

function EditableRow({ product, selected, onSelect, onSaved, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const firstInput = useRef(null);

  useEffect(() => {
    if (editing) firstInput.current?.focus();
  }, [editing]);

  const start = () => {
    setDraft({ name: product.name, category: product.category, price: String(product.price), stock: String(product.stock) });
    setError('');
    setEditing(true);
  };

  const save = async () => {
    try {
      const updated = await api(`/admin/products/${product.id}`, { method: 'PUT', body: { ...draft, price: Number(draft.price), stock: draft.stock === '' ? '' : Number(draft.stock) } });
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
  };

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <tr className={selected ? 'selected' : ''} data-testid={`product-row-${product.id}`}>
      <td>
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(product.id, e.target.checked)} aria-label={`Select ${product.name}`} />
      </td>
      {editing ? (
        <>
          <td>
            <input ref={firstInput} aria-label="Name" value={draft.name} onChange={set('name')} onKeyDown={onKeyDown} className="cell-input" />
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </td>
          <td>
            <select aria-label="Category" value={draft.category} onChange={set('category')} onKeyDown={onKeyDown} className="cell-input">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </td>
          <td>
            <input aria-label="Price" type="number" step="0.01" value={draft.price} onChange={set('price')} onKeyDown={onKeyDown} className="cell-input num" />
          </td>
          <td>
            <input aria-label="Stock" type="number" step="1" value={draft.stock} onChange={set('stock')} onKeyDown={onKeyDown} className="cell-input num" />
          </td>
          <td className="row-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={save}>
              Save
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </td>
        </>
      ) : (
        <>
          <td onDoubleClick={start}>{product.name}</td>
          <td onDoubleClick={start}>{product.category}</td>
          <td className="num" onDoubleClick={start}>
            {formatPrice(product.price)}
          </td>
          <td className={`num ${product.stock < 5 ? 'low-stock' : ''}`} onDoubleClick={start}>
            {product.stock}
          </td>
          <td className="row-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={start} aria-label={`Edit ${product.name}`}>
              Edit
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete([product])} aria-label={`Delete ${product.name}`}>
              Delete
            </button>
          </td>
        </>
      )}
    </tr>
  );
}

export default function AdminProducts() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [selected, setSelected] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const toast = useToast();

  const load = () => api('/admin/products').then(setProducts).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    const list = q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) : [...products];
    const col = COLUMNS.find((c) => c.key === sort.key);
    list.sort((a, b) => {
      const cmp = col.numeric ? a[sort.key] - b[sort.key] : String(a[sort.key]).localeCompare(String(b[sort.key]));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [products, query, sort]);

  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const someVisibleSelected = visible.some((p) => selected.has(p.id));
  const headerCheckbox = useRef(null);
  useEffect(() => {
    if (headerCheckbox.current) headerCheckbox.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  const selectOne = (id, on) =>
    setSelected((s) => {
      const next = new Set(s);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  const selectAll = (on) => setSelected(on ? new Set(visible.map((p) => p.id)) : new Set());

  const confirmDelete = async () => {
    const ids = toDelete.map((p) => p.id);
    try {
      if (ids.length === 1) await api(`/admin/products/${ids[0]}`, { method: 'DELETE' });
      else await api('/admin/products/bulk-delete', { method: 'POST', body: { ids } });
      setProducts((list) => list.filter((p) => !ids.includes(p.id)));
      setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
      toast.show(ids.length === 1 ? `Deleted ${toDelete[0].name}.` : `Deleted ${ids.length} products.`, { type: 'success' });
    } catch (e) {
      toast.show(e.message, { type: 'error' });
    }
    setToDelete(null);
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      const result = await api('/admin/products/import', { method: 'POST', body });
      setImportResult({ type: result.errors.length ? 'warning' : 'success', ...result });
      load();
    } catch (err) {
      setImportResult({ type: 'error', message: err.message });
    }
  };

  if (error) return <Alert>{error}</Alert>;
  if (!products) return <Spinner label="Loading products…" />;

  return (
    <section aria-labelledby="products-heading">
      <div className="page-head">
        <h1 id="products-heading">Products</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          Add product
        </button>
      </div>

      <div className="table-toolbar">
        <div className="search-box">
          <label htmlFor="product-search" className="visually-hidden">
            Search products
          </label>
          <input id="product-search" type="search" placeholder="Search by name or category…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="toolbar-controls">
          <button type="button" className="btn btn-danger" disabled={!selected.size} onClick={() => setToDelete(products.filter((p) => selected.has(p.id)))}>
            Delete selected ({selected.size})
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => downloadFile('/admin/products/export', 'products.csv').catch((e) => toast.show(e.message, { type: 'error' }))}>
            Export CSV
          </button>
          <label className="btn btn-secondary" htmlFor="csv-import">
            Import CSV
          </label>
          <input id="csv-import" type="file" accept=".csv,text/csv" className="visually-hidden" onChange={onImport} />
        </div>
      </div>

      {importResult && (
        <Alert type={importResult.type} data-testid="import-result">
          {importResult.message || (
            <>
              Imported {importResult.created} new and updated {importResult.updated} existing products.
              {importResult.errors.length > 0 && (
                <ul>
                  {importResult.errors.map((err) => (
                    <li key={err.row}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Alert>
      )}

      <p className="muted" role="status" data-testid="product-count">
        {visible.length} of {products.length} products
      </p>

      <div className="table-wrap">
        <table className="data-table admin-table">
          <caption className="visually-hidden">Products. Column headers with buttons are sortable. Double-click a cell to edit.</caption>
          <thead>
            <tr>
              <th scope="col" className="col-check">
                <input ref={headerCheckbox} type="checkbox" checked={allVisibleSelected} onChange={(e) => selectAll(e.target.checked)} aria-label="Select all products" />
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className={c.numeric ? 'num' : ''} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="sort-btn" onClick={() => toggleSort(c.key)}>
                    {c.label}
                    <span aria-hidden="true" className="sort-icon">
                      {sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
              ))}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <EditableRow
                key={p.id}
                product={p}
                selected={selected.has(p.id)}
                onSelect={selectOne}
                onSaved={(u) => {
                  setProducts((list) => list.map((x) => (x.id === u.id ? { ...x, ...u } : x)));
                  toast.show(`Saved ${u.name}.`, { type: 'success' });
                }}
                onDelete={setToDelete}
              />
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  No products match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add product">
        <ProductForm
          onCancel={() => setCreating(false)}
          onSaved={(p) => {
            setProducts((list) => [...list, p]);
            setCreating(false);
            toast.show(`Created ${p.name}.`, { type: 'success' });
          }}
        />
      </Modal>

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title={toDelete?.length === 1 ? 'Delete product?' : `Delete ${toDelete?.length} products?`}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setToDelete(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmDelete}>
              Delete
            </button>
          </>
        }
      >
        <p>{toDelete?.length === 1 ? `“${toDelete[0].name}” will be permanently deleted.` : `${toDelete?.length} products will be permanently deleted.`} This cannot be undone.</p>
      </Modal>
    </section>
  );
}
