"use client";

import { useEffect, useRef } from "react";

import type { ChatConversationSummary } from "@/features/chat/types";
import { usePrivateChat } from "@/features/chat/use-private-chat";

function shortId(publicId: string): string {
  return `${publicId.slice(0, 12)}…${publicId.slice(-6)}`;
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Brand() {
  return (
    <span className="text-[17px] font-black tracking-tight text-[#111]">
      g<span className="text-[#C62828]">000</span>st
    </span>
  );
}

function OnlineSignal() {
  return (
    <span aria-label="Online" className="flex h-3 items-end gap-0.5">
      {[4, 6, 9, 12].map((height) => (
        <span key={height} className="block w-[3px] rounded-sm bg-[#9A9A9A]" style={{ height }} />
      ))}
    </span>
  );
}

type ConversationListProps = Readonly<{
  conversations: readonly ChatConversationSummary[];
  error: string | null;
  isLoading: boolean;
  onOpen: (conversation: ChatConversationSummary) => void;
  onRefresh: () => void;
  onStart: () => void;
}>;

function ConversationList({
  conversations,
  error,
  isLoading,
  onOpen,
  onRefresh,
  onStart,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#D8D8D8] text-xs font-semibold text-black/45">
        Loading conversations…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#D8D8D8] px-7">
        <p className="text-center text-sm font-bold text-[#C62828]">{error}</p>
        <button
          className="mt-4 h-11 rounded-full bg-white px-6 font-black text-[#111]"
          onClick={onRefresh}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#D8D8D8] px-7">
        <p className="text-center text-[13px] font-semibold leading-5 text-black/45">
          Your private conversations will appear here.
        </p>
        <button
          className="mt-4 h-11 rounded-full bg-[#9A9A9A] px-6 font-black text-white"
          onClick={onStart}
          type="button"
        >
          Start private chat
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#D8D8D8] p-3">
      {conversations.map((conversation) => (
        <button
          className="mb-2 flex w-full items-center rounded-[18px] border border-white/60 bg-[#E2E2E2] p-3 text-left"
          key={conversation.conversationId}
          onClick={() => onOpen(conversation)}
          type="button"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9A9A9A] text-base font-black text-white">
            g
          </span>
          <span className="ml-3 min-w-0 flex-1">
            <span className="block font-mono text-[12px] font-black text-[#111]">
              {shortId(conversation.participantPublicId)}
            </span>
            <span className="mt-1 block truncate text-xs font-semibold text-black/45">
              {conversation.lastMessagePreview || "Private conversation"}
            </span>
          </span>
          <span className="ml-2 flex shrink-0 flex-col items-end">
            <span className="text-[10px] font-bold text-black/40">
              {formatTime(conversation.updatedAtMs)}
            </span>
            {conversation.unreadCount > 0 ? (
              <span className="mt-1 min-w-5 rounded-full bg-[#C62828] px-1.5 py-0.5 text-center text-[10px] font-black text-white">
                {Math.min(conversation.unreadCount, 99)}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function PrivateChatPage() {
  const chat = usePrivateChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [chat.messages.length]);

  const canSend = chat.draft.trim().length > 0 && !chat.isSending;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#D8D8D8]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/15 bg-gradient-to-b from-[#fafafa] via-[#d8d8d8] to-[#b0b0b0] px-3 shadow-md">
        <div className="flex items-center gap-1.5">
          <Brand />
          <OnlineSignal />
        </div>
        <button
          aria-label="Start a new private chat"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-2xl font-black text-[#111]"
          onClick={chat.openNewChat}
          type="button"
        >
          +
        </button>
      </header>

      {chat.activeConversation ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center border-b border-black/10 bg-[#D0D0D0] px-2">
            <button
              aria-label="Back to conversations"
              className="flex h-10 w-10 items-center justify-center rounded-full text-3xl font-black text-[#111]"
              onClick={chat.closeConversation}
              type="button"
            >
              ‹
            </button>
            <div className="ml-1 min-w-0 flex-1">
              <p className="text-[10px] font-bold text-black/45">PRIVATE CHAT</p>
              <p className="truncate font-mono text-[12px] font-black text-[#111]">
                {shortId(chat.activeConversation.participantPublicId)}
              </p>
            </div>
          </div>

          {chat.isLoadingMessages ? (
            <div className="flex flex-1 items-center justify-center text-xs font-semibold text-black/45">
              Loading messages…
            </div>
          ) : chat.messagesError ? (
            <div className="flex flex-1 flex-col items-center justify-center px-7">
              <p className="text-center text-sm font-bold text-[#C62828]">{chat.messagesError}</p>
              <button
                className="mt-4 h-11 rounded-full bg-white px-6 font-black"
                onClick={() => void chat.refreshMessages()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3">
              {chat.messages.length === 0 ? (
                <div className="flex h-full items-center justify-center px-7">
                  <p className="text-center text-[13px] font-semibold leading-5 text-black/45">
                    This private conversation is empty. Send the first message.
                  </p>
                </div>
              ) : (
                chat.messages.map((message) => {
                  const mine = message.senderPublicId === chat.userPublicId;
                  return (
                    <div
                      className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}
                      key={message.id}
                    >
                      <div
                        className={`max-w-[78%] px-3 py-2 ${
                          mine
                            ? "rounded-[18px] rounded-br border border-[#9A9A9A] bg-[#E0E0E0]"
                            : "rounded-[18px] rounded-bl border-2 border-[#9A9A9A] bg-[#A8A8A8]"
                        }`}
                      >
                        <p className={`whitespace-pre-wrap break-words text-sm font-bold ${mine ? "text-black" : "text-white"}`}>
                          {message.content}
                        </p>
                        <p className={`mt-1 text-right text-[10px] font-bold ${mine ? "text-black/40" : "text-white/75"}`}>
                          {formatTime(message.createdAtMs)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {chat.sendError ? (
            <p aria-live="polite" className="bg-[#D0D0D0] px-4 pt-1 text-center text-[11px] font-bold text-[#C62828]">
              {chat.sendError}
            </p>
          ) : null}

          <div className="shrink-0 border-t border-black/10 bg-[#D0D0D0] px-[10px] pb-1 pt-1.5">
            <div className="flex items-end gap-2">
              <button
                aria-label="Attach"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[28px] font-bold text-[#9A9A9A] opacity-40"
                disabled
                type="button"
              >
                +
              </button>
              <div className="flex min-h-11 flex-1 items-center rounded-[22px] border border-black/15 bg-white px-1.5">
                <textarea
                  aria-label="Message"
                  className="max-h-28 min-h-11 w-full resize-none bg-transparent px-2.5 pb-1.5 pt-2.5 text-[15px] text-[#111] outline-none"
                  disabled={chat.isSending}
                  maxLength={4_000}
                  onChange={(event) => chat.updateDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void chat.submitMessage();
                    }
                  }}
                  placeholder="Type a message"
                  rows={1}
                  value={chat.draft}
                />
              </div>
              <button
                aria-label="Send"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#9A9A9A] text-base font-black text-white disabled:opacity-50"
                disabled={!canSend}
                onClick={() => void chat.submitMessage()}
                type="button"
              >
                ➤
              </button>
            </div>
            <p className="pt-0.5 text-center text-[10px] font-bold leading-3 text-black/40">
              Private conversation · Screenshots may be possible
            </p>
          </div>
        </div>
      ) : (
        <ConversationList
          conversations={chat.conversations}
          error={chat.conversationsError}
          isLoading={chat.isLoadingConversations}
          onOpen={chat.openConversation}
          onRefresh={() => void chat.refreshConversations()}
          onStart={chat.openNewChat}
        />
      )}

      {chat.isNewChatOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
          <form
            className="w-full max-w-[360px] rounded-[24px] border border-white/60 bg-[#D8D8D8] p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void chat.submitNewChat();
            }}
          >
            <h2 className="text-lg font-black text-[#111]">New private chat</h2>
            <p className="mb-4 mt-1 text-xs font-semibold leading-5 text-black/55">
              Enter the other person&apos;s shareable 50-character Public ID.
            </p>
            <input
              aria-label="Participant Public ID"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-12 w-full rounded-[14px] border border-black/15 bg-white px-3 font-mono text-[13px] text-[#111] outline-none focus:border-[#9A9A9A]"
              disabled={chat.isStartingChat}
              maxLength={50}
              onChange={(event) => chat.updateParticipantInput(event.target.value)}
              placeholder="Public ID"
              value={chat.participantInput}
            />
            {chat.participantError ? (
              <p aria-live="polite" className="mb-2 mt-1 text-xs font-semibold text-[#C62828]">
                {chat.participantError}
              </p>
            ) : null}
            <p className="mb-4 mt-1 text-right text-[10px] font-bold text-black/40">
              {chat.participantInput.length}/50
            </p>
            <div className="flex gap-2">
              <button
                className="h-11 flex-1 rounded-full border border-black/15 bg-white font-bold text-[#111]"
                disabled={chat.isStartingChat}
                onClick={chat.closeNewChat}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-11 flex-1 rounded-full bg-[#9A9A9A] font-black text-white disabled:opacity-50"
                disabled={chat.isStartingChat}
                type="submit"
              >
                {chat.isStartingChat ? "Opening…" : "Open chat"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
