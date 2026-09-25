import { Suspense } from "react";

import PrivateChatPage from "@/features/chat/private-chat-page";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center bg-[#D8D8D8] text-sm font-bold text-black/45">Loading chat…</div>}>
      <PrivateChatPage />
    </Suspense>
  );
}
