"use client";

import { useState } from "react";
import toast from "react-hot-toast";

type Tab = "keypad" | "sms" | "plans";

const PLANS = [
  { key: "sms5",  icon: "💬", name: "5 SMS",       sub: "UK / EU / USA",       price: "£5"  },
  { key: "min10", icon: "📞", name: "10 MINUTES",   sub: "Mobile voice",         price: "£10" },
  { key: "min30", icon: "⏱", name: "30 MINUTES",   sub: "UK / EU / USA",       price: "£25" },
];

export default function MobilePage() {
  const [tab, setTab] = useState<Tab>("keypad");
  const [dialDisplay, setDialDisplay] = useState("g000st");
  const [dialNumber, setDialNumber] = useState("");
  const [smsTo, setSmsTo] = useState("");
  const [smsText, setSmsText] = useState("");
  const [smsLog, setSmsLog] = useState<string[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

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

  const call = () => {
    if (!dialNumber) { toast.error("Enter a number first"); return; }
    toast.success(`Calling ${dialNumber}…`);
  };

  const sendSms = () => {
    if (!smsTo.trim()) { toast.error("Enter a number"); return; }
    if (!smsText.trim()) { toast.error("Write a message"); return; }
    setSmsLog((prev) => [`→ ${smsTo}: ${smsText}`, ...prev]);
    setSmsText("");
    toast.success("SMS sent!");
  };

  const pay = (method: string) => {
    if (!selectedPlan) { toast.error("Choose a plan first"); return; }
    const plan = PLANS.find((p) => p.key === selectedPlan);
    toast.success(`${method} payment for ${plan?.name} ${plan?.price}`);
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

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#D8D8D8", overflow: "hidden", color: "#111" }}>

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
            No credit
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
            <button onClick={call} style={{
              width: 70, height: 70, borderRadius: "50%", border: 0, background: "#34C759", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
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
          <button onClick={sendSms} style={{
            width: "100%", height: 52, borderRadius: 16, border: 0,
            background: "#333", color: "#fff", fontWeight: 900, fontSize: 18, marginBottom: 10, cursor: "pointer",
          }}>Send</button>
          <div style={{
            flex: 1, minHeight: 80, background: "#ececec", borderRadius: 16, padding: 14,
            overflow: "auto", fontSize: 14,
          }}>
            {smsLog.length === 0
              ? <span style={{ color: "#888" }}>SMS log will appear here</span>
              : smsLog.map((msg, i) => <div key={i} style={{ marginBottom: 6, fontWeight: 600 }}>{msg}</div>)
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

          {PLANS.map((plan) => (
            <button key={plan.key} onClick={() => setSelectedPlan(plan.key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
              background: selectedPlan === plan.key ? "#ffe8e8" : "#fff",
              border: selectedPlan === plan.key ? "2.5px solid #C62828" : "1.5px solid #e4e4e4",
              borderRadius: 18, padding: "18px 16px", minHeight: 76, color: "#111",
              marginBottom: 12, boxShadow: "0 1px 0 rgba(0,0,0,.04)", cursor: "pointer",
            }}>
              <div style={{ width: 36, fontSize: 22, color: "#C62828", textAlign: "center" }}>{plan.icon}</div>
              <div style={{ flex: 1 }}>
                <b style={{ display: "block", fontSize: 16, fontWeight: 800 }}>{plan.name}</b>
                <span style={{ display: "block", color: "#888", fontSize: 12, marginTop: 2 }}>{plan.sub}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{plan.price}</div>
            </button>
          ))}

          {selectedPlan && (
            <div style={{ textAlign: "center", margin: "8px auto 12px", display: "inline-block",
              background: "#f3c7c7", color: "#9b1c1c", borderRadius: 999,
              padding: "6px 12px", fontSize: 11, fontWeight: 700, width: "100%" }}>
              {PLANS.find((p) => p.key === selectedPlan)?.name} selected — choose payment below
            </div>
          )}

          <button onClick={() => pay("Apple Pay")} style={{
            height: 56, borderRadius: 28, border: 0, background: "#111", color: "#fff",
            width: "78%", maxWidth: 280, margin: "18px auto 10px", display: "flex",
            alignItems: "center", justifyContent: "center", gap: 10,
            fontWeight: 800, fontSize: 18, cursor: "pointer",
          }}>
            <span style={{ display: "inline-block", width: 22, height: 22, background: "#000", borderRadius: 4 }} />
            Apple Pay
          </button>

          <button onClick={() => pay("Google Pay")} style={{
            height: 56, borderRadius: 28, border: "1px solid #ccc", background: "#fff", color: "#111",
            width: "78%", maxWidth: 280, margin: "0 auto 12px", display: "flex",
            alignItems: "center", justifyContent: "center", gap: 10,
            fontWeight: 800, fontSize: 18, cursor: "pointer",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.3 3-7.1z"/>
              <path fill="#34A853" d="M12 22c2.7 0 5-1 6.6-2.7l-3.2-2.4c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.5C4.7 19.7 8.1 22 12 22z"/>
              <path fill="#FBBC05" d="M6.4 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.7H3.1C2.4 9.1 2 10.5 2 12s.4 2.9 1.1 4.3l3.3-2.5z"/>
              <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3 14.7 2 12 2 8.1 2 4.7 4.3 3.1 7.7l3.3 2.5C7.2 7.7 9.4 5.9 12 5.9z"/>
            </svg>
            Google Pay
          </button>

          {!selectedPlan && (
            <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9b1c1c",
              background: "#f3c7c7", borderRadius: 999, padding: "6px 12px", margin: "0 auto", display: "inline-block", width: "100%" }}>
              Choose a plan then Pay
            </div>
          )}
        </div>
      )}
    </div>
  );
}
