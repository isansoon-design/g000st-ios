import { XMLParser } from 'fast-xml-parser';
import type { SocialLinkPreviewV1 } from '../social/social-types.js';
import { downloadFeed, safeUrl } from './rss-feed.js';

const decoder = new XMLParser({ parseTagValue: false });
function decode(value: string): string {
  // HTML attributes can contain XML-compatible named/numeric entities.
  try { return String(decoder.parse(`<text>${value.replace(/</g, '&lt;')}</text>`).text ?? ''); }
  catch { return value; }
}

export function articlePreview(html: string, preview: SocialLinkPreviewV1): SocialLinkPreviewV1 {
  const metadata = new Map<string, string>();
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = new Map<string, string>();
    for (const attr of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes.set(attr[1]!.toLowerCase(), decode(attr[2] ?? attr[3] ?? attr[4] ?? ''));
    }
    const key = attributes.get('property') ?? attributes.get('name');
    const content = attributes.get('content');
    if (key && content && !metadata.has(key.toLowerCase())) metadata.set(key.toLowerCase(), content.trim());
  }
  const imageUrl = safeUrl(metadata.get('og:image') ?? metadata.get('twitter:image'), preview.url);
  return {
    ...preview,
    ...(metadata.get('og:site_name') ? { siteName: metadata.get('og:site_name')!.slice(0, 100) } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export async function enrichArticlePreview(preview: SocialLinkPreviewV1): Promise<SocialLinkPreviewV1> {
  if (preview.imageUrl) return preview;
  try {
    const html = await downloadFeed(preview.url, AbortSignal.timeout(5_000), 0, 'text/html');
    return articlePreview(html, preview);
  } catch { return preview; }
}
