// Deterministic seed data. Every call to createDb() returns a fresh copy, so /api/reset
// always puts the app back into exactly the same state.

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CATEGORIES = ['Electronics', 'Clothing', 'Home', 'Books', 'Sports', 'Toys'];

const NAMES = {
  Electronics: ['Wireless Headphones', 'Bluetooth Speaker', 'Smart Watch', 'USB-C Hub', 'Mechanical Keyboard', 'Gaming Mouse', '4K Webcam', 'Portable Charger'],
  Clothing: ['Classic T-Shirt', 'Denim Jacket', 'Running Shoes', 'Wool Sweater', 'Summer Dress', 'Cargo Pants', 'Rain Coat', 'Hoodie'],
  Home: ['Ceramic Mug Set', 'Desk Lamp', 'Throw Pillow', 'Scented Candle', 'Wall Clock', 'Plant Pot', 'Bath Towel Set', 'Coffee Grinder'],
  Books: ['The Testing Mindset', 'JavaScript Patterns', 'Design Systems Handbook', 'Clean Automation', 'Async Adventures', 'The Selector Guide', 'Flaky No More', 'CSS Unleashed'],
  Sports: ['Yoga Mat', 'Dumbbell Pair', 'Water Bottle', 'Tennis Racket', 'Cycling Gloves', 'Jump Rope', 'Football', 'Resistance Bands'],
  Toys: ['Building Blocks', 'Puzzle 1000 Pieces', 'Remote Control Car', 'Plush Bear', 'Board Game Night', 'Stunt Kite', 'Wooden Train Set', 'Magic Kit'],
};

const PRICE_RANGES = {
  Electronics: [25, 450],
  Clothing: [15, 180],
  Home: [10, 120],
  Books: [8, 60],
  Sports: [10, 220],
  Toys: [9, 140],
};

