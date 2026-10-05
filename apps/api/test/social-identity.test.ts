import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import type { ContactsStore } from '../src/contacts/contacts-store.js';
import { publicDisplayName, socialAlias } from '../src/social/social-identity.js';
import { SocialService } from '../src/social/social-service.js';
import type { SocialStore } from '../src/social/social-store.js';

const PUBLIC_ID = '1234AbCd' + 'A'.repeat(34) + 'B12cD34e';

describe('Social display identity', () => {
  it('uses the first eight Public ID characters as the alias', () => {
    assert.equal(socialAlias(PUBLIC_ID), '1234AbCd');
  });

  it('hides the real name unless the user explicitly allows it', () => {
    assert.equal(publicDisplayName(PUBLIC_ID, { displayName: 'Real Name' }), '1234AbCd');
    assert.equal(
      publicDisplayName(PUBLIC_ID, { displayName: 'Real Name', showDisplayName: false }),
      '1234AbCd',
    );
  });

  it('shows a non-empty real name only when allowed', () => {
    assert.equal(
      publicDisplayName(PUBLIC_ID, { displayName: '  Real Name  ', showDisplayName: true }),
      'Real Name',
    );
    assert.equal(publicDisplayName(PUBLIC_ID, { displayName: '   ', showDisplayName: true }), '1234AbCd');
    assert.equal(publicDisplayName(PUBLIC_ID, undefined), '1234AbCd');
  });

  it('always uses the deleted-account tombstone instead of a name or alias', () => {
    assert.equal(
      publicDisplayName(PUBLIC_ID, {
        deletedAtMs: 1,
        displayName: 'Former Name',
        showDisplayName: true,
      }),
      'Deleted account',
    );
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
    const contacts = { async getPeerPreferences() { return { blocked: false, allowAudioCalls: true, allowVideoCalls: true }; } } as unknown as ContactsStore;
    const service = new SocialService(store, authStore, Date.now, undefined, contacts);

    assert.equal((await service.getProfile(PUBLIC_ID, PUBLIC_ID)).displayName, 'Real Name');
    assert.equal((await service.getProfile('viewer', PUBLIC_ID)).displayName, '1234AbCd');
  });
});
