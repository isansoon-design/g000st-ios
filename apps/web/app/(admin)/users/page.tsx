"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, RefreshCw, Search, UserCheck, UserX } from "lucide-react";
import toast from "react-hot-toast";

import { getAdminAnalytics, getAdminUsersPage, setAdminUserName, setAdminUserStatus, type AdminUserV1 } from "@/app/api/admin-desk";
import { toApiError } from "@/app/api/api-error";

const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const number = new Intl.NumberFormat("en-US");

export default function UsersPage() {
  const [users, setUsers] = useState<readonly AdminUserV1[]>([]);
  const [results, setResults] = useState<readonly AdminUserV1[] | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [searchCursor, setSearchCursor] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const [page, analytics] = await Promise.allSettled([getAdminUsersPage(), getAdminAnalytics()]);
      if (page.status === "rejected") throw page.reason;
      setUsers(page.value.users);
      setCursor(page.value.nextCursor);
      setTotal(analytics.status === "fulfilled" ? analytics.value.users.total : null);
      setError("");
    } catch (cause) { setError(toApiError(cause).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadFirst(); }, [loadFirst]);
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) { setResults(null); setSearchCursor(undefined); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    setResults([]);
    setSearchCursor(undefined);
    const timer = setTimeout(() => {
      void getAdminUsersPage(undefined, trimmed)
        .then((page) => { if (!cancelled) { setResults(page.users); setSearchCursor(page.nextCursor); setError(""); } })
        .catch((cause) => { if (!cancelled) setError(toApiError(cause).message); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  async function loadMore() {
    const activeCursor = query.trim() ? searchCursor : cursor;
    if (!activeCursor || moreLoading) return;
    setMoreLoading(true);
    try {
      const page = await getAdminUsersPage(activeCursor, query.trim());
      if (query.trim()) { setResults((current) => [...(current ?? []), ...page.users]); setSearchCursor(page.nextCursor); }
      else { setUsers((current) => [...current, ...page.users]); setCursor(page.nextCursor); }
      setError("");
    } catch (cause) { setError(toApiError(cause).message); }
    finally { setMoreLoading(false); }
  }

  function updateRow(publicId: string, changes: Partial<AdminUserV1>) {
    setUsers((current) => current.map((user) => user.publicId === publicId ? { ...user, ...changes } : user));
    setResults((current) => current?.map((user) => user.publicId === publicId ? { ...user, ...changes } : user) ?? null);
  }

  async function changeStatus(user: AdminUserV1) {
    const status = user.status === "suspended" ? "active" : "suspended";
    setBusyId(user.publicId);
    try {
      await setAdminUserStatus(user.publicId, status);
      updateRow(user.publicId, { status });
      toast.success(status === "active" ? "Account reactivated" : "Account suspended");
    } catch (cause) { toast.error(toApiError(cause).message); }
    finally { setBusyId(null); }
  }

  async function changeName(user: AdminUserV1) {
    const displayName = window.prompt("New display name", user.displayName)?.trim();
    if (!displayName || displayName === user.displayName) return;
    setBusyId(user.publicId);
    try {
      await setAdminUserName(user.publicId, displayName);
      updateRow(user.publicId, { displayName });
      toast.success("Display name updated");
    } catch (cause) { toast.error(toApiError(cause).message); }
    finally { setBusyId(null); }
  }

  const visible = results ?? users;
  return <div className="min-h-full bg-gray-50 p-4 text-gray-900 dark:bg-night-canvas dark:text-night-text sm:p-7"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-black">User management</h1><p className="mt-1 text-sm text-gray-500 dark:text-night-muted">Real database accounts · search by name or Public ID · dates in UTC</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm dark:bg-night-surface">{total === null ? "—" : number.format(total)} users</span><button onClick={() => void loadFirst()} disabled={loading} className="rounded-full border border-gray-300 bg-white p-2 disabled:opacity-50 dark:border-night-border dark:bg-night-surface" aria-label="Refresh"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button></div></header>
    <div className="relative"><Search className="absolute left-4 top-3 text-gray-400" size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or Public ID" className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-4 outline-none focus:border-red-500 dark:border-night-border dark:bg-night-surface" /></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-night-border dark:bg-night-surface"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b bg-gray-50 text-xs text-gray-500 dark:border-night-border dark:bg-night-control dark:text-night-muted"><tr><th className="p-4">User</th><th className="p-4">Status</th><th className="p-4">Role</th><th className="p-4">Registered</th><th className="p-4">Last recorded activity</th><th className="p-4">Actions</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-night-border">{visible.map((user) => <tr key={user.publicId}><td className="p-4"><div className="font-bold">{user.displayName || "No display name"}</div><code dir="ltr" className="block max-w-[220px] truncate text-xs text-gray-500" title={user.publicId}>{user.publicId}</code></td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${user.status === "suspended" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{user.status === "suspended" ? "Suspended" : "Active"}</span></td><td className="p-4">{user.role === "admin" ? "Admin" : "users"}</td><td className="p-4">{user.createdAtMs ? date.format(user.createdAtMs) : "—"}</td><td className="p-4">{user.lastActiveAtMs ? dateTime.format(user.lastActiveAtMs) : "No recorded activity"}</td><td className="p-4"><div className="flex gap-2"><button disabled={busyId === user.publicId} onClick={() => void changeName(user)} className="rounded-lg border border-gray-200 p-2 disabled:opacity-50 dark:border-night-border" title="Edit display name"><Pencil size={17} /></button><button disabled={busyId === user.publicId || user.role === "admin"} onClick={() => void changeStatus(user)} className="rounded-lg border border-gray-200 p-2 disabled:opacity-50 dark:border-night-border" title={user.status === "suspended" ? "Reactivate" : "Suspend account"}>{user.status === "suspended" ? <UserCheck size={17} /> : <UserX size={17} />}</button></div></td></tr>)}</tbody></table>{(loading || searching) && <p className="p-5 text-sm text-gray-500">Loading…</p>}{!loading && !searching && !visible.length && <p className="p-5 text-sm text-gray-500">No matching accounts.</p>}</div>
    {(query.trim() ? searchCursor : cursor) && <div className="text-center"><button onClick={() => void loadMore()} disabled={moreLoading || searching} className="rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{moreLoading ? "Loading…" : "Load more"}</button></div>}
  </div></div>;
}
