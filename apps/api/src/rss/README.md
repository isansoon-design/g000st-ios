# RSS publishing (API v1)

Admins manage sources at `/rss` in the web dashboard. Each source has a name,
public HTTP(S) feed URL, active publishing account's 50-character Public ID,
interval in minutes (1–43,200), and enabled flag. RSS 2.0, RSS 1.0 and Atom are
supported. Posts contain plain-text title/summary and an HTTP(S) article link,
up to the existing 4,000-character social limit. New posts also contain an optional
`linkPreview` with article URL, publisher name, title, excerpt and image URL.
Images come from Media RSS thumbnails/content, image enclosures, Atom enclosures,
or embedded HTML. If the feed has no image, the next unpublished article is
fetched once for Open Graph/Twitter image metadata and publisher name. This uses
the same public-address/DNS/redirect/body protections, with a five-second deadline.
Metadata fetch failure never prevents publication. Images are displayed from the
publisher's URL; unavailable images fall back to a text card. Existing posts are
not backfilled. Web and mobile render previews in feeds, profiles, details and shares.
Public author names and avatars follow the account's existing profile settings.

## Contract

All endpoints require an authenticated admin and use `/api/v1/admin/rss`:

- `GET /`: `{ version: 1, sources: RssSourceV1[] }`.
- `POST /`: `RssInputV1`, returns `201 { version: 1, id }`.
- `PUT /:id`: complete `RssInputV1`, returns `{ version: 1, id }`.
- `DELETE /:id`: returns `204`; existing posts and deduplication receipts remain.

`RssInputV1` is `{ name, url, accountPublicId, intervalMinutes, enabled }`.
`RssSourceV1` additionally includes `id`, `createdAtMs`, `updatedAtMs`,
`nextRunAtMs`, `lastCheckedAtMs`, `lastPublishedAtMs`, `lastPostId`, `lastError`,
and `publishedCount`. Nullable timestamps and post/error fields are `null` until
available; `nextRunAtMs` is `null` when disabled. Writes are rate limited.

## Scheduling and persistence

The API starts the RSS worker automatically. Keep at least one API instance
running continuously; there is no external cron or additional environment variable.
The worker checks every 15 seconds and claims up to 20 due sources per sweep.
The first run occurs one interval after saving/enabling. Saving any settings
restarts the interval and invalidates an in-flight fetch. Each successful run
publishes at most one unseen article, in the feed's order, then schedules the
next run relative to completion. Empty feeds produce no post. Failures are shown
in the dashboard and retried after the configured interval. Downtime does not
produce a burst of catch-up posts.

Each run examines the first 100 items currently offered by the feed; this is not
an archive or a persistent article queue. Items removed by the publisher before
a run may never be imported. Use an interval appropriate to the source's volume.

`${prefix}_rss_sources` stores configuration, status, and a two-minute lease.
`${prefix}_rss_published` stores stable SHA-256 receipts keyed by normalized feed
URL and item GUID/Atom ID (falling back to article link, then title/date).
Receipts are shared across sources using the same URL, so re-adding a source or
changing its publishing account does not repost already imported articles.
Post creation, receipt creation, and schedule advancement commit atomically in
Firestore. Competing workers, expired leases, account suspension, edits, pauses,
and deletion are checked before publication. Single-field Firestore indexes
are sufficient; no composite index is required.

## Fetching limits

Requests permit only public HTTP(S) destinations on standard ports, without
embedded credentials. DNS addresses are checked and the connection is pinned
to a validated address. Each redirect is revalidated (maximum three).
Requests have a 20-second network deadline and a 2 MB body limit. DTD/entity
declarations are rejected. Remote error bodies are not exposed in the dashboard.

Run `npm --prefix apps/api test`, `npm --prefix apps/api run typecheck:tests`,
and `npm run typecheck:web` to validate changes. Live feed/Firestore operation
also needs a deployment smoke test with an active publishing account.
