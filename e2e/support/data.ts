export type Role = 'user' | 'admin' | 'jane' | 'locked';

export const USERS: Record<Role, { email: string; password: string; name: string }> = {
  user: { email: 'user@shoplab.test', password: 'Password123!', name: 'Uma User' },
  admin: { email: 'admin@shoplab.test', password: 'Admin123!', name: 'Ada Admin' },
  jane: { email: 'jane@shoplab.test', password: 'Password123!', name: 'Jane Doe' },
  locked: { email: 'locked@shoplab.test', password: 'Password123!', name: 'Luke Locked' },
};

export const STORAGE = {
  token: 'shoplab.token',
  cart: 'shoplab.cart',
  theme: 'shoplab.theme',
  lang: 'shoplab.lang',
};

// A valid 1x1 PNG, used for avatar uploads.
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export const toPrice = (text: string) => Number(text.replace(/[^0-9.]/g, ''));

export function longDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
