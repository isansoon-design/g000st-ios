import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import ipaddr from 'ipaddr.js';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const MAX_BYTES = 2 * 1024 * 1024;
export type FeedEntry = Readonly<{ key: string; content: string }>;
export function feedUrl(value: string): URL {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) {
    throw new Error('Use a public HTTP(S) feed URL without credentials or a custom port.');
  }
  url.hash = '';
  return url;
}

export function publicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}

/** Pin each connection to validated DNS results, including every redirect. */
export async function downloadFeed(value: string, signal = AbortSignal.timeout(20_000), redirects = 0): Promise<string> {
  const url = feedUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  signal.throwIfAborted();
  const addresses = await new Promise<LookupAddress[]>((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener('abort', aborted, { once: true });
    void lookup(hostname, { all: true }).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) throw new Error('Feed URL must resolve to a public address.');
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const address = addresses[0]!;
    const request = (url.protocol === 'https:' ? httpsGet : httpGet)(url, {
      signal,
      agent: false,
      family: address.family,
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'Accept-Encoding': 'identity', 'User-Agent': 'g000st-RSS/1.0' },
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        const location = response.headers.location;
        response.destroy();
        if (!location || redirects >= 3) return reject(new Error('Feed redirect limit reached.'));
        try { void downloadFeed(new URL(location, url).href, signal, redirects + 1).then(resolve, reject); }
        catch { reject(new Error('Feed returned an invalid redirect URL.')); }
        return;
      }
      if (response.statusCode !== 200) { response.destroy(); reject(new Error('Feed server did not return HTTP 200.')); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { response.destroy(new Error('Feed exceeds the 2 MB limit.')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    request.on('error', reject);
  });
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return text((value as Record<string, unknown>)['#text']);
  return '';
}
function plain(value: unknown): string {
  return text(value).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function array(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : value ? [value] : []).filter((item) => item && typeof item === 'object');
}

export function parseFeed(xml: string, sourceUrl: string): FeedEntry[] {
  if (Buffer.byteLength(xml) > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Feed must contain valid RSS or Atom XML without a DTD.');
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, processEntities: true }).parse(xml);
  const root = parsed.rss?.channel ?? parsed.feed ?? parsed.RDF;
  if (root == null || (typeof root !== 'object' && root !== '')) throw new Error('The URL does not contain an RSS or Atom feed.');
  const entries = array(root.item ?? root.entry).slice(0, 100);
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    const atomLink = array(entry.link).find((link) => !link['@_rel'] || link['@_rel'] === 'alternate');
    const rawLink = text(entry.link) || text(atomLink?.['@_href']);
    let link = '';
    try { if (rawLink) link = feedUrl(new URL(rawLink, sourceUrl).href).href; } catch { /* Skip unsafe article links. */ }
    const title = plain(entry.title);
    const summary = plain(entry.description ?? entry.summary ?? entry.encoded ?? entry.content);
    if (!title && !summary) return [];
    const identity = text(entry.guid ?? entry.id) || link || `${title}\n${text(entry.pubDate ?? entry.published ?? entry.updated)}`;
    const key = createHash('sha256').update(`${feedUrl(sourceUrl).href}\n${identity}`).digest('hex');
    if (seen.has(key)) return [];
    seen.add(key);
    const suffix = link && link.length <= 2000 ? `\n\n${link}` : '';
    const content = [title, summary].filter(Boolean).join('\n\n').slice(0, 4000 - suffix.length) + suffix;
    return [{ key, content }];
  });
}
