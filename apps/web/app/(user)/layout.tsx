"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Globe2, IdCard, MessageCircle, ShoppingBag, Smartphone, UsersRound } from "lucide-react";

import axios from "@/app/api/axios";
import { ThemeToggle } from "@/context/ThemeContext";
import { NoticeBanner } from "@/features/admin/notice-banner";
import { PresenceHeartbeat } from "@/features/presence/presence-heartbeat";
import { UserSidebar } from "@/components/navigation/user-sidebar";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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

  const navItems = [
    { href: "/social", label: "Social", Icon: Globe2 },
    { href: "/chat", label: "Chat", Icon: MessageCircle },
    { href: "/contacts", label: "Friends", Icon: UsersRound },
    { href: "/profile", label: "Profile", Icon: IdCard },
    { href: "/market", label: "Trading", Icon: ShoppingBag },
    { href: "/mobile", label: "Mobile", Icon: Smartphone },
  ];

  return (
    <div className="admin-feature-scope h-[100dvh] overflow-hidden bg-[#c8cdd5] text-[#17191d] dark:bg-[#242326] dark:text-night-text" data-admin-hidden={hiddenParts}>
      <PresenceHeartbeat />
      <div className="relative mx-auto flex h-full w-full max-w-[1720px] flex-col bg-[#e6e8eb] shadow-[0_0_60px_rgba(18,24,36,.18)] dark:bg-night-canvas">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 bg-white/90 px-4 backdrop-blur dark:border-white/10 dark:bg-night-header/95 lg:h-16 lg:px-6">
          <div className="flex items-center gap-2"><UserSidebar /><Link href="/social" className="text-xl font-black tracking-tight text-[#17191d] dark:text-white">g<span className="text-[#C62828]">000</span>st</Link><span className="ml-3 hidden border-l border-black/10 pl-4 text-xs font-bold uppercase tracking-[.22em] text-black/35 dark:border-white/15 dark:text-night-muted xl:inline">Your space to connect</span></div>
          {pathname !== "/profile" && <ThemeToggle />}
        </header>
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[76px] shrink-0 flex-col border-r border-black/10 bg-white/70 px-2 py-5 dark:border-white/10 dark:bg-night-header/65 lg:flex xl:w-56 xl:px-3" aria-label="Desktop navigation">
            <p className="hidden px-3 pb-3 text-[10px] font-black uppercase tracking-[.22em] text-black/35 dark:text-night-muted xl:block">Navigation</p>
            <nav className="space-y-1.5">{navItems.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/') || (href === '/profile' && (pathname.startsWith('/users/') || pathname.startsWith('/beacons/')));
              return <Link key={href} href={href} title={label} aria-current={active ? 'page' : undefined} className={`flex h-12 items-center justify-center gap-3 rounded-2xl px-3 text-sm font-extrabold transition-colors xl:justify-start ${active ? 'bg-[#C62828] text-white shadow-[0_8px_20px_rgba(198,40,40,.2)]' : 'text-[#444b56] hover:bg-black/5 dark:text-night-text dark:hover:bg-white/10'}`}><Icon size={20} strokeWidth={2} /><span className="hidden xl:inline">{label}</span></Link>;
            })}</nav>
            <div className="mt-auto hidden border-t border-black/10 px-3 pt-5 dark:border-white/10 xl:block"><p className="text-xs leading-5 text-black/45 dark:text-night-muted">Make a place for your ideas, then share them with your people.</p></div>
          </aside>
          <main className="relative min-w-0 flex-1 overflow-hidden">
            <NoticeBanner />
            {pageEnabled ? children : <div className="flex h-full items-center justify-center p-6 text-center text-sm font-bold">This page is temporarily unavailable.</div>}
          </main>
        </div>
        <nav aria-label="Mobile navigation" className="flex h-[76px] shrink-0 border-t border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,.06)] dark:border-white/10 dark:bg-night-header lg:hidden">
          {navItems.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/') || (href === '/profile' && (pathname.startsWith('/users/') || pathname.startsWith('/beacons/')));
            return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-2 text-[10px] font-black ${active ? 'border-[#C62828] text-[#C62828]' : 'border-transparent text-black/45 dark:text-night-muted'}`}><Icon size={20} strokeWidth={2} /><span className="truncate">{label}</span></Link>;
          })}
        </nav>
      </div>
    </div>
  );
}
