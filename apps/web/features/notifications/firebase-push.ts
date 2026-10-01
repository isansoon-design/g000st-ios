"use client";
import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import axios from '@/app/api/axios';
import { sessionStorage } from '@/app/api/session-storage';

const DEVICE_KEY = 'g000st.web-push-device.v1';
export function webPushDeviceId(): string {
  const stored = localStorage.getItem(DEVICE_KEY);
  if (stored && /^[a-f0-9-]{36}$/.test(stored)) return stored;
  const id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); return id;
}
export async function setupWebPush(requestPermission = false) {
  if (!('Notification' in window) || !(await isSupported())) return null;
  const configResponse = await fetch('/api/push-config');
  if (!configResponse.ok) return null;
  const config = await configResponse.json() as { firebase: FirebaseOptions; vapidKey: string };
  if (Notification.permission === 'default' && requestPermission) await Notification.requestPermission();
  if (Notification.permission !== 'granted') return null;
  const app = getApps()[0] ?? initializeApp(config.firebase);
  const messaging = getMessaging(app);
  const worker = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: worker });
  if (!token) return null;
  const owner = sessionStorage.get()?.user.publicId;
  if (!owner) return null;
  const { data } = await axios.get<{ pages: { publicId: string }[] }>('/auth/pages');
  const deviceId = webPushDeviceId();
  for (const publicId of [owner, ...data.pages.map((page) => page.publicId)]) {
    if (sessionStorage.get()?.user.publicId !== owner) return null;
    await axios.put('/notifications/devices', { deviceId, fcmToken: token, platform: 'web' }, { headers: { 'X-Acting-Public-Id': publicId } });
  }
  return onMessage(messaging, () => window.dispatchEvent(new Event('g000st:notifications')));
}

export async function unregisterWebPush(): Promise<void> {
  const deviceId = typeof window !== 'undefined' ? localStorage.getItem(DEVICE_KEY) : null;
  if (!deviceId || !sessionStorage.get()) return;
  try {
    const owner = sessionStorage.get()!.user.publicId;
    const { data } = await axios.get<{ pages: { publicId: string }[] }>('/auth/pages');
    await Promise.allSettled([owner, ...data.pages.map((page) => page.publicId)].map((publicId) => axios.delete('/notifications/devices', { data: { deviceId }, headers: { 'X-Acting-Public-Id': publicId } })));
  } catch { /* Local logout remains available offline. */ }
}
