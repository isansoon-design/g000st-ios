import { FieldPath, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { encodeCallingCursor, type CallingCursor } from './calling-cursor.js';
import type { CallingStore } from './calling-store.js';
import type {
  CallHistoryEntry,
  CallingPage,
  CallMedia,
  CallStatus,
  VoipDeviceRegistration,
} from './calling-types.js';

type StoredCall = Readonly<{
  callerPublicId: string;
  calleePublicId: string;
  participantPublicIds: readonly [string, string];
  media: CallMedia;
  status: CallStatus;
  startedAtMs: number;
  answeredAtMs?: number;
  endedAtMs?: number;
}>;

export class FirestoreCallingStore implements CallingStore {
  constructor(
    private readonly db: Firestore,
    private readonly prefix: string,
  ) {}

  async createCall(entry: {
    id: string;
    callerPublicId: string;
    calleePublicId: string;
    media: CallMedia;
    startedAtMs: number;
  }): Promise<void> {
    const ref = this.calls().doc(entry.id);
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists) return;

      transaction.create(ref, {
        callerPublicId: entry.callerPublicId,
        calleePublicId: entry.calleePublicId,
        participantPublicIds: [entry.callerPublicId, entry.calleePublicId],
        media: entry.media,
        status: 'ringing',
        startedAtMs: entry.startedAtMs,
      } satisfies StoredCall);
    });
  }

  async markAnswered(callId: string, answeredAtMs: number): Promise<void> {
    const ref = this.calls().doc(callId);
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (!existing.exists || (existing.data() as StoredCall).status !== 'ringing') return;
      transaction.update(ref, { status: 'in_progress', answeredAtMs } satisfies Partial<StoredCall>);
    });
  }

  async markEnded(
    callId: string,
    endedAtMs: number,
    status: Extract<CallStatus, 'ended' | 'missed' | 'rejected'>,
  ): Promise<void> {
    const ref = this.calls().doc(callId);
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      const data = existing.data() as StoredCall | undefined;
      if (!existing.exists || !data || data.status === 'ended' || data.status === 'missed' || data.status === 'rejected') {
        return;
      }
      transaction.update(ref, { status, endedAtMs } satisfies Partial<StoredCall>);
    });
  }

  async listHistory(
    publicId: string,
    limit: number,
    cursor?: CallingCursor,
  ): Promise<CallingPage<CallHistoryEntry>> {
    let query = this.calls()
      .where('participantPublicIds', 'array-contains', publicId)
      .orderBy('startedAtMs', 'desc')
      .orderBy(FieldPath.documentId(), 'desc');
    if (cursor) query = query.startAfter(cursor.createdAtMs, cursor.id);

    const snapshot = await query.limit(limit + 1).get();
    const documents = snapshot.docs.slice(0, limit);
    const items = documents.map((document) => this.toEntry(document));
    const last = documents.at(-1);

    return {
      items,
      ...(snapshot.size > limit && last
        ? { nextCursor: encodeCallingCursor({ createdAtMs: (last.data() as StoredCall).startedAtMs, id: last.id }) }
        : {}),
    };
  }

  private toEntry(document: QueryDocumentSnapshot): CallHistoryEntry {
    const data = document.data() as StoredCall;
    return {
      id: document.id,
      callerPublicId: data.callerPublicId,
      calleePublicId: data.calleePublicId,
      media: data.media,
      status: data.status,
      startedAtMs: data.startedAtMs,
      ...(data.answeredAtMs ? { answeredAtMs: data.answeredAtMs } : {}),
      ...(data.endedAtMs ? { endedAtMs: data.endedAtMs } : {}),
    };
  }

  async upsertVoipDevice(registration: VoipDeviceRegistration): Promise<void> {
    await this.voipDevices(registration.publicId).doc(registration.deviceId).set({
      tokenType: registration.tokenType,
      token: registration.token,
      updatedAtMs: registration.updatedAtMs,
    });
  }

  async removeVoipDevice(publicId: string, deviceId: string): Promise<void> {
    await this.voipDevices(publicId).doc(deviceId).delete();
  }

  async listVoipDevices(publicId: string): Promise<readonly VoipDeviceRegistration[]> {
    const snapshot = await this.voipDevices(publicId).get();
    return snapshot.docs.map((document) => {
      const data = document.data() as Omit<VoipDeviceRegistration, 'publicId' | 'deviceId'>;
      return { publicId, deviceId: document.id, ...data };
    });
  }

  private calls() {
    return this.db.collection(`${this.prefix}_calling_calls`);
  }

  private voipDevices(publicId: string) {
    return this.db.collection(`${this.prefix}_calling_voip_devices`).doc(publicId).collection('devices');
  }
}
