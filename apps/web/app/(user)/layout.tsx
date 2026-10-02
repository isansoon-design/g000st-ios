"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";

import axios from "@/app/api/axios";
import { ThemeToggle } from "@/context/ThemeContext";
import { NoticeBanner } from "@/features/admin/notice-banner";
import { PresenceHeartbeat } from "@/features/presence/presence-heartbeat";
import { UserSidebar } from "@/components/navigation/user-sidebar";
import { NotificationBell } from '@/features/notifications/notification-bell';
import { PushBootstrap } from '@/features/notifications/push-bootstrap';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasPageTitle = ["/social", "/chat", "/contacts", "/profile", "/market", "/mobile"].includes(pathname)
    || pathname.startsWith("/posts/");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  useEffect(() => { closeMobileSidebar(); }, [pathname, closeMobileSidebar]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = () => { if (desktop.matches) closeMobileSidebar(); };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [closeMobileSidebar]);
  const [experience, setExperience] = useState<{ pages: Record<string, boolean>; parts: Record<string, boolean> } | null>(null);
  useEffect(() => {
    void axios.get<{ pages: Record<string, boolean>; parts: Record<string, boolean> }>('/communication/experience')
      .then(({ data }) => setExperience(data)).catch(() => undefined);
  }, []);
  const pageKey = pathname.startsWith('/profile') || pathname.startsWith('/users/') || pathname.startsWith('/beacons/') ? 'mypage'
    : pathname.startsWith('/social-chat') || pathname.startsWith('/chat') ? 'whisper'
      : pathname.startsWith('/social') || pathname.startsWith('/posts/social/') ? 'centre'
        : pathname.startsWith('/contacts') ? 'network'
          : pathname.startsWith('/market') || pathname.startsWith('/posts/market/') ? 'trading'
            : pathname.startsWith('/mobile') ? 'mobile' : null;
  const pageEnabled = experience?.pages.site !== false && (!pageKey || experience?.pages[pageKey] !== false);
  const hiddenParts = Object.entries(experience?.parts ?? {}).filter(([, enabled]) => !enabled).map(([key]) => key).join(' ');

  return (
    <div className="admin-feature-scope h-[100dvh] overflow-hidden bg-[#c8cdd5] text-[#17191d] dark:bg-[#242326] dark:text-night-text" data-admin-hidden={hiddenParts}>
      <PresenceHeartbeat />
      <PushBootstrap />
      <div className="relative mx-auto flex h-full w-full max-w-[1720px] flex-col bg-[#e6e8eb] shadow-[0_0_60px_rgba(18,24,36,.18)] dark:bg-night-canvas">
        <header className="relative z-[60] flex h-14 shrink-0 items-center justify-between gap-1 border-b border-black/10 bg-white/90 px-2 backdrop-blur dark:border-white/10 dark:bg-night-header/95 sm:px-4 lg:h-16 lg:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
            <button type="button" aria-label={mobileSidebarOpen ? "Close navigation" : "Open navigation"} aria-controls="user-navigation" aria-expanded={mobileSidebarOpen} onClick={() => setMobileSidebarOpen((open) => !open)} className="mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-[#111] hover:bg-black/10 dark:text-white dark:hover:bg-white/10 lg:hidden"><Menu size={21} /></button>
            <button type="button" aria-label={desktopSidebarOpen ? "Close navigation" : "Open navigation"} aria-controls="user-navigation" aria-expanded={desktopSidebarOpen} onClick={() => setDesktopSidebarOpen((open) => !open)} className="mr-2 hidden h-9 w-9 items-center justify-center rounded-lg text-[#111] hover:bg-black/10 dark:text-white dark:hover:bg-white/10 lg:flex"><Menu size={21} /></button>
            <Link href="/social" className={`${hasPageTitle ? "hidden sm:inline" : ""} text-xl font-black tracking-tight text-[#17191d] dark:text-white`}>g<span className="text-[#C62828]">000</span>st</Link>
            <span className="ml-3 hidden border-l border-black/10 pl-4 text-xs font-bold uppercase tracking-[.22em] text-black/35 dark:border-white/15 dark:text-night-muted xl:inline">Your space to connect</span>
          </div>
          <div id="user-page-header-slot" className="flex min-w-0 flex-1 items-center justify-end gap-2" />
          <div className="flex min-w-0 items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <UserSidebar desktopOpen={desktopSidebarOpen} mobileOpen={mobileSidebarOpen} onCloseMobile={closeMobileSidebar} pathname={pathname} />
          <main className="relative min-w-0 flex-1 overflow-hidden">
            <NoticeBanner />
            {pageEnabled ? children : <div className="flex h-full items-center justify-center p-6 text-center text-sm font-bold">This page is temporarily unavailable.</div>}
          </main>
        </div>
      </div>
    </div>
  );
}
