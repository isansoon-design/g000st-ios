export type PushPlatform = 'android' | 'ios';

export type PushDevice = Readonly<{
  deviceId: string;
  expoPushToken: string;
  platform: PushPlatform;
  publicId: string;
  updatedAtMs: number;
}>;

export type PushMessage = Readonly<{
  body: string;
  data: Readonly<Record<string, string>>;
  title: string;
}>;
