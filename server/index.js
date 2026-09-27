import express from 'express';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import { createDb, CATEGORIES, COUPONS } from './seed.js';
import { productSvg, invoicePdf, toCsv, parseCsv } from './files.js';
import { computeTotals, SHIPPING_METHODS, MAX_QTY_PER_ITEM, round } from '../src/lib/pricing.js';

const PORT = Number(process.env.PORT || 3101);
// Artificial latency on catalog endpoints so skeleton loaders are visible. Override per request with ?delay=ms.
const API_LATENCY = Number(process.env.API_LATENCY ?? 400);
const SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours
const REMEMBER_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_FAILED_LOGINS = 3;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ORDER_STATUSES = ['pending', 'shipped', 'delivered'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

let db = createDb();
const sessions = new Map(); // token -> { userId, expiresAt }

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------- helpers ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone,
  bio: u.bio,
  avatarUrl: u.avatar ? `/api/avatars/${u.id}?v=${u.avatar.version}` : null,
  createdAt: u.createdAt,
});
const imageUrl = (p, i = 0) => `/api/images/products/${p.id}/${i}.svg`;
const productSummary = (p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price,
  rating: p.rating,
  reviewCount: p.reviews.length,
  stock: p.stock,
  image: imageUrl(p),
});
const productDetail = (p) => ({
  ...productSummary(p),
  description: p.description,
  features: p.features,
  images: Array.from({ length: p.imageCount }, (_, i) => imageUrl(p, i)),
  sizes: p.sizes,
  colors: p.colors,
  reviews: p.reviews,
  questions: p.questions,
});
const bodyOf = (req) => req.body || {};
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function createSession(userId, remember) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { userId, expiresAt: Date.now() + (remember ? REMEMBER_TTL : SESSION_TTL) });
  return token;
}

function tokenFrom(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function userForToken(token) {
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) return null;
  return db.users.find((u) => u.id === session.userId) || null;
}

function auth(req, res, next) {
  const token = tokenFrom(req);
  if (!token) return res.status(401).json({ error: 'You need to log in to do that.', code: 'NOT_AUTHENTICATED' });
  const user = userForToken(token);
  if (!user) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Your session has expired. Please log in again.', code: 'SESSION_EXPIRED' });
  }
  req.user = user;
  req.token = token;
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'You do not have permission to do that.', code: 'FORBIDDEN' });
  next();
}

function latency(req, res, next) {
  const ms = req.query.delay !== undefined ? Number(req.query.delay) : API_LATENCY;
  if (ms > 0) sleep(Math.min(ms, 10000)).then(next);
  else next();
}

function validateProductInput(input, { partial = false } = {}) {
  const errors = {};
  const out = {};
  if (!partial || 'name' in input) {
    const name = str(input.name);
    if (name.length < 2) errors.name = 'Name must be at least 2 characters';
    else out.name = name;
  }
  if (!partial || 'category' in input) {
    if (!CATEGORIES.includes(input.category)) errors.category = `Category must be one of: ${CATEGORIES.join(', ')}`;
    else out.category = input.category;
  }
  if (!partial || 'price' in input) {
    const price = Number(input.price);
    if (input.price === '' || !Number.isFinite(price) || price <= 0) errors.price = 'Price must be a positive number';
    else out.price = round(price);
  }
  if (!partial || 'stock' in input) {
    const stock = Number(input.stock);
    if (input.stock === '' || !Number.isInteger(stock) || stock < 0) errors.stock = 'Stock must be a whole number of 0 or more';
    else out.stock = stock;
  }
  if ('description' in input) out.description = str(input.description);
  return { errors, value: out };
}

function newProduct(value) {
  return {
    id: db.nextIds.product++,
    description: '',
    features: ['Free returns within 30 days'],
    imageCount: 4,
    sizes: [],
    colors: [],
    reviews: [],
    questions: [],
    rating: 0,
    createdAt: new Date().toISOString(),
    ...value,
  };
}

