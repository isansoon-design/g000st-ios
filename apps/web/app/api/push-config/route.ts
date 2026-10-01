import { SDK_VERSION } from 'firebase/app';
import { NextResponse } from 'next/server';

export function GET() {
  const firebase = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!firebase.apiKey || !firebase.projectId || !firebase.messagingSenderId || !firebase.appId || !vapidKey) return NextResponse.json({ enabled: false }, { status: 503 });
  // Firebase web configuration is public. Never include server credentials here.
  return NextResponse.json({ firebase, vapidKey, sdkVersion: SDK_VERSION });
}
