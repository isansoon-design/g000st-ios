"use client";
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { NotificationCategory, NotificationScope, NotificationPreferencesV1 } from '@/app/api/notifications';
import { getNotificationPreferences, saveNotificationPreferences } from '@/app/api/notifications';
import axios from '@/app/api/axios';
import { useNotifications } from './use-notifications';
import { NotificationList } from './notification-list';
import { setupWebPush } from './firebase-push';

export function NotificationsPage({ scope = 'user' }: { scope?: NotificationScope }) {
  return <Suspense fallback={<p className="p-6">Loading notifications…</p>}><NotificationsPageContent scope={scope} /></Suspense>;
}

function NotificationsPageContent({ scope }: { scope: NotificationScope }) {
  const noticeId = useSearchParams().get('noticeId');
  const state = useNotifications(scope);
  const [preferences, setPreferences] = useState<NotificationPreferencesV1 | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const categories: { value: NotificationCategory; label: string }[] = scope === 'admin'
    ? [{ value: 'reports', label: 'Reports' }, { value: 'support', label: 'Support' }]
    : [{ value: 'social', label: 'Social activity' }, { value: 'market', label: 'Market activity' }, { value: 'messages', label: 'Private messages' }, { value: 'administration', label: 'Administration' }, { value: 'support', label: 'Support replies' }, { value: 'billing', label: 'Balance and purchases' }, { value: 'reports', label: 'Report results' }];
  useEffect(() => {
    let active = true;
    void getNotificationPreferences(scope).then((value) => { if (active) setPreferences(value); }).catch(() => { if (active) setError(true); });
    setNotice(null);
    if (scope === 'user' && noticeId) void axios.get<{ version: 1; notice: { text: string } }>(`/communication/notices/${encodeURIComponent(noticeId)}`)
      .then(({ data }) => { if (active) setNotice(data.notice.text); }).catch(() => { if (active) setNotice('This message is unavailable.'); });
    return () => { active = false; };
  }, [scope, noticeId]);
  return <div className="h-full overflow-auto p-4 sm:p-6"><div className="mx-auto max-w-2xl">
    <h1 className="mb-4 text-xl font-bold">{scope === 'admin' ? 'Admin notifications' : 'Notifications'}</h1>
    {notice && <div className="mb-4 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-gray-900">{notice}</div>}
    {error && <p role="alert" className="mb-3 text-sm text-red-700">Could not update notification settings.</p>}
    <div className="mb-4 rounded-xl border border-black/10 p-4 dark:border-night-border">
      {preferences && <label className="flex items-center justify-between gap-4 text-sm font-semibold">Push notifications<input type="checkbox" checked={preferences.pushEnabled} disabled={saving} onChange={async (event) => { const next = { ...preferences, pushEnabled: event.target.checked }; setSaving(true); try { await saveNotificationPreferences(next, scope); setPreferences(next); setError(false); } catch { setError(true); } finally { setSaving(false); } }} /></label>}
      <p className="mt-2 text-xs text-gray-500 dark:text-night-muted">Notifications remain available here when push is disabled.</p>
      {preferences && <div className="mt-3 space-y-2">{categories.map(({ value, label }) => <label key={value} className="flex items-center justify-between gap-3 text-sm">{label}<input type="checkbox" disabled={saving || !preferences.pushEnabled} checked={!preferences.mutedCategories.includes(value)} onChange={async (event) => {
        const next = { ...preferences, mutedCategories: event.target.checked ? preferences.mutedCategories.filter((category) => category !== value) : [...preferences.mutedCategories, value] };
        setSaving(true); try { await saveNotificationPreferences(next, scope); setPreferences(next); setError(false); } catch { setError(true); } finally { setSaving(false); }
      }} /></label>)}</div>}
      <button disabled={saving} className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300" onClick={async () => { setSaving(true); try { const cleanup = await setupWebPush(true); if (!cleanup) setError(true); else cleanup(); } catch { setError(true); } finally { setSaving(false); } }}>Enable notifications on this browser</button>
    </div>
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-night-border dark:bg-night-surface"><NotificationList {...state} scope={scope} /></div>
  </div></div>;
}