// ---------- websocket ----------

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket, req) => {
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  const user = userForToken(token);
  if (!user || user.role !== 'admin') {
    socket.close(4401, 'Unauthorized');
    return;
  }
  socket.isAdmin = true;
  socket.send(JSON.stringify({ type: 'hello', message: 'Connected to ShopLab live updates' }));
});

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of wss.clients) if (client.isAdmin && client.readyState === 1) client.send(data);
}

// ---------- test utilities ----------

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/reset', (req, res) => {
  db = createDb();
  sessions.clear();
  res.json({ ok: true, message: 'Database reset to seed data' });
});

app.post('/api/test/expire-sessions', (req, res) => {
  const { token } = bodyOf(req);
  for (const [t, s] of sessions) if (!token || token === t) s.expiresAt = 0;
  res.json({ ok: true });
});

app.post('/api/test/new-order', (req, res) => res.status(201).json(createRandomOrder()));

// ---------- auth ----------

app.post('/api/auth/login', (req, res) => {
  const email = str(bodyOf(req).email).toLowerCase();
  const { password = '', remember = false } = bodyOf(req);
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.', code: 'VALIDATION' });

  const user = db.users.find((u) => u.email.toLowerCase() === email);
  const lockedResponse = () =>
    res.status(423).json({ error: 'Your account has been locked after too many failed attempts. Reset your password to unlock it.', code: 'ACCOUNT_LOCKED' });

  if (user?.locked) return lockedResponse();
  if (!user || user.password !== password) {
    if (user) {
      user.failedAttempts++;
      if (user.failedAttempts >= MAX_FAILED_LOGINS) {
        user.locked = true;
        return lockedResponse();
      }
      const left = MAX_FAILED_LOGINS - user.failedAttempts;
      return res.status(401).json({ error: `Invalid email or password. ${left} attempt${left === 1 ? '' : 's'} left.`, code: 'INVALID_CREDENTIALS', attemptsLeft: left });
    }
    return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
  }

  user.failedAttempts = 0;
  const token = createSession(user.id, Boolean(remember));
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  const b = bodyOf(req);
  const name = str(b.name);
  const email = str(b.email).toLowerCase();
  const errors = {};
  if (name.length < 2) errors.name = 'Please enter your full name';
  if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address';
  if (!PASSWORD_RE.test(b.password || '')) errors.password = 'Password must be at least 8 characters and include uppercase, lowercase and a number';
  if (b.password !== b.confirmPassword) errors.confirmPassword = 'Passwords do not match';
  if (!b.acceptTerms) errors.acceptTerms = 'You must accept the terms and conditions';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the errors below.', code: 'VALIDATION', fields: errors });
  if (db.users.some((u) => u.email === email)) {
    return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_TAKEN', fields: { email: 'An account with this email already exists' } });
  }
  const user = { id: db.nextIds.user++, name, email, password: b.password, role: 'user', phone: '', bio: '', locked: false, failedAttempts: 0, avatar: null, createdAt: new Date().toISOString() };
  db.users.push(user);
  const token = createSession(user.id, false);
  res.status(201).json({ token, user: publicUser(user) });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const email = str(bodyOf(req).email).toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address', code: 'VALIDATION' });
  const user = db.users.find((u) => u.email === email);
  // Practice-app shortcut: requesting a reset unlocks the account.
  if (user) Object.assign(user, { locked: false, failedAttempts: 0 });
  res.json({ message: 'If an account exists for that email, we have sent a password reset link.' });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/auth/logout', (req, res) => {
  const token = tokenFrom(req);
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

// ---------- catalog ----------

app.get('/api/categories', (req, res) => {
  res.json(CATEGORIES.map((name) => ({ name, count: db.products.filter((p) => p.category === name).length })));
});

app.get('/api/products', latency, (req, res) => {
  const q = str(req.query.q).toLowerCase();
  const categories = str(req.query.category).split(',').filter(Boolean);
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
  const minRating = req.query.rating ? Number(req.query.rating) : null;
  const sort = str(req.query.sort) || 'relevance';
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 100);

  let items = db.products.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false;
    if (categories.length && !categories.includes(p.category)) return false;
    if (minPrice !== null && p.price < minPrice) return false;
    if (maxPrice !== null && p.price > maxPrice) return false;
    if (minRating !== null && p.rating < minRating) return false;
    return true;
  });

  const sorters = {
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    'rating-desc': (a, b) => b.rating - a.rating,
    'name-asc': (a, b) => a.name.localeCompare(b.name),
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  };
  if (sorters[sort]) items = [...items].sort(sorters[sort]);

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(Number(req.query.page) || 1, 1), pages);
  res.json({ items: items.slice((page - 1) * limit, page * limit).map(productSummary), total, page, pages, limit });
});

