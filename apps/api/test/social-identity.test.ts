import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import { publicDisplayName, socialAlias } from '../src/social/social-identity.js';
import { SocialService } from '../src/social/social-service.js';
import type { SocialStore } from '../src/social/social-store.js';

const PUBLIC_ID = 'A'.repeat(42) + 'B12cD34e';

describe('Social display identity', () => {
  it('uses the last eight Public ID characters as the alias', () => {
    assert.equal(socialAlias(PUBLIC_ID), 'B12cD34e');
  });

  it('hides the real name unless the user explicitly allows it', () => {
    assert.equal(publicDisplayName(PUBLIC_ID, { displayName: 'Real Name' }), 'B12cD34e');
    assert.equal(
      publicDisplayName(PUBLIC_ID, { displayName: 'Real Name', showDisplayName: false }),
      'B12cD34e',
    );
  });

  it('shows a non-empty real name only when allowed', () => {
    assert.equal(
      publicDisplayName(PUBLIC_ID, { displayName: '  Real Name  ', showDisplayName: true }),
      'Real Name',
    );
    assert.equal(publicDisplayName(PUBLIC_ID, { displayName: '   ', showDisplayName: true }), 'B12cD34e');
  });

  it('returns the real name to its owner but masks it for another viewer', async () => {
    const store = {
      async getProfile() {
        return {
          campedByViewer: false,
          displayName: 'Real Name',
          publicId: PUBLIC_ID,
          showDisplayName: false,
          updatedAtMs: 1,
        };
      },
    } as unknown as SocialStore;
    const authStore = {
      async isUserActive() {
        return true;
      },
    } as unknown as AuthStore;
    const service = new SocialService(store, authStore);

    assert.equal((await service.getProfile(PUBLIC_ID, PUBLIC_ID)).displayName, 'Real Name');
    assert.equal((await service.getProfile('viewer', PUBLIC_ID)).displayName, 'B12cD34e');
  });
});
