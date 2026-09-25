"use client";

import { useConfirmModal } from "@/context/ConfirmModalContext";
import { Mic, Send, Square, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useCalling } from "@/features/calling/use-calling";
import { getChatAttachmentDownload } from "@/features/chat/api";
import type { ChatConversationSummary } from "@/features/chat/types";
import { usePrivateChat } from "@/features/chat/use-private-chat";
import { useVoiceRecorder } from "@/features/chat/use-voice-recorder";
import Image from "next/image";

function shortId(publicId: string): string {
  return publicId.slice(-8);
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(value: number): string {
  const seconds = Math.max(0, Math.ceil(value / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const waveform = [5, 11, 16, 9, 19, 13, 7, 15, 20, 10, 17, 8, 14, 6, 12, 18];

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

function useObjectUrl(file?: File) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function AttachmentThumb({ file }: Readonly<{ file: File }>) {
  const url = useObjectUrl(file);
  if (file.type.startsWith("image/") && url) {
    return <Image alt="" width={200} height={200} className="h-50 w-50 object-cover" src={url} />;
  }
  return <span className="text-2xl">{file.type.startsWith("video/") ? "▶️" : "📄"}</span>;
}

function AttachmentPreviewModal({ chat }: Readonly<{ chat: ReturnType<typeof usePrivateChat> }>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, chat.attachments.length - 1));
  const active = chat.attachments[safeActiveIndex];
  const activeUrl = useObjectUrl(active);

  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 sm:items-center sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-[28px] bg-[#EFEFEF] p-4 shadow-2xl sm:rounded-[28px]">
        <div className="mb-3 flex items-center justify-between">
          <button className="px-3 py-2 font-bold text-[#C62828]" disabled={chat.isSending} onClick={() => chat.setAttachments([])} type="button">Cancel</button>
          <div className="text-center"><p className="font-black">Preview</p><p className="text-[10px] font-bold text-black/45">{chat.attachments.length}/3 selected</p></div>
          <button className="min-w-20 rounded-full bg-[#9A9A9A] px-4 py-2 font-black text-white disabled:opacity-50" disabled={chat.isSending} onClick={() => void chat.submitMessage()} type="button">{chat.isSending ? "Sending…" : "Send"}</button>
        </div>
        <div className="flex h-[52vh] items-center justify-center overflow-hidden rounded-[22px] bg-black">
          {active.type.startsWith("image/") && activeUrl ? <img alt={active.name} className="h-full w-full object-contain" src={activeUrl} /> : active.type.startsWith("video/") && activeUrl ? <video className="h-full w-full object-contain" controls preload="metadata" src={activeUrl} /> : <div className="px-8 text-center text-white"><p className="text-6xl">📄</p><p className="mt-4 break-all font-black">{active.name}</p><p className="mt-2 text-xs font-bold text-white/60">{(active.size / 1024 / 1024).toFixed(1)} MB</p></div>}
        </div>
        {chat.sendError ? <p className="mt-2 text-center text-xs font-bold text-[#C62828]">{chat.sendError}</p> : null}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {chat.attachments.map((file, index) => (
            <button className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border-2 bg-black ${index === safeActiveIndex ? "border-[#C62828]" : "border-transparent"}`} key={`${file.name}-${file.lastModified}-${index}`} onClick={() => setActiveIndex(index)} type="button">
              <AttachmentThumb file={file} />
              <span aria-label={`Remove ${file.name}`} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-sm font-black text-white" onClick={(event) => { event.stopPropagation(); chat.removeAttachment(index); }}>×</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type MessageAttachmentProps = Readonly<{
  attachment: NonNullable<import("@/features/chat/types").ChatMessage["attachments"]>[number];
  conversationId: string;
  messageId: string;
}>;

function MessageAttachment({ attachment, conversationId, messageId }: MessageAttachmentProps) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getChatAttachmentDownload(conversationId, messageId, attachment.id)
        .then((nextUrl) => {
          if (!active) return;
          setUrl(nextUrl);
          setFailed(false);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 4 * 60 * 1_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [attachment.id, conversationId, messageId]);

  if (failed) return <span className="block rounded-xl bg-black/10 px-3 py-4 text-xs font-bold text-[#C62828]">Attachment unavailable</span>;
  if (!url) return <span className="block h-36 w-64 animate-pulse rounded-xl bg-black/10" />;
  if (attachment.kind === "image") {
    return <img alt={attachment.fileName} className="max-h-72 w-full cursor-zoom-in rounded-[14px] object-cover transition duration-200 hover:brightness-95" onClick={() => window.open(url, "_blank", "noopener,noreferrer")} src={url} />;
  }
  if (attachment.kind === "video") {
    return <video className="max-h-72 w-full rounded-[14px] bg-black" controls preload="metadata" src={url} />;
  }
  if (attachment.kind === "audio") {
    return (
      <div className="w-64 rounded-[18px] bg-black/10 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1" aria-hidden="true">
          {waveform.map((height, index) => (
            <span className="w-1 rounded-full bg-current opacity-45" key={index} style={{ height }} />
          ))}
          <span className="ml-auto text-[10px] font-black opacity-50">
            {formatDuration(attachment.durationMs ?? 0)}
          </span>
        </div>
        <audio className="h-8 w-full" controls preload="metadata" src={url} />
      </div>
    );
  }
  return (
    <button className="flex w-full items-center gap-3 rounded-[14px] bg-black/10 p-3 text-left transition hover:bg-black/15" onClick={() => window.open(url, "_blank", "noopener,noreferrer")} type="button">
      <span className="text-3xl">📄</span>
      <span className="min-w-0"><span className="block truncate text-xs font-black">{attachment.fileName}</span><span className="mt-1 block text-[10px] font-bold opacity-50">Open document</span></span>
    </button>
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

  if (error && conversations.length === 0) {
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
      {error ? (
        <div
          aria-live="polite"
          className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 rounded-[14px] border border-[#C62828]/20 bg-white/95 px-3 py-2 shadow-sm"
        >
          <p className="text-[11px] font-bold text-[#C62828]">{error}</p>
          <button
            className="shrink-0 rounded-full bg-[#111] px-3 py-1.5 text-[10px] font-black text-white"
            onClick={onRefresh}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : null}
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
              {conversation.participantStatus === "deleted"
                ? "Deleted account"
                : conversation.participantDisplayName || shortId(conversation.participantPublicId)}
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
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams.get("conversationId") ?? undefined;
  const chat = usePrivateChat(requestedConversationId);
  const [blurMessages, setBlurMessages] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const voiceRecorder = useVoiceRecorder();
  const { confirm } = useConfirmModal();
  const { callUser } = useCalling();
  const bottomRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const didScrollToUnreadRef = useRef<string | null>(null);

  useEffect(() => {
    if (!chat.isSending && chat.activeConversation) {
      // Use a small timeout to ensure the DOM has updated (disabled attribute removed) before focusing
      const timer = setTimeout(() => {
        messageInputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [chat.activeConversation?.conversationId, chat.isSending]);

  const handleToggleBurn = async () => {
    const isCurrentlyOn = chat.burnAfterRead;
    const confirmed = await confirm({
      title: isCurrentlyOn ? "Disable Burn After Read?" : "Enable Burn After Read?",
      message: isCurrentlyOn
        ? "Messages will no longer burn 5 seconds after they are opened."
        : "Messages will burn 5 seconds after they are opened. Are you sure you want to enable this?",
      confirmLabel: isCurrentlyOn ? "Disable" : "Enable",
      isDangerous: !isCurrentlyOn,
    });

    if (confirmed) {
      chat.toggleBurnAfterRead();
    }
  };

  useEffect(() => {
    didScrollToUnreadRef.current = null;
    voiceRecorder.cancel();
    voiceRecorder.discard();
    // The recorder should reset whenever the user changes conversations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.activeConversation?.conversationId]);

  useEffect(() => {
    if (chat.firstUnreadMessageId) {
      if (didScrollToUnreadRef.current === chat.firstUnreadMessageId) return;
      const message = document.getElementById(`chat-message-${chat.firstUnreadMessageId}`);
      if (!message) return;
      didScrollToUnreadRef.current = chat.firstUnreadMessageId;
      message.scrollIntoView({ behavior: "instant", block: "center" });
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [chat.firstUnreadMessageId, chat.messages.length]);

  const participantDeleted = chat.activeConversation?.participantStatus === "deleted";
  const canSend =
    (chat.draft.trim().length > 0 || chat.attachments.length > 0) &&
    !chat.isSending &&
    !participantDeleted;

  const sendVoiceMessage = async () => {
    const recording = voiceRecorder.recording ?? await voiceRecorder.stop();
    if (!recording) return;
    const sent = await chat.submitVoiceMessage(recording.file, recording.durationMs);
    if (sent) voiceRecorder.discard();
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden border-x border-black/10 bg-[#D8D8D8] shadow-2xl">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/15 bg-gradient-to-b from-[#fafafa] via-[#d8d8d8] to-[#b0b0b0] px-3 shadow-md">
        <div className="flex items-center gap-1.5">
          <Brand />
          <OnlineSignal />
          <div className="ml-2 flex items-center gap-2 rounded-md border border-black/10 bg-white/50 px-1">
            <button
              aria-label="Decrease font size"
              className="flex h-6 w-6 items-center justify-center rounded-sm bg-white text-lg font-black leading-none text-black hover:bg-gray-100"
              onClick={() => setFontSize((s) => Math.max(10, s - 2))}
              type="button"
            >
              -
            </button>
            <button
              aria-label="Increase font size"
              className="flex h-6 w-6 items-center justify-center rounded-sm bg-white text-lg font-black leading-none text-black hover:bg-gray-100"
              onClick={() => setFontSize((s) => Math.min(32, s + 2))}
              type="button"
            >
              +
            </button>
          </div>
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
        <div className="flex min-h-0 flex-1 flex-col px-2">
          <div className="flex h-12 gap-2 items-center border-b border-black/10 bg-[#D0D0D0] p-1">
            <button
              aria-label="Back to conversations"
              className="flex h-10 w-10 items-center justify-center rounded-full text-3xl font-black text-[#111]"
              onClick={chat.closeConversation}
              type="button"
            >
              ‹
            </button>
            <div className="ml-1 grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#DDD]">
              {!participantDeleted && chat.participantAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={chat.participantAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={16} />
              )}
            </div>
            <div className="ml-2 min-w-0 flex-1">
              <p className="text-[10px] font-bold text-black/45">PRIVATE CHAT</p>
              <p className="truncate font-mono text-[12px] font-black text-[#111]">
                {participantDeleted
                  ? "Deleted account"
                  : chat.participantDisplayName || shortId(chat.activeConversation.participantPublicId)}
              </p>
            </div>
            <div className="mr-1 flex shrink-0 items-center gap-1.5">
              <span className="text-[9px] font-black text-black/45">BLUR</span>
              <button
                aria-checked={blurMessages}
                aria-label={`Message blur ${blurMessages ? "on" : "off"}`}
                className={`relative h-5 w-9 rounded-full transition-colors ${blurMessages ? "bg-[#111]" : "bg-black/20"}`}
                onClick={() => setBlurMessages((current) => !current)}
                role="switch"
                type="button"
              >
                <span
                  className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${blurMessages ? "translate-x-[18px]" : "translate-x-0.5"}`}
                />
              </button>
            </div>
            {!participantDeleted ? (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  aria-label="Call"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-base hover:bg-black/5"
                  onClick={() => void callUser(chat.activeConversation!.participantPublicId, "audio")}
                  type="button"
                >
                  📞
                </button>
                <button
                  aria-label="Video call"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-base hover:bg-black/5"
                  onClick={() => void callUser(chat.activeConversation!.participantPublicId, "video")}
                  type="button"
                >
                  🎥
                </button>
              </div>
            ) : null}
          </div>

          {chat.isLoadingMessages && chat.messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-xs font-semibold text-black/45">
              Loading messages…
            </div>
          ) : chat.messagesError && chat.messages.length === 0 ? (
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
              {chat.messagesError ? (
                <div
                  aria-live="polite"
                  className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 rounded-[14px] border border-[#C62828]/20 bg-white/95 px-3 py-2 shadow-sm"
                >
                  <p className="text-[11px] font-bold text-[#C62828]">{chat.messagesError}</p>
                  <button
                    className="shrink-0 rounded-full bg-[#111] px-3 py-1.5 text-[10px] font-black text-white"
                    onClick={() => void chat.refreshMessages()}
                    type="button"
                  >
                    Try again
                  </button>
                </div>
              ) : null}
              {chat.hasOlderMessages || chat.isLoadingOlderMessages ? (
                <button
                  className="mb-3 h-9 w-full rounded-full bg-white/60 text-[11px] font-black text-black/50 disabled:opacity-60"
                  disabled={chat.isLoadingOlderMessages}
                  onClick={() => void chat.loadOlderMessages()}
                  type="button"
                >
                  {chat.isLoadingOlderMessages ? "Loading…" : "Load earlier messages"}
                </button>
              ) : null}
              {chat.messages.length === 0 ? (
                <div className="flex h-full items-center justify-center px-7">
                  <p className="text-center text-[13px] font-semibold leading-5 text-black/45">
                    This private conversation is empty. Send the first message.
                  </p>
                </div>
              ) : (
                chat.messages.map((message) => {
                  const mine = message.senderPublicId === chat.userPublicId;
                  const secondsLeft = message.burnStartedAtMs
                    ? Math.max(0, Math.ceil((message.expiresAtMs - chat.nowMs) / 1_000))
                    : null;
                  const deliveryLabel = mine
                    ? message.burnAfterReadSeconds
                      ? message.burnStartedAtMs
                        ? "Opened"
                        : "Sent"
                      : message.readAtMs
                        ? "Read"
                        : "Sent"
                    : null;
                  return (
                    <div id={`chat-message-${message.id}`} key={message.id}>
                      {message.id === chat.firstUnreadMessageId ? (
                        <div className="mb-3 mt-1 flex items-center gap-2">
                          <span className="h-px flex-1 bg-[#C62828]/40" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#C62828]">
                            Unread
                          </span>
                          <span className="h-px flex-1 bg-[#C62828]/40" />
                        </div>
                      ) : null}
                      <div className={`chat-message-enter mb-3 flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[78%] px-3 py-2 text-left ${mine
                            ? "rounded-[18px] rounded-br border border-[#9A9A9A] bg-[#E0E0E0]"
                            : "rounded-[18px] rounded-bl border-2 border-[#9A9A9A] bg-[#A8A8A8]"
                            }`}
                          onClick={() => message.locked && void chat.openBurnMessage(message.id)}
                          onKeyDown={(event) => {
                            if (!message.locked || (event.key !== "Enter" && event.key !== " ")) return;
                            event.preventDefault();
                            void chat.openBurnMessage(message.id);
                          }}
                          role={message.locked ? "button" : undefined}
                          tabIndex={message.locked ? 0 : undefined}
                        >
                          {message.locked || message.content ? <p aria-label={!message.locked && blurMessages ? "Message hidden by blur" : undefined} className={`whitespace-pre-wrap break-words font-bold ${mine ? "text-black" : "text-white"} ${!message.locked && blurMessages ? "pointer-events-none select-none" : ""}`} style={!message.locked && blurMessages ? { filter: "blur(10px)", fontSize } : { fontSize }}>{message.locked ? "🔒 Click to open · burns in 5s" : message.content}</p> : null}
                          {!message.locked && message.attachments?.length ? (
                            <div className="mt-2 flex flex-col gap-1">
                              {message.attachments.map((attachment) => (
                                <span
                                  className="block overflow-hidden rounded-[14px]"
                                  key={attachment.id}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MessageAttachment attachment={attachment} conversationId={message.conversationId} messageId={message.id} />
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <p className={`mt-1 text-right text-[10px] font-bold ${mine ? "text-black/40" : "text-white/75"}`}>
                            {message.burnAfterReadSeconds ? (
                              <span className={mine ? "text-[#C62828]" : "text-white"}>
                                {secondsLeft === null ? "🔥 Burn 5s · " : `🔥 ${secondsLeft}s · `}
                              </span>
                            ) : null}
                            {formatTime(message.createdAtMs)}
                            {deliveryLabel ? ` · ${deliveryLabel}` : null}
                          </p>
                        </div>
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

          {participantDeleted ? (
            <div className="shrink-0 border-t border-black/10 bg-[#D0D0D0] px-4 py-3">
              <p className="text-center text-xs font-bold text-black/50">
                This account was deleted. You can read retained messages, but cannot send new ones.
              </p>
            </div>
          ) : (
            <div className="shrink-0 border-t border-black/10 bg-[#D0D0D0] px-[10px] pb-1 pt-1.5">
              <div className="flex items-end gap-2 px-3">
                <div className="flex flex-col items-center">
                  <button
                    aria-label="Attach"
                    className="flex h-8 w-10 shrink-0 items-center justify-center rounded-full text-[28px] font-bold text-[#9A9A9A]"
                    onClick={() => attachmentInputRef.current?.click()}
                    type="button"
                  >
                    +
                  </button>
                  <input
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    multiple
                    onChange={(event) => {
                      chat.setAttachments(Array.from(event.target.files ?? []));
                      event.target.value = "";
                    }}
                    ref={attachmentInputRef}
                    type="file"
                  />
                  <button
                    aria-checked={chat.burnAfterRead}
                    aria-label={`Burn after read ${chat.burnAfterRead ? "on" : "off"}`}
                    className={`min-w-10  rounded-full px-1.5 py-0.5 text-[8px] font-black text-white ${chat.burnAfterRead ? "bg-[#C62828] p-1" : "bg-black/20"
                      }`}
                    onClick={handleToggleBurn}
                    role="switch"
                    type="button"
                  >
                    {chat.burnAfterRead ? "🔥 ON" : "BURN"}
                  </button>
                </div>
                {voiceRecorder.isRecording ? (
                  <div className="flex min-h-11 flex-1 items-center gap-3 rounded-[22px] border border-[#C62828]/25 bg-white px-3 shadow-inner">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#C62828]" />
                    <span className="font-mono text-sm font-black text-[#C62828]">{formatDuration(voiceRecorder.durationMs)}</span>
                    <span className="flex flex-1 items-center justify-center gap-1" aria-hidden="true">
                      {waveform.slice(0, 11).map((height, index) => <span className="w-1 animate-pulse rounded-full bg-[#C62828]/55" key={index} style={{ height }} />)}
                    </span>
                    <button aria-label="Cancel recording" className="grid h-8 w-8 place-items-center rounded-full text-black/45 hover:bg-black/5" onClick={voiceRecorder.cancel} type="button"><Trash2 size={17} /></button>
                  </div>
                ) : voiceRecorder.recording ? (
                  <div className="flex min-h-11 flex-1 items-center gap-2 rounded-[22px] border border-black/15 bg-white px-2">
                    <audio className="h-8 min-w-0 flex-1" controls src={voiceRecorder.recording.previewUrl} />
                    <span className="font-mono text-[11px] font-black text-black/45">{formatDuration(voiceRecorder.recording.durationMs)}</span>
                    <button aria-label="Delete recording" className="grid h-8 w-8 place-items-center rounded-full text-[#C62828] hover:bg-[#C62828]/10" onClick={voiceRecorder.discard} type="button"><Trash2 size={17} /></button>
                  </div>
                ) : (
                  <div className="flex min-h-11 flex-1 items-center rounded-[22px] border border-black/15 bg-white px-1.5">
                    <textarea
                      aria-label="Message"
                      autoFocus
                      className="max-h-28 px-3 min-h-11 w-full resize-none bg-transparent pb-1.5 pt-2.5 text-[15px] text-[#111] outline-none"
                      disabled={chat.isSending}
                      ref={messageInputRef}
                      maxLength={4_000}
                      onChange={(event) => chat.updateDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          if (canSend) void chat.submitMessage();
                        }
                      }}
                      placeholder="Type a message"
                      rows={1}
                      value={chat.draft}
                    />
                  </div>
                )}
                {voiceRecorder.isRecording ? (
                  <button aria-label="Stop recording" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#C62828] text-white shadow-md" onClick={() => void voiceRecorder.stop()} type="button"><Square fill="currentColor" size={15} /></button>
                ) : voiceRecorder.recording ? (
                  <button aria-label="Send voice message" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#111] text-white shadow-md disabled:opacity-50" disabled={chat.isSending} onClick={() => void sendVoiceMessage()} type="button"><Send size={18} /></button>
                ) : chat.draft.trim() || chat.attachments.length ? (
                  <button aria-label="Send" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#9A9A9A] text-white disabled:opacity-50" disabled={!canSend} onClick={() => void chat.submitMessage()} type="button"><Send size={18} /></button>
                ) : (
                  <button aria-label="Record a voice message" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#111] text-white shadow-md transition hover:scale-105 disabled:opacity-50" disabled={chat.isSending} onClick={() => void voiceRecorder.start()} type="button"><Mic size={20} /></button>
                )}
              </div>
              {voiceRecorder.error ? <p aria-live="polite" className="pt-1 text-center text-[10px] font-bold text-[#C62828]">{voiceRecorder.error}</p> : null}
              {chat.attachments.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {chat.attachments.map((file, index) => (
                    <button
                      className="max-w-full rounded-full bg-white/70 px-2 py-1 text-left text-[10px] font-bold text-[#111]"
                      key={`${file.name}-${index}`}
                      onClick={() => chat.removeAttachment(index)}
                      title="Remove attachment"
                      type="button"
                    >
                      {file.name} ×
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="pt-0.5 text-center text-[10px] font-bold leading-3 text-black/40">
                Kept 2 hours · Burn 5s {chat.burnAfterRead ? "ON" : "OFF"} · Screenshots possible
              </p>
            </div>
          )}
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
      <AttachmentPreviewModal chat={chat} />
    </div>
  );
}
