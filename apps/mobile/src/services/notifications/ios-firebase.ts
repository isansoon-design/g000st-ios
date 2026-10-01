import { Platform } from 'react-native';

export async function iosFirebaseMessaging() {
  if (Platform.OS !== 'ios') return null;
  // Keep Android's existing CallKit/Telecom -> Expo FCM service as its sole entry point.
  const { getMessaging } = await import('@react-native-firebase/messaging');
  return getMessaging();
}

export async function iosFcmToken(): Promise<string | null> {
  const messaging = await iosFirebaseMessaging();
  if (!messaging) return null;
  const { getToken, registerDeviceForRemoteMessages } = await import('@react-native-firebase/messaging');
  if (!messaging.isDeviceRegisteredForRemoteMessages) await registerDeviceForRemoteMessages(messaging);
  return getToken(messaging);
}
