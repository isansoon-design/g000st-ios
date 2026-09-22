import { ApiError } from '../http/api-error.js';
import type { TelnyxGateway } from './telephony-service.js';
import type { WebrtcCredential } from './telephony-types.js';

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';
const WEBRTC_CREDENTIAL_TTL_SECONDS = 600;

export type SendSmsResult = Readonly<{ messageId: string; status: string }>;

type SendMessageResponse = Readonly<{ data: Readonly<{ id: string; to?: readonly Readonly<{ status?: string }>[] }> }>;
type CreateCredentialResponse = Readonly<{ data: Readonly<{ id: string; sip_username: string; sip_password: string }> }>;

/**
 * Thin wrapper over Telnyx's REST API using the platform's global `fetch` — no SDK dependency,
 * matching this codebase's `HmacTurnCredentialProvider` style for third-party HTTP integrations.
 */
export class TelnyxClient implements TelnyxGateway {
  constructor(
    private readonly apiKey: string,
    private readonly connectionId: string,
    private readonly fromE164: string,
    private readonly now: () => number = Date.now,
  ) {}

  async sendSms(toE164: string, text: string): Promise<SendSmsResult> {
    const response = await this.post<SendMessageResponse>('/messages', {
      to: toE164,
      from: this.fromE164,
      text,
    });

    return { messageId: response.data.id, status: response.data.to?.[0]?.status ?? 'queued' };
  }

  /**
   * Issues a short-lived WebRTC login for the mobile/web softphone SDK: creates an on-demand
   * telephony credential, then mints a JWT login token from it. The token endpoint returns the
   * JWT as a raw text body, not JSON — confirm this against a real sandbox response once
   * TELNYX_API_KEY is configured, since it isn't fully documented publicly.
   * https://developers.telnyx.com/development/webrtc/auth/telephony-credentials
   */
  async issueWebrtcCredential(publicId: string): Promise<Omit<WebrtcCredential, 'clientState'>> {
    const expiresAtMs = this.now() + WEBRTC_CREDENTIAL_TTL_SECONDS * 1_000;
    const created = await this.post<CreateCredentialResponse>('/telephony_credentials', {
      connection_id: this.connectionId,
      name: `g000st-${publicId}`,
      expires_at: new Date(expiresAtMs).toISOString(),
    });

    const tokenResponse = await fetch(`${TELNYX_API_BASE}/telephony_credentials/${created.data.id}/token`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}` },
    });
    if (!tokenResponse.ok) {
      throw new ApiError(502, 'PROVIDER_ERROR', 'Could not issue a calling credential. Try again.');
    }

    return {
      sipUsername: created.data.sip_username,
      sipPassword: created.data.sip_password,
      loginToken: (await tokenResponse.text()).trim(),
      expiresAtMs,
    };
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${TELNYX_API_BASE}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new ApiError(502, 'PROVIDER_ERROR', 'The telephony provider could not complete this request.');
    }

    return (await response.json()) as T;
  }
}
