# ShopLab

A practice e-commerce store with an admin panel, built for learning Playwright.
React + Vite on the front end, Express with an in-memory database on the back end.

## Run it

```bash
npm install
npm run dev        # API on :3101, web on http://localhost:5173
```

Production-style: `npm run build && npm start` serves everything from http://localhost:3101.

Environment variables: `PORT` (API port, default 3101) and `API_LATENCY` (ms of artificial delay on catalog endpoints, default 400; set to 0 for fast tests).

## Demo accounts

| Email                 | Password       | Notes                    |
| --------------------- | -------------- | ------------------------ |
| `user@shoplab.test`   | `Password123!` | Has order history        |
| `admin@shoplab.test`  | `Admin123!`    | Can open `/admin`        |
| `jane@shoplab.test`   | `Password123!` | Second customer          |
| `locked@shoplab.test` | `Password123!` | Locked (use "Forgot password" to unlock) |

## Test data

| What                  | Value                                          |
| --------------------- | ---------------------------------------------- |
| Coupons               | `SAVE10` (10%), `WELCOME5` ($5, min $20), `FREESHIP`, `SUMMER20` (expired) |
| Cards (payment iframe)| `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined |
| Out-of-stock product  | Stunt Kite (`/products/46`)                    |
| Disabled variants     | Classic T-Shirt (`/products/9`): XS, XL, Red · Wireless Headphones (`/products/1`): White |

## Test hooks

| Endpoint                          | Purpose                                         |
| --------------------------------- | ----------------------------------------------- |
| `POST /api/reset`                 | Restore seed data and clear all sessions        |
| `POST /api/test/expire-sessions`  | Expire all sessions (or `{ "token": "..." }`)   |
| `POST /api/test/new-order`        | Create an order and push it over the WebSocket  |
| `GET /api/products?delay=2000`    | Override latency for one request                |

## Storage keys

- `shoplab.token`: auth token (localStorage with "Remember me", otherwise sessionStorage)
- `shoplab.cart`: cart and coupon (localStorage)
- `shoplab.theme` / `shoplab.lang`: preferences (localStorage)

## Feature map

| Area            | Routes                          | What to practise                                       |
| --------------- | ------------------------------- | ------------------------------------------------------ |
| Auth            | `/login` `/register` `/forgot-password` | Validation, lockout after 3 attempts, remember me, `?redirect=`, 403 for non-admins |
| Catalog         | `/products`                     | Debounced search, filters, native + custom sort, pagination / infinite scroll, skeletons, empty + error states (all state is in the URL) |
| Product         | `/products/:id`                 | Gallery + zoom modal, disabled variants, quantity stepper, tabs, tooltip, Share opens a new tab |
| Cart & checkout | `/cart` `/checkout`             | Totals, coupons, 4-step wizard, date picker (past disabled), payment **iframe** |
| Profile         | `/profile`                      | Avatar upload (PNG/JPG/WebP, ≤ 2 MB), password change, invoice PDF download, delete account (native `confirm`) |
| Admin           | `/admin` `/admin/products` `/admin/orders` | Sortable/searchable table, inline edit, bulk delete, CSV export/import, canvas charts, drag-and-drop kanban, WebSocket toasts |
| Global          | everywhere                      | Dark/light theme, EN/AR with RTL, hamburger menu, 404, offline banner, session expiry, skip link, Escape closes dialogs |
# shop-lab