app.get('/api/products/:id', latency, (req, res) => {
  const product = db.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' });
  res.json(productDetail(product));
});

app.post('/api/products/:id/questions', auth, (req, res) => {
  const product = db.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const question = str(bodyOf(req).question);
  if (question.length < 10) return res.status(400).json({ error: 'Your question must be at least 10 characters.', code: 'VALIDATION' });
  const entry = { id: `${product.id}-q${Date.now()}`, question, answer: null, author: req.user.name, date: new Date().toISOString() };
  product.questions.push(entry);
  res.status(201).json(entry);
});

app.get('/api/images/products/:id/:index.svg', (req, res) => {
  const product = db.products.find((p) => p.id === Number(req.params.id)) || { id: Number(req.params.id) || 0, name: 'Product' };
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(productSvg(product, Number(req.params.index) || 0));
});

app.get('/api/avatars/:userId', (req, res) => {
  const user = db.users.find((u) => u.id === Number(req.params.userId));
  if (!user?.avatar) return res.status(404).end();
  res.type(user.avatar.mimetype).send(user.avatar.buffer);
});

// ---------- coupons ----------

function findCoupon(code) {
  const coupon = COUPONS.find((c) => c.code === str(code).toUpperCase());
  if (!coupon) return { status: 404, body: { error: 'This coupon code is not valid.', code: 'COUPON_INVALID' } };
  if (new Date(coupon.expiresAt) < new Date()) return { status: 400, body: { error: 'This coupon has expired.', code: 'COUPON_EXPIRED' } };
  return { coupon };
}

app.post('/api/coupons/validate', (req, res) => {
  const { code, subtotal } = bodyOf(req);
  if (!str(code)) return res.status(400).json({ error: 'Please enter a coupon code.', code: 'VALIDATION' });
  const result = findCoupon(code);
  if (!result.coupon) return res.status(result.status).json(result.body);
  const { coupon } = result;
  if (coupon.minSubtotal && Number(subtotal) < coupon.minSubtotal) {
    return res.status(400).json({ error: `This coupon requires a minimum order of $${coupon.minSubtotal}.`, code: 'COUPON_MIN_SUBTOTAL' });
  }
  const { expiresAt, ...publicCoupon } = coupon;
  res.json(publicCoupon);
});

// ---------- orders ----------

