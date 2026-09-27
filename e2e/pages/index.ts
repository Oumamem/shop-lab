import { expect, type Locator, type Page } from '@playwright/test';
import { toPrice } from '../support/data';

// Clicks the <label> of a visually hidden radio/checkbox, as a real user would.
export const labelOf = (page: Page, control: Locator) => page.locator('label').filter({ has: control });

export class Header {
  constructor(private page: Page) {}
  get nav() { return this.page.getByRole('navigation', { name: 'Main navigation' }); }
  get menuButton() { return this.page.getByRole('button', { name: 'Menu' }); }
  get cartLink() { return this.page.getByRole('link', { name: /^Cart, \d+ items$/ }); }
  get cartCount() { return this.page.getByTestId('cart-count'); }
  get currentUser() { return this.page.getByTestId('current-user').locator('.header-user-name'); }
  get logoutButton() { return this.page.getByRole('button', { name: 'Log out' }); }
  get themeToggle() { return this.page.getByRole('button', { name: /Switch to (dark|light) theme/ }); }
  get languageSelect() { return this.page.getByRole('combobox', { name: 'Language' }); }
}

export class LoginPage {
  constructor(private page: Page) {}
  get email() { return this.page.getByLabel('Email'); }
  get password() { return this.page.getByLabel('Password', { exact: true }); }
  get rememberMe() { return this.page.getByRole('checkbox', { name: 'Remember me' }); }
  get submit() { return this.page.getByRole('button', { name: 'Log in', exact: true }); }
  get error() { return this.page.getByTestId('login-error'); }

  async goto(query = '') {
    await this.page.goto(`/login${query}`);
  }

  async login(email: string, password: string, remember = false) {
    await this.email.fill(email);
    await this.password.fill(password);
    if (remember) await this.rememberMe.check();
    await this.submit.click();
  }
}

export class RegisterPage {
  constructor(private page: Page) {}
  field(label: string) { return this.page.getByLabel(label, { exact: true }); }
  get terms() { return this.page.getByRole('checkbox', { name: 'I agree to the Terms and Conditions' }); }
  get submit() { return this.page.getByRole('button', { name: 'Create account' }); }
  get strength() { return this.page.getByRole('meter', { name: 'Password strength' }); }
}

export class CatalogPage {
  constructor(private page: Page) {}
  get search() { return this.page.getByRole('searchbox', { name: 'Search products' }); }
  get cards() { return this.page.getByTestId('product-card'); }
  get cardNames() { return this.cards.getByRole('heading'); }
  get resultsCount() { return this.page.getByTestId('results-count'); }
  get skeletons() { return this.page.getByTestId('product-skeleton'); }
  get nativeSort() { return this.page.getByRole('combobox', { name: 'Sort by' }); }
  get customSort() { return this.page.getByRole('combobox', { name: 'Sort order' }); }
  get emptyState() { return this.page.getByRole('heading', { name: 'No products found' }); }
  get errorState() { return this.page.getByRole('alert').filter({ hasText: 'Something went wrong while loading products.' }); }
  get pagination() { return this.page.getByRole('navigation', { name: 'Pagination' }); }
  category(name: string) { return this.page.getByRole('checkbox', { name: new RegExp(`^${name} \\(`) }); }
  rating(label: string) { return this.page.getByRole('radio', { name: label }); }

  async goto(query = '') {
    await this.page.goto(`/products${query}`);
    await this.waitForResults();
  }

  async waitForResults() {
    await expect(this.page.locator('[aria-busy="true"]')).toHaveCount(0);
  }

  async prices() {
    await this.waitForResults();
    return (await this.cards.getByTestId('product-price').allTextContents()).map(toPrice);
  }

