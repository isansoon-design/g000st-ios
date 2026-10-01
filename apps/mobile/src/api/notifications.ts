import axiosInstance from '@/api/axios';

export async function registerPushDevice(input: Readonly<{
  deviceId: string;
  expoPushToken?: string;
  fcmToken?: string;
  platform: 'android' | 'ios';
}>, actorPublicId?: string): Promise<void> {
  await axiosInstance.put('/notifications/devices', input, actorPublicId ? { headers: { 'X-Acting-Public-Id': actorPublicId } } : undefined);
}

export async function unregisterPushDevice(deviceId: string, actorPublicId?: string): Promise<void> {
  await axiosInstance.delete('/notifications/devices', { data: { deviceId }, ...(actorPublicId ? { headers: { 'X-Acting-Public-Id': actorPublicId } } : {}) });
}
