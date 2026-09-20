export interface PresenceStore {
  setLastActive(publicId: string, nowMs: number): Promise<void>;
  getLastActiveMany(publicIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
