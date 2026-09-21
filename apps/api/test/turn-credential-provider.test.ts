import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HmacTurnCredentialProvider } from '../src/calling/turn-credential-provider.js';

const NOW = 1_789_560_000_000;
const SECRET = 'test-only-turn-shared-secret';
const URLS = ['turn:turn.g000st.com:3478'];
const USER = 'A'.repeat(50);

describe('HmacTurnCredentialProvider', () => {
  it('issues a time-boxed username and a matching HMAC credential', async () => {
    const provider = new HmacTurnCredentialProvider(URLS, SECRET, () => NOW);
    const credential = await provider.issueCredential(USER);

    assert.deepEqual(credential.urls, URLS);
    assert.equal(credential.expiresAtMs, NOW + 600_000);

    const [expirySeconds, publicIdPart] = credential.username.split(':');
    assert.equal(expirySeconds, String(Math.floor(credential.expiresAtMs / 1_000)));
    assert.equal(publicIdPart, USER);

    const expectedCredential = createHmac('sha1', SECRET).update(credential.username).digest('base64');
    assert.equal(credential.credential, expectedCredential);
  });

  it('issues a different credential for a different user at the same instant', async () => {
    const provider = new HmacTurnCredentialProvider(URLS, SECRET, () => NOW);
    const a = await provider.issueCredential(USER);
    const b = await provider.issueCredential('B'.repeat(50));

    assert.notEqual(a.username, b.username);
    assert.notEqual(a.credential, b.credential);
  });
});
