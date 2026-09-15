type SessionClearedListener = () => void;

const sessionClearedListeners = new Set<SessionClearedListener>();

export function subscribeToSessionCleared(listener: SessionClearedListener): () => void {
  sessionClearedListeners.add(listener);
  return () => sessionClearedListeners.delete(listener);
}

export function emitSessionCleared(): void {
  sessionClearedListeners.forEach((listener) => listener());
}
