"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ThemeMode = "light" | "dark";
type ThemeContextValue = Readonly<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>;

const STORAGE_KEY = "g000st:app-theme:v1";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [mode, updateMode] = useState<ThemeMode>("light");

  useEffect(() => {
    updateMode(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = event.newValue === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      document.documentElement.classList.toggle("dark", next === "dark");
      updateMode(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    setMode(next) {
      document.documentElement.dataset.theme = next;
      document.documentElement.classList.toggle("dark", next === "dark");
      updateMode(next);
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Browsers may disable storage. */ }
    },
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const isDark = mode === "dark";
  return (
    <button
      aria-checked={isDark}
      aria-label="Dark mode"
      className="relative flex h-11 w-[68px] shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C62828]"
      onClick={() => setMode(isDark ? "light" : "dark")}
      role="switch"
      type="button"
    >
      <span className="relative flex h-[34px] w-16 items-center justify-around rounded-full border border-[#AAA7AD] bg-[#ECEBED] text-[#77727D] transition-colors dark:border-[#B5B2B9] dark:bg-[#29282E] dark:text-[#F4F2F5]">
        <span className="absolute left-[2px] top-[2px] h-7 w-7 rounded-full bg-white shadow-sm transition-[left,background-color] dark:left-[33px] dark:bg-[#111111]" />
        <Sun aria-hidden="true" className="relative z-10 h-4 w-4 text-[#C78014] dark:text-[#A6A2AC]" strokeWidth={2} />
        <Moon aria-hidden="true" className="relative z-10 h-4 w-4 text-[#77727D] dark:text-[#F4F2F5]" fill="currentColor" strokeWidth={1.5} />
      </span>
    </button>
  );
}

export function PublicThemeControl() {
  const pathname = usePathname();
  if (!pathname || !["/login", "/register", "/support", "/privacy-policy"].includes(pathname)) return null;
  return <div className="fixed right-3 top-3 z-[100] rounded-full bg-white/75 shadow-sm dark:bg-[#414046]/90"><ThemeToggle /></div>;
}
