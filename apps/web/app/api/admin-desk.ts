import axios from '@/app/api/axios';

export type AdminDeskV1 = Readonly<{
  version: 1;
  openInboxCount: number;
  users: readonly Readonly<{ publicId: string; displayName: string; status: string; role: string; createdAtMs: number }>[];
  posts: readonly Readonly<{ id: string; ownerPublicId: string; content: string; hidden: boolean; deleted: boolean; createdAtMs: number }>[];
  listings: readonly Readonly<{ id: string; ownerPublicId: string; content: string; city: string; hidden: boolean; deleted: boolean; createdAtMs: number }>[];
  config: Readonly<{ pages: Readonly<Record<string, boolean>>; parts: Readonly<Record<string, boolean>>; labels: Readonly<Record<string, string>> }>;
  messages: readonly Readonly<{ id: string; to: string; text: string; type: string; createdAtMs: number }>[];
  inbox: readonly Readonly<{ id: string; from: string; text: string; status: string; createdAtMs: number }>[];
  issued: readonly Readonly<{ publicId: string; note: string; createdAtMs: number }>[];
}>;

export type AdminAnalyticsV1 = Readonly<{
  version: 1;
  generatedAtMs: number;
  timezone: 'UTC';
  users: Readonly<{
    total: number; onlineNow: number; registeredToday: number; registeredThisMonth: number;
    activeToday: number; activeThisMonth: number; suspended: number;
    registrationsByDay: readonly Readonly<{ day: string; count: number }>[];
  }>;
  geography: Readonly<{
    source: 'trusted_proxy' | 'unavailable'; coveredUsers: number;
    countries: readonly Readonly<{ name: string; count: number }>[];
    cities: readonly Readonly<{ name: string; country: string; count: number }>[];
  }>;
  sections: readonly Readonly<{ key: string; label: string; count: number; today: number; thisMonth: number; metric: string }>[];
}>;

export type AdminUserV1 = Readonly<{
  publicId: string;
  displayName: string;
  status: string;
  role: string;
  createdAtMs: number;
  lastActiveAtMs: number;
}>;

export type AdminUsersPageV1 = Readonly<{
  version: 1;
  users: readonly AdminUserV1[];
  nextCursor?: string;
}>;

export type AdminBillingRecentV1 = Readonly<{
  version: 1;
  accountCount: number;
  balances: readonly Readonly<{
    publicId: string;
    voiceSecondsRemaining: number;
    smsRemaining: number;
    updatedAtMs: number;
  }>[];
}>;

export async function getAdminDesk(): Promise<AdminDeskV1> {
  return (await axios.get<AdminDeskV1>('/admin/desk')).data;
}

export async function searchAdminUsers(query: string): Promise<readonly AdminUserV1[]> {
  return (await axios.get<{ users: readonly AdminUserV1[] }>('/admin/desk/users', { params: { q: query } })).data.users;
}

export async function getAdminAnalytics(): Promise<AdminAnalyticsV1> {
  return (await axios.get<AdminAnalyticsV1>('/admin/analytics')).data;
}

export async function getAdminUsersPage(cursor?: string): Promise<AdminUsersPageV1> {
  return (await axios.get<AdminUsersPageV1>('/admin/users', { params: { limit: 50, cursor } })).data;
}

export async function getAdminBillingRecent(): Promise<AdminBillingRecentV1> {
  return (await axios.get<AdminBillingRecentV1>('/admin/billing/recent')).data;
}

export async function issueAccount(note: string): Promise<{ publicId: string; recoveryId: string; noteSaved: boolean }> {
  return (await axios.post<{ publicId: string; recoveryId: string; noteSaved: boolean }>('/admin/desk/accounts', { note })).data;
}

export async function setAdminFlag(kind: 'pages' | 'parts', key: string, enabled: boolean): Promise<void> {
  await axios.put(`/admin/desk/config/${kind}/${key}`, { enabled });
}

export async function setAdminLabel(kind: 'pages' | 'parts', key: string, label: string): Promise<void> {
  await axios.put(`/admin/desk/config/${kind}/${key}/label`, { label });
}

export async function setAdminUserStatus(publicId: string, status: 'active' | 'suspended'): Promise<void> {
  await axios.put(`/admin/desk/users/${publicId}/status`, { status });
}

export async function setAdminUserName(publicId: string, displayName: string): Promise<void> {
  await axios.put(`/admin/desk/users/${publicId}/name`, { displayName });
}

export async function setAdminPostVisible(section: 'social' | 'market', id: string, enabled: boolean): Promise<void> {
  await axios.put(`/admin/desk/posts/${section}/${id}/visibility`, { enabled });
}

export async function setAdminPostContent(id: string, content: string): Promise<void> {
  await axios.put(`/admin/desk/posts/${id}/content`, { content });
}

export async function deleteAdminPost(section: 'social' | 'market', id: string): Promise<void> {
  await axios.delete(`/admin/desk/posts/${section}/${id}`);
}

export async function sendAdminMessage(to: string, text: string, type: 'msg' | 'warning'): Promise<void> {
  await axios.post('/admin/desk/messages', { to, text, type });
}

export async function deleteAdminMessage(id: string): Promise<void> {
  await axios.delete(`/admin/desk/messages/${id}`);
}

export async function replyToSupport(id: string, text: string): Promise<void> {
  await axios.post(`/admin/desk/inbox/${id}/reply`, { text });
}
