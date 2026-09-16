"use client";

import { Suspense } from "react";
import SocialChatInner from "./SocialChatInner";

export default function SocialChatPage() {
  return (
    <Suspense fallback={<div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#E5E5E7", color: "#888" }}>Loading…</div>}>
      <SocialChatInner />
    </Suspense>
  );
}
