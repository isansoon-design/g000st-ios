import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateSocialMediaBatch } from '../src/social/social-policy.js';

describe('Social media policy', () => {
  it('allows no media, one or two images, and one video', () => {
    for (const media of [
      [],
      [{ contentType: 'image/jpeg' }],
      [{ contentType: 'image/jpeg' }, { contentType: 'image/webp' }],
      [{ contentType: 'video/mp4' }],
    ]) assert.doesNotThrow(() => validateSocialMediaBatch(media));
  });

  it('rejects mixed media, multiple videos, and more than two images', () => {
    for (const media of [
      [{ contentType: 'image/jpeg' }, { contentType: 'video/mp4' }],
      [{ contentType: 'video/mp4' }, { contentType: 'video/webm' }],
      [{ contentType: 'image/jpeg' }, { contentType: 'image/png' }, { contentType: 'image/webp' }],
    ]) assert.throws(() => validateSocialMediaBatch(media));
  });
});
