import { ExpoPushGateway } from './expo-push-gateway.js';
import type { NotificationStore } from './notification-store.js';
import type { PushPlatform } from './notification-types.js';

export type NewChatMessageNotification = Readonly<{
  conversationId: string;
  recipientPublicId: string;
}>;

export interface ChatNotifier {
  notifyNewMessage(input: NewChatMessageNotification): Promise<void>;
}

export class NotificationService implements ChatNotifier {
  constructor(
    private readonly store: NotificationStore,
    private readonly gateway: ExpoPushGateway,
    private readonly now: () => number = Date.now,
  ) {}

  async registerDevice(
    publicId: string,
    input: Readonly<{
      deviceId: string;
      expoPushToken: string;
      platform: PushPlatform;
    }>,
  ): Promise<void> {
    await this.store.upsertDevice({ ...input, publicId, updatedAtMs: this.now() });
  }

  async unregisterDevice(publicId: string, deviceId: string): Promise<void> {
    await this.store.removeDevice(publicId, deviceId);
  }

  async notifyNewMessage(input: NewChatMessageNotification): Promise<void> {
    const devices = await this.store.listActiveDevices(input.recipientPublicId);
    await this.gateway.send(devices, {
      body: 'You received a new private message.',
      data: {
        conversationId: input.conversationId,
        type: 'chat.message',
        url: `g000st://chat?conversationId=${input.conversationId}`,
      },
      title: 'g000st',
    });
  }
}
