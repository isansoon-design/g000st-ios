"use client";

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import axios from '@/app/api/axios';
import { sessionStorage } from '@/app/api/session-storage';

export function SupportContactForm() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(!!sessionStorage.get()), []);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await axios.post('/communication/contact', { text: text.trim() });
      setText('');
      toast.success('Your message was sent.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not send your message.'); }
    finally { setBusy(false); }
  }

  if (!signedIn) return null;
  return <form onSubmit={(event) => void send(event)} className="mt-6 text-left"><label htmlFor="support-message" className="mb-2 block text-sm font-bold">Send a private message to support</label><textarea id="support-message" className="min-h-28 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-black dark:border-night-border dark:bg-night-control dark:text-white" value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder="How can we help?" /><button className="mt-2 rounded-xl bg-[#c62828] px-5 py-2 font-bold text-white disabled:opacity-50" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send message'}</button></form>;
}
