"use client";

import { Activity, Globe2, MapPin, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getAdminAnalytics, type AdminAnalyticsV1 } from '@/app/api/admin-desk';
import { sectionDetails } from '../section-metrics';

const number = new Intl.NumberFormat('en-US');
const countries = new Intl.DisplayNames(['en'], { type: 'region' });
const panel = 'rounded-[22px] border border-white/70 bg-white p-5 shadow-[0_12px_32px_rgba(32,43,56,.08)] dark:border-night-border dark:bg-night-surface';

export default function AnalyticsPage() {
  const [data, setData] = useState<AdminAnalyticsV1 | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try { setData(await getAdminAnalytics()); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not load analytics'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  const maxDay = Math.max(1, ...(data?.users.registrationsByDay.map((day) => day.count) ?? []));
  const geoMax = Math.max(1, ...(data?.geography.countries.map((country) => country.count) ?? []));
  const citiesByCountry = new Map<string, AdminAnalyticsV1['geography']['cities'][number][]>();
  for (const city of data?.geography.cities ?? []) {
    const countryCities = citiesByCountry.get(city.country) ?? [];
    countryCities.push(city);
    citiesByCountry.set(city.country, countryCities);
  }


  return <div className="min-h-full bg-[linear-gradient(135deg,#e5e9ef,#d8dce3_52%,#eef0f3)] p-4 text-[#17212c] dark:bg-night-canvas dark:text-night-text sm:p-7">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-[#c62828]">G000ST · ADMIN INSIGHTS</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Platform analytics</h1><p className="mt-2 text-sm text-slate-600 dark:text-night-muted">Live database metrics · daily and monthly periods use UTC</p></div><button onClick={() => void refresh()} disabled={loading} className="flex items-center gap-2 rounded-full bg-[#17212c] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /> Refresh</button></header>
      {error && <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && !data && <div className={panel}>Loading analytics…</div>}
      {data && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Users"><Metric icon={<Users size={21} />} label="Total users" value={data.users.total} caption="Human accounts, excluding profile pages" /><Metric icon={<TrendingUp size={21} />} label="Registered today" value={data.users.registeredToday} caption={`This month: ${number.format(data.users.registeredThisMonth)}`} /><Metric icon={<Activity size={21} />} label="Active today" value={data.users.activeToday} caption={`This month: ${number.format(data.users.activeThisMonth)}`} /><Metric icon={<Globe2 size={21} />} label="Online now" value={data.users.onlineNow} caption="Active within the last 2 minutes" /></section>
        <section className="grid gap-5 xl:grid-cols-[1.7fr_1fr]"><div className={panel}><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black">Registrations in the last 30 days</h2><p className="mt-1 text-xs text-slate-500 dark:text-night-muted">New accounts by registration day</p></div><span className="rounded-full bg-[#fce8e8] px-3 py-1 text-xs font-bold text-[#a52b2b]">{number.format(data.users.registeredThisMonth)} this month</span></div><div className="mt-6 flex h-44 items-end gap-1" aria-label="Daily registration chart">{data.users.registrationsByDay.map((day) => <div key={day.day} title={`${day.day}: ${day.count}`} className="group relative flex h-full min-w-0 flex-1 items-end"><div className="w-full rounded-t-md bg-[linear-gradient(#e53935,#9e2424)] transition-all hover:brightness-110" style={{ height: `${Math.max(day.count ? 9 : 2, day.count / maxDay * 100)}%` }} /><span className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 rounded bg-[#17212c] px-2 py-1 text-[10px] text-white group-hover:block">{day.day}: {number.format(day.count)}</span></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>{data.users.registrationsByDay[0]?.day}</span><span>{data.users.registrationsByDay.at(-1)?.day}</span></div></div><div className={`${panel} flex flex-col justify-between`}><div><h2 className="text-lg font-black">Activity rate</h2><p className="mt-1 text-xs text-slate-500 dark:text-night-muted">Distinct accounts with recent recorded presence</p></div><div className="space-y-5 py-5"><Ratio label="Active today" value={data.users.activeToday} total={data.users.total} /><Ratio label="Active this month" value={data.users.activeThisMonth} total={data.users.total} /></div><div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-night-control dark:text-night-muted">Suspended users: <b>{number.format(data.users.suspended)}</b>. Activity uses each account’s last recorded presence; it is not a historical visits log.</div></div></section>
        <section className={panel} aria-label="Countries and cities">
          <div className="flex items-center gap-2"><Globe2 className="text-[#c62828]" size={20} /><h2 className="text-lg font-black">Countries and cities where users connected</h2></div>
          <p className="mt-1 text-xs text-slate-500 dark:text-night-muted">Approximate location from connection IP · coverage: {number.format(data.geography.coveredUsers)} users</p>
          {data.geography.countries.length ? <div className="mt-5 grid items-start gap-4 lg:grid-cols-2">
            {data.geography.countries.map((country) => {
              const countryCities = citiesByCountry.get(country.name) ?? [];
              const unknownCityCount = country.count - countryCities.reduce((total, city) => total + city.count, 0);
              return <div key={country.name} className="rounded-2xl border border-slate-200 p-4 dark:border-night-border">
                <h3 className="flex justify-between gap-3 text-sm"><span className="font-bold">{countries.of(country.name) ?? country.name}</span><span>{number.format(country.count)}</span></h3>
                <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-night-control"><div className="h-full rounded-full bg-[#c62828]" style={{ width: `${country.count / geoMax * 100}%` }} /></div>
                <ul className="mt-4 space-y-2 border-l border-slate-200 pl-3 dark:border-night-border">
                  {countryCities.map((city) => <li key={city.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-night-control"><span className="flex min-w-0 items-center gap-2"><MapPin size={15} className="shrink-0 text-slate-400" /><span className="break-words">{city.name}</span></span><b>{number.format(city.count)}</b></li>)}
                  {unknownCityCount > 0 && <li className="flex justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-night-control dark:text-night-muted"><span>City unavailable</span><span>{number.format(unknownCityCount)}</span></li>}
                </ul>
              </div>;
            })}
          </div> : <Unavailable />}
        </section>
        <p className="text-xs text-slate-500 dark:text-night-muted">Locations are approximate and reflect activity in the last 30 days. VPNs and mobile networks may show a different location; some cities are unavailable. <a href="https://db-ip.com" target="_blank" rel="noreferrer" className="underline">IP Geolocation by DB-IP</a> · <a href="/users" className="font-bold underline">View location by user</a></p>
        <section className={panel}><div className="mb-4"><h2 className="text-lg font-black">Content and feature records</h2><p className="mt-1 text-xs text-slate-500 dark:text-night-muted">Record counts by feature, not user counts. Periods use UTC.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.sections.map((section) => <div key={section.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-night-border dark:bg-night-control"><div className="text-sm font-black">{sectionDetails[section.key]?.title ?? section.label}</div><div className="mt-3 text-3xl font-black">{number.format(section.count)} <span className="text-xs font-normal">total</span></div><div className="text-xs text-slate-500 dark:text-night-muted">{sectionDetails[section.key]?.description ?? section.metric}</div><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white px-3 py-1 dark:bg-night-surface">{sectionDetails[section.key]?.period ?? "recorded"} today {number.format(section.today)}</span><span className="rounded-full bg-white px-3 py-1 dark:bg-night-surface">This month {number.format(section.thisMonth)}</span></div></div>)}</div></section>
        <p className="pb-6 text-center text-[11px] text-slate-500 dark:text-night-muted">Last updated: {new Date(data.generatedAtMs).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC'}</p>
      </>}
    </div>
  </div>;
}

function Metric({ icon, label, value, caption }: { icon: React.ReactNode; label: string; value: number; caption: string }) { return <div className={`${panel} relative overflow-hidden`}><div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-[#c62828]/[.06]" /><div className="relative flex items-center gap-2 text-[#c62828]">{icon}<span className="text-sm font-bold text-slate-600 dark:text-night-muted">{label}</span></div><div className="relative mt-4 text-4xl font-black">{number.format(value)}</div><p className="relative mt-2 text-xs text-slate-500 dark:text-night-muted">{caption}</p></div>; }
function Ratio({ label, value, total }: { label: string; value: number; total: number }) { const percent = total ? Math.round(value / total * 100) : 0; return <div><div className="flex justify-between text-sm"><b>{label}</b><span>{number.format(percent)}%</span></div><div className="mt-2 h-3 rounded-full bg-slate-100 dark:bg-night-control"><div className="h-full rounded-full bg-[linear-gradient(90deg,#c62828,#f46a61)]" style={{ width: `${Math.min(100, percent)}%` }} /></div></div>; }
function Unavailable() { return <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-night-border dark:bg-night-control dark:text-night-muted">Unavailable. The server has no trusted location for these connections.</div>; }
