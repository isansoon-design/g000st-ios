"use client";
import { useEffect } from 'react';
import { setupWebPush } from './firebase-push';
import { sessionStorage } from '@/app/api/session-storage';
import axios from '@/app/api/axios';
import { safeNotificationPath } from './notification-path';

export function PushBootstrap() {
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    void setupWebPush().then((cleanup) => { if (active) unsubscribe = cleanup; else cleanup?.(); }).catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    const recipient = params.get('pushRecipient');
    const path = safeNotificationPath(params.get('pushPath'));
    if (recipient && /^[A-Za-z0-9]{50}$/.test(recipient) && path) {
      const owner = sessionStorage.get()?.user.publicId;
      void axios.get<{ pages: { publicId: string }[] }>('/auth/pages').then(({ data }) => {
        if (!active || owner !== sessionStorage.get()?.user.publicId) return;
        if (recipient !== owner && !data.pages.some((page) => page.publicId === recipient)) return;
        sessionStorage.setActingPublicId(recipient);
        window.location.replace(path);
      }).catch(() => undefined);
    }
    return () => { active = false; unsubscribe?.(); };
  }, []);
  return null;
}
