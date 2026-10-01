import { queueNotification } from '../notifications/notification-events.js';
import { FieldPath, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { decodeBillingCursor, encodeBillingCursor, type BillingCursor } from './billing-cursor.js';
import type { ApplyLedgerEntryInput, ApplyLedgerEntryResult, BillingStore } from './billing-store.js';
import type { Balance, BillingPage, LedgerEvent, LedgerEventKind } from './billing-types.js';

type StoredBalance = Readonly<{
  voiceSecondsRemaining: number;
  smsRemaining: number;
  updatedAtMs: number;
}>;

type StoredLedgerEvent = Readonly<{
  kind: LedgerEventKind;
  voiceSecondsDelta: number;
  smsDelta: number;
  reference: string;
  reason?: string;
  actorPublicId?: string;
  createdAtMs: number;
}>;

const EMPTY_BALANCE: StoredBalance = { voiceSecondsRemaining: 0, smsRemaining: 0, updatedAtMs: 0 };

export class FirestoreBillingStore implements BillingStore {
  constructor(
    private readonly db: Firestore,
    private readonly prefix: string,
  ) {}

  async getBalance(publicId: string): Promise<Balance> {
    const snapshot = await this.balances().doc(publicId).get();
    return (snapshot.data() as StoredBalance | undefined) ?? EMPTY_BALANCE;
  }

  async applyLedgerEntry(input: ApplyLedgerEntryInput): Promise<ApplyLedgerEntryResult> {
    const balanceRef = this.balances().doc(input.publicId);
    const ledgerRef = this.ledger(input.publicId).doc(input.idempotencyKey);

    return this.db.runTransaction(async (transaction) => {
      const [balanceSnapshot, ledgerSnapshot] = await Promise.all([
        transaction.get(balanceRef),
        transaction.get(ledgerRef),
      ]);
      const current = (balanceSnapshot.data() as StoredBalance | undefined) ?? EMPTY_BALANCE;

      if (ledgerSnapshot.exists) {
        return { status: 'already_applied', balance: current };
      }

      // Only sms_consumption is checked here: it is synchronous (balance is checked right
      // before Telnyx is asked to send, so it should never actually go negative). A call's
      // real duration is only known after it ends, by which point the call already happened
      // and cost real money at Telnyx — that consumption is recorded unconditionally, the same
      // as a purchase or an admin adjustment. Overage is bounded by capping call duration
      // server-side against the pre-flight balance, not by rejecting the post-hoc debit.
      const isUnconditional = input.kind !== 'sms_consumption';
      const nextVoiceSeconds = current.voiceSecondsRemaining + input.voiceSecondsDelta;
      const nextSms = current.smsRemaining + input.smsDelta;

      if (!isUnconditional && (nextVoiceSeconds < 0 || nextSms < 0)) {
        return { status: 'insufficient' };
      }

      const next: StoredBalance = {
        voiceSecondsRemaining: nextVoiceSeconds,
        smsRemaining: nextSms,
        updatedAtMs: input.nowMs,
      };

      transaction.set(balanceRef, next, { merge: true });
      transaction.create(ledgerRef, {
        kind: input.kind,
        voiceSecondsDelta: input.voiceSecondsDelta,
        smsDelta: input.smsDelta,
        reference: input.idempotencyKey,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.actorPublicId ? { actorPublicId: input.actorPublicId } : {}),
        createdAtMs: input.nowMs,
      } satisfies StoredLedgerEvent);

      const notification = { audience: 'recipient' as const, recipientPublicId: input.publicId,
        scope: 'user' as const, category: 'billing' as const, createdAtMs: input.nowMs, path: '/mobile' };
      if (input.kind === 'purchase' || input.kind === 'admin_adjustment') {
        queueNotification(this.db, this.prefix, transaction, { ...notification,
          type: input.kind === 'purchase' ? 'billing.purchase_confirmed' : 'billing.balance_adjusted',
          title: input.kind === 'purchase' ? 'Purchase confirmed' : 'Balance adjusted',
          body: input.kind === 'purchase' ? 'Your purchase was confirmed and your balance updated.' : 'The administration adjusted your balance. View the ledger for details.' });
      }
      const lowVoice = current.voiceSecondsRemaining >= 300 && nextVoiceSeconds < 300;
      const lowSms = current.smsRemaining >= 5 && nextSms < 5;
      const depleted = (current.voiceSecondsRemaining > 0 && nextVoiceSeconds <= 0) || (current.smsRemaining > 0 && nextSms <= 0);
      if (input.kind !== 'purchase' && (lowVoice || lowSms || depleted)) {
        queueNotification(this.db, this.prefix, transaction, { ...notification, type: 'billing.balance_warning',
          title: depleted ? 'Balance depleted' : 'Low balance', body: 'Check your remaining call and SMS balance.' });
      }
      return { status: 'applied', balance: next };
    });
  }

  async listLedger(
    publicId: string,
    limit: number,
    cursor?: BillingCursor,
  ): Promise<BillingPage<LedgerEvent>> {
    let query = this.ledger(publicId).orderBy('createdAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (cursor) query = query.startAfter(cursor.createdAtMs, cursor.id);

    const snapshot = await query.limit(limit + 1).get();
    const documents = snapshot.docs.slice(0, limit);
    const items = documents.map((document) => this.toLedgerEvent(document));
    const last = documents.at(-1);

    return {
      items,
      ...(snapshot.size > limit && last
        ? { nextCursor: encodeBillingCursor({ createdAtMs: (last.data() as StoredLedgerEvent).createdAtMs, id: last.id }) }
        : {}),
    };
  }

  private toLedgerEvent(document: QueryDocumentSnapshot): LedgerEvent {
    const data = document.data() as StoredLedgerEvent;
    return {
      id: document.id,
      kind: data.kind,
      voiceSecondsDelta: data.voiceSecondsDelta,
      smsDelta: data.smsDelta,
      reference: data.reference,
      ...(data.reason ? { reason: data.reason } : {}),
      ...(data.actorPublicId ? { actorPublicId: data.actorPublicId } : {}),
      createdAtMs: data.createdAtMs,
    };
  }

  private balances() {
    return this.db.collection(`${this.prefix}_billing_balances`);
  }

  private ledger(publicId: string) {
    return this.balances().doc(publicId).collection('ledger');
  }
}
