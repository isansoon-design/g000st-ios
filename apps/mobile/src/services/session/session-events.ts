type SessionClearedListener = () => void;

const sessionClearedListeners = new Set<SessionClearedListener>();
const sessionChangedListeners = new Set<() => void>();

export function subscribeToSessionChanged(listener: () => void): () => void {
  sessionChangedListeners.add(listener);
  return () => sessionChangedListeners.delete(listener);
}

export function emitSessionChanged(): void {
  sessionChangedListeners.forEach((listener) => listener());
}

export function subscribeToSessionCleared(listener: SessionClearedListener): () => void {
  sessionClearedListeners.add(listener);
  return () => sessionClearedListeners.delete(listener);
}

export function emitSessionCleared(): void {
  emitSessionChanged();
  sessionClearedListeners.forEach((listener) => listener());
}
