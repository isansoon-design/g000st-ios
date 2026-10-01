"use client";
import { Bell, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { NotificationScope } from '@/app/api/notifications';
import { useNotifications } from './use-notifications';
import { NotificationList } from './notification-list';

export function NotificationBell({ scope = 'user' }: { scope?: NotificationScope }) {
  const [open, setOpen] = useState(false);
  const state = useNotifications(scope);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [open]);
  const count = state.page?.unreadCount ?? 0;
  return <div className="relative shrink-0" ref={root}>
    <button ref={button} type="button" aria-label={`Notifications${count ? `, ${count} unread` : ''}`} aria-expanded={open} aria-controls={`notification-popover-${scope}`} onClick={() => { setOpen(!open); if (!open) void state.refresh(); }} className="relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-black/10 dark:hover:bg-white/10">
      <Bell size={21} />{count > 0 && <span className="absolute -right-0.5 top-0 min-w-4 rounded-full bg-[#C62828] px-1 text-center text-[10px] font-bold leading-4 text-white">{count > 99 ? '99+' : count}</span>}
    </button>
    {open && <section id={`notification-popover-${scope}`} aria-label="Notifications" className="fixed right-2 top-16 z-50 flex max-h-[calc(100dvh-5rem)] w-[min(390px,calc(100vw-1rem))] flex-col rounded-2xl border border-black/10 bg-white shadow-xl dark:border-night-border dark:bg-night-surface lg:absolute lg:right-0 lg:top-12">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-night-border"><h2 className="font-bold">{scope === 'admin' ? 'Admin notifications' : 'Notifications'}</h2><button aria-label="Close notifications" onClick={() => { setOpen(false); button.current?.focus(); }} className="p-1"><X size={18} /></button></div>
      <div className="overflow-auto"><NotificationList {...state} scope={scope} onNavigate={() => setOpen(false)} /></div>
      <Link href={scope === 'admin' ? '/admin-notifications' : '/notifications'} onClick={() => setOpen(false)} className="border-t border-black/10 p-3 text-center text-sm font-bold text-red-700 dark:border-night-border dark:text-red-300">View all notifications</Link>
    </section>}
  </div>;
}
