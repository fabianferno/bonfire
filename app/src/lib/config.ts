export const BONFIRE_BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BONFIRE_BASE_URL) ||
  'http://localhost:8080';
