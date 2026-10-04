import assert from 'node:assert/strict';
import { it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import { ApiError } from '../src/http/api-error.js';
import { pageAddressSchema } from '../src/social/page-address-schema.js';
import { SocialService } from '../src/social/social-service.js';
import type { SocialStore } from '../src/social/social-store.js';
import type { SocialProfile } from '../src/social/social-types.js';

it('accepts omitted, partial and empty page addresses and preserves postal code formatting', () => {
  assert.deepEqual(pageAddressSchema.parse({}), {});
  assert.deepEqual(pageAddressSchema.parse({ city: ' Damascus ' }), { city: 'Damascus' });
  assert.deepEqual(pageAddressSchema.parse({ postCode: ' 00123 AB ' }), { postCode: '00123 AB' });
  const empty = { city: '', postCode: '', street1: '', street2: '' };
  assert.deepEqual(pageAddressSchema.parse(empty), empty);
  for (const [key, limit] of [['city', 100], ['postCode', 32], ['street1', 200], ['street2', 200]] as const) {
    assert.equal(pageAddressSchema.safeParse({ [key]: 'x'.repeat(limit + 1) }).success, false);
    assert.equal(pageAddressSchema.safeParse({ [key]: 123 }).success, false);
  }
});

it('saves, publicly reads and clears page address fields while keeping omitted fields', async () => {
  const pageId = 'P'.repeat(50);
  let stored: SocialProfile = { publicId: pageId, displayName: 'Shop', showDisplayName: true, updatedAtMs: 1 };
  const authStore = {
    async getPageOwner(id: string) { return id === pageId ? 'O'.repeat(50) : null; },
    async isUserActive() { return true; },
  } as unknown as AuthStore;
  const store = {
    async getProfile() { return stored; },
    async updateProfile(_id: string, input: Partial<SocialProfile>) {
      stored = { ...stored, ...input };
      return stored;
    },
  } as unknown as SocialStore;
  const service = new SocialService(store, authStore);
  await service.updateProfile(pageId, pageAddressSchema.parse({ city: ' Damascus ', postCode: '00123', street1: 'Main Street', street2: 'Suite 4' }));
  const publicProfile = await service.getProfile('V'.repeat(50), pageId);
  assert.equal(publicProfile.city, 'Damascus');
  assert.equal(publicProfile.postCode, '00123');
  assert.equal(publicProfile.street1, 'Main Street');
  assert.equal(publicProfile.street2, 'Suite 4');
  await service.updateProfile(pageId, { street2: '' });
  assert.equal(stored.street2, '');
  assert.equal(stored.city, 'Damascus');
  const saved = await service.updateProfile(pageId, { city: '', postCode: '', street1: '', street2: '' });
  assert.equal(saved.city, '');
  assert.equal(saved.postCode, '');
  assert.equal(saved.street1, '');
  await assert.rejects(() => service.updateProfile('U'.repeat(50), { city: 'Damascus' }), (error: unknown) => error instanceof ApiError && error.code === 'PAGE_ADDRESS_ONLY');
});
