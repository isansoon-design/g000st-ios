"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";

interface Message {
  id: string;
  sender: "user" | "other";
  content: string;
  timestamp: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", sender: "other", content: "Hey! How are you?",              timestamp: "10:30" },
    { id: "2", sender: "user",  content: "I'm doing great! How about you?", timestamp: "10:31" },
    { id: "3", sender: "other", content: "Excellent! Want to catch up later?", timestamp: "10:32" },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || isSending) return;
    setIsSending(true);
    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    setMessages((prev) => [...prev, { id: String(Date.now()), sender: "user", content: inputValue, timestamp: now }]);
    setInputValue("");
    setTimeout(() => {
      setMessages((prev) => [...prev, { id: String(Date.now()+1), sender: "other", content: "Got it 👍", timestamp: now }]);
      setIsSending(false);
    }, 900);
  };

  const hdrStyle: React.CSSProperties = {
    flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px",
    background: "linear-gradient(180deg,#fafafa 0%,#d8d8d8 45%,#b0b0b0 100%)",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,.9),0 6px 16px rgba(0,0,0,.12)",
    borderBottom: "1px solid rgba(0,0,0,.12)",
  };

  const icoBtn: React.CSSProperties = {
    width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(0,0,0,.08)",
    background: "rgba(255,255,255,.92)", display: "inline-flex",
    alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 17,
    boxShadow: "0 1px 3px rgba(0,0,0,.06)", flexShrink: 0,
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={hdrStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.02em" }}>
            g<span style={{ color: "#C62828" }}>000</span>st
          </span>
          <span style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
            {[4,6,8,10].map((h,i) => (
              <span key={i} style={{ width: 3, height: h, background: "#34C759", borderRadius: 2, display: "block" }} />
            ))}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={icoBtn} onClick={() => toast("Calling…")} title="Call">📞</button>
          <button style={icoBtn} onClick={() => toast("Video call…")} title="Video">🎥</button>
        </div>
      </div>

      {/* Social button */}
      <button onClick={() => window.location.href = "/social"} style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        margin: "8px 12px 0", height: 52, borderRadius: 26, border: 0, cursor: "pointer",
        background: "linear-gradient(180deg,#E8E8E8,#D0D0D0)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,.8),0 4px 12px rgba(0,0,0,.1)",
        fontWeight: 800, fontSize: 13, color: "#111",
        letterSpacing: "0.02em",
      }}>
        <span style={{ fontWeight: 900, fontSize: 13 }}>g<span style={{ color: "#C62828" }}>000</span>st</span>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "#C62828", color: "#fff", fontSize: 10, fontWeight: 900,
          padding: "5px 9px", borderRadius: 8, letterSpacing: "0.06em",
        }}>SOCIAL</span>
      </button>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 12px 8px",
        background: "radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.35) 0%,transparent 50%),linear-gradient(165deg,#E8E8E8 0%,#D8D8D8 40%,#B0B0B0 75%,#c5c5c5 100%)",
        WebkitOverflowScrolling: "touch" as any,
      }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: "flex", justifyContent: msg.sender === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{
              maxWidth: "70%", padding: "10px 12px", borderRadius: 14, fontSize: 14, fontWeight: 600, lineHeight: 1.45,
              borderBottomRightRadius: msg.sender === "user" ? 4 : 14,
              borderBottomLeftRadius: msg.sender === "user" ? 14 : 4,
              background: msg.sender === "user"
                ? "linear-gradient(150deg,#fff 0%,#ddd 50%,#b0b0b0 100%)"
                : "linear-gradient(150deg,#A8A8A8 0%,#9A9A9A 100%)",
              border: msg.sender === "user" ? "1.5px solid #9A9A9A" : "none",
              boxShadow: msg.sender === "user"
                ? "inset 0 2px 0 rgba(242,242,242,.9),0 8px 16px rgba(0,0,0,.18)"
                : "inset 0 2px 0 rgba(255,255,255,.35),0 10px 20px rgba(150,150,150,.35)",
              color: "#111",
            }}>
              <p style={{ margin: 0 }}>{msg.content}</p>
              <p style={{ margin: "4px 0 0", fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,.4)", textAlign: "right" }}>{msg.timestamp}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        flexShrink: 0,
        background: "linear-gradient(180deg,#fafafa 0%,#d8d8d8 100%)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,.9),0 -4px 12px rgba(0,0,0,.08)",
        borderTop: "1px solid rgba(0,0,0,.1)",
        padding: "6px 10px 4px", display: "flex", gap: 8, alignItems: "center",
      }}>
        <div style={{
          flex: 1,
          background: "linear-gradient(180deg,#fff,#f0f0f0)",
          boxShadow: "inset 0 3px 8px rgba(0,0,0,.08),inset 0 1px 0 #fff,0 4px 12px rgba(0,0,0,.1)",
          borderRadius: 20, padding: "0 12px", display: "flex", alignItems: "center",
        }}>
          <textarea
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message"
            style={{
              flex: 1, border: "none", background: "transparent", fontSize: 14,
              fontWeight: 600, outline: "none", color: "#111", resize: "none" as const,
              padding: "10px 0", lineHeight: 1.4, maxHeight: 80,
            }}
          />
        </div>
        <button onClick={handleSend} disabled={!inputValue.trim() || isSending} style={{
          width: 40, height: 40, borderRadius: "50%", border: 0, flexShrink: 0,
          background: "linear-gradient(180deg,#B8B8B8,#9A9A9A)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,.35),0 8px 18px rgba(150,150,150,.4)",
          color: "#fff", fontWeight: 900, fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: !inputValue.trim() || isSending ? 0.5 : 1,
        }}>➤</button>
      </div>

      {/* Privacy note */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "2px 12px 0",
        background: "linear-gradient(180deg,#d8d8d8,#b0b0b0)",
        borderTop: "1px solid rgba(0,0,0,.1)",
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, padding: "4px 0" }}>
          Kept 2 hours · extra 5s burn if on · Screenshots possible
        </span>
      </div>
    </div>
  );
}
