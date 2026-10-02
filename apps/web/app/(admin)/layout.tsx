"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Users, Settings, LogOut, Menu, BarChart3, PanelsTopLeft } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/context/ThemeContext";
import { logout } from "@/app/api/auth";
import { NotificationBell } from '@/features/notifications/notification-bell';
import { PushBootstrap } from '@/features/notifications/push-bootstrap';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isBillingPage = usePathname() === "/billing";

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-night-canvas">
      <PushBootstrap />
      {/* Header */}
      <header className="relative z-[60] shrink-0 bg-white dark:bg-night-surface border-b border-gray-200 dark:border-night-border px-2 sm:px-6 py-4 flex items-center justify-between gap-1">
        <div className="flex shrink-0 items-center gap-1 sm:gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg lg:hidden"
            aria-label="Toggle admin navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className={`${isBillingPage ? "hidden sm:block" : ""} text-lg font-bold sm:text-xl`}>
            <span className="text-gray-900 dark:text-night-text">g</span>
            <span className="text-red-600">000</span>
            <span className="text-gray-900 dark:text-night-text">st</span>
            <span className="ml-2 hidden text-gray-600 dark:text-night-muted sm:inline">Admin</span>
          </h1>
        </div>
        <div id="admin-page-header-slot" className="flex min-w-0 flex-1 items-center justify-center px-2" />
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <NotificationBell scope="admin" />
          <ThemeToggle />
          <button className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 sm:p-2" aria-label="Log out" onClick={async () => { await logout(); window.location.replace('/login'); }}>
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {isSidebarOpen && <button aria-label="Close admin navigation" className="absolute inset-0 z-10 bg-black/40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
        {/* Sidebar */}
        <nav
          className={`${isSidebarOpen ? "absolute inset-y-0 left-0 z-20 w-64" : "hidden"} lg:relative lg:block lg:w-64 shrink-0 bg-white dark:bg-night-surface border-r border-gray-200 dark:border-night-border overflow-y-auto`}
        >
          <div className="p-6 space-y-4">
            <Link href="/rss" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-night-muted dark:hover:bg-white/10">RSS publishing</Link>
            <Link href="/reports" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-night-muted dark:hover:bg-white/10">Reports</Link>
            <Link
              href="/dashboard"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-night-muted"
            >
              <Settings className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/users"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-night-muted"
            >
              <Users className="w-5 h-5" />
              <span>Users</span>
            </Link>
            <Link href="/client-desk" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-night-muted dark:hover:bg-white/10">
              <PanelsTopLeft className="h-5 w-5" /><span>Client desk</span>
            </Link>
            <Link href="/analytics" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-night-muted dark:hover:bg-white/10">
              <BarChart3 className="h-5 w-5" /><span>Analytics</span>
            </Link>
            <Link
              href="/billing"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-night-muted"
            >
              <CreditCard className="w-5 h-5" />
              <span>Billing</span>
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
