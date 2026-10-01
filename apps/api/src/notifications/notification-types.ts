export type PushPlatform = 'android' | 'ios' | 'web';

export type PushDevice = Readonly<{
  deviceId: string;
  expoPushToken?: string;
  fcmToken?: string;
  platform: PushPlatform;
  publicId: string;
  updatedAtMs: number;
  ownerPublicId?: string;
}>;

export type PushMessage = Readonly<{
  body: string;
  data: Readonly<Record<string, string>>;
  title: string;
  expiresAtMs?: number;
}>;

export interface PushGateway {
  send(devices: readonly PushDevice[], message: PushMessage): Promise<void>;
}

export type NotificationScope = 'user' | 'admin';
export type NotificationCategory = 'social' | 'market' | 'messages' | 'administration' | 'billing' | 'reports' | 'support';
export type NotificationEvent = Readonly<{
  type: string;
  audience: 'recipient' | 'admins' | 'all';
  recipientPublicId?: string;
  actorPublicId?: string;
  scope: NotificationScope;
  category: NotificationCategory;
  title: string;
  body: string;
  path: string;
  createdAtMs: number;
  expiresAtMs: number;
  pushAfterMs: number;
  push: boolean;
  source?: Readonly<{ collection: string; id: string; parentId?: string }>;
}>;

export type InboxNotification = NotificationEvent & Readonly<{
  id: string;
  recipientPublicId: string;
  readAtMs: number | null;
}>;

export type NotificationPreferences = Readonly<{
  pushEnabled: boolean;
  mutedCategories: readonly NotificationCategory[];
}>;
