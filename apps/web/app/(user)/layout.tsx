"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/chat",     label: "CHAT",     icon: "💬" },
    { href: "/contacts", label: "CONTACTS", icon: "👥" },
    { href: "/profile",  label: "ID",       icon: "🪪" },
    { href: "/mobile",   label: "MOBILE",   icon: "📞" },
    { href: "/social",   label: "SOCIAL",   icon: "◎" },
  ];

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#C8CDD5]">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col bg-[#D8DCE3] shadow-[0_0_55px_rgba(0,0,0,0.18)]">
        <main className="relative min-h-0 flex-1 overflow-hidden">
          {children}
        </main>

      {/* Bottom Navigation - exactly like original */}
      <nav style={{
        flexShrink: 0,
        display: "flex",
        background: "linear-gradient(180deg,#eee 0%,#c4c4c4 50%,#9a9a9a 100%)",
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
                color: isActive ? "#111" : "#6A6A6A",
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
