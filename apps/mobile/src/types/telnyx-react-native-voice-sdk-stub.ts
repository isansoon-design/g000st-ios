// Type-check-only stand-in for `@telnyx/react-native-voice-sdk` — see tsconfig.typecheck.json's
// `paths` override, which points imports of that package specifier here ONLY for `tsc --noEmit`
// (never for Metro, which still bundles the real package normally). The real package ships raw,
// un-precompiled `.ts` source as its "types"/"main" entry, and that source does not type-check
// cleanly under this project's strict tsconfig (missing-null-check and RTCStatsReport typing
// issues inside the SDK itself, confirmed by reading its installed source — not a config problem
// on our side). This hand-mirrors the exact subset of the real API this app actually uses.

export type CallState = 'new' | 'ringing' | 'connecting' | 'active' | 'ended' | 'held' | 'dropped';

export interface ClientOptions {
  login_token?: string;
  login?: string;
  password?: string;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

export interface CallOptions {
  destinationNumber?: string;
  audio?: boolean;
  callerIdName?: string;
  callerIdNumber?: string;
  customHeaders?: { name: string; value: string }[];
  /** Base64-encoded — pass the server-signed token verbatim, never construct this. */
  clientState?: string;
}

export declare class Call {
  readonly state: CallState;
  hangup(customHeaders?: { name: string; value: string }[]): void;
  mute(): void;
  unmute(): void;
}

type TelnyxRTCEventMap = {
  'telnyx.client.ready': () => void;
  'telnyx.client.error': (error: Error) => void;
  'telnyx.call.stateChanged': (call: Call, state: string) => void;
};

export declare class TelnyxRTC {
  constructor(options: ClientOptions);
  connect(): Promise<void>;
  disconnect(fromReconnection?: boolean): void;
  newCall(options: CallOptions): Promise<Call>;
  on<Event extends keyof TelnyxRTCEventMap>(event: Event, listener: TelnyxRTCEventMap[Event]): void;
  off<Event extends keyof TelnyxRTCEventMap>(event: Event, listener: TelnyxRTCEventMap[Event]): void;
}
