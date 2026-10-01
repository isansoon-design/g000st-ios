import { SDK_VERSION } from 'firebase/app';

export function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId || !config.appId || !config.messagingSenderId) return new Response('// Push is not configured.', { status: 503 });
  // Synchronous initialization is required when the browser restarts a worker for a push.
  const script = `
self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const data = event.notification.data?.FCM_MSG?.data ?? event.notification.data ?? {};
  const path = typeof data.path === 'string' && data.path.startsWith('/') && !data.path.startsWith('//') ? data.path : '/notifications';
  const url = new URL('/notifications', self.location.origin);
  url.searchParams.set('pushRecipient', typeof data.recipientPublicId === 'string' ? data.recipientPublicId : '');
  url.searchParams.set('pushPath', path);
  event.waitUntil(self.clients.openWindow(url.href));
});
importScripts('https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-messaging-compat.js');
firebase.initializeApp(${JSON.stringify(config)});
firebase.messaging();
`;
  return new Response(script, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' } });
}
