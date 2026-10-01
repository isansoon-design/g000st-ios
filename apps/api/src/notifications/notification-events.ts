import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction, WriteBatch } from 'firebase-admin/firestore';
import type { NotificationEvent } from './notification-types.js';

/** Called inside the same transaction/batch as the product mutation. */
export function queueNotification(
  db: Firestore, prefix: string, writer: Transaction | WriteBatch,
  input: Omit<NotificationEvent, 'expiresAtMs' | 'pushAfterMs' | 'push'> & Partial<Pick<NotificationEvent, 'expiresAtMs' | 'pushAfterMs' | 'push'>>,
): void {
  if (input.audience === 'recipient' && (!input.recipientPublicId || input.recipientPublicId === input.actorPublicId)) return;
  const event: NotificationEvent = {
    expiresAtMs: input.createdAtMs + 7 * 24 * 60 * 60_000,
    pushAfterMs: input.createdAtMs,
    push: true,
    ...input,
  };
  writer.create(db.collection(`${prefix}_notification_events`).doc(randomUUID()), {
    ...event, availableAtMs: input.createdAtMs, state: 'pending', attempts: 0, cursor: null,
  });
}