const COLORS = [
  { name: 'Black', hex: '#1f2937' },
  { name: 'White', hex: '#f9fafb' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Green', hex: '#16a34a' },
];

const REVIEWERS = ['Sam K.', 'Lina M.', 'Omar A.', 'Priya S.', 'Tom W.', 'Yuki T.', 'Nadia B.', 'Carlos R.'];
const REVIEW_TEXT = [
  'Exactly what I needed. Would buy again.',
  'Good quality for the price.',
  'Arrived quickly and well packaged.',
  'Not quite what I expected, but it works.',
  'Absolutely love it!',
  'Decent, though the colour was slightly different from the photos.',
  'Stopped working after a month. Disappointed.',
  'Great value. Recommended to my friends.',
];

const QUESTIONS = [
  { question: 'Is this item covered by a warranty?', answer: 'Yes, all items include a 12-month warranty.' },
  { question: 'Can I return it if it does not fit?', answer: 'Returns are free within 30 days.' },
  { question: 'Do you ship internationally?', answer: null },
];

const DAY = 24 * 60 * 60 * 1000;
// Fixed reference date keeps seed data identical between runs (useful for visual tests).
const SEED_NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

function buildProducts(rand) {
  const products = [];
  let id = 1;
  for (const category of CATEGORIES) {
    for (const name of NAMES[category]) {
      const [lo, hi] = PRICE_RANGES[category];
      const price = (Math.round(lo + rand() * (hi - lo)) * 100 - 1) / 100; // e.g. 47.99
      const rating = Math.round((1.5 + rand() * 3.5) * 10) / 10;
      const reviewCount = Math.floor(rand() * 5);
      const reviews = Array.from({ length: reviewCount }, (_, i) => ({
        id: `${id}-${i + 1}`,
        author: REVIEWERS[Math.floor(rand() * REVIEWERS.length)],
        rating: Math.max(1, Math.min(5, Math.round(rating + (rand() * 2 - 1)))),
        comment: REVIEW_TEXT[Math.floor(rand() * REVIEW_TEXT.length)],
        date: new Date(SEED_NOW - Math.floor(rand() * 90) * DAY).toISOString(),
      }));

      let sizes = [];
      let colors = [];
      if (category === 'Clothing') {
        const sizeNames = name === 'Running Shoes' ? ['38', '39', '40', '41', '42', '43'] : ['XS', 'S', 'M', 'L', 'XL'];
        sizes = sizeNames.map((s) => ({ name: s, stock: rand() < 0.25 ? 0 : 1 + Math.floor(rand() * 12) }));
      }
      if (category === 'Clothing' || category === 'Electronics') {
        colors = COLORS.slice(0, 2 + Math.floor(rand() * 3)).map((c) => ({ ...c, stock: rand() < 0.2 ? 0 : 1 + Math.floor(rand() * 15) }));
      }
      const stock = rand() < 0.08 ? 0 : 3 + Math.floor(rand() * 40);

      products.push({
        id,
        name,
        category,
        price: Math.max(price, 4.99),
        rating,
        reviewCount,
        stock,
        description: `The ${name} is one of our best-loved ${category.toLowerCase()} products. Carefully designed, built to last, and backed by our 30-day return policy.`,
        features: ['Free returns within 30 days', '12-month warranty', 'Ships in eco-friendly packaging'],
        imageCount: 4,
        sizes,
        colors,
        reviews,
        questions: QUESTIONS.slice(0, 1 + (id % 3)).map((q, i) => ({ id: `${id}-q${i + 1}`, ...q, author: REVIEWERS[(id + i) % REVIEWERS.length], date: new Date(SEED_NOW - (i + 3) * DAY).toISOString() })),
        createdAt: new Date(SEED_NOW - id * DAY).toISOString(),
      });
      id++;
    }
  }

  // Hand-tuned products that tests can rely on.
  const headphones = products.find((p) => p.name === 'Wireless Headphones');
  Object.assign(headphones, {
    price: 99.99,
    rating: 4.5,
    stock: 8,
    colors: [
      { name: 'Black', hex: '#1f2937', stock: 5 },
      { name: 'White', hex: '#f9fafb', stock: 0 },
      { name: 'Blue', hex: '#2563eb', stock: 3 },
    ],
  });
  const tshirt = products.find((p) => p.name === 'Classic T-Shirt');
  Object.assign(tshirt, {
    price: 19.99,
    stock: 20,
    sizes: [
      { name: 'XS', stock: 0 },
      { name: 'S', stock: 4 },
      { name: 'M', stock: 10 },
      { name: 'L', stock: 6 },
      { name: 'XL', stock: 0 },
    ],
    colors: [
      { name: 'Black', hex: '#1f2937', stock: 12 },
      { name: 'White', hex: '#f9fafb', stock: 8 },
      { name: 'Red', hex: '#dc2626', stock: 0 },
    ],
  });
  const kite = products.find((p) => p.name === 'Stunt Kite');
  Object.assign(kite, { stock: 0 }); // always out of stock
  const book = products.find((p) => p.name === 'The Testing Mindset');
  Object.assign(book, { price: 24.99, stock: 50, rating: 4.9 });

  return products;
}

function buildOrders(products) {
  const pick = (name) => products.find((p) => p.name === name);
  const line = (name, qty, extra = {}) => {
    const p = pick(name);
    return { productId: p.id, name: p.name, price: p.price, qty, size: null, color: null, ...extra };
  };
  const address = (fullName, city) => ({ fullName, street: '12 Test Street', city, postalCode: '10001', country: 'United States', phone: '+1 555 0100' });

  const specs = [
    { userId: 2, status: 'delivered', daysAgo: 12, items: [line('The Testing Mindset', 1), line('Ceramic Mug Set', 2)], city: 'New York' },
    { userId: 2, status: 'shipped', daysAgo: 4, items: [line('Wireless Headphones', 1, { color: 'Black' })], city: 'New York' },
    { userId: 2, status: 'pending', daysAgo: 1, items: [line('Classic T-Shirt', 2, { size: 'M', color: 'Black' })], city: 'New York' },
    { userId: 4, status: 'pending', daysAgo: 0, items: [line('Yoga Mat', 1), line('Water Bottle', 2)], city: 'Boston' },
    { userId: 4, status: 'shipped', daysAgo: 3, items: [line('Board Game Night', 1)], city: 'Boston' },
    { userId: 4, status: 'delivered', daysAgo: 6, items: [line('Desk Lamp', 1), line('Scented Candle', 3)], city: 'Boston' },
    { userId: 4, status: 'delivered', daysAgo: 5, items: [line('Mechanical Keyboard', 1)], city: 'Boston' },
    { userId: 2, status: 'delivered', daysAgo: 2, items: [line('Running Shoes', 1, { size: '41', color: 'Black' })], city: 'New York' },
  ];

  // Orders are relative to the real current time so the admin "last 7 days" charts always have data.
  const now = Date.now();
  return specs.map((s, i) => {
    const subtotal = Math.round(s.items.reduce((sum, it) => sum + it.price * it.qty, 0) * 100) / 100;
    const shipping = subtotal >= 100 ? 0 : 5.99;
    const users = { 2: 'Uma User', 4: 'Jane Doe' };
    return {
      id: 1001 + i,
      number: `ORD-${1001 + i}`,
      userId: s.userId,
      customerName: users[s.userId],
      items: s.items,
      address: address(users[s.userId], s.city),
      shippingMethod: 'standard',
      deliveryDate: new Date(now - (s.daysAgo - 6) * DAY).toISOString().slice(0, 10),
      coupon: null,
      payment: { brand: 'Visa', last4: '4242' },
      subtotal,
      discount: 0,
      shipping,
      total: Math.round((subtotal + shipping) * 100) / 100,
      status: s.status,
      createdAt: new Date(now - s.daysAgo * DAY).toISOString(),
    };
  });
}

export const COUPONS = [
  { code: 'SAVE10', type: 'percent', value: 10, description: '10% off your order', expiresAt: '2099-12-31' },
  { code: 'WELCOME5', type: 'fixed', value: 5, minSubtotal: 20, description: '$5 off orders over $20', expiresAt: '2099-12-31' },
  { code: 'FREESHIP', type: 'freeship', value: 0, description: 'Free shipping', expiresAt: '2099-12-31' },
  { code: 'SUMMER20', type: 'percent', value: 20, description: '20% off (summer sale)', expiresAt: '2024-09-01' },
];

export function createDb() {
  const rand = mulberry32(42);
  const products = buildProducts(rand);
  return {
    users: [
      { id: 1, name: 'Ada Admin', email: 'admin@shoplab.test', password: 'Admin123!', role: 'admin', phone: '', bio: '', locked: false, failedAttempts: 0, avatar: null, createdAt: new Date(SEED_NOW - 400 * DAY).toISOString() },
      { id: 2, name: 'Uma User', email: 'user@shoplab.test', password: 'Password123!', role: 'user', phone: '+1 555 0100', bio: 'I love testing things.', locked: false, failedAttempts: 0, avatar: null, createdAt: new Date(SEED_NOW - 200 * DAY).toISOString() },
      { id: 3, name: 'Luke Locked', email: 'locked@shoplab.test', password: 'Password123!', role: 'user', phone: '', bio: '', locked: true, failedAttempts: 3, avatar: null, createdAt: new Date(SEED_NOW - 100 * DAY).toISOString() },
      { id: 4, name: 'Jane Doe', email: 'jane@shoplab.test', password: 'Password123!', role: 'user', phone: '', bio: '', locked: false, failedAttempts: 0, avatar: null, createdAt: new Date(SEED_NOW - 50 * DAY).toISOString() },
    ],
    products,
    orders: buildOrders(products),
    nextIds: { user: 5, product: products.length + 1, order: 1009 },
  };
}
