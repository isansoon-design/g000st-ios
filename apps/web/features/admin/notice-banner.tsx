"use client";

import { useEffect, useState } from 'react';
import axios from '@/app/api/axios';
import { sessionStorage } from '@/app/api/session-storage';

type Notice = Readonly<{ id: string; text: string; type: 'msg' | 'warning'; createdAtMs: number }>;

export function NoticeBanner() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [storageKey, setStorageKey] = useState('');

  useEffect(() => {
    const key = `g000st:dismissed-notices:${sessionStorage.get()?.user.publicId ?? 'none'}`;
    setStorageKey(key);
    try { const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); setDismissed(Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : []); }
    catch { setDismissed([]); }
    const load = () => void axios.get<{ notices: Notice[] }>('/communication/notices')
      .then(({ data }) => setNotices(data.notices)).catch(() => undefined);
    load();
    const timer = setInterval(load, 120_000);
    return () => clearInterval(timer);
  }, []);

  const visible = notices.filter((notice) => !dismissed.includes(notice.id)).slice(0, 2);
  if (!visible.length) return null;
  return <div className="absolute inset-x-3 top-3 z-40 space-y-2" role="region" aria-label="Platform notices">{visible.map((notice) => <div key={notice.id} className={`flex items-start justify-between gap-3 rounded-2xl border-2 p-3 text-sm shadow-lg ${notice.type === 'warning' ? 'border-[#c62828] bg-[#fff3cd] text-black' : 'border-black bg-white text-black'}`}><div><b>{notice.type === 'warning' ? 'Warning from g000st' : 'Message from g000st'}</b><p className="mt-1 whitespace-pre-wrap break-words">{notice.text}</p></div><button className="rounded-full px-2 font-black" aria-label="Dismiss notice" onClick={() => { const next = [...dismissed, notice.id]; setDismissed(next); if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next)); }}>×</button></div>)}</div>;
}
