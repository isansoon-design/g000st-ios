import { createHmac } from 'node:crypto';

import type { TurnCredential } from './calling-types.js';

const CREDENTIAL_TTL_SECONDS = 600;

export interface TurnCredentialProvider {
  issueCredential(publicId: string): Promise<TurnCredential>;
}

/**
 * Implements the widely-supported "shared secret" TURN REST scheme (the same mechanism
 * coturn's `use-auth-secret` option implements, and several managed TURN providers accept
 * directly) instead of one vendor's bespoke API. This keeps the managed-TURN-vs-self-hosted
 * choice (still undecided — see the implementation plan) a configuration detail rather than
 * a code change: username = "<expiry-unix-seconds>:<publicId>", credential =
 * base64(HMAC-SHA1(sharedSecret, username)).
 */
export class HmacTurnCredentialProvider implements TurnCredentialProvider {
  constructor(
    private readonly turnUrls: readonly string[],
    private readonly sharedSecret: string,
    private readonly now: () => number = Date.now,
  ) {}

  async issueCredential(publicId: string): Promise<TurnCredential> {
    const expiresAtMs = this.now() + CREDENTIAL_TTL_SECONDS * 1_000;
    const username = `${Math.floor(expiresAtMs / 1_000)}:${publicId}`;
    const credential = createHmac('sha1', this.sharedSecret).update(username).digest('base64');

    return { urls: this.turnUrls, username, credential, expiresAtMs };
  }
}
