# Notifications API v1

Implemented locally on 1 October 2026. This contract supplements `/api/v1` and the [Arabic inventory](NOTIFICATIONS_INVENTORY_AR.md). It does not assert staging deployment or device delivery.

All API requests require a bearer session. `X-Acting-Public-Id` selects an owned page for user notifications. `scope=admin` always uses the authenticated owner's identity and requires a current administrator role; selecting a page does not grant or remove administrator privileges. Recipient IDs supplied as query/body overrides are rejected.

## Inbox

`GET /api/v1/notifications?scope=user&limit=20&cursor=…`

- `scope`: `user` (default) or `admin`.
- `limit`: integer 1–50, default 20.
- `cursor`: optional opaque pagination cursor, maximum 500 characters.
- Stable order: descending creation time, then descending notification ID.

```ts
type NotificationCategoryV1 =
  | 'social' | 'market' | 'messages' | 'administration'
  | 'billing' | 'reports' | 'support';

type NotificationItemV1 = Readonly<{
  id: string; // 64 lowercase hex characters
  type: string;
  category: NotificationCategoryV1;
  title: string;
  body: string;
  path: string; // local product destination, never an arbitrary external URL
  createdAtMs: number;
  expiresAtMs: number; // deadline for Push, not deletion of inbox history
  readAtMs: number | null;
}>;

type NotificationPageV1 = Readonly<{
  version: 1;
  items: readonly NotificationItemV1[];
  unreadCount: number; // entire inbox, not just the returned page
  nextCursor?: string;
}>;
```

Chat notifications use the existing conversation inbox and unread counter. Their events pass through the delivery queue but do not create a second item in the general notification inbox.

`POST /api/v1/notifications/read`

```ts
type MarkReadV1 = Readonly<{
  scope?: 'user' | 'admin';
  ids: readonly string[]; // 1–100 notification IDs
}>;
```

Returns `204`. Only the actor's scoped inbox is updated. Missing IDs are a no-op; marking an already-read item does not change its first read timestamp. Reading one inbox never marks a different user's/page's/admin's item.

## Preferences

`GET /api/v1/notifications/preferences?scope=user`

```ts
type NotificationPreferencesV1 = Readonly<{
  pushEnabled: boolean;
  mutedCategories: readonly NotificationCategoryV1[];
}>;
type PreferencesResultV1 = Readonly<{
  version: 1;
  preferences: NotificationPreferencesV1;
}>;
```

Default: Push enabled, no muted categories. This does not override operating-system/browser permission.

`PUT /api/v1/notifications/preferences`

Body: preferences plus optional `scope`; maximum seven category entries. Returns `204`. Inbox records remain available when Push is disabled. Native incoming-call ringing has its existing calling settings and is independent of these general activity preferences.

## Device registration

`PUT /api/v1/notifications/devices`

```ts
type FcmDeviceRegistrationV1 = Readonly<{
  deviceId: string; // UUID for this installation
  fcmToken: string; // 20–4096 characters
  platform: 'android' | 'ios' | 'web';
}>;
type LegacyExpoDeviceRegistrationV1 = Readonly<{
  deviceId: string;
  expoPushToken: string;
  platform: 'android' | 'ios';
}>;
```

The server derives the recipient and owner from authentication. A request cannot contain both transports or an owner override. Rotation replaces the previous registration for that installation and acting identity in one write batch. Older clients can keep registering Expo tokens during native app rollout. FCM takes precedence when both transports exist for the same installation.

`DELETE /api/v1/notifications/devices` with `{ deviceId: string }` returns `204`. Clients unregister all owned identities before local logout where network access permits.

## Administrator report destination

- `GET /api/v1/admin/reports/:section?cursor=…&reportId=…`: `section` is `social` or `market`. Returns `{ version: 1, items, nextCursor?, selected? }`, 30 records per page, newest first. Optional UUID `reportId` includes a selected report independently of pagination so old notification links still open their case. Existing report records include the content ID, optional comment ID, reason, optional details, reporter public ID, status and creation time. Reporter information is administrator-only and never included in Push.
- `PUT /api/v1/admin/reports/:section/:reportId`: `{ resolution: 'action_taken' | 'no_violation' }`, returns `204`. Resolving an already-resolved report is a no-op. Resolution, audit entry and result notification are written atomically. `action_taken` records a decision; it does not itself hide or delete content. Use existing content-management actions first.

`GET /api/v1/communication/notices/:noticeId` opens a specific administrative message even when it is older than the recent-notices list. It returns `{ version: 1, notice: { id, text, type, createdAtMs } }`. Both notice endpoints use the verified acting identity; only messages addressed to that identity or `all` are readable. Other identities receive `404`.

## Delivery behavior

- Product mutations atomically create durable event jobs. A worker leases fanout/delivery tasks, retries failures with backoff and starts with the API process.
- One inbox/delivery ID per event and recipient; likes are grouped by target within a 15-minute time bucket. Repeated follow/unfollow actions by the same actor are suppressed within a 15-minute bucket.
- Ordinary reports retain separate inbox items and share a summary Push per section and 15-minute bucket. `violence`, `privacy` and `sexual` reports currently get immediate review alerts; this is triage, not an automatic violation judgment.
- Browser/device Push requires real configuration and permission. The inbox updates through API polling every 30 seconds and refreshes after reads/foreground pushes.
- Expired events, read items, unavailable content, resolved immediate reports and blocked actor relationships suppress pending Push. A suspension-status event may still notify its suspended owner; social events cannot.
- Provider delivery is **at least once**. A process failure after provider acceptance or partial device success can cause a retry. FCM notification tags/collapse IDs reduce duplicate presentation; provider acceptance is not a read or delivery receipt.
- The API never includes private-message text, Burn content, secret credentials, actor identifiers or internal source paths in public inbox metadata. Anonymous comment alerts also hide the actor in the legacy Social alert API.

The deployed database remains Firestore. New collections use the existing prefix: `notification_events`, `notification_deliveries`, `notification_inboxes` (scoped recipient documents with `items`), and `notification_preferences`. All are server-owned. They must be included in the later PostgreSQL migration and retention policy; the change does not migrate databases or replay historical Social alerts.
