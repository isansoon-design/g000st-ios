import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import type { ContactsStore } from './contacts-store.js';
import type { Contact, PeerPreferences } from './contacts-types.js';

export class FirestoreContactsStore implements ContactsStore {
  constructor(private readonly db: Firestore, private readonly prefix: string) {}

  async updateNickname(ownerPublicId: string, contactPublicId: string, nickname: string | undefined): Promise<boolean> {
    const reference = this.contacts(ownerPublicId).doc(contactPublicId);
    if (nickname) await reference.set({ nickname }, { merge: true });
    else if ((await reference.get()).exists) await reference.update({ nickname: FieldValue.delete() });
    return true;
  }

  async listContacts(ownerPublicId: string): Promise<readonly Contact[]> {
    const snapshot = await this.contacts(ownerPublicId).get();
    return snapshot.docs.map((document) => ({
      addedAtMs: (document.data().addedAtMs as number | undefined) ?? 0,
      contactPublicId: document.id,
      ...(document.data().nickname ? { nickname: document.data().nickname as string } : {}),
    }));
  }

  async getPeerPreferences(ownerPublicId: string, peerPublicId: string): Promise<PeerPreferences> {
    const data = (await this.contacts(ownerPublicId).doc(peerPublicId).get()).data();
    return {
      blocked: data?.blocked === true,
      allowAudioCalls: data?.allowAudioCalls !== false,
      allowVideoCalls: data?.allowVideoCalls !== false,
    };
  }

  async updatePeerPreferences(ownerPublicId: string, peerPublicId: string, changes: Partial<PeerPreferences>): Promise<PeerPreferences> {
    const reference = this.contacts(ownerPublicId).doc(peerPublicId);
    await reference.set(changes, { merge: true });
    return this.getPeerPreferences(ownerPublicId, peerPublicId);
  }

  private contacts(ownerPublicId: string) {
    return this.db.collection(`${this.prefix}_contacts`).doc(ownerPublicId).collection('items');
  }
}
