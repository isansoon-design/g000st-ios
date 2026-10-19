"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import axios from '@/app/api/axios';
import { sessionStorage } from '@/app/api/session-storage';

export default function ContactUsPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const opening = useRef(false);

  useEffect(() => {
    if (!sessionStorage.get()) router.replace('/login');
    else setSignedIn(true);
  }, [router]);

  async function openSupport() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError('');
    try {
      const { data } = await axios.post<{ version: 1; conversationId: string }>('/communication/support/conversation');
      router.push(`/chat?conversationId=${encodeURIComponent(data.conversationId)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open support. Please try again.');
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }

  if (!signedIn) return null;
  return <div className="flex h-full items-center justify-center overflow-y-auto p-6">
    <section className="w-full max-w-lg rounded-3xl border border-black/10 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-night-surface">
      <MessageCircle className="mx-auto mb-5 text-[#C62828]" size={40} aria-hidden="true" />
      <h1 className="text-2xl font-black">Contact us</h1>
      <p className="mt-3 text-sm leading-6 text-black/60 dark:text-night-muted">Need help or want to report a complaint? Start a private conversation with our support team.</p>
      <button type="button" disabled={busy} onClick={() => void openSupport()} className="mt-6 w-full rounded-xl bg-[#C62828] px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Opening conversation…' : 'Contact us & report a complaint'}</button>
      {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  </div>;
}
