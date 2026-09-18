import type { NotificationStore } from './notification-store.js';
import type { PushDevice, PushMessage } from './notification-types.js';

type ExpoPushTicket = Readonly<{
  details?: Readonly<{ error?: string }>;
  id?: string;
  message?: string;
  status: 'error' | 'ok';
}>;

type ExpoPushResponse = Readonly<{
  data?: readonly ExpoPushTicket[];
}>;

export class ExpoPushGateway {
  constructor(
    private readonly store: NotificationStore,
    private readonly accessToken?: string,
  ) {}

  async send(devices: readonly PushDevice[], message: PushMessage): Promise<void> {
    if (devices.length === 0) return;

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      body: JSON.stringify(
        devices.map((device) => ({
          body: message.body,
          channelId: 'messages',
          data: message.data,
          sound: 'default',
          title: message.title,
          to: device.expoPushToken,
        })),
      ),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Expo Push Service returned ${response.status}.`);

    const payload = (await response.json()) as ExpoPushResponse;
    await Promise.all(
      (payload.data ?? []).map(async (ticket, index) => {
        if (ticket.status !== 'error' || ticket.details?.error !== 'DeviceNotRegistered') return;
        const device = devices[index];
        if (device) await this.store.disableToken(device.expoPushToken);
      }),
    );
  }
}
