import axios from '@/app/api/axios';

export type NotificationScope = 'user' | 'admin';
export type NotificationCategory = 'social' | 'market' | 'messages' | 'administration' | 'billing' | 'reports' | 'support';
export type NotificationItemV1 = Readonly<{
  id: string; type: string; category: NotificationCategory; title: string; body: string;
  path: string; createdAtMs: number; expiresAtMs: number; readAtMs: number | null;
}>;
export type NotificationPageV1 = Readonly<{ version: 1; items: readonly NotificationItemV1[]; unreadCount: number; nextCursor?: string }>;
export type NotificationPreferencesV1 = Readonly<{ pushEnabled: boolean; mutedCategories: readonly NotificationCategory[] }>;

export async function listNotifications(scope: NotificationScope = 'user', cursor?: string): Promise<NotificationPageV1> {
  const { data } = await axios.get<NotificationPageV1>('/notifications', { params: { scope, cursor, limit: 20 } });
  return data;
}
export async function markNotificationsRead(ids: readonly string[], scope: NotificationScope = 'user'): Promise<void> {
  if (ids.length) await axios.post('/notifications/read', { ids, scope });
}
export async function getNotificationPreferences(scope: NotificationScope = 'user'): Promise<NotificationPreferencesV1> {
  const { data } = await axios.get<{ version: 1; preferences: NotificationPreferencesV1 }>('/notifications/preferences', { params: { scope } });
  return data.preferences;
}
export async function saveNotificationPreferences(preferences: NotificationPreferencesV1, scope: NotificationScope = 'user'): Promise<void> {
  await axios.put('/notifications/preferences', { ...preferences, scope });
}
