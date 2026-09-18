import axiosInstance from '@/api/axios';

export async function registerPushDevice(input: Readonly<{
  deviceId: string;
  expoPushToken: string;
  platform: 'android' | 'ios';
}>): Promise<void> {
  await axiosInstance.put('/notifications/devices', input);
}

export async function unregisterPushDevice(deviceId: string): Promise<void> {
  await axiosInstance.delete('/notifications/devices', { data: { deviceId } });
}
