"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

interface Msg {
  id: string;
  mine: boolean;
  text: string;
  time: string;
}

export default function SocialChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const peerId = params.get("peer") || "unknown";
  const [messages, setMessages] = useState<Msg[]>([
    { id: "1", mine: false, text: "Hey! Saw your post.", time: "10:30" },
    { id: "2", mine: true, text: "Thanks for reaching out!", time: "10:31" },
  ]);
  const [input, setInput] = useState("");
  const [showMore, setShowMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    const now = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), mine: true, text: input, time: now },
    ]);
    setInput("");
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), mine: false, text: "Got it 👍", time: now },
      ]);
    }, 800);
  };

  const hdrStyle: React.CSSProperties = {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    gap: 10,
    background: "linear-gradient(180deg,#fafafa 0%,#d8d8d8 45%,#b0b0b0 100%)",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,.9),0 4px 12px rgba(0,0,0,.1)",
    borderBottom: "1px solid rgba(0,0,0,.12)",
  };

  const icoBtn: React.CSSProperties = {
    width: 38,
    height: 38,
    borderRadius: 11,
    border: "1px solid rgba(0,0,0,.08)",
    background: "rgba(255,255,255,.92)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,.06)",
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#E5E5E7",
        overflow: "hidden",
      }}
    >
      <div style={hdrStyle}>
        <button
          onClick={() => router.back()}
          style={{ ...icoBtn, fontWeight: 900, fontSize: 18 }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#111" }}>
            Social Chat
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#666",
              fontFamily: "ui-monospace,monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {peerId}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => toast("Voice call…")}
            style={icoBtn}
            title="Call"
          >
            📞
            <em
              style={{
                fontSize: 8,
                fontWeight: 700,
                fontStyle: "normal",
                color: "#555",
              }}
            >
              Call
            </em>
          </button>
          <button
            onClick={() => toast("Video call…")}
            style={icoBtn}
            title="Video"
          >
            🎥
            <em
              style={{
                fontSize: 8,
                fontWeight: 700,
                fontStyle: "normal",
                color: "#555",
              }}
            >
              Video
            </em>
          </button>
          <button
            onClick={() => setShowMore(!showMore)}
            style={icoBtn}
            title="More"
          >
            ⋯
            <em
              style={{
                fontSize: 8,
                fontWeight: 700,
                fontStyle: "normal",
                color: "#555",
              }}
            >
              More
            </em>
          </button>
        </div>
      </div>

      {showMore && (
        <div
          style={{
            background: "#fff",
            borderBottom: "1px solid #ddd",
            padding: "8px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => {
              toast("ID hidden");
              setShowMore(false);
            }}
            style={{
              border: "none",
              background: "none",
              textAlign: "left",
              padding: "8px 0",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Hide my Social ID
          </button>
          <button
            onClick={() => {
              toast("User blocked");
              setShowMore(false);
            }}
            style={{
              border: "none",
              background: "none",
              textAlign: "left",
              padding: "8px 0",
              fontSize: 14,
              fontWeight: 800,
              color: "#C62828",
              cursor: "pointer",
            }}
          >
            Block
          </button>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 12px 8px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.mine ? "flex-end" : "flex-start",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                maxWidth: "70%",
                padding: "10px 12px",
                borderRadius: 14,
                borderBottomRightRadius: msg.mine ? 4 : 14,
                borderBottomLeftRadius: msg.mine ? 14 : 4,
                background: msg.mine
                  ? "linear-gradient(150deg,#fff 0%,#ddd 50%,#b0b0b0 100%)"
                  : "linear-gradient(150deg,#A8A8A8 0%,#9A9A9A 100%)",
                border: msg.mine ? "1.5px solid #9A9A9A" : "none",
                boxShadow: msg.mine
                  ? "inset 0 2px 0 rgba(242,242,242,.9),0 8px 16px rgba(0,0,0,.18)"
                  : "inset 0 2px 0 rgba(255,255,255,.35),0 10px 20px rgba(150,150,150,.35)",
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#111",
                  margin: 0,
                  lineHeight: 1.45,
                }}
              >
                {msg.text}
              </p>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(0,0,0,.4)",
                  margin: "4px 0 0",
                  textAlign: "right",
                }}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          flexShrink: 0,
          display: "flex",
          gap: 8,
          padding: "8px 12px 10px",
          background: "linear-gradient(180deg,#fafafa 0%,#d8d8d8 100%)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,.9),0 -4px 12px rgba(0,0,0,.08)",
          borderTop: "1px solid rgba(0,0,0,.1)",
        }}
      >
        <div
          style={{
            flex: 1,
            background: "linear-gradient(180deg,#fff,#f0f0f0)",
            boxShadow:
              "inset 0 3px 8px rgba(0,0,0,.08),inset 0 1px 0 #fff,0 4px 12px rgba(0,0,0,.1)",
            borderRadius: 20,
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Type a message"
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 14,
              fontWeight: 600,
              outline: "none",
              color: "#111",
            }}
          />
        </div>
        <button
          onClick={send}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: 0,
            background: "linear-gradient(180deg,#B8B8B8,#9A9A9A)",
            color: "#fff",
            fontWeight: 900,
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
