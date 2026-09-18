import type { PushDevice, PushPlatform } from './notification-types.js';

export interface NotificationStore {
  disableToken(expoPushToken: string): Promise<void>;
  listActiveDevices(publicId: string): Promise<readonly PushDevice[]>;
  removeDevice(publicId: string, deviceId: string): Promise<void>;
  upsertDevice(input: Readonly<{
    deviceId: string;
    expoPushToken: string;
    platform: PushPlatform;
    publicId: string;
    updatedAtMs: number;
  }>): Promise<void>;
}
