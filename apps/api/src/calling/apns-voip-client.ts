import { createPrivateKey, createSign } from 'node:crypto';
import { connect } from 'node:http2';

import type { IncomingCallPushEvent } from './calling-types.js';

export type ApnsVoipConfig = Readonly<{
  keyId: string;
  teamId: string;
  /** The literal contents of the .p8 auth key file (PEM). */
  privateKeyPem: string;
  bundleId: string;
  production: boolean;
}>;

const TOKEN_LIFETIME_MS = 55 * 60 * 1_000; // Apple invalidates tokens older than 60 minutes.

function base64Url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * A minimal APNs provider client using token-based (.p8) auth over HTTP/2, built on Node's
 * built-in `http2`/`crypto` modules rather than a third-party APNs SDK — the same
 * thin-wrapper-over-the-provider-API philosophy already used for Telnyx elsewhere in this
 * module. Sends only VoIP pushes (`apns-push-type: voip`), never general notifications.
 */
export class ApnsVoipClient {
  private cachedToken?: { value: string; issuedAtMs: number };

  constructor(
    private readonly config: ApnsVoipConfig,
    private readonly now: () => number = Date.now,
  ) {}

  async sendIncomingCall(deviceToken: string, event: IncomingCallPushEvent): Promise<void> {
    const session = connect(`https://${this.host()}`);
    try {
      await this.post(session, deviceToken, { incomingCall: event });
    } finally {
      session.close();
    }
  }

  private host(): string {
    return this.config.production ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
  }

  private authToken(): string {
    if (this.cachedToken && this.now() - this.cachedToken.issuedAtMs < TOKEN_LIFETIME_MS) {
      return this.cachedToken.value;
    }

    const header = base64Url(Buffer.from(JSON.stringify({ alg: 'ES256', kid: this.config.keyId })));
    const payload = base64Url(
      Buffer.from(JSON.stringify({ iss: this.config.teamId, iat: Math.floor(this.now() / 1_000) })),
    );
    const signingInput = `${header}.${payload}`;
    const signature = createSign('SHA256').update(signingInput).sign({
      key: createPrivateKey(this.config.privateKeyPem),
      dsaEncoding: 'ieee-p1363',
    });

    const value = `${signingInput}.${base64Url(signature)}`;
    this.cachedToken = { value, issuedAtMs: this.now() };
    return value;
  }

  private post(
    session: ReturnType<typeof connect>,
    deviceToken: string,
    body: Readonly<{ incomingCall: IncomingCallPushEvent }>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = session.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${this.authToken()}`,
        'apns-topic': `${this.config.bundleId}.voip`,
        'apns-push-type': 'voip',
        'apns-priority': '10',
        'apns-expiration': '0',
      });

      let statusCode = 0;
      let responseBody = '';
      request.on('response', (headers) => {
        statusCode = Number(headers[':status']);
      });
      request.on('data', (chunk: Buffer) => {
        responseBody += chunk.toString('utf8');
      });
      request.on('end', () => {
        if (statusCode >= 200 && statusCode < 300) resolve();
        else reject(new Error(`APNs VoIP push failed (${statusCode}): ${responseBody}`));
      });
      request.on('error', reject);
      request.end(JSON.stringify(body));
    });
  }
}
