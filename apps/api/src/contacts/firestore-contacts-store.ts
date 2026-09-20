import type { Firestore } from 'firebase-admin/firestore';

import type { ContactsStore } from './contacts-store.js';
import type { Contact } from './contacts-types.js';

export class FirestoreContactsStore implements ContactsStore {
  constructor(private readonly db: Firestore, private readonly prefix: string) {}

  async addContact(ownerPublicId: string, contactPublicId: string, nowMs: number): Promise<void> {
    await this.contacts(ownerPublicId).doc(contactPublicId).set({ addedAtMs: nowMs }, { merge: true });
  }

  async removeContact(ownerPublicId: string, contactPublicId: string): Promise<boolean> {
    const reference = this.contacts(ownerPublicId).doc(contactPublicId);
    const snapshot = await reference.get();
    if (!snapshot.exists) return false;
    await reference.delete();
    return true;
  }

  async listContacts(ownerPublicId: string): Promise<readonly Contact[]> {
    const snapshot = await this.contacts(ownerPublicId).orderBy('addedAtMs', 'desc').get();
    return snapshot.docs.map((document) => ({
      addedAtMs: document.data().addedAtMs as number,
      contactPublicId: document.id,
    }));
  }

  private contacts(ownerPublicId: string) {
    return this.db.collection(`${this.prefix}_contacts`).doc(ownerPublicId).collection('items');
  }
}
