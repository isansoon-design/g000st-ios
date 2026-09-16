"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Contact {
  id: string;
  name: string;
  g000stId: string;
  status: "online" | "offline" | "away";
  favorite?: boolean;
}

const mockContacts: Contact[] = [
  { id: "1", name: "John Doe",    g000stId: "xK9mN2pQ...", status: "online",  favorite: true  },
  { id: "2", name: "Jane Smith",  g000stId: "aB3cD4eF...", status: "online"                   },
  { id: "3", name: "Bob Wilson",  g000stId: "rT7uV8wX...", status: "away"                     },
  { id: "4", name: "Alice Brown", g000stId: "yZ1a2B3c...", status: "offline", favorite: true  },
];

type Filter = "all" | "online" | "favorites";

export default function ContactsPage() {
  const router = useRouter();
  const [contacts] = useState<Contact[]>(mockContacts);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = contacts.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                        c.g000stId.toLowerCase().includes(search.toLowerCase());
    if (filter === "online")    return matchSearch && c.status === "online";
    if (filter === "favorites") return matchSearch && c.favorite;
    return matchSearch;
  });

  const statusColor = (s: Contact["status"]) =>
    s === "online" ? "#34C759" : s === "away" ? "#FF9500" : "#8A8A8E";

  const hdrStyle: React.CSSProperties = {
    background: "linear-gradient(180deg,#fafafa 0%,#d8d8d8 45%,#b0b0b0 100%)",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,.9),0 6px 16px rgba(0,0,0,.12)",
    borderBottom: "1px solid rgba(0,0,0,.12)",
    padding: "10px 14px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 8, flexShrink: 0,
  };

  const btnSmStyle: React.CSSProperties = {
    height: 32, padding: "0 12px", borderRadius: 10,
    border: "1.5px solid #9A9A9A",
    background: "linear-gradient(180deg,#E8E8E8,#D0D0D0)",
    color: "#111", fontWeight: 800, fontSize: 12, cursor: "pointer",
    whiteSpace: "nowrap" as const,
  };

  const chipStyle = (on: boolean): React.CSSProperties => ({
    height: 30, padding: "0 14px", borderRadius: 999,
    border: on ? "1.5px solid #9A9A9A" : "1px solid rgba(0,0,0,.15)",
    background: on ? "linear-gradient(180deg,#B8B8B8,#9A9A9A)" : "rgba(255,255,255,.5)",
    color: on ? "#fff" : "#444", fontWeight: 800, fontSize: 12, cursor: "pointer",
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#D8DCE3", overflow: "hidden" }}>
      {/* Header */}
      <div style={hdrStyle}>
        <span style={{ fontWeight: 900, fontSize: 16 }}>Contacts</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={btnSmStyle} onClick={() => toast("New group")}>New group</button>
          <button style={{ ...btnSmStyle, color: "#9A9A9A", border: "1.5px solid #9A9A9A", background: "#fff" }}
            onClick={() => toast("My QR code")}>My QR</button>
          <button style={{ ...btnSmStyle, background: "linear-gradient(180deg,#B8B8B8,#9A9A9A)", color: "#fff", border: "1px solid #9A9A9A" }}
            onClick={() => toast("Add contact")}>+ Add</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "8px 12px", background: "#D8DCE3", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.4, fontSize: 16 }}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or g000st..."
            style={{
              width: "100%", height: 38, borderRadius: 12, border: "1px solid rgba(0,0,0,.12)",
              background: "rgba(255,255,255,.7)", paddingLeft: 34, paddingRight: 12,
              fontSize: 14, fontWeight: 600, color: "#111", outline: "none", boxSizing: "border-box" as const,
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, padding: "4px 12px 8px", flexShrink: 0 }}>
        {(["all", "online", "favorites"] as Filter[]).map((f) => (
          <button key={f} style={chipStyle(filter === f)} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Contact List */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as any }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(0,0,0,.4)", fontSize: 14, fontWeight: 700 }}>
            No contacts found
          </div>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => router.push("/chat")}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "12px 14px", textAlign: "left", border: "none",
              background: "rgba(255,255,255,.35)", cursor: "pointer",
              borderBottom: "1px solid rgba(0,0,0,.06)",
            }}
          >
            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 46, height: 46, borderRadius: "50%",
                background: "linear-gradient(145deg,#A8A8A8,#9A9A9A)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 900, color: "#fff",
                border: "2px solid rgba(255,255,255,.6)",
              }}>
                {c.name.charAt(0)}
              </div>
              <div style={{
                position: "absolute", bottom: 1, right: 1,
                width: 11, height: 11, borderRadius: "50%",
                background: statusColor(c.status), border: "2px solid #D8DCE3",
              }} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#111" }}>{c.name}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,.45)", fontFamily: "ui-monospace,monospace", marginTop: 2 }}>
                {c.g000stId}
              </div>
            </div>

            {/* Call buttons */}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, flexShrink: 0 }}>
              <button onClick={(e) => { e.stopPropagation(); toast("Calling…"); }} style={{
                width: 38, height: 38, borderRadius: "50%",
                border: "1.5px solid #9A9A9A",
                background: "linear-gradient(145deg,#f5f5f5,#c8c8c8)",
                color: "#9A9A9A", fontSize: 16, display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer",
              }}>📞</button>
              <button onClick={(e) => { e.stopPropagation(); toast("Video call…"); }} style={{
                width: 38, height: 38, borderRadius: "50%",
                border: "1.5px solid #1565C0",
                background: "linear-gradient(145deg,#f5f5f5,#c8c8c8)",
                color: "#1565C0", fontSize: 16, display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer",
              }}>🎥</button>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
