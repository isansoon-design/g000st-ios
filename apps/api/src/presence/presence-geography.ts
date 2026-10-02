export type PresenceGeographyV1 = Readonly<{
  country: string;
  city?: string;
  recordedAtMs: number;
}>;

export function recentGeography(
  data: Readonly<{ country?: unknown; city?: unknown; geoRecordedAtMs?: unknown }> | undefined,
  nowMs: number,
): PresenceGeographyV1 | undefined {
  if (!data || typeof data.country !== 'string' || !/^[A-Z]{2}$/.test(data.country)
    || data.country === 'XX' || data.country === 'ZZ'
    || typeof data.geoRecordedAtMs !== 'number' || !Number.isFinite(data.geoRecordedAtMs)
    || data.geoRecordedAtMs < 0 || data.geoRecordedAtMs > nowMs
    || nowMs - data.geoRecordedAtMs > 30 * 86_400_000) return undefined;
  const city = typeof data.city === 'string' ? data.city.trim() : '';
  return {
    country: data.country,
    ...(city && city.length <= 100 && !/[\u0000-\u001F\u007F<>]/.test(city) ? { city } : {}),
    recordedAtMs: data.geoRecordedAtMs,
  };
}