function placeOrder(user, input) {
  const errors = {};
  const items = [];
  for (const line of Array.isArray(input.items) ? input.items : []) {
    const product = db.products.find((p) => p.id === Number(line.productId));
    const qty = Number(line.qty);
    if (!product) { errors.items = 'One of the products in your cart no longer exists.'; continue; }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) { errors.items = `Invalid quantity for ${product.name}.`; continue; }
    const variantStock = [
      product.stock,
      line.size ? product.sizes.find((s) => s.name === line.size)?.stock ?? 0 : Infinity,
      line.color ? product.colors.find((c) => c.name === line.color)?.stock ?? 0 : Infinity,
    ];
    if (Math.min(...variantStock) < qty) { errors.items = `Sorry, ${product.name} does not have enough stock.`; continue; }
    items.push({ productId: product.id, name: product.name, price: product.price, qty, size: line.size || null, color: line.color || null, product });
  }
  if (!items.length && !errors.items) errors.items = 'Your cart is empty.';

  const a = input.address || {};
  for (const f of ['fullName', 'street', 'city', 'postalCode', 'country']) if (!str(a[f])) errors[`address.${f}`] = 'Required';

  if (!SHIPPING_METHODS[input.shippingMethod]) errors.shippingMethod = 'Choose a shipping method';
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate || '') || input.deliveryDate <= today) errors.deliveryDate = 'Choose a delivery date in the future';

  const payment = input.payment || {};
  if (!/^\d{4}$/.test(payment.last4 || '') || !payment.token) errors.payment = 'Payment details are missing';

  let coupon = null;
  if (input.coupon) {
    const result = findCoupon(input.coupon);
    if (!result.coupon) errors.coupon = result.body.error;
    else coupon = result.coupon;
  }

  if (Object.keys(errors).length) return { status: 400, body: { error: Object.values(errors)[0], code: 'VALIDATION', fields: errors } };
  if (payment.last4 === '0002') return { status: 402, body: { error: 'Your card was declined. Please use a different card.', code: 'CARD_DECLINED' } };

  const totals = computeTotals(items, coupon, input.shippingMethod);
  for (const it of items) {
    it.product.stock -= it.qty;
    const size = it.product.sizes.find((s) => s.name === it.size);
    if (size) size.stock -= it.qty;
    const color = it.product.colors.find((c) => c.name === it.color);
    if (color) color.stock -= it.qty;
    delete it.product;
  }

  const id = db.nextIds.order++;
  const order = {
    id,
    number: `ORD-${id}`,
    userId: user.id,
    customerName: user.name,
    items,
    address: { fullName: str(a.fullName), street: str(a.street), city: str(a.city), postalCode: str(a.postalCode), country: str(a.country), phone: str(a.phone) },
    shippingMethod: input.shippingMethod,
    deliveryDate: input.deliveryDate,
    coupon: totals.couponApplied ? coupon.code : null,
    payment: { brand: str(payment.brand) || 'Card', last4: payment.last4 },
    subtotal: totals.subtotal,
    discount: totals.discount,
    shipping: totals.shipping,
    total: totals.total,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.orders.push(order);
  broadcast({ type: 'order:new', order });
  return { status: 201, body: order };
}

function createRandomOrder() {
  const customer = db.users.find((u) => u.id === 4) || db.users.find((u) => u.role === 'user') || db.users[0];
  const inStock = db.products.filter((p) => p.stock > 0 && !p.sizes.length && !p.colors.length);
  const product = inStock[Math.floor(Math.random() * inStock.length)];
  const deliveryDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  return placeOrder(customer, {
    items: [{ productId: product.id, qty: 1 }],
    address: { fullName: customer.name, street: '1 Simulation Way', city: 'Testville', postalCode: '12345', country: 'United States' },
    shippingMethod: 'standard',
    deliveryDate,
    payment: { brand: 'Visa', last4: '4242', token: 'tok_simulated' },
  }).body;
}

app.post('/api/orders', auth, (req, res) => {
  const result = placeOrder(req.user, bodyOf(req));
  res.status(result.status).json(result.body);
});