  async ratings() {
    await this.waitForResults();
    const labels = await this.cards.getByRole('img', { name: /^Rated/ }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || ''));
    return labels.map((l) => Number(/Rated ([\d.]+)/.exec(l)?.[1]));
  }

  async chooseView(label: 'Pages' | 'Infinite scroll') {
    await labelOf(this.page, this.page.getByRole('radio', { name: label })).click();
  }

  // Range inputs cannot be filled, so set the value the way the browser would and fire an input event.
  async setRange(label: string, value: number) {
    await this.page.getByLabel(label, { exact: true }).evaluate((el: HTMLInputElement, v) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
}

export class ProductPage {
  constructor(private page: Page) {}
  get title() { return this.page.getByRole('heading', { level: 1 }); }
  get mainImage() { return this.page.getByTestId('main-image'); }
  get zoomButton() { return this.page.getByRole('button', { name: 'Zoom image' }); }
  get quantity() { return this.page.getByRole('spinbutton', { name: 'Quantity' }); }
  get increase() { return this.page.getByRole('button', { name: 'Increase quantity' }); }
  get decrease() { return this.page.getByRole('button', { name: 'Decrease quantity' }); }
  get addToCart() { return this.page.getByRole('button', { name: 'Add to cart' }); }
  get error() { return this.page.getByTestId('add-to-cart-error'); }
  get shippingInfo() { return this.page.getByRole('button', { name: 'Shipping information' }); }
  get shareButton() { return this.page.getByRole('button', { name: /^Share/ }); }
  thumbnail(n: number) { return this.page.getByRole('button', { name: `Show image ${n}` }); }
  tab(name: string) { return this.page.getByRole('tab', { name: new RegExp(`^${name.replace(/[&()]/g, '\\$&')}`) }); }

  option(group: 'Size' | 'Colour', value: string) {
    return this.page.getByRole('group', { name: new RegExp(`^${group}:`) }).getByRole('radio', { name: new RegExp(`^${value}( \\(out of stock\\))?$`) });
  }

  async choose(group: 'Size' | 'Colour', value: string) {
    const radio = this.page.getByRole('radio', { name: new RegExp(`^${value}( \\(out of stock\\))?$`) });
    await this.page.getByRole('group', { name: new RegExp(`^${group}:`) }).locator('label').filter({ has: radio }).click();
    await expect(this.option(group, value)).toBeChecked();
  }

  async goto(id: number) {
    await this.page.goto(`/products/${id}`);
    await expect(this.title).toBeVisible();
  }
}

export class CartPage {
  constructor(private page: Page) {}
  get items() { return this.page.getByTestId('cart-item'); }
  get couponInput() { return this.page.getByLabel('Coupon code'); }
  get applyCoupon() { return this.page.getByRole('button', { name: 'Apply' }); }
  summary(line: 'subtotal' | 'discount' | 'shipping' | 'total') { return this.page.getByTestId(`summary-${line}`); }
  item(name: string) { return this.items.filter({ hasText: name }); }
  quantity(name: string) { return this.page.getByRole('spinbutton', { name: `Quantity for ${name}` }); }
  remove(name: string) { return this.page.getByRole('button', { name: `Remove ${name} from cart` }); }
}

export class CheckoutPage {
  constructor(private page: Page) {}
  get stepHeading() { return this.page.getByRole('heading', { level: 2 }).first(); }
  get calendar() { return this.page.getByRole('dialog', { name: 'Choose delivery date' }); }
  get paymentFrame() { return this.page.frameLocator('iframe[title="Secure payment form"]'); }
  get savedCard() { return this.page.getByTestId('saved-card'); }
  get placeOrder() { return this.page.getByRole('button', { name: /^Place order/ }); }
  get orderError() { return this.page.getByTestId('place-order-error'); }
  field(label: string) { return this.page.getByLabel(label, { exact: true }); }
  day(date: Date) { return this.calendar.getByRole('button', { name: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }); }

  async openCalendar() {
    await this.page.getByRole('button', { name: 'Choose date' }).click();
    await expect(this.calendar).toBeVisible();
  }

  async payWith(number: string, expiry: string, cvc: string, holder = 'Uma User') {
    const frame = this.paymentFrame;
    await frame.getByLabel('Name on card').fill(holder);
    await frame.getByLabel('Card number').fill(number);
    await frame.getByLabel('Expiry date (MM/YY)').fill(expiry);
    await frame.getByLabel('Security code (CVC)').fill(cvc);
    await frame.getByRole('button', { name: 'Save card' }).click();
  }
}

export class ProfilePage {
  constructor(private page: Page) {}
  get avatarInput() { return this.page.getByLabel('Upload avatar'); }
  get avatarImage() { return this.page.getByRole('img', { name: 'Your avatar' }); }
  get ordersTable() { return this.page.getByRole('table', { name: 'Your orders' }); }
  field(label: string) { return this.page.getByLabel(label, { exact: true }); }
  orderRow(number: string) { return this.ordersTable.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: number }) }); }
}

export class AdminProductsPage {
  constructor(private page: Page) {}
  get search() { return this.page.getByRole('searchbox', { name: 'Search products' }); }
  get rows() { return this.page.locator('table.admin-table tbody tr'); }
  get count() { return this.page.getByTestId('product-count'); }
  get importInput() { return this.page.getByLabel('Import CSV'); }
  get importResult() { return this.page.getByTestId('import-result'); }
  row(name: string) { return this.rows.filter({ hasText: name }); }
  sortBy(column: string) { return this.page.getByRole('columnheader').getByRole('button', { name: new RegExp(`^${column}`) }); }
  header(column: string) { return this.page.getByRole('columnheader', { name: new RegExp(`^${column}`) }); }

  async goto() {
    await this.page.goto('/admin/products');
    await expect(this.count).toBeVisible();
  }
}

export class AdminOrdersPage {
  constructor(private page: Page) {}
  get liveStatus() { return this.page.getByTestId('live-status'); }
  column(status: string) { return this.page.getByTestId(`column-${status.toLowerCase()}`); }
  columnCount(status: string) { return this.page.getByTestId(`count-${status.toLowerCase()}`); }
  card(number: string) { return this.page.getByTestId(`order-card-${number}`); }
}
