import type { PresenceStore } from './presence-store.js';

export const ONLINE_WINDOW_MS = 2 * 60 * 1_000;

export class PresenceService {
  constructor(
    private readonly store: PresenceStore,
    private readonly now: () => number = Date.now,
    private readonly trustGeoHeaders = false,
  ) {}

  heartbeat(publicId: string, headers?: Readonly<{ country?: string; city?: string }>): Promise<void> {
    const country = headers?.country?.trim().toUpperCase();
    const rawCity = headers?.city?.trim();
    const geo = this.trustGeoHeaders && country && /^[A-Z]{2}$/.test(country)
      ? { country, ...(rawCity && rawCity.length <= 100 && !/[\u0000-\u001F<>]/.test(rawCity) ? { city: rawCity } : {}) }
      : undefined;
    return this.store.setLastActive(publicId, this.now(), geo);
  }

  async isOnlineMany(publicIds: readonly string[]): Promise<ReadonlyMap<string, boolean>> {
    const nowMs = this.now();
    const lastActive = await this.store.getLastActiveMany(publicIds);
    const result = new Map<string, boolean>();
    for (const publicId of publicIds) {
      const lastActiveAtMs = lastActive.get(publicId);
      result.set(publicId, lastActiveAtMs !== undefined && nowMs - lastActiveAtMs < ONLINE_WINDOW_MS);
    }
    return result;
  }
}
