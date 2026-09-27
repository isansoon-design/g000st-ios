import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import type { MediaService } from '../src/media/media-service.js';
import { SocialService } from '../src/social/social-service.js';
import type { SocialStore } from '../src/social/social-store.js';
import type { SocialProfile } from '../src/social/social-types.js';

const publicId = 'A'.repeat(50);
const oldKey = `avatars/${publicId}/old`;
const newKey = `avatars/${publicId}/new`;
const pending = { byteSize: 12, contentType: 'image/png', fileName: 'photo.png', id: 'new', objectKey: `pending-avatar/${publicId}/new` };

function fixture(failSave = false) {
  const deleted: string[] = [];
  let profile: SocialProfile = { publicId, avatarObjectKey: oldKey, showDisplayName: false, updatedAtMs: 1 };
  const store = {
    async getProfile() { return { ...profile, campedByViewer: false }; },
    async updateProfile(_publicId: string, input: Partial<SocialProfile>) {
      if (failSave) throw new Error('Firestore write failed');
      profile = { ...profile, ...input, updatedAtMs: 2 };
      return profile;
    },
  } as unknown as SocialStore;
  const media = {
    async promoteAvatar() { return { objectKey: newKey }; },
    async deleteProfileImage(key: string) { deleted.push(key); },
    async getDownloadUrl(input: { objectKey: string }) { return { downloadUrl: `https://example.com/${input.objectKey}` }; },
  } as unknown as MediaService;
  const auth = { async isUserActive() { return true; } } as unknown as AuthStore;
  return { deleted, service: new SocialService(store, auth, () => 2, media) };
}

describe('profile photo replacement', () => {
  it('keeps the old photo if saving the new key fails', async () => {
    const { deleted, service } = fixture(true);
    await assert.rejects(() => service.updateProfile(publicId, { avatarMedia: pending }), /Firestore write failed/);
    assert.deepEqual(deleted, []);
    assert.equal((await service.getProfile(publicId, publicId)).avatarUrl, `https://example.com/${oldKey}`);
  });

  it('returns the persisted photo and then deletes the old one', async () => {
    const { deleted, service } = fixture();
    const updated = await service.updateProfile(publicId, { avatarMedia: pending });
    assert.equal(updated.avatarUrl, `https://example.com/${newKey}`);
    assert.equal((await service.getProfile(publicId, publicId)).avatarUrl, `https://example.com/${newKey}`);
    assert.deepEqual(deleted, [oldKey]);
  });
});
