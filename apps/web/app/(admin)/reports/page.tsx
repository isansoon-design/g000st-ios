"use client";
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from '@/app/api/axios';

type Report = { id: string; postId: string; commentId?: string; reason: string; details?: string; status: string; createdAtMs: number; resolution?: string };
export default function ReportsPage() {
  return <Suspense fallback={<p className="p-6">Loading reports…</p>}><ReportsContent /></Suspense>;
}
function ReportsContent() {
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get('section');
  const requestedReport = searchParams.get('reportId');
  const [section, setSection] = useState<'social' | 'market'>('social');
  const [items, setItems] = useState<Report[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const generation = useRef(0);
  const load = async (kind: 'social' | 'market', nextCursor?: string) => {
    const requestId = ++generation.current;
    setLoading(true); setError(false);
    const reportId = !nextCursor && kind === (requestedSection === 'market' ? 'market' : 'social') && requestedReport && /^[a-f0-9-]{36}$/.test(requestedReport) ? requestedReport : undefined;
    try {
      const { data } = await axios.get<{ version: 1; items: Report[]; selected?: Report; nextCursor?: string }>(`/admin/reports/${kind}`, { params: { cursor: nextCursor, reportId } });
      if (requestId !== generation.current) return;
      const rows = data.selected && !data.items.some((item) => item.id === data.selected!.id) ? [data.selected, ...data.items] : data.items;
      setItems((old) => nextCursor ? [...old, ...rows.filter((item) => !old.some((entry) => entry.id === item.id))] : rows); setCursor(data.nextCursor);
    } catch { if (requestId === generation.current) setError(true); } finally { if (requestId === generation.current) setLoading(false); }
  };
  useEffect(() => {
    const kind = requestedSection === 'market' ? 'market' : 'social';
    setSection(kind); setSelected(requestedReport); void load(kind);
  }, [requestedSection, requestedReport]);
  const resolve = async (id: string, resolution: 'action_taken' | 'no_violation') => {
    setLoading(true);
    try { await axios.put(`/admin/reports/${section}/${id}`, { resolution }); await load(section); }
    catch { setError(true); setLoading(false); }
  };
  return <div className="mx-auto max-w-4xl p-6"><h1 className="mb-4 text-2xl font-bold">Reports</h1>
    <div className="mb-4 flex gap-3">{(['social', 'market'] as const).map((kind) => <button disabled={loading} key={kind} onClick={() => { setSection(kind); setItems([]); void load(kind); }} className={`rounded-lg border px-4 py-2 capitalize ${kind === section ? 'bg-red-700 text-white' : ''}`}>{kind}</button>)}</div>
    {error && <p role="alert" className="mb-4 text-red-700">Could not update reports. <button className="underline" onClick={() => void load(section)}>Retry</button></p>}
    {loading && <p role="status" className="mb-3">Loading…</p>}
    {!loading && !error && !items.length && <p>No reports yet.</p>}
    <div className="space-y-3">{items.map((item) => <article key={item.id} className={`rounded-xl border bg-white p-4 dark:bg-night-surface ${selected === item.id ? 'border-red-600' : 'border-black/10 dark:border-night-border'}`}>
      <div className="flex flex-wrap justify-between gap-2"><strong className="capitalize">{item.reason}</strong><span className="text-sm">{item.status}</span></div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{item.details || 'No additional details.'}</p>
      <p className="mt-2 text-xs text-gray-500">{new Date(item.createdAtMs).toLocaleString()}{item.commentId ? ' · Comment report' : ''}</p>
      <Link className="mt-3 inline-block text-sm font-semibold text-red-700" href={`/posts/${section}/${item.postId}`}>View content</Link>
      {item.status !== 'resolved' && <div className="mt-3 flex flex-wrap gap-2"><button disabled={loading} className="rounded-lg border px-3 py-2 text-sm" onClick={() => void resolve(item.id, 'no_violation')}>Resolve: no violation</button><button disabled={loading} className="rounded-lg border px-3 py-2 text-sm" onClick={() => void resolve(item.id, 'action_taken')}>Resolve: action already taken</button><Link className="rounded-lg border px-3 py-2 text-sm" href="/client-desk">Manage content</Link></div>}
      {item.resolution && <p className="mt-2 text-xs">{item.resolution === 'action_taken' ? 'Action taken' : 'No violation'}</p>}
    </article>)}</div>
    {cursor && <button disabled={loading} onClick={() => void load(section, cursor)} className="mt-4 rounded-lg border px-4 py-2">Load more</button>}
  </div>;
}
