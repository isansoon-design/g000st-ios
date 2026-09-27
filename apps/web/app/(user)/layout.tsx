"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import axios from "@/app/api/axios";
import { ThemeToggle } from "@/context/ThemeContext";
import { NoticeBanner } from "@/features/admin/notice-banner";
import { PresenceHeartbeat } from "@/features/presence/presence-heartbeat";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [experience, setExperience] = useState<{ pages: Record<string, boolean>; parts: Record<string, boolean> } | null>(null);
  useEffect(() => {
    void axios.get<{ pages: Record<string, boolean>; parts: Record<string, boolean> }>('/communication/experience')
      .then(({ data }) => setExperience(data)).catch(() => undefined);
  }, []);
  const pageKey = pathname.startsWith('/profile') || pathname.startsWith('/users/') ? 'mypage'
    : pathname.startsWith('/social-chat') || pathname.startsWith('/chat') ? 'whisper'
      : pathname.startsWith('/social') ? 'centre'
        : pathname.startsWith('/contacts') ? 'network'
          : pathname.startsWith('/market') ? 'trading'
            : pathname.startsWith('/mobile') ? 'mobile' : null;
  const pageEnabled = experience?.pages.site !== false && (!pageKey || experience?.pages[pageKey] !== false);
  const hiddenParts = Object.entries(experience?.parts ?? {}).filter(([, enabled]) => !enabled).map(([key]) => key).join(' ');

  const navItems = [
    { href: "/social", label: "SOCIAL", icon: "◎" },
    { href: "/chat", label: "CHAT", icon: "💬" },
    { href: "/contacts", label: "FRIENDS", icon: "👥" },
    { href: "/profile", label: "ID", icon: "🪪" },
    { href: "/market", label: "TRAIDING", icon: "🛍" },
    { href: "/mobile", label: "MOBILE", icon: "📞" },
  ];

  return (
    <div className="admin-feature-scope h-[100dvh] overflow-hidden bg-[#C8CDD5] dark:bg-night-canvas" data-admin-hidden={hiddenParts}>
      <PresenceHeartbeat />
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col bg-[#D8DCE3] dark:bg-night-canvas shadow-[0_0_55px_rgba(0,0,0,0.18)]">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-black/10 bg-[#D0D0D0] px-3 dark:border-white/15 dark:bg-night-header">
          <span className="text-sm font-black text-[#111] dark:text-white">g<span className="text-[#C62828]">000</span>st</span>
          {pathname !== "/profile" && <ThemeToggle />}
        </header>
        <main className="relative min-h-0 flex-1 overflow-hidden">
          <NoticeBanner />
          {pageEnabled ? children : <div className="flex h-full items-center justify-center p-6 text-center text-sm font-bold">This page is temporarily unavailable.</div>}
        </main>

        {/* Bottom Navigation - exactly like original */}
        <nav style={{
          flexShrink: 0,
          display: "flex",
          background: "linear-gradient(180deg,var(--tone-bg-eeeeee) 0%,var(--tone-bg-c4c4c4) 50%,var(--app-control) 100%)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,.55),0 -8px 24px rgba(0,0,0,.12)",
          borderTop: "1px solid rgba(0,0,0,.15)",
          height: 84,
          paddingBottom: 24,
          boxSizing: "border-box" as const,
        }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column" as const,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  textDecoration: "none",
                  color: isActive ? "var(--app-text)" : "var(--tone-fg-6a6a6a)",
                  fontWeight: 900,
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  paddingTop: 6,
                  filter: "drop-shadow(0 2px 3px rgba(0,0,0,.15))",
                  borderTop: isActive ? "2px solid #C62828" : "2px solid transparent",
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
