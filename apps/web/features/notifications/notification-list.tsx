"use client";
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { NotificationItemV1, NotificationScope } from '@/app/api/notifications';
import type { useNotifications } from './use-notifications';
import { safeNotificationPath } from './notification-path';

export function NotificationList({ page, error, loading, refresh, markRead, onNavigate }: ReturnType<typeof useNotifications> & { scope: NotificationScope; onNavigate?: () => void }) {
  const router = useRouter();
  const [writeError, setWriteError] = useState(false);
  const [saving, setSaving] = useState(false);
  const openItem = async (item: NotificationItemV1) => {
    setWriteError(false); setSaving(true);
    try {
      if (item.readAtMs === null) await markRead([item.id]);
      onNavigate?.();
      const path = safeNotificationPath(item.path);
      if (path) router.push(path);
    } catch { setWriteError(true); }
    finally { setSaving(false); }
  };
  return <div>
    {(error || writeError) && <div role="alert" className="p-4 text-sm text-red-700 dark:text-red-300">Could not update notifications. <button className="underline" onClick={() => void refresh()}>Retry</button></div>}
    {!page && loading && <p role="status" className="p-6 text-center text-sm">Loading notifications…</p>}
    {page && !page.items.length && <p className="p-8 text-center text-sm text-gray-500 dark:text-night-muted">You’re all caught up.</p>}
    {!!page?.items.some((item) => item.readAtMs === null) && <button disabled={saving} onClick={async () => { setSaving(true); try { await markRead(page.items.filter((item) => item.readAtMs === null).map((item) => item.id)); } catch { setWriteError(true); } finally { setSaving(false); } }} className="px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-300">Mark displayed notifications as read</button>}
    <ul>{page?.items.map((item) => <li key={item.id} className="border-t border-black/5 dark:border-white/5"><button disabled={saving} onClick={() => void openItem(item)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 ${item.readAtMs === null ? 'bg-red-50/70 dark:bg-red-950/20' : ''}`}>
      <span aria-label={item.readAtMs === null ? 'Unread' : 'Read'} className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAtMs === null ? 'bg-red-600' : 'bg-transparent'}`} />
      <span className="min-w-0"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-sm text-gray-600 dark:text-night-muted">{item.body}</span><time dateTime={new Date(item.createdAtMs).toISOString()} className="mt-1 block text-xs text-gray-500 dark:text-night-muted">{new Date(item.createdAtMs).toLocaleString()}</time></span>
    </button></li>)}</ul>
    {page?.nextCursor && <button disabled={loading} onClick={() => void refresh(page.nextCursor)} className="w-full p-3 text-sm font-semibold">{loading ? 'Loading…' : 'Load more'}</button>}
  </div>;
}
