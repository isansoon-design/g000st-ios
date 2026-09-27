import { Suspense } from "react";

import PrivateChatPage from "@/features/chat/private-chat-page";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center bg-[#D8D8D8] dark:bg-night-canvas text-sm font-bold text-black/45 dark:text-night-muted">Loading chat…</div>}>
      <div data-admin-part="whisper.chat" className="h-full"><PrivateChatPage /></div>
    </Suspense>
  );
}
