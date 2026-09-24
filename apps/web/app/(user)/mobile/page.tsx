"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { ApiError } from "@/app/api/api-error";
import {
  createCheckoutSession,
  getBalance,
  listBillingSkus,
  listSms,
  sendSms as sendSmsRequest,
} from "@/app/api/mobile";
import type { Balance, BillingSku, OutboundSms } from "@/features/mobile/types";
import { useExternalCall } from "@/features/mobile/use-external-call";

type Tab = "keypad" | "sms" | "plans";

const SKU_ICON: Record<string, string> = { sms: "💬", voice_minutes: "📞" };

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(priceCents / 100);
}

/** Accepts "+", the "00" international trunk prefix (common outside the US), or bare digits. */
function normalizeE164(input: string): string {
  const sanitized = input.replace(/[\s\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
  if (sanitized.startsWith("+")) return sanitized;
  if (sanitized.startsWith("00")) return `+${sanitized.slice(2)}`;
  return `+${sanitized}`;
}

export default function MobilePage() {
  const [tab, setTab] = useState<Tab>("keypad");
  const [dialDisplay, setDialDisplay] = useState("g000st");
  const [dialNumber, setDialNumber] = useState("");
  const [smsTo, setSmsTo] = useState("");
  const [smsText, setSmsText] = useState("");
  const [smsHistory, setSmsHistory] = useState<OutboundSms[]>([]);
  const [smsHistoryLoading, setSmsHistoryLoading] = useState(false);
  const [smsHistoryError, setSmsHistoryError] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [skus, setSkus] = useState<BillingSku[]>([]);
  const [skusLoading, setSkusLoading] = useState(false);
  const [skusError, setSkusError] = useState(false);
  const [checkoutStarting, setCheckoutStarting] = useState(false);
  const externalCall = useExternalCall();
  const [callDurationSec, setCallDurationSec] = useState(0);

  useEffect(() => {
    if (externalCall.status !== "active") {
      setCallDurationSec(0);
      return;
    }
    const interval = setInterval(() => setCallDurationSec((prev) => prev + 1), 1_000);
    return () => clearInterval(interval);
  }, [externalCall.status]);

  const loadBalance = async () => {
    try {
      setBalance(await getBalance());
    } catch {
      // Non-critical: keypad/plans just fall back to a loading state.
    }
  };

  const loadSkus = async () => {
    setSkusLoading(true);
    setSkusError(false);
    try {
      setSkus(await listBillingSkus());
    } catch {
      setSkusError(true);
    } finally {
      setSkusLoading(false);
    }
  };

  useEffect(() => {
    // Reads the query param synchronously via window.location instead of Next's
    // useSearchParams so this stays a plain client-rendered effect with no Suspense
    // boundary requirement — this page has no server-rendered data to hydrate anyway.
    const checkoutResult = new URLSearchParams(window.location.search).get("checkout");
    if (checkoutResult) window.history.replaceState(null, "", window.location.pathname);

    if (checkoutResult === "success") {
      // The redirect back from Stripe only means the *browser* returned — the balance only
      // becomes real once the signature-verified webhook lands, which can be a moment behind.
      // Poll briefly instead of trusting the redirect (see docs/API_CONTRACT_V1.md).
      setTab("keypad");
      toast("Payment received — confirming your balance…");
      void pollBalanceAfterCheckout();
    } else if (checkoutResult === "cancel") {
      toast("Checkout cancelled.");
      void loadBalance();
    } else {
      void loadBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pollBalanceAfterCheckout = async () => {
    // Fetch immediately rather than waiting first: the webhook that credits the balance often
    // finishes before the browser even completes the redirect back from Stripe, so by the time
    // this runs the balance may already be current. Any successful fetch is trusted as-is —
    // there's no reliable "before" snapshot to diff against (the balance is fetched fresh on
    // every page load, not carried over from before checkout), so we don't wait for a change,
    // just for the first fetch that succeeds. Retries only guard against a slow/failed request.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const next = await getBalance().catch(() => null);
      if (next) {
        setBalance(next);
        toast.success("Balance updated!");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }

    toast("Still confirming — check back in a moment if the balance hasn't updated.");
  };

  useEffect(() => {
    if (tab === "plans" && skus.length === 0 && !skusLoading) void loadSkus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleBuy = async () => {
    if (!selectedPlan) { toast.error("Choose a plan first"); return; }
    setCheckoutStarting(true);
    try {
      const { checkoutUrl } = await createCheckoutSession(selectedPlan);
      window.location.href = checkoutUrl;
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      toast.error(apiError?.message ?? "Could not start checkout. Try again.");
      setCheckoutStarting(false);
    }
  };

  const loadSmsHistory = async () => {
    setSmsHistoryLoading(true);
    setSmsHistoryError(false);
    try {
      const { items } = await listSms();
      setSmsHistory(items);
    } catch {
      setSmsHistoryError(true);
    } finally {
      setSmsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "sms") void loadSmsHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const digit = (d: string) => {
    const newNum = dialNumber + d;
    setDialNumber(newNum);
    setDialDisplay(newNum);
  };

  const backspace = () => {
    const newNum = dialNumber.slice(0, -1);
    setDialNumber(newNum);
    setDialDisplay(newNum || "g000st");
  };

  const handleCall = async () => {
    if (!dialNumber) { toast.error("Enter a number first"); return; }
    const toE164 = normalizeE164(dialNumber);
    if (!/^\+[1-9]\d{1,14}$/.test(toE164)) {
      toast.error("Enter the full number with country code, e.g. 15551234567");
      return;
    }
    await externalCall.placeCall(toE164);
  };

  useEffect(() => {
    if (externalCall.status !== "error" || !externalCall.errorMessage) return;
    if (externalCall.errorCode === "INSUFFICIENT_BALANCE") {
      toast.error("Not enough call credit — buy a bundle first");
    } else {
      toast.error(externalCall.errorMessage);
    }
    externalCall.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCall.status]);

  const handleSendSms = async () => {
    if (!smsTo.trim()) { toast.error("Enter a number"); return; }
    const toE164 = normalizeE164(smsTo);
    const body = smsText.trim();
    if (!/^\+[1-9]\d{1,14}$/.test(toE164)) { toast.error("Use full international format, e.g. +15551234567"); return; }
    if (!body) { toast.error("Write a message"); return; }

    setSmsSending(true);
    try {
      const message = await sendSmsRequest(toE164, body);
      setSmsHistory((prev) => [message, ...prev]);
      setSmsText("");
      await loadBalance();
      toast.success("SMS sent!");
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      if (apiError?.code === "INSUFFICIENT_BALANCE") {
        toast.error("Not enough SMS credit — buy a bundle first");
      } else {
        toast.error(apiError?.message ?? "Could not send the SMS. Try again.");
      }
    } finally {
      setSmsSending(false);
    }
  };

  const btnStyle: React.CSSProperties = {
    width: 74, height: 74, borderRadius: "50%",
    border: "1px solid #b0b0b0",
    background: "linear-gradient(180deg,#f7f7f7,#d4d4d4)",
    color: "#111", display: "flex", flexDirection: "column" as const,
    alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer",
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    height: 36, padding: "0 16px", borderRadius: 12,
    border: active ? "1.5px solid #9A9A9A" : "1px solid #ccc",
    background: active ? "linear-gradient(180deg,#B8B8B8,#9A9A9A)" : "#e8e8e8",
    color: active ? "#fff" : "#333", fontWeight: 800, fontSize: 12, cursor: "pointer",
  });

  const callStatusLabel: Record<string, string> = {
    connecting: "Connecting…",
    ringing: "Ringing…",
    active: "In call",
    ended: "Call ended",
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#D8D8D8", overflow: "hidden", color: "#111", position: "relative" }}>

      {/* Top bar */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 16px",
        background: "linear-gradient(180deg,#fafafa 0%,#d8d8d8 45%,#b0b0b0 100%)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,.9),0 4px 12px rgba(0,0,0,.1)",
        borderBottom: "1px solid rgba(0,0,0,.12)",
      }}>
        <div style={{ width: 40 }} /> {/* spacer */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: "#C62828" }}>NO TRACE</div>
        <button onClick={() => setTab("plans")} style={{
          width: 40, height: 36, borderRadius: 18, border: "1px solid #999",
          background: "#eee", color: "#111", fontWeight: 900, fontSize: 16, cursor: "pointer",
        }}>£</button>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8, padding: "8px 16px 0", flexShrink: 0 }}>
        <button style={tabBtnStyle(tab === "keypad")} onClick={() => setTab("keypad")}>Keypad</button>
        <button style={tabBtnStyle(tab === "sms")}    onClick={() => setTab("sms")}>SMS</button>
        <button style={tabBtnStyle(tab === "plans")}  onClick={() => setTab("plans")}>Plans £</button>
      </div>

      {/* KEYPAD TAB */}
      {tab === "keypad" && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ textAlign: "center", fontSize: 30, fontWeight: 800, letterSpacing: "0.04em", color: "#111", minHeight: 44, padding: "10px 16px 4px" }}>
            {dialDisplay}
          </div>
          <div style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: "#666", marginBottom: 6 }}>
            PRIVATE NUMBER · NO RECORDING
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#333", textAlign: "center", marginBottom: 6 }}>
            {balance ? `${Math.floor(balance.voiceSecondsRemaining / 60)} min · ${balance.smsRemaining} SMS` : "No credit"}
          </div>

          {/* Dial Pad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 74px)", gap: "14px 26px", justifyContent: "center", margin: "4px auto 0" }}>
            {[
              ["1",""],["2","ABC"],["3","DEF"],
              ["4","GHI"],["5","JKL"],["6","MNO"],
              ["7","PQRS"],["8","TUV"],["9","WXYZ"],
              ["*",""],["0","+"],["#",""],
            ].map(([d, sub]) => (
              <button key={d} onClick={() => digit(d)} style={btnStyle}>
                <b style={{ fontSize: 30, fontWeight: 500, lineHeight: 1 }}>{d}</b>
                {sub && <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: "#666", textDecoration: "none", marginTop: 2 }}>{sub}</span>}
              </button>
            ))}
          </div>

          {/* Call Row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, margin: "16px 0 8px" }}>
            <button onClick={() => { setTab("sms"); }} style={{
              minWidth: 72, height: 56, borderRadius: 16, border: "2px solid #111",
              background: "#fff", color: "#111", fontWeight: 900, fontSize: 16, letterSpacing: "0.04em", cursor: "pointer",
            }}>SMS</button>
            <button onClick={() => void handleCall()} disabled={externalCall.status !== "idle" && externalCall.status !== "error"} style={{
              width: 70, height: 70, borderRadius: "50%", border: 0, background: "#34C759", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: externalCall.status !== "idle" && externalCall.status !== "error" ? 0.5 : 1,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"/>
              </svg>
            </button>
            <button onClick={backspace} style={{
              width: 44, height: 32, border: 0, background: "transparent", color: "#444", fontSize: 22, cursor: "pointer",
            }}>⌫</button>
          </div>

          <div style={{ padding: "0 16px", marginTop: 8, width: "100%", boxSizing: "border-box" as const }}>
            <button style={{
              width: "100%", height: 46, borderRadius: 12, border: "1px solid #555",
              background: "#e8e8e8", color: "#222", fontWeight: 800, fontSize: 16, cursor: "pointer",
            }} onClick={() => toast("Contacts coming soon")}>Contacts</button>
          </div>
          <button onClick={() => setTab("plans")} style={{
            display: "block", width: "calc(100% - 32px)", margin: "4px 16px 16px", height: 46,
            borderRadius: 14, border: "2px solid #C62828", background: "#fff",
            color: "#C62828", fontWeight: 900, fontSize: 14, cursor: "pointer",
          }}>
            Buy number · £5 / £10 / £25
          </button>
        </div>
      )}

      {/* SMS TAB */}
      {tab === "sms" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 16px 16px", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 22 }}>SMS</div>
            <button style={{
              height: 36, padding: "0 12px", borderRadius: 12, border: "1px solid #333",
              background: "#fff", color: "#333", fontWeight: 800, fontSize: 12, cursor: "pointer",
            }} onClick={() => toast("Contacts coming soon")}>Names</button>
          </div>
          <input value={smsTo} onChange={(e) => setSmsTo(e.target.value)}
            placeholder="To: number or name"
            style={{
              height: 58, borderRadius: 12, border: "1px solid #888", background: "#fff",
              color: "#111", padding: "0 12px", fontSize: 18, fontWeight: 700, outline: "none",
              marginBottom: 8, boxSizing: "border-box" as const, width: "100%",
            }} />
          <textarea
            value={smsText} onChange={(e) => setSmsText(e.target.value)}
            placeholder="Write your message"
            rows={4}
            style={{
              width: "100%", height: 120, minHeight: 120, borderRadius: 12, border: "1px solid #888",
              background: "#fff", color: "#111", padding: 12, fontSize: 16, lineHeight: 1.35,
              resize: "none" as const, outline: "none", marginBottom: 8, boxSizing: "border-box" as const,
              fontWeight: 600,
            }} />
          <button onClick={handleSendSms} disabled={smsSending} style={{
            width: "100%", height: 52, borderRadius: 16, border: 0,
            background: "#333", color: "#fff", fontWeight: 900, fontSize: 18, marginBottom: 10,
            cursor: smsSending ? "default" : "pointer", opacity: smsSending ? 0.6 : 1,
          }}>{smsSending ? "Sending…" : "Send"}</button>
          <div style={{
            flex: 1, minHeight: 80, background: "#ececec", borderRadius: 16, padding: 14,
            overflow: "auto", fontSize: 14,
          }}>
            {smsHistoryLoading
              ? <span style={{ color: "#888" }}>Loading…</span>
              : smsHistoryError
              ? <span style={{ color: "#9b1c1c" }}>Could not load SMS history. <button onClick={() => void loadSmsHistory()} style={{ border: 0, background: "none", color: "#9b1c1c", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>Retry</button></span>
              : smsHistory.length === 0
              ? <span style={{ color: "#888" }}>SMS log will appear here</span>
              : smsHistory.map((message) => (
                <div key={message.id} style={{ marginBottom: 6, fontWeight: 600 }}>
                  → {message.toE164}: {message.body}
                  <span style={{ marginLeft: 6, fontWeight: 700, fontSize: 11, color: message.status === "delivery_failed" || message.status === "sending_failed" ? "#C62828" : "#666" }}>
                    [{message.status}]
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* PLANS TAB */}
      {tab === "plans" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 24px", background: "#f3f3f3" }}>
          <div style={{ textAlign: "center", fontWeight: 800, fontSize: 11, letterSpacing: "0.12em", color: "#C62828", margin: "6px 0 14px" }}>
            NO TRACE · PRIVATE · NO RECORDING
          </div>

          {skusLoading && (
            <div style={{ textAlign: "center", color: "#888", padding: "24px 0" }}>Loading…</div>
          )}

          {skusError && (
            <div style={{ textAlign: "center", color: "#9b1c1c", padding: "12px 0" }}>
              Could not load bundles.{" "}
              <button onClick={() => void loadSkus()} style={{ border: 0, background: "none", color: "#9b1c1c", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>Retry</button>
            </div>
          )}

          {!skusLoading && !skusError && skus.length === 0 && (
            <div style={{ textAlign: "center", color: "#888", padding: "24px 0" }}>No bundles available right now.</div>
          )}

          {skus.map((sku) => (
            <button key={sku.id} onClick={() => setSelectedPlan(sku.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
              background: selectedPlan === sku.id ? "#ffe8e8" : "#fff",
              border: selectedPlan === sku.id ? "2.5px solid #C62828" : "1.5px solid #e4e4e4",
              borderRadius: 18, padding: "18px 16px", minHeight: 76, color: "#111",
              marginBottom: 12, boxShadow: "0 1px 0 rgba(0,0,0,.04)", cursor: "pointer",
            }}>
              <div style={{ width: 36, fontSize: 22, color: "#C62828", textAlign: "center" }}>{SKU_ICON[sku.kind] ?? "•"}</div>
              <div style={{ flex: 1 }}>
                <b style={{ display: "block", fontSize: 16, fontWeight: 800 }}>{sku.label}</b>
                <span style={{ display: "block", color: "#888", fontSize: 12, marginTop: 2 }}>
                  {sku.kind === "voice_minutes" ? "Mobile voice" : "UK / EU / USA"}
                </span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{formatPrice(sku.priceCents, sku.currency)}</div>
            </button>
          ))}

          {selectedPlan && (
            <div style={{ textAlign: "center", margin: "8px auto 12px", display: "inline-block",
              background: "#f3c7c7", color: "#9b1c1c", borderRadius: 999,
              padding: "6px 12px", fontSize: 11, fontWeight: 700, width: "100%" }}>
              {skus.find((s) => s.id === selectedPlan)?.label} selected — tap Buy below
            </div>
          )}

          <button onClick={handleBuy} disabled={checkoutStarting || !selectedPlan} style={{
            height: 56, borderRadius: 28, border: 0, background: "#111", color: "#fff",
            width: "78%", maxWidth: 280, margin: "18px auto 12px", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 18,
            cursor: checkoutStarting || !selectedPlan ? "default" : "pointer",
            opacity: checkoutStarting || !selectedPlan ? 0.5 : 1,
          }}>
            {checkoutStarting ? "Redirecting…" : "Buy"}
          </button>

          {!selectedPlan && !skusLoading && skus.length > 0 && (
            <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9b1c1c",
              background: "#f3c7c7", borderRadius: 999, padding: "6px 12px", margin: "0 auto", display: "inline-block", width: "100%" }}>
              Choose a bundle then Buy
            </div>
          )}

          <div style={{ textAlign: "center", fontSize: 11, color: "#888", marginTop: 10 }}>
            Card, Apple Pay, or Google Pay on the next screen
          </div>
        </div>
      )}

      {/* IN-CALL OVERLAY */}
      {externalCall.status !== "idle" && externalCall.status !== "error" && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(17,17,17,0.94)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          color: "#fff", padding: 24, gap: 16, zIndex: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: "#8FE39A" }}>
            {callStatusLabel[externalCall.status]}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{dialDisplay}</div>
          {externalCall.status === "active" && (
            <div style={{ fontSize: 14, fontWeight: 600, color: "#bbb" }}>
              {String(Math.floor(callDurationSec / 60)).padStart(2, "0")}:{String(callDurationSec % 60).padStart(2, "0")}
            </div>
          )}

          {externalCall.status === "ended" ? (
            <button onClick={() => externalCall.reset()} style={{
              marginTop: 12, height: 48, padding: "0 32px", borderRadius: 24, border: "1px solid #666",
              background: "transparent", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
            }}>Close</button>
          ) : (
            <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
              {externalCall.status === "active" && (
                <button onClick={() => externalCall.toggleMute()} style={{
                  width: 60, height: 60, borderRadius: "50%", border: "1px solid #666",
                  background: externalCall.isMuted ? "#fff" : "transparent",
                  color: externalCall.isMuted ? "#111" : "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer",
                }}>{externalCall.isMuted ? "Unmute" : "Mute"}</button>
              )}
              <button onClick={() => externalCall.hangup()} style={{
                width: 60, height: 60, borderRadius: "50%", border: 0, background: "#E53935", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" style={{ transform: "rotate(135deg)" }}>
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
