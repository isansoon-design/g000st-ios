"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { adjustAdminBalance, getAdminBalance, getAdminLedger } from "@/app/api/admin-billing";
import { getAdminBillingRecent, type AdminBillingRecentV1 } from "@/app/api/admin-desk";
import { toApiError } from "@/app/api/api-error";
import { useConfirmModal } from "@/context/ConfirmModalContext";
import { AdminHeaderPortal } from "@/components/navigation/header-portal";
import type { Balance, LedgerEvent } from "@/features/mobile/types";

const PUBLIC_ID_LENGTH = 50;

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(Math.abs(seconds) / 60);
  const sign = seconds < 0 ? "-" : "";
  return `${sign}${minutes} min`;
}

function formatLedgerDelta(entry: LedgerEvent): string {
  const parts: string[] = [];
  if (entry.voiceSecondsDelta !== 0) {
    parts.push(`${entry.voiceSecondsDelta > 0 ? "+" : ""}${formatSeconds(entry.voiceSecondsDelta)}`);
  }
  if (entry.smsDelta !== 0) {
    parts.push(`${entry.smsDelta > 0 ? "+" : ""}${entry.smsDelta} SMS`);
  }
  return parts.join(", ") || "—";
}

export default function AdminBillingPage() {
  const { confirm } = useConfirmModal();
  const [publicIdInput, setPublicIdInput] = useState("");
  const [lookedUpPublicId, setLookedUpPublicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [ledger, setLedger] = useState<LedgerEvent[]>([]);
  const [ledgerCursor, setLedgerCursor] = useState<string | undefined>(undefined);
  const [ledgerLoadingMore, setLedgerLoadingMore] = useState(false);

  const [adjustMinutes, setAdjustMinutes] = useState("");
  const [adjustSms, setAdjustSms] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [overview, setOverview] = useState<AdminBillingRecentV1 | null>(null);
  const [overviewError, setOverviewError] = useState("");

  const refreshOverview = useCallback(async () => {
    try { setOverview(await getAdminBillingRecent()); setOverviewError(""); }
    catch (error) { setOverviewError(toApiError(error).message); }
  }, []);
  useEffect(() => { void refreshOverview(); }, [refreshOverview]);

  const load = useCallback(async (publicId: string) => {
    setLoading(true);
    try {
      const [nextBalance, ledgerPage] = await Promise.all([
        getAdminBalance(publicId),
        getAdminLedger(publicId),
      ]);
      setBalance(nextBalance);
      setLedger(ledgerPage.items);
      setLedgerCursor(ledgerPage.nextCursor);
      setLookedUpPublicId(publicId);
    } catch (error) {
      toast.error(toApiError(error).message);
      setBalance(null);
      setLedger([]);
      setLookedUpPublicId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLookup = useCallback(() => {
    const publicId = publicIdInput.trim();
    if (publicId.length !== PUBLIC_ID_LENGTH || !/^[A-Za-z0-9]+$/.test(publicId)) {
      toast.error(`Public ID must be exactly ${PUBLIC_ID_LENGTH} letters or numbers.`);
      return;
    }
    void load(publicId);
  }, [load, publicIdInput]);

  const loadMoreLedger = useCallback(async () => {
    if (!lookedUpPublicId || !ledgerCursor) return;
    setLedgerLoadingMore(true);
    try {
      const page = await getAdminLedger(lookedUpPublicId, ledgerCursor);
      setLedger((current) => [...current, ...page.items]);
      setLedgerCursor(page.nextCursor);
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setLedgerLoadingMore(false);
    }
  }, [ledgerCursor, lookedUpPublicId]);

  const handleAdjust = useCallback(async () => {
    if (!lookedUpPublicId) return;

    const minutes = Number(adjustMinutes || 0);
    const sms = Number(adjustSms || 0);
    if (!Number.isInteger(minutes) || !Number.isInteger(sms)) {
      toast.error("Minutes and SMS must be whole numbers.");
      return;
    }
    if (minutes === 0 && sms === 0) {
      toast.error("Enter a non-zero adjustment.");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("A reason is required.");
      return;
    }

    const confirmed = await confirm({
      title: "Apply balance adjustment?",
      message: `${minutes !== 0 ? `${minutes > 0 ? "+" : ""}${minutes} min` : ""}${
        minutes !== 0 && sms !== 0 ? ", " : ""
      }${sms !== 0 ? `${sms > 0 ? "+" : ""}${sms} SMS` : ""} for ${lookedUpPublicId}. This is logged in the ledger and cannot be undone automatically.`,
      confirmLabel: "Apply",
    });
    if (!confirmed) return;

    setAdjusting(true);
    try {
      const nextBalance = await adjustAdminBalance(lookedUpPublicId, minutes * 60, sms, adjustReason.trim());
      setBalance(nextBalance);
      setAdjustMinutes("");
      setAdjustSms("");
      setAdjustReason("");
      await load(lookedUpPublicId);
      await refreshOverview();
      toast.success("Balance adjusted.");
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setAdjusting(false);
    }
  }, [adjustMinutes, adjustReason, adjustSms, confirm, load, lookedUpPublicId, refreshOverview]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-night-canvas overflow-auto">
      <AdminHeaderPortal><h2 className="truncate text-sm font-semibold sm:text-lg">Call &amp; SMS credits</h2></AdminHeaderPortal>

      <div className="p-6 max-w-3xl w-full space-y-6">
        <p className="text-sm text-gray-600 dark:text-night-muted">Real prepaid balances and ledger for external calls and SMS. In-app calls remain free.</p>
        <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-night-border dark:bg-night-surface">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Recent balances</h3><p className="text-xs text-gray-500 dark:text-night-muted">Accounts with recorded credit activity: {overview?.accountCount ?? "—"}</p></div><button onClick={() => void refreshOverview()} className="rounded-lg border px-3 py-2 text-xs font-bold dark:border-night-border">Refresh</button></div>
          {overviewError && <p role="alert" className="mt-3 text-sm text-red-600">{overviewError}</p>}
          {overview?.balances.length ? <div className="mt-4 space-y-2">{overview.balances.map((item) => <button key={item.publicId} onClick={() => { setPublicIdInput(item.publicId); void load(item.publicId); }} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50 dark:border-night-border dark:hover:bg-white/10"><code className="max-w-[210px] truncate text-xs" title={item.publicId}>{item.publicId}</code><span className="text-xs">{formatSeconds(item.voiceSecondsRemaining)} · {item.smsRemaining} SMS</span><span className="text-xs text-gray-500">{new Date(item.updatedAtMs).toLocaleString()}</span></button>)}</div> : overview && <p className="mt-4 text-sm text-gray-500">No credit activity recorded yet. You can still look up an account below.</p>}
        </section>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder={`Public ID (${PUBLIC_ID_LENGTH} characters)`}
            value={publicIdInput}
            onChange={(event) => setPublicIdInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleLookup()}
            className="min-w-0 flex-1 px-4 py-2 border border-gray-300 dark:border-night-border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleLookup}
            disabled={loading}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "Loading…" : "Look up"}
          </button>
        </div>

        {lookedUpPublicId && balance && (
          <>
            <div className="bg-white dark:bg-night-surface border border-gray-200 dark:border-night-border rounded-lg p-5">
              <div className="mb-3 break-all font-mono text-xs text-gray-500 dark:text-night-muted">{lookedUpPublicId}</div>
              <div className="flex flex-wrap gap-4 sm:gap-8">
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-night-text">
                    {formatSeconds(balance.voiceSecondsRemaining)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-night-muted">Voice remaining</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-night-text">{balance.smsRemaining}</div>
                  <div className="text-xs text-gray-500 dark:text-night-muted">SMS remaining</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-night-surface border border-gray-200 dark:border-night-border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-3">Adjust balance</h3>
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-night-muted mb-1">Voice minutes (+/-)</label>
                  <input
                    type="number"
                    value={adjustMinutes}
                    onChange={(event) => setAdjustMinutes(event.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 dark:border-night-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-night-muted mb-1">SMS (+/-)</label>
                  <input
                    type="number"
                    value={adjustSms}
                    onChange={(event) => setAdjustSms(event.target.value)}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-night-border rounded-lg text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-600 dark:text-night-muted mb-1">Reason</label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(event) => setAdjustReason(event.target.value)}
                    placeholder="e.g. goodwill credit, chargeback correction"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-night-border rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => void handleAdjust()}
                    disabled={adjusting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {adjusting ? "Applying…" : "Apply"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-night-surface border border-gray-200 dark:border-night-border rounded-lg overflow-hidden">
              <h3 className="text-sm font-semibold px-5 py-3 border-b border-gray-200 dark:border-night-border">Ledger</h3>
              {ledger.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-500 dark:text-night-muted">No ledger entries yet.</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="min-w-[700px] w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-night-border bg-gray-50 dark:bg-night-canvas text-left text-xs font-semibold text-gray-700 dark:text-night-muted">
                      <th className="px-5 py-2">Kind</th>
                      <th className="px-5 py-2">Delta</th>
                      <th className="px-5 py-2">Reference</th>
                      <th className="px-5 py-2">Reason / Actor</th>
                      <th className="px-5 py-2">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ledger.map((entry) => (
                      <tr key={entry.id} className="text-sm">
                        <td className="px-5 py-2">{entry.kind}</td>
                        <td className="px-5 py-2">{formatLedgerDelta(entry)}</td>
                        <td className="px-5 py-2 font-mono text-xs text-gray-500 dark:text-night-muted">{entry.reference}</td>
                        <td className="px-5 py-2 text-gray-600 dark:text-night-muted">
                          {entry.reason ?? "—"}
                          {entry.actorPublicId ? ` (${entry.actorPublicId.slice(0, 8)}…)` : ""}
                        </td>
                        <td className="px-5 py-2 text-gray-500 dark:text-night-muted">
                          {new Date(entry.createdAtMs).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
              {ledgerCursor && (
                <div className="px-5 py-3 border-t border-gray-200 dark:border-night-border">
                  <button
                    onClick={() => void loadMoreLedger()}
                    disabled={ledgerLoadingMore}
                    className="text-sm text-blue-600 dark:text-blue-300 font-medium disabled:opacity-50"
                  >
                    {ledgerLoadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
