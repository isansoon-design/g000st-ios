export type CallMedia = 'audio' | 'video';

export type CallStatus = 'ringing' | 'in_progress' | 'ended' | 'missed' | 'rejected';

export type CallHistoryEntry = Readonly<{
  id: string;
  callerPublicId: string;
  calleePublicId: string;
  media: CallMedia;
  status: CallStatus;
  startedAtMs: number;
  answeredAtMs?: number;
  endedAtMs?: number;
}>;

export type CallingPage<T> = Readonly<{ items: readonly T[]; nextCursor?: string }>;

export type TurnCredential = Readonly<{
  urls: readonly string[];
  username: string;
  credential: string;
  expiresAtMs: number;
}>;

export type PushTokenType = 'APNS_VOIP' | 'FCM';

export type VoipDeviceRegistration = Readonly<{
  publicId: string;
  deviceId: string;
  tokenType: PushTokenType;
  token: string;
  updatedAtMs: number;
}>;

/** Mirrors expo-callkit-telecom's `IncomingCallEvent` wire shape exactly — see its docs. */
export type IncomingCallPushEvent = Readonly<{
  eventId: string;
  serverCallId: string;
  hasVideo: boolean;
  startedAt: string;
  caller: Readonly<{ id: string; displayName?: string }>;
}>;
