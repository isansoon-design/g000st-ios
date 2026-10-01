import { ApiError } from '../http/api-error.js';

export const MAX_SOCIAL_MEDIA_BYTES = 5 * 1024 * 1024;
export const MAX_SOCIAL_IMAGES = 2;
export const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

export function validateSocialMediaBatch(media: readonly Readonly<{ contentType: string }>[]): void {
  const imageCount = media.filter((item) => item.contentType.startsWith('image/')).length;
  const validImages = imageCount === media.length && imageCount <= MAX_SOCIAL_IMAGES;
  if (media.length > 0 && !validImages) {
    throw new ApiError(
      400,
      'INVALID_SOCIAL_MEDIA_BATCH',
      'A post can contain up to two images.',
    );
  }
}
