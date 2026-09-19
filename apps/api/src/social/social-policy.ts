import { ApiError } from '../http/api-error.js';

export const MAX_SOCIAL_MEDIA_BYTES = 5 * 1024 * 1024;
export const MAX_SOCIAL_IMAGES = 2;

export function validateSocialMediaBatch(media: readonly Readonly<{ contentType: string }>[]): void {
  const imageCount = media.filter((item) => item.contentType.startsWith('image/')).length;
  const videoCount = media.filter((item) => item.contentType.startsWith('video/')).length;
  const validImages = videoCount === 0 && imageCount === media.length && imageCount <= MAX_SOCIAL_IMAGES;
  const validVideo = imageCount === 0 && videoCount === 1 && media.length === 1;
  if (media.length > 0 && !validImages && !validVideo) {
    throw new ApiError(
      400,
      'INVALID_SOCIAL_MEDIA_BATCH',
      'A post can contain up to two images or one video.',
    );
  }
}
