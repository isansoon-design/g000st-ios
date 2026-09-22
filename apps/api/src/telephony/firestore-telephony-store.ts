import { FieldPath, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { encodeTelephonyCursor, type TelephonyCursor } from './telephony-cursor.js';
import type { TelephonyStore } from './telephony-store.js';
import type {
  ExternalCall,
  ExternalCallStatus,
  OutboundSms,
  OutboundSmsStatus,
  TelephonyPage,
} from './telephony-types.js';

type StoredCall = Readonly<{
  toE164: string;
  status: ExternalCallStatus;
  startedAtMs: number;
  answeredAtMs?: number;
  endedAtMs?: number;
  billedSeconds?: number;
}>;

type StoredSms = Readonly<{
  publicId: string;
  toE164: string;
  body: string;
  status: OutboundSmsStatus;
  createdAtMs: number;
}>;

export class FirestoreTelephonyStore implements TelephonyStore {
  constructor(
    private readonly db: Firestore,
    private readonly prefix: string,
  ) {}

  async createCall(entry: Readonly<{ id: string; publicId: string; toE164: string; startedAtMs: number }>): Promise<void> {
    const ref = this.calls(entry.publicId).doc(entry.id);
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists) return;

      transaction.create(ref, {
        toE164: entry.toE164,
        status: 'initiated',
        startedAtMs: entry.startedAtMs,
      } satisfies StoredCall);
    });
  }

  async markCallAnswered(publicId: string, callControlId: string, answeredAtMs: number): Promise<void> {
    const ref = this.calls(publicId).doc(callControlId);
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      const data = existing.data() as StoredCall | undefined;
      if (!existing.exists || !data || data.status !== 'initiated') return;

      transaction.update(ref, { status: 'answered', answeredAtMs } satisfies Partial<StoredCall>);
    });
  }

  async getCall(publicId: string, callControlId: string): Promise<ExternalCall | undefined> {
    const snapshot = await this.calls(publicId).doc(callControlId).get();
    if (!snapshot.exists) return undefined;
    return this.toExternalCall(snapshot.id, snapshot.data() as StoredCall);
  }

  async markCallEnded(
    publicId: string,
    callControlId: string,
    endedAtMs: number,
    billedSeconds: number,
  ): Promise<Readonly<{ alreadyEnded: boolean }>> {
    const ref = this.calls(publicId).doc(callControlId);
    return this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      const data = existing.data() as StoredCall | undefined;
      if (!existing.exists || !data || data.status === 'ended') return { alreadyEnded: true };

      transaction.update(ref, { status: 'ended', endedAtMs, billedSeconds } satisfies Partial<StoredCall>);
      return { alreadyEnded: false };
    });
  }

  async listCalls(publicId: string, limit: number, cursor?: TelephonyCursor): Promise<TelephonyPage<ExternalCall>> {
    let query = this.calls(publicId).orderBy('startedAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (cursor) query = query.startAfter(cursor.createdAtMs, cursor.id);

    const snapshot = await query.limit(limit + 1).get();
    const documents = snapshot.docs.slice(0, limit);
    const items = documents.map((document) => this.toExternalCall(document.id, document.data() as StoredCall));
    const last = documents.at(-1);

    return {
      items,
      ...(snapshot.size > limit && last
        ? { nextCursor: encodeTelephonyCursor({ createdAtMs: (last.data() as StoredCall).startedAtMs, id: last.id }) }
        : {}),
    };
  }

  async createSms(
    entry: Readonly<{
      id: string;
      publicId: string;
      toE164: string;
      body: string;
      status: OutboundSmsStatus;
      createdAtMs: number;
    }>,
  ): Promise<void> {
    await this.sms().doc(entry.id).create({
      publicId: entry.publicId,
      toE164: entry.toE164,
      body: entry.body,
      status: entry.status,
      createdAtMs: entry.createdAtMs,
    } satisfies StoredSms);
  }

  async updateSmsStatus(messageId: string, status: OutboundSmsStatus): Promise<void> {
    const ref = this.sms().doc(messageId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return;

    await ref.update({ status } satisfies Partial<StoredSms>);
  }

  async listSms(publicId: string, limit: number, cursor?: TelephonyCursor): Promise<TelephonyPage<OutboundSms>> {
    let query = this.sms()
      .where('publicId', '==', publicId)
      .orderBy('createdAtMs', 'desc')
      .orderBy(FieldPath.documentId(), 'desc');
    if (cursor) query = query.startAfter(cursor.createdAtMs, cursor.id);

    const snapshot = await query.limit(limit + 1).get();
    const documents = snapshot.docs.slice(0, limit);
    const items = documents.map((document) => this.toOutboundSms(document));
    const last = documents.at(-1);

    return {
      items,
      ...(snapshot.size > limit && last
        ? { nextCursor: encodeTelephonyCursor({ createdAtMs: (last.data() as StoredSms).createdAtMs, id: last.id }) }
        : {}),
    };
  }

  private toExternalCall(id: string, data: StoredCall): ExternalCall {
    return {
      id,
      toE164: data.toE164,
      status: data.status,
      startedAtMs: data.startedAtMs,
      ...(data.answeredAtMs ? { answeredAtMs: data.answeredAtMs } : {}),
      ...(data.endedAtMs ? { endedAtMs: data.endedAtMs } : {}),
      ...(data.billedSeconds !== undefined ? { billedSeconds: data.billedSeconds } : {}),
    };
  }

  private toOutboundSms(document: QueryDocumentSnapshot): OutboundSms {
    const data = document.data() as StoredSms;
    return { id: document.id, toE164: data.toE164, body: data.body, status: data.status, createdAtMs: data.createdAtMs };
  }

  private calls(publicId: string) {
    return this.db.collection(`${this.prefix}_telephony_calls`).doc(publicId).collection('calls');
  }

  private sms() {
    return this.db.collection(`${this.prefix}_telephony_sms`);
  }
}
