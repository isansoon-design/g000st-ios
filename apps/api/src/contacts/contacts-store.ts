import type { Contact } from './contacts-types.js';

export interface ContactsStore {
  addContact(ownerPublicId: string, contactPublicId: string, nowMs: number): Promise<void>;
  removeContact(ownerPublicId: string, contactPublicId: string): Promise<boolean>;
  listContacts(ownerPublicId: string): Promise<readonly Contact[]>;
}
