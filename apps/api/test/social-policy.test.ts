import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateSocialMediaBatch } from '../src/social/social-policy.js';

describe('Social media policy', () => {
  it('allows no media and one or two images', () => {
    for (const media of [
      [],
      [{ contentType: 'image/jpeg' }],
      [{ contentType: 'image/jpeg' }, { contentType: 'image/webp' }],
    ]) assert.doesNotThrow(() => validateSocialMediaBatch(media));
  });

  it('rejects any video, documents, mixed media, and more than two images', () => {
    for (const media of [
      [{ contentType: 'video/mp4' }],
      [{ contentType: 'video/quicktime' }],
      [{ contentType: 'application/pdf' }],
      [{ contentType: 'image/jpeg' }, { contentType: 'video/mp4' }],
      [{ contentType: 'video/mp4' }, { contentType: 'video/webm' }],
      [{ contentType: 'image/jpeg' }, { contentType: 'image/png' }, { contentType: 'image/webp' }],
    ]) assert.throws(() => validateSocialMediaBatch(media));
  });
});
