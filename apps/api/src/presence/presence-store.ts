export interface PresenceStore {
  setLastActive(publicId: string, nowMs: number, geo?: Readonly<{ country: string; city?: string }>): Promise<void>;
  getLastActiveMany(publicIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
