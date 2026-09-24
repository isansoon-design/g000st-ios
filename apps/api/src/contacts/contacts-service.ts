import type { AuthStore } from '../auth/auth-store.js';
import { ApiError } from '../http/api-error.js';
import type { PresenceService } from '../presence/presence-service.js';
import type { SocialService } from '../social/social-service.js';
import type { ContactsStore } from './contacts-store.js';
import type { ContactView } from './contacts-types.js';

export class ContactsService {
  constructor(
    private readonly store: ContactsStore,
    private readonly authStore: AuthStore,
    private readonly socialService: SocialService,
    private readonly presenceService: PresenceService,
    private readonly now: () => number = Date.now,
  ) {}

  async addContact(ownerPublicId: string, contactPublicId: string): Promise<void> {
    if (contactPublicId === ownerPublicId) {
      throw new ApiError(400, 'INVALID_CONTACT', 'You cannot add yourself.');
    }
    if (!(await this.authStore.isUserActive(contactPublicId))) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'No active user has that Public ID.');
    }
    await this.store.addContact(ownerPublicId, contactPublicId, this.now());
  }

  async removeContact(ownerPublicId: string, contactPublicId: string): Promise<void> {
    if (!(await this.store.removeContact(ownerPublicId, contactPublicId))) {
      throw new ApiError(404, 'CONTACT_NOT_FOUND', 'Contact not found.');
    }
  }

  async listContacts(ownerPublicId: string): Promise<readonly ContactView[]> {
    const contacts = await this.store.listContacts(ownerPublicId);
    const online = await this.presenceService.isOnlineMany(
      contacts.map((contact) => contact.contactPublicId),
    );
    return Promise.all(
      contacts.map(async (contact) => {
        const active = await this.authStore.isUserActive(contact.contactPublicId);
        if (!active) {
          return {
            addedAtMs: contact.addedAtMs,
            displayName: 'Deleted account',
            online: false,
            publicId: contact.contactPublicId,
          };
        }
        const profile = await this.socialService
          .getProfile(ownerPublicId, contact.contactPublicId)
          .catch(() => null);
        return {
          addedAtMs: contact.addedAtMs,
          avatarUrl: profile?.avatarUrl,
          displayName: profile?.displayName,
          online: online.get(contact.contactPublicId) ?? false,
          publicId: contact.contactPublicId,
        };
      }),
    );
  }
}
