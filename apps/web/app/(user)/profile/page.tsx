"use client";

import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

const RINGTONES = [
  { value: "g000st", label: "g000st Default" },
  { value: "soft", label: "Soft Chime" },
  { value: "pulse", label: "Pulse" },
  { value: "classic", label: "Classic Ring" },
  { value: "silent", label: "Silent" },
];

export default function ProfilePage() {
  const [userId, setUserId] = useState("—");
  const [profile, setProfile] = useState({ name: "", sex: "", age: "", country: "", hobby: "", interested: "" });
  const [ringtone, setRingtone] = useState("g000st");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [supportMsg, setSupportMsg] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = localStorage.getItem("user_id") || "—";
    setUserId(id);
    try {
      const saved = JSON.parse(localStorage.getItem("g000st_profile") || "{}");
      if (saved) setProfile((p) => ({ ...p, ...saved }));
    } catch {}
  }, []);

  const copyId = () => {
    navigator.clipboard?.writeText(userId).then(() => toast.success("ID copied!")).catch(() => {
      const el = document.createElement("textarea");
      el.value = userId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast.success("ID copied!");
    });
  };

  const shareId = () => {
    if (navigator.share) {
      navigator.share({ title: "My g000st ID", text: userId });
    } else {
      copyId();
    }
  };

  const saveProfile = () => {
    localStorage.setItem("g000st_profile", JSON.stringify(profile));
    toast.success("Profile saved!");
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const sendSupport = async () => {
    if (!supportMsg.trim()) { toast.error("Write a message first"); return; }
    setSendingSupport(true);
    await new Promise((r) => setTimeout(r, 800));
    setSendingSupport(false);
    setSupportMsg("");
    toast.success("Message sent to support!");
  };

  const cardStyle: React.CSSProperties = {
    background: "linear-gradient(160deg,#ffffff 0%,#e6e6e6 42%,#b8b8b8 78%,#d8d8d8 100%)",
    border: "1px solid rgba(255,255,255,.55)",
    borderBottom: "1px solid rgba(0,0,0,.18)",
    borderRight: "1px solid rgba(0,0,0,.12)",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,.85),inset 0 -2px 4px rgba(0,0,0,.12),0 10px 24px rgba(0,0,0,.22)",
    borderRadius: 16,
    padding: "14px",
    marginBottom: 12,
  };

  const fieldStyle: React.CSSProperties = {
    display: "block", width: "100%", height: 40, borderRadius: 12,
    border: "1.5px solid rgba(150,150,150,.35)", background: "#fff",
    padding: "0 12px", fontSize: 13, fontWeight: 700, color: "#111",
    marginTop: 6, marginBottom: 12, boxSizing: "border-box",
    outline: "none",
  };

  const btnStyle: React.CSSProperties = {
    height: 36, padding: "0 14px", borderRadius: 12,
    border: "1.5px solid #9A9A9A", background: "linear-gradient(180deg,#E8E8E8,#D0D0D0)",
    color: "#111", fontWeight: 800, fontSize: 12, cursor: "pointer",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 900, color: "rgba(0,0,0,.45)", letterSpacing: "0.04em",
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#D8DCE3", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        background: "linear-gradient(180deg,#fafafa 0%,#d8d8d8 45%,#b0b0b0 100%)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,.9),0 6px 16px rgba(0,0,0,.12)",
        borderBottom: "1px solid rgba(0,0,0,.12)",
      }}>
        <span style={{ fontWeight: 900, fontSize: 16 }}>Profile</span>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", color: "rgba(0,0,0,.35)", cursor: "pointer" }}>OPTIONAL</span>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 28px", WebkitOverflowScrolling: "touch" as any }}>

        {/* ID Card */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(0,0,0,.45)", letterSpacing: "0.04em", marginBottom: 6 }}>
            Copy ur ID
          </div>
          <div style={{
            width: "100%", fontSize: 13, wordBreak: "break-all", lineHeight: 1.45,
            fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 900, color: "#C62828",
            margin: "4px 0 10px",
          }}>
            {userId}
          </div>
          <div style={{
            display: "flex", width: "100%", height: 44, borderRadius: 14,
            overflow: "hidden", border: "1.5px solid #111", background: "#D0D0D0",
          }}>
            <button onClick={copyId} style={{
              flex: 1, height: 44, border: 0, borderRight: "1px solid #111",
              background: "linear-gradient(180deg,#E8E8E8,#C4C4C4)",
              fontSize: 13, fontWeight: 900, color: "#111", cursor: "pointer",
            }}>
              Copy ur ID
            </button>
            <button onClick={shareId} style={{
              flex: 1, height: 44, border: 0,
              background: "linear-gradient(180deg,#E8E8E8,#C4C4C4)",
              fontSize: 13, fontWeight: 900, color: "#111", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              Share
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 12v7a1 1 0 001 1h7M20 4l-9.5 9.5M14 4h6v6" stroke="#C62828" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,.35)", marginTop: 8, lineHeight: 1.35 }}>
            Tap the arrow to share your ID with friends.
          </p>
        </div>

        {/* Sounds & Ringtones */}
        <div style={{ ...cardStyle, background: "linear-gradient(160deg,#F2F2F2,#E0E0E0)", border: "1.5px solid rgba(150,150,150,.3)" }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.06em", color: "rgba(0,0,0,.45)", marginBottom: 8 }}>
            SOUNDS · RINGTONES
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 8 }}>Call ringtone</div>
          <select
            value={ringtone}
            onChange={(e) => setRingtone(e.target.value)}
            style={{
              width: "100%", height: 40, borderRadius: 12,
              border: "1.5px solid rgba(150,150,150,.35)", background: "#fff",
              padding: "0 10px", fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 8,
            }}
          >
            {RINGTONES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            <button style={btnStyle} onClick={() => toast("Playing preview…")}>▶ Preview</button>
            <button style={btnStyle}>Stop</button>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,.4)", marginTop: 8 }}>
            {RINGTONES.find((r) => r.value === ringtone)?.label}
          </div>
        </div>

        {/* Profile Photo */}
        <div style={{ ...cardStyle, textAlign: "center" as const }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", margin: "0 auto 8px",
            background: "linear-gradient(145deg,#E8E8E8,#c8c8c8)",
            border: "2px solid #8E8E8E", overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {photoUrl
              ? <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 24, opacity: 0.35 }}>📷</span>
            }
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhotoChange} />
          <button style={{ ...btnStyle, width: "100%", maxWidth: 260 }} onClick={() => photoInputRef.current?.click()}>
            Add photo
          </button>
          {photoUrl && (
            <button style={{ ...btnStyle, marginTop: 8, width: "100%", maxWidth: 260 }} onClick={() => setPhotoUrl(null)}>
              Remove
            </button>
          )}
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,.4)", marginTop: 8, lineHeight: 1.3 }}>
            Nothing is required. Fill only what you want.
          </p>
        </div>

        {/* Profile Fields */}
        <div style={cardStyle}>
          <label style={labelStyle}>NAME</label>
          <input style={fieldStyle} placeholder="Your name (optional)" value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />

          <label style={labelStyle}>SEX</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 12 }}>
            {["Male", "Female"].map((s) => (
              <button key={s} onClick={() => setProfile((p) => ({ ...p, sex: s.toLowerCase() }))} style={{
                flex: 1, height: 40, borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer",
                border: "1.5px solid #9A9A9A",
                background: profile.sex === s.toLowerCase()
                  ? "linear-gradient(180deg,#B8B8B8 0%,#9A9A9A 100%)"
                  : "linear-gradient(180deg,#E8E8E8,#D0D0D0)",
                color: profile.sex === s.toLowerCase() ? "#fff" : "#111",
              }}>{s}</button>
            ))}
          </div>

          <label style={labelStyle}>AGE</label>
          <input style={fieldStyle} type="number" placeholder="Age (optional)" min="13" max="120"
            value={profile.age} onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))} />

          <label style={labelStyle}>COUNTRY</label>
          <input style={fieldStyle} placeholder="Country (optional)" value={profile.country}
            onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))} />

          <label style={labelStyle}>HOBBY</label>
          <input style={fieldStyle} placeholder="e.g. hiking, football…" value={profile.hobby}
            onChange={(e) => setProfile((p) => ({ ...p, hobby: e.target.value }))} />

          <label style={labelStyle}>INTERESTED IN</label>
          <input style={{ ...fieldStyle, marginBottom: 4 }} placeholder="What you are into (optional)"
            value={profile.interested} onChange={(e) => setProfile((p) => ({ ...p, interested: e.target.value }))} />
        </div>

        {/* Save Button */}
        <button onClick={saveProfile} style={{
          width: "100%", height: 48, borderRadius: 14, border: "1px solid #9A9A9A", marginBottom: 10,
          background: "linear-gradient(180deg,#B8B8B8 0%,#9A9A9A 48%,#9A9A9A 100%)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,.35),0 8px 18px rgba(150,150,150,.4)",
          color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer",
        }}>
          Save profile
        </button>

        {/* Contact Us / Support */}
        <div style={{ ...cardStyle, background: "linear-gradient(160deg,#FFF8E7,#E8E8E8)", border: "1.5px solid #C0C0C0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#1a1a1a" }}>Contact us / Support</div>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#9A9A9A" }}>★★★★★</div>
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,.45)", marginBottom: 10, lineHeight: 1.35 }}>
            Send a message. You can attach a photo or video.
          </p>
          <textarea
            value={supportMsg}
            onChange={(e) => setSupportMsg(e.target.value)}
            placeholder="Your message…"
            rows={4}
            style={{
              width: "100%", minHeight: 88, borderRadius: 12, border: "1.5px solid rgba(150,150,150,.35)",
              background: "#fff", padding: 10, fontSize: 13, fontWeight: 600, color: "#111",
              resize: "vertical" as const, marginBottom: 10, boxSizing: "border-box" as const, outline: "none",
            }}
          />
          <button onClick={sendSupport} disabled={sendingSupport} style={{
            width: "100%", height: 46, borderRadius: 14, border: 0,
            background: sendingSupport ? "#aaa" : "linear-gradient(180deg,#B8B8B8,#9A9A9A)",
            color: "#fff", fontWeight: 900, fontSize: 14, cursor: sendingSupport ? "not-allowed" : "pointer",
          }}>
            {sendingSupport ? "Sending…" : "Send to Support"}
          </button>
        </div>

        {/* Legal */}
        <div style={{ ...cardStyle, textAlign: "center" as const, marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,.45)", marginBottom: 10 }}>Legal</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, justifyContent: "center" }}>
            <button style={btnStyle} onClick={() => toast("Privacy Policy")}>Privacy Policy</button>
            <button style={btnStyle} onClick={() => toast("Terms & Conditions")}>Terms &amp; Conditions</button>
          </div>
        </div>

      </div>
    </div>
  );
}
