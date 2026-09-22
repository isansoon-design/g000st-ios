"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";

import { adjustAdminBalance, getAdminBalance, getAdminLedger } from "@/app/api/admin-billing";
import { toApiError } from "@/app/api/api-error";
import { useConfirmModal } from "@/context/ConfirmModalContext";
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
      toast.success("Balance adjusted.");
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setAdjusting(false);
    }
  }, [adjustMinutes, adjustReason, adjustSms, confirm, load, lookedUpPublicId]);

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-auto">
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <h2 className="text-lg font-semibold">Billing</h2>
        <p className="text-sm text-gray-600">Look up a user&apos;s call/SMS credit balance and ledger by Public ID.</p>
      </div>

      <div className="p-6 max-w-3xl w-full space-y-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={`Public ID (${PUBLIC_ID_LENGTH} characters)`}
            value={publicIdInput}
            onChange={(event) => setPublicIdInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleLookup()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="text-xs text-gray-500 font-mono mb-3">{lookedUpPublicId}</div>
              <div className="flex gap-8">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatSeconds(balance.voiceSecondsRemaining)}
                  </div>
                  <div className="text-xs text-gray-500">Voice remaining</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{balance.smsRemaining}</div>
                  <div className="text-xs text-gray-500">SMS remaining</div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-3">Adjust balance</h3>
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Voice minutes (+/-)</label>
                  <input
                    type="number"
                    value={adjustMinutes}
                    onChange={(event) => setAdjustMinutes(event.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">SMS (+/-)</label>
                  <input
                    type="number"
                    value={adjustSms}
                    onChange={(event) => setAdjustSms(event.target.value)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-600 mb-1">Reason</label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(event) => setAdjustReason(event.target.value)}
                    placeholder="e.g. goodwill credit, chargeback correction"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <h3 className="text-sm font-semibold px-5 py-3 border-b border-gray-200">Ledger</h3>
              {ledger.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-500">No ledger entries yet.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-700">
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
                        <td className="px-5 py-2 font-mono text-xs text-gray-500">{entry.reference}</td>
                        <td className="px-5 py-2 text-gray-600">
                          {entry.reason ?? "—"}
                          {entry.actorPublicId ? ` (${entry.actorPublicId.slice(0, 8)}…)` : ""}
                        </td>
                        <td className="px-5 py-2 text-gray-500">
                          {new Date(entry.createdAtMs).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {ledgerCursor && (
                <div className="px-5 py-3 border-t border-gray-200">
                  <button
                    onClick={() => void loadMoreLedger()}
                    disabled={ledgerLoadingMore}
                    className="text-sm text-blue-600 font-medium disabled:opacity-50"
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
