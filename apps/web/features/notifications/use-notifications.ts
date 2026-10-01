"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { listNotifications, markNotificationsRead, type NotificationPageV1, type NotificationScope } from '@/app/api/notifications';
import { sessionStorage } from '@/app/api/session-storage';

export function useNotifications(scope: NotificationScope) {
  const [page, setPage] = useState<NotificationPageV1 | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const alive = useRef(true);
  const identity = useRef<string | null>(null);
  const inFlight = useRef(false);
  const currentIdentity = useCallback(() => scope === 'admin' ? sessionStorage.get()?.user.publicId ?? null : sessionStorage.getActingPublicId(), [scope]);
  const refresh = useCallback(async (cursor?: string) => {
    const actor = currentIdentity();
    if (!actor || inFlight.current) return;
    if (identity.current !== actor) { identity.current = actor; setPage(null); }
    inFlight.current = true;
    setLoading(true);
    try {
      const next = await listNotifications(scope, cursor);
      if (alive.current && actor === currentIdentity()) {
        setPage((previous) => cursor && previous ? { ...next, items: [...previous.items, ...next.items.filter((item) => !previous.items.some((old) => old.id === item.id))] } : next);
        setError(false);
      }
    } catch { if (alive.current) setError(true); }
    finally { inFlight.current = false; if (alive.current) setLoading(false); }
  }, [currentIdentity, scope]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const update = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    window.addEventListener('g000st:notifications', update);
    document.addEventListener('visibilitychange', update);
    return () => { alive.current = false; window.clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('g000st:notifications', update); document.removeEventListener('visibilitychange', update); };
  }, [refresh]);
  const markRead = async (ids: readonly string[]) => {
    await markNotificationsRead(ids, scope);
    await refresh();
    window.dispatchEvent(new Event('g000st:notifications'));
  };
  return { page, error, loading, refresh, markRead };
}
