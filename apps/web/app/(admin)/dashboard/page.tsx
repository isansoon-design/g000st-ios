"use client";

import Link from "next/link";
import { Activity, BarChart3, MessageSquare, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getAdminAnalytics, getAdminDesk, type AdminAnalyticsV1, type AdminDeskV1 } from "@/app/api/admin-desk";
import { toApiError } from "@/app/api/api-error";
import { sectionDetails } from "../section-metrics";

const number = new Intl.NumberFormat("en-US");
const time = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const panel = "rounded-2xl border border-gray-200 bg-white p-5 dark:border-night-border dark:bg-night-surface";

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AdminAnalyticsV1 | null>(null);
  const [desk, setDesk] = useState<AdminDeskV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextAnalytics, nextDesk] = await Promise.allSettled([getAdminAnalytics(), getAdminDesk()]);
      if (nextAnalytics.status === "rejected") throw nextAnalytics.reason;
      setAnalytics(nextAnalytics.value);
      setDesk(nextDesk.status === "fulfilled" ? nextDesk.value : null);
      setError("");
    } catch (cause) { setError(toApiError(cause).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const cards = analytics ? [
    { label: "Total users", detail: "Human accounts, excluding profile pages", value: analytics.users.total, icon: Users, href: "/users" },
    { label: "Online now", detail: "Active in the last 2 minutes", value: analytics.users.onlineNow, icon: Activity, href: "/analytics" },
    { label: "Registered today", detail: "New accounts since 00:00 UTC", value: analytics.users.registeredToday, icon: BarChart3, href: "/analytics" },
    { label: "Open support messages", detail: "Messages awaiting a reply", value: desk?.openInboxCount, icon: MessageSquare, href: "/client-desk" },
  ] : [];

  return <div className="min-h-full bg-gray-50 p-4 text-gray-900 dark:bg-night-canvas dark:text-night-text sm:p-7"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-black">Dashboard</h1><p className="mt-1 text-sm text-gray-500 dark:text-night-muted">Current platform data · UTC reporting periods</p></div><button onClick={() => void refresh()} disabled={loading} className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />Refresh</button></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading && !analytics && <div className={panel}>Loading dashboard…</div>}
    {analytics && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Link href={card.href} key={card.label} className={`${panel} shadow-sm transition hover:-translate-y-0.5`}><div className="flex items-center justify-between text-sm text-gray-500 dark:text-night-muted"><span>{card.label}</span><card.icon size={20} className="text-red-600" /></div><strong className="mt-4 block text-3xl">{card.value === undefined ? "—" : number.format(card.value)}</strong><p className="mt-2 text-xs text-gray-500 dark:text-night-muted">{card.detail}</p></Link>)}</section>
      <section className="grid gap-4 lg:grid-cols-2"><div className={panel}><h2 className="text-lg font-black">User activity</h2><p className="mt-1 text-xs text-gray-500 dark:text-night-muted">Distinct active accounts, based on each account’s latest recorded presence.</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Summary label="Active today" value={analytics.users.activeToday} /><Summary label="Active this month" value={analytics.users.activeThisMonth} /><Summary label="Registered this month" value={analytics.users.registeredThisMonth} /><Summary label="Suspended accounts" value={analytics.users.suspended} /></div><Link href="/analytics" className="mt-5 inline-block text-sm font-bold text-red-700 underline">View detailed analytics</Link></div><div className={panel}><h2 className="text-lg font-black">Content and feature records</h2><p className="mt-1 text-xs text-gray-500 dark:text-night-muted">These count records in each feature, not users. Today and this month use UTC.</p><div className="mt-4 space-y-3">{analytics.sections.slice(0, 6).map((section) => { const info = sectionDetails[section.key]; return <div key={section.key} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-night-control"><div className="flex justify-between gap-2"><b>{info?.title ?? section.label}</b><span>Total {number.format(section.count)}</span></div><p className="mt-1 text-xs text-gray-500 dark:text-night-muted">{info?.description ?? section.metric}</p><div className="mt-2 flex gap-3 text-xs font-bold"><span>{info ? info.period[0].toUpperCase() + info.period.slice(1) : "Recorded"} today {number.format(section.today)}</span><span>This month {number.format(section.thisMonth)}</span></div></div>; })}</div><Link href="/analytics" className="mt-4 inline-block text-sm font-bold text-red-700 underline">View all feature metrics</Link></div></section>
      <section className={panel}><div className="flex items-center justify-between"><h2 className="text-lg font-black">Recent support messages</h2><Link href="/client-desk" className="text-sm font-bold text-red-700 underline">Open Client desk</Link></div>{desk?.inbox.length ? <div className="mt-3 space-y-2">{desk.inbox.slice(0, 5).map((item) => <div key={item.id} className="rounded-xl border border-gray-100 p-3 text-sm dark:border-night-border"><div className="flex flex-wrap justify-between gap-2"><code className="text-xs">{item.from.slice(0, 8)}…</code><span className="text-xs text-gray-500">{time.format(item.createdAtMs)} UTC</span></div><p className="mt-1 line-clamp-2">{item.text}</p></div>)}</div> : <p className="mt-3 text-sm text-gray-500">No messages yet.</p>}</section>
      <p className="text-center text-xs text-gray-500">Metrics refreshed: {time.format(analytics.generatedAtMs)} UTC · Daily and monthly periods use UTC</p>
    </>}
  </div></div>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-gray-50 p-3 dark:bg-night-control"><span className="text-gray-500 dark:text-night-muted">{label}</span><strong className="mt-1 block text-xl">{number.format(value)}</strong></div>;
}
