import type { CallingCursor } from './calling-cursor.js';
import type {
  CallHistoryEntry,
  CallingPage,
  CallMedia,
  CallStatus,
  VoipDeviceRegistration,
} from './calling-types.js';

export interface CallingStore {
  /** No-ops if a call with this id already exists (defends against a duplicated invite message). */
  createCall(
    entry: Readonly<{
      id: string;
      callerPublicId: string;
      calleePublicId: string;
      media: CallMedia;
      startedAtMs: number;
    }>,
  ): Promise<void>;

  markAnswered(callId: string, answeredAtMs: number): Promise<void>;

  /** No-ops if the call was already ended (defends against a duplicated end/reject message). */
  markEnded(callId: string, endedAtMs: number, status: Extract<CallStatus, 'ended' | 'missed' | 'rejected'>): Promise<void>;

  /** A call appears in both participants' history; `publicId` may be either the caller or callee. */
  listHistory(
    publicId: string,
    limit: number,
    cursor?: CallingCursor,
  ): Promise<CallingPage<CallHistoryEntry>>;

  upsertVoipDevice(registration: VoipDeviceRegistration): Promise<void>;
  removeVoipDevice(publicId: string, deviceId: string): Promise<void>;
  listVoipDevices(publicId: string): Promise<readonly VoipDeviceRegistration[]>;
}
