"use client";

import Link from "next/link";
import { Activity, BarChart3, MessageSquare, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getAdminAnalytics, getAdminDesk, type AdminAnalyticsV1, type AdminDeskV1 } from "@/app/api/admin-desk";
import { toApiError } from "@/app/api/api-error";

const number = new Intl.NumberFormat("ar");
const time = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

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
    { label: "إجمالي المستخدمين", value: analytics.users.total, icon: Users, href: "/users" },
    { label: "المتصلون الآن", value: analytics.users.onlineNow, icon: Activity, href: "/analytics" },
    { label: "المسجلون اليوم", value: analytics.users.registeredToday, icon: BarChart3, href: "/analytics" },
    { label: "رسائل الدعم المفتوحة", value: desk?.openInboxCount, icon: MessageSquare, href: "/client-desk" },
  ] : [];

  return <div dir="rtl" className="min-h-full bg-gray-50 p-4 text-gray-900 dark:bg-night-canvas dark:text-night-text sm:p-7"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-black">لوحة التحكم</h1><p className="mt-1 text-sm text-gray-500 dark:text-night-muted">ملخص مباشر من بيانات المنصة</p></div><button onClick={() => void refresh()} disabled={loading} className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />تحديث</button></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading && !analytics && <div className="rounded-2xl bg-white p-6 dark:bg-night-surface">جارٍ تحميل البيانات…</div>}
    {analytics && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Link href={card.href} key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 dark:border-night-border dark:bg-night-surface"><div className="flex items-center justify-between text-sm text-gray-500 dark:text-night-muted"><span>{card.label}</span><card.icon size={20} className="text-red-600" /></div><strong className="mt-4 block text-3xl">{card.value === undefined ? "—" : number.format(card.value)}</strong></Link>)}</section>
      <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-night-border dark:bg-night-surface"><h2 className="text-lg font-black">نشاط المستخدمين</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Summary label="نشطون اليوم" value={analytics.users.activeToday} /><Summary label="نشطون هذا الشهر" value={analytics.users.activeThisMonth} /><Summary label="تسجيلات هذا الشهر" value={analytics.users.registeredThisMonth} /><Summary label="حسابات موقوفة" value={analytics.users.suspended} /></div><Link href="/analytics" className="mt-5 inline-block text-sm font-bold text-red-700 underline">عرض الإحصاءات التفصيلية</Link></div><div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-night-border dark:bg-night-surface"><h2 className="text-lg font-black">الأقسام</h2><div className="mt-3 space-y-2">{analytics.sections.slice(0, 6).map((section) => <div key={section.key} className="flex justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-night-control"><span>{section.label}</span><b>{number.format(section.count)}</b></div>)}</div></div></section>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-night-border dark:bg-night-surface"><div className="flex items-center justify-between"><h2 className="text-lg font-black">آخر رسائل الدعم</h2><Link href="/client-desk" className="text-sm font-bold text-red-700 underline">فتح لوحة العميل</Link></div>{desk?.inbox.length ? <div className="mt-3 space-y-2">{desk.inbox.slice(0, 5).map((item) => <div key={item.id} className="rounded-xl border border-gray-100 p-3 text-sm dark:border-night-border"><div className="flex flex-wrap justify-between gap-2"><code dir="ltr" className="text-xs">{item.from.slice(0, 8)}…</code><span className="text-xs text-gray-500">{time.format(item.createdAtMs)}</span></div><p className="mt-1 line-clamp-2">{item.text}</p></div>)}</div> : <p className="mt-3 text-sm text-gray-500">لا توجد رسائل بعد.</p>}</section>
      <p className="text-center text-xs text-gray-500">آخر تحديث للقياسات: {time.format(analytics.generatedAtMs)} · الحدود اليومية والشهرية بتوقيت UTC</p>
    </>}
  </div></div>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-gray-50 p-3 dark:bg-night-control"><span className="text-gray-500 dark:text-night-muted">{label}</span><strong className="mt-1 block text-xl">{number.format(value)}</strong></div>;
}
