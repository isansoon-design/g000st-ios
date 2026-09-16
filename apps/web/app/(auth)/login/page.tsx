"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleEnter = async () => {
    const raw = userId.trim();
    if (!raw) {
      setError("Paste your user ID");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/lookup?userId=${encodeURIComponent(raw)}`
      );
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem("auth_token", raw);
        localStorage.setItem("user_id", data.userId || raw);
        localStorage.setItem("user_name", data.name || "g000st user");
        router.push("/chat");
      } else {
        setError("User ID not found. Download the app to create one.");
      }
    } catch {
      // Offline / backend down — let them in with the raw ID anyway
      localStorage.setItem("auth_token", raw);
      localStorage.setItem("user_id", raw);
      router.push("/chat");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{ background: "#D8DCE3" }}
      className="min-h-screen flex items-center justify-center px-6"
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          border: "2px solid #000",
          borderRadius: 22,
          boxShadow: "4px 4px 0 #000",
          padding: 22,
        }}
      >
        {/* Logo */}
        <div style={{ fontWeight: 900, fontSize: 28, letterSpacing: "-0.04em" }}>
          g<span style={{ color: "#FF3B30" }}>000</span>st
        </div>

        {/* Label */}
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.14em",
            color: "#6B7280",
            textTransform: "uppercase",
          }}
        >
          paste your user ID
        </div>

        {/* Input */}
        <input
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          placeholder="Paste your user ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEnter()}
          style={{
            marginTop: 18,
            width: "100%",
            height: 48,
            border: "2px solid #000",
            borderRadius: 14,
            background: "#F5F5F7",
            padding: "0 14px",
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Error */}
        {error && (
          <p style={{ marginTop: 8, color: "#E53935", fontWeight: 800, fontSize: 13 }}>
            {error}
          </p>
        )}

        {/* Button */}
        <button
          onClick={handleEnter}
          disabled={isLoading}
          style={{
            marginTop: 12,
            width: "100%",
            height: 52,
            border: 0,
            borderRadius: 999,
            background: isLoading ? "#aaa" : "#E53935",
            color: "#fff",
            fontWeight: 900,
            fontSize: 16,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "..." : "Enter"}
        </button>

        {/* Footer text */}
        <p
          style={{
            marginTop: 16,
            textAlign: "center",
            fontSize: 13,
            fontWeight: 700,
            color: "#6B7280",
            lineHeight: 1.4,
          }}
        >
          To create your ID, download our g000st app
        </p>
      </div>
    </div>
  );
}
