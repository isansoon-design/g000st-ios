import type { AuthStore } from '../auth/auth-store.js';
import { ApiError } from '../http/api-error.js';
import type { PresenceService } from '../presence/presence-service.js';
import type { SocialService } from '../social/social-service.js';
import { socialAlias } from '../social/social-identity.js';
import type { ContactsStore } from './contacts-store.js';
import type { ContactView, PeerPreferences } from './contacts-types.js';

export class ContactsService {
  constructor(
    private readonly store: ContactsStore,
    private readonly authStore: AuthStore,
    private readonly socialService: SocialService,
    private readonly presenceService: PresenceService,
  ) {}

  async followUser(ownerPublicId: string, contactPublicId: string): Promise<void> {
    if (contactPublicId === ownerPublicId) {
      throw new ApiError(400, 'INVALID_CONTACT', 'You cannot add yourself.');
    }
    await this.socialService.follow(ownerPublicId, contactPublicId);
  }

  async unfollowUser(ownerPublicId: string, contactPublicId: string): Promise<void> {
    if (!(await this.socialService.unfollow(ownerPublicId, contactPublicId))) {
      throw new ApiError(404, 'CONTACT_NOT_FOUND', 'Contact not found.');
    }
  }

  async updateNickname(ownerPublicId: string, contactPublicId: string, nickname: string | undefined): Promise<void> {
    if (!(await this.store.updateNickname(ownerPublicId, contactPublicId, nickname?.trim()))) {
      throw new ApiError(404, 'CONTACT_NOT_FOUND', 'Contact not found.');
    }
  }

  async listNicknames(ownerPublicId: string): Promise<readonly Readonly<{ publicId: string; nickname: string }>[]> {
    const contacts = await this.store.listContacts(ownerPublicId);
    return contacts.flatMap((contact) => contact.nickname
      ? [{ publicId: contact.contactPublicId, nickname: contact.nickname }]
      : []);
  }

  getPeerPreferences(ownerPublicId: string, peerPublicId: string): Promise<PeerPreferences> {
    return this.store.getPeerPreferences(ownerPublicId, peerPublicId);
  }

  updatePeerPreferences(ownerPublicId: string, peerPublicId: string, changes: Partial<PeerPreferences>): Promise<PeerPreferences> {
    if (ownerPublicId === peerPublicId) throw new ApiError(400, 'INVALID_CONTACT', 'You cannot change your own contact settings.');
    return this.store.updatePeerPreferences(ownerPublicId, peerPublicId, changes);
  }

  async canMessage(senderPublicId: string, recipientPublicId: string): Promise<boolean> {
    const [sender, recipient] = await Promise.all([
      this.getPeerPreferences(senderPublicId, recipientPublicId),
      this.getPeerPreferences(recipientPublicId, senderPublicId),
    ]);
    return !sender.blocked && !recipient.blocked;
  }

  async canCall(callerPublicId: string, calleePublicId: string, media: 'audio' | 'video'): Promise<boolean> {
    const [caller, callee] = await Promise.all([
      this.getPeerPreferences(callerPublicId, calleePublicId),
      this.getPeerPreferences(calleePublicId, callerPublicId),
    ]);
    return !caller.blocked && !callee.blocked && (media === 'audio' ? callee.allowAudioCalls : callee.allowVideoCalls);
  }

  async listContacts(ownerPublicId: string): Promise<readonly ContactView[]> {
    const [following, metadata] = await Promise.all([
      this.socialService.listFollowing(ownerPublicId),
      this.store.listContacts(ownerPublicId),
    ]);
    const nicknames = new Map(metadata.map((contact) => [contact.contactPublicId, contact.nickname]));
    const online = await this.presenceService.isOnlineMany(
      following.map((contact) => contact.publicId),
    );
    return Promise.all(
      following.map(async (contact) => {
        const active = await this.authStore.isUserActive(contact.publicId);
        if (!active) {
          return {
            addedAtMs: contact.followedAtMs,
            displayName: 'Deleted account',
            nickname: nicknames.get(contact.publicId),
            online: false,
            publicId: contact.publicId,
          };
        }
        const profile = await this.socialService
          .getProfile(ownerPublicId, contact.publicId)
          .catch(() => null);
        return {
          addedAtMs: contact.followedAtMs,
          avatarUrl: profile?.avatarUrl,
          displayName: profile?.displayName || socialAlias(contact.publicId),
          nickname: nicknames.get(contact.publicId),
          online: online.get(contact.publicId) ?? false,
          publicId: contact.publicId,
        };
      }),
    );
  }
}
