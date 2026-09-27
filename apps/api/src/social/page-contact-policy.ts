export type PageSocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin';

const allowedHosts: Record<PageSocialPlatform, readonly string[]> = {
  facebook: ['facebook.com', 'fb.com'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  linkedin: ['linkedin.com'],
};

export function normalizeWhatsAppNumber(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
}

export function normalizePageSocialUrl(value: string, platform: PageSocialPlatform): string | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol !== 'https:' || url.username || url.password || !allowedHosts[platform].includes(host) || url.pathname === '/') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}
