export type TextLinkPart = Readonly<{ text: string; href?: string }>;

/** Link only web addresses, preserving surrounding text and punctuation. */
export function splitTextLinks(content: string): TextLinkPart[] {
  const pattern = /https?:\/\/[^\s<>"'`]+|(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#][^\s<>"'`]*)?/gi;
  const parts: TextLinkPart[] = [];
  let cursor = 0;
  for (const match of content.matchAll(pattern)) {
    const start = match.index;
    // Do not turn email addresses, embedded words, or other URI schemes into links.
    if (start > 0 && /[\p{L}\p{N}_@/:-]/u.test(content[start - 1])) continue;
    let text = match[0].replace(/[.,!?;:،؛؟…]+$/u, "");
    for (const [close, open] of [[")", "("], ["]", "["], ["}", "{"]]) {
      while (text.endsWith(close) && text.split(close).length > text.split(open).length) {
        text = text.slice(0, -1);
      }
    }
    text = text.replace(/[.,!?;:،؛؟…]+$/u, "");
    const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    try {
      const url = new URL(href);
      if (!url.hostname || url.username || url.password) continue;
    } catch {
      continue;
    }
    if (start > cursor) parts.push({ text: content.slice(cursor, start) });
    parts.push({ text, href });
    cursor = start + text.length;
  }
  if (cursor < content.length) parts.push({ text: content.slice(cursor) });
  return parts;
}
