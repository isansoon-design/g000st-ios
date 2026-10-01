export function safeNotificationPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return null;
  const url = new URL(value, 'https://g000st.invalid');
  return /^\/(?:notifications|mobile|chat|client-desk|reports)$/.test(url.pathname)
    || /^\/posts\/(?:social|market)\/[a-f0-9-]{36}$/.test(url.pathname)
    || /^\/users\/[A-Za-z0-9]{50}$/.test(url.pathname) ? value : null;
}
