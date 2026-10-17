import { ApiError } from '../http/api-error.js';
import type { MediaService } from '../media/media-service.js';
import { MAX_SOCIAL_IMAGES, validateSocialMediaBatch } from './social-policy.js';
import type { SocialMedia, SocialMediaEdit } from './social-types.js';

export type ResolvedMediaEdit = Readonly<{ media: readonly SocialMedia[]; added: readonly SocialMedia[]; removed: readonly SocialMedia[] }>;

/**
 * Turns a keep/add media edit into the final stored media list.
 * Kept items must already belong to the post; added items are promoted from the
 * owner's pending uploads (keyed by the existing post id).
 */
export async function resolveMediaEdit(input: Readonly<{ existing: readonly SocialMedia[]; edit: SocialMediaEdit; media: MediaService; ownerId: string; postId: string }>): Promise<ResolvedMediaEdit> {
  const { existing, edit } = input;
  const keepIds = new Set(edit.keep);
  if (keepIds.size !== edit.keep.length) throw new ApiError(400, 'INVALID_SOCIAL_MEDIA', 'Media can only be kept once.');
  const kept = edit.keep.map((id) => {
    const match = existing.find((item) => item.id === id);
    if (!match) throw new ApiError(400, 'INVALID_SOCIAL_MEDIA', 'This media does not belong to this post.');
    return match;
  });
  const addIds = new Set(edit.add.map((item) => item.id));
  if (addIds.size !== edit.add.length || edit.add.some((item) => keepIds.has(item.id) || existing.some((old) => old.id === item.id))) {
    throw new ApiError(400, 'INVALID_SOCIAL_MEDIA', 'Media must be unique.');
  }
  if (kept.length + edit.add.length > MAX_SOCIAL_IMAGES) throw new ApiError(400, 'INVALID_SOCIAL_MEDIA_BATCH', 'A post can contain up to two images.');
  validateSocialMediaBatch(edit.add);
  const added = await Promise.all(edit.add.map((item) => input.media.promoteSocialMedia({ media: item, postId: input.postId, publicId: input.ownerId })));
  return { media: [...kept, ...added], added, removed: existing.filter((item) => !keepIds.has(item.id)) };
}

/** Best-effort storage cleanup: a failed delete must never fail an edit that already saved. */
export async function discardMedia(media: MediaService | undefined, items: readonly SocialMedia[]): Promise<void> {
  if (!media || !items.length) return;
  await media.deleteAttachments(items).catch(() => undefined);
}
