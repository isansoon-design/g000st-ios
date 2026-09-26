import type { Contact, PeerPreferences } from './contacts-types.js';

export interface ContactsStore {
  updateNickname(ownerPublicId: string, contactPublicId: string, nickname: string | undefined): Promise<boolean>;
  listContacts(ownerPublicId: string): Promise<readonly Contact[]>;
  getPeerPreferences(ownerPublicId: string, peerPublicId: string): Promise<PeerPreferences>;
  updatePeerPreferences(ownerPublicId: string, peerPublicId: string, changes: Partial<PeerPreferences>): Promise<PeerPreferences>;
}