app.get('/api/orders', auth, (req, res) => {
  res.json(db.orders.filter((o) => o.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

function findOrderFor(req, res) {
  const order = db.orders.find((o) => o.id === Number(req.params.id));
  if (!order || (order.userId !== req.user.id && req.user.role !== 'admin')) {
    res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' });
    return null;
  }
  return order;
}

app.get('/api/orders/:id', auth, (req, res) => {
  const order = findOrderFor(req, res);
  if (order) res.json(order);
});

app.get('/api/orders/:id/invoice', auth, (req, res) => {
  const order = findOrderFor(req, res);
  if (!order) return;
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="invoice-${order.number}.pdf"`);
  res.send(invoicePdf(order));
});

// ---------- profile ----------

app.put('/api/profile', auth, (req, res) => {
  const b = bodyOf(req);
  const errors = {};
  const name = str(b.name);
  const email = str(b.email).toLowerCase();
  const phone = str(b.phone);
  if (name.length < 2) errors.name = 'Please enter your full name';
  if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address';
  else if (db.users.some((u) => u.email === email && u.id !== req.user.id)) errors.email = 'This email is already in use';
  if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) errors.phone = 'Please enter a valid phone number';
  if (str(b.bio).length > 200) errors.bio = 'Bio must be 200 characters or fewer';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the errors below.', code: 'VALIDATION', fields: errors });
  Object.assign(req.user, { name, email, phone, bio: str(b.bio) });
  res.json({ user: publicUser(req.user) });
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: AVATAR_MAX_BYTES } });

app.post('/api/profile/avatar', auth, (req, res) => {
  upload.single('avatar')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'The image must be 2 MB or smaller.', code: 'FILE_TOO_LARGE' });
    if (err) return res.status(400).json({ error: err.message, code: 'UPLOAD_FAILED' });
    if (!req.file) return res.status(400).json({ error: 'Please choose an image to upload.', code: 'VALIDATION' });
    if (!AVATAR_TYPES.includes(req.file.mimetype)) return res.status(415).json({ error: 'Only PNG, JPG or WebP images are allowed.', code: 'INVALID_FILE_TYPE' });
    req.user.avatar = { buffer: req.file.buffer, mimetype: req.file.mimetype, version: Date.now() };
    res.json({ user: publicUser(req.user) });
  });
});

app.delete('/api/profile/avatar', auth, (req, res) => {
  req.user.avatar = null;
  res.json({ user: publicUser(req.user) });
});

app.put('/api/profile/password', auth, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = bodyOf(req);
  if (currentPassword !== req.user.password) return res.status(400).json({ error: 'Your current password is incorrect.', code: 'WRONG_PASSWORD', fields: { currentPassword: 'Your current password is incorrect' } });
  if (!PASSWORD_RE.test(newPassword || '')) return res.status(400).json({ error: 'Password must be at least 8 characters and include uppercase, lowercase and a number', code: 'VALIDATION', fields: { newPassword: 'Password must be at least 8 characters and include uppercase, lowercase and a number' } });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match', code: 'VALIDATION', fields: { confirmPassword: 'Passwords do not match' } });
  if (newPassword === currentPassword) return res.status(400).json({ error: 'New password must be different from the current one', code: 'VALIDATION', fields: { newPassword: 'New password must be different from the current one' } });
  req.user.password = newPassword;
  res.json({ ok: true, message: 'Password updated' });
});

app.delete('/api/profile', auth, (req, res) => {
  if (req.user.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be deleted.', code: 'FORBIDDEN' });
  db.users = db.users.filter((u) => u.id !== req.user.id);
  for (const [t, s] of sessions) if (s.userId === req.user.id) sessions.delete(t);
  res.json({ ok: true });
});

// ---------- admin ----------

const admin = express.Router();
admin.use(auth, adminOnly);

admin.get('/stats', (req, res) => {
  const days = 7;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const salesByDay = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getTime() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    const dayOrders = db.orders.filter((o) => o.createdAt.slice(0, 10) === d);
    return { date: d, total: round(dayOrders.reduce((s, o) => s + o.total, 0)), orders: dayOrders.length };
  });
  res.json({
    revenue: round(db.orders.reduce((s, o) => s + o.total, 0)),
    orderCount: db.orders.length,
    customerCount: db.users.filter((u) => u.role === 'user').length,
    productCount: db.products.length,
    lowStockCount: db.products.filter((p) => p.stock < 5).length,
    ordersByStatus: Object.fromEntries(ORDER_STATUSES.map((s) => [s, db.orders.filter((o) => o.status === s).length])),
    salesByDay,
    recentOrders: [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  });
});

admin.get('/products', (req, res) => {
  res.json(db.products.map((p) => ({ ...productSummary(p), description: p.description })));
});

admin.post('/products', (req, res) => {
  const { errors, value } = validateProductInput(bodyOf(req));
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the errors below.', code: 'VALIDATION', fields: errors });
  const product = newProduct(value);
  db.products.push(product);
  res.status(201).json(productSummary(product));
});

admin.put('/products/:id', (req, res) => {
  const product = db.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const { errors, value } = validateProductInput(bodyOf(req), { partial: true });
  if (Object.keys(errors).length) return res.status(400).json({ error: Object.values(errors)[0], code: 'VALIDATION', fields: errors });
  Object.assign(product, value);
  res.json({ ...productSummary(product), description: product.description });
});

admin.delete('/products/:id', (req, res) => {
  const before = db.products.length;
  db.products = db.products.filter((p) => p.id !== Number(req.params.id));
  if (db.products.length === before) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true });
});

admin.post('/products/bulk-delete', (req, res) => {
  const ids = new Set((bodyOf(req).ids || []).map(Number));
  if (!ids.size) return res.status(400).json({ error: 'No products selected' });
  const before = db.products.length;
  db.products = db.products.filter((p) => !ids.has(p.id));
  res.json({ deleted: before - db.products.length });
});

const CSV_COLUMNS = ['id', 'name', 'category', 'price', 'stock', 'description'];

admin.get('/products/export', (req, res) => {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="products.csv"');
  res.send(toCsv(db.products, CSV_COLUMNS));
});

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

admin.post('/products/import', (req, res) => {
  csvUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The CSV file must be 1 MB or smaller.' : err.message });
    if (!req.file) return res.status(400).json({ error: 'Please choose a CSV file.' });
    if (!/\.csv$/i.test(req.file.originalname)) return res.status(415).json({ error: 'Only .csv files can be imported.', code: 'INVALID_FILE_TYPE' });

    const rows = parseCsv(req.file.buffer.toString('utf8'));
    if (rows.length < 2) return res.status(400).json({ error: 'The CSV file has no data rows.' });
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const missing = ['name', 'category', 'price', 'stock'].filter((c) => !header.includes(c));
    if (missing.length) return res.status(400).json({ error: `Missing required column(s): ${missing.join(', ')}` });

    let created = 0;
    let updated = 0;
    const errors = [];
    rows.slice(1).forEach((cells, i) => {
      const record = Object.fromEntries(header.map((h, j) => [h, (cells[j] ?? '').trim()]));
      const existing = record.id ? db.products.find((p) => p.id === Number(record.id)) : null;
      const { errors: fieldErrors, value } = validateProductInput(record, { partial: false });
      if (Object.keys(fieldErrors).length) {
        errors.push({ row: i + 2, message: Object.values(fieldErrors).join('; ') });
        return;
      }
      if (existing) { Object.assign(existing, value); updated++; }
      else { db.products.push(newProduct(value)); created++; }
    });
    res.json({ created, updated, errors });
  });
});

admin.get('/orders', (req, res) => {
  res.json([...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

admin.patch('/orders/:id', (req, res) => {
  const order = db.orders.find((o) => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { status } = bodyOf(req);
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });
  order.status = status;
  broadcast({ type: 'order:updated', order });
  res.json(order);
});

admin.post('/simulate-order', (req, res) => res.status(201).json(createRandomOrder()));

admin.get('/users', (req, res) => res.json(db.users.map((u) => ({ ...publicUser(u), locked: u.locked }))));

app.use('/api/admin', admin);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));

// ---------- production: serve the built client ----------

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`ShopLab API listening on http://localhost:${PORT}`);
});
