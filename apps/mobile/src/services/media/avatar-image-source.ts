// Signed download URLs change on each request. Cache by object path so every
// screen can reuse the same photo while a new upload gets a new cache entry.
export function avatarImageSource(uri: string) {
  return { uri, cacheKey: uri.split('?')[0] };
}
