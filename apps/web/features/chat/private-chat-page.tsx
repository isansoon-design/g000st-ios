"use client";

import {
  getPeerPreferences,
  listContactNicknames,
  updateContactNickname,
  updatePeerPreferences,
  type PeerPreferences,
} from "@/app/api/contacts";
import { getSocialProfile, toggleSocialCamp } from "@/app/api/social";
import { useConfirmModal } from "@/context/ConfirmModalContext";
import { UserHeaderPortal } from "@/components/navigation/header-portal";
import { Mic, Send, Square, Trash2, UserRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { useCalling } from "@/features/calling/use-calling";
import {
  deleteChatMessage,
  editChatMessage,
  getChatAttachmentDownload,
} from "@/features/chat/api";
import type {
  ChatConversationSummary,
  ChatMessage,
} from "@/features/chat/types";
import { usePrivateChat } from "@/features/chat/use-private-chat";
import { useVoiceRecorder } from "@/features/chat/use-voice-recorder";
import Image from "next/image";

function shortId(publicId: string): string {
  return publicId.slice(0, 8);
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(value: number): string {
  const seconds = Math.max(0, Math.ceil(value / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const waveform = [5, 11, 16, 9, 19, 13, 7, 15, 20, 10, 17, 8, 14, 6, 12, 18];

function OnlineSignal() {
  return (
    <span aria-label="Online" className="flex h-3 items-end gap-0.5">
      {[4, 6, 9, 12].map((height) => (
        <span
          key={height}
          className="block w-[3px] rounded-sm bg-[#9A9A9A] dark:bg-night-control"
          style={{ height }}
        />
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
    return (
      <Image
        alt=""
        width={200}
        height={200}
        className="h-50 w-50 object-cover"
        src={url}
      />
    );
  }
  return (
    <span className="text-2xl">
      {file.type.startsWith("video/") ? "▶️" : "📄"}
    </span>
  );
}

function AttachmentPreviewModal({
  chat,
}: Readonly<{ chat: ReturnType<typeof usePrivateChat> }>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex = Math.min(
    activeIndex,
    Math.max(0, chat.attachments.length - 1),
  );
  const active = chat.attachments[safeActiveIndex];
  const activeUrl = useObjectUrl(active);

  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 sm:items-center sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-[28px] bg-[#EFEFEF] dark:bg-night-surface p-4 shadow-2xl sm:rounded-[28px]">
        <div className="mb-3 flex items-center justify-between">
          <button
            className="px-3 py-2 font-bold text-[#C62828]"
            disabled={chat.isSending}
            onClick={() => chat.setAttachments([])}
            type="button"
          >
            Cancel
          </button>
          <div className="text-center">
            <p className="font-black">Preview</p>
            <p className="text-[10px] font-bold text-black/45 dark:text-night-muted">
              {chat.attachments.length}/3 selected
            </p>
          </div>
          <button
            className="min-w-20 rounded-full bg-[#9A9A9A] dark:bg-night-control px-4 py-2 font-black text-white disabled:opacity-50"
            disabled={chat.isSending}
            onClick={() => void chat.submitMessage()}
            type="button"
          >
            {chat.isSending ? "Sending…" : "Send"}
          </button>
        </div>
        <div className="flex h-[52vh] items-center justify-center overflow-hidden rounded-[22px] bg-black">
          {active.type.startsWith("image/") && activeUrl ? (
            <img
              alt={active.name}
              className="h-full w-full object-contain"
              src={activeUrl}
            />
          ) : active.type.startsWith("video/") && activeUrl ? (
            <video
              className="h-full w-full object-contain"
              controls
              preload="metadata"
              src={activeUrl}
            />
          ) : (
            <div className="px-8 text-center text-white">
              <p className="text-6xl">📄</p>
              <p className="mt-4 break-all font-black">{active.name}</p>
              <p className="mt-2 text-xs font-bold text-white/60">
                {(active.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          )}
        </div>
        {chat.sendError ? (
          <p className="mt-2 text-center text-xs font-bold text-[#C62828]">
            {chat.sendError}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {chat.attachments.map((file, index) => (
            <button
              className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border-2 bg-black ${index === safeActiveIndex ? "border-[#C62828]" : "border-transparent"}`}
              key={`${file.name}-${file.lastModified}-${index}`}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <AttachmentThumb file={file} />
              <span
                aria-label={`Remove ${file.name}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-sm font-black text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  chat.removeAttachment(index);
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type MessageAttachmentProps = Readonly<{
  attachment: NonNullable<
    import("@/features/chat/types").ChatMessage["attachments"]
  >[number];
  conversationId: string;
  messageId: string;
}>;

function MessageAttachment({
  attachment,
  conversationId,
  messageId,
}: MessageAttachmentProps) {
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

  if (failed)
    return (
      <span className="block rounded-xl bg-black/10 dark:bg-white/10 px-3 py-4 text-xs font-bold text-[#C62828]">
        Attachment unavailable
      </span>
    );
  if (!url)
    return (
      <span className="block h-36 w-64 animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
    );
  if (attachment.kind === "image") {
    return (
      <img
        alt={attachment.fileName}
        className="max-h-72 w-full cursor-zoom-in rounded-[14px] object-cover transition duration-200 hover:brightness-95"
        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        src={url}
      />
    );
  }
  if (attachment.kind === "video") {
    return (
      <video
        className="max-h-72 w-full rounded-[14px] bg-black"
        controls
        preload="metadata"
        src={url}
      />
    );
  }
  if (attachment.kind === "audio") {
    return (
      <div className="w-64 rounded-[18px] bg-white/10 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1" aria-hidden="true">
          {waveform.map((height, index) => (
            <span
              className="w-1 rounded-full bg-white/70 dark:bg-night-surface"
              key={index}
              style={{ height }}
            />
          ))}
          <span className="ml-auto text-[10px] font-black text-white/90">
            {formatDuration(attachment.durationMs ?? 0)}
          </span>
        </div>
        <audio
          className="h-8 w-full"
          controls
          preload="metadata"
          src={url}
          style={{ colorScheme: "dark" }}
        />
      </div>
    );
  }
  return (
    <button
      className="flex w-full items-center gap-3 rounded-[14px] bg-black/10 dark:bg-white/10 p-3 text-left transition hover:bg-black/15"
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      type="button"
    >
      <span className="text-3xl">📄</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black">
          {attachment.fileName}
        </span>
        <span className="mt-1 block text-[10px] font-bold opacity-50">
          Open document
        </span>
      </span>
    </button>
  );
}

type ConversationListProps = Readonly<{
  conversations: readonly ChatConversationSummary[];
  initialKind?: "private" | "market";
  namesByPublicId: Readonly<Record<string, string>>;
  error: string | null;
  isLoading: boolean;
  onOpen: (conversation: ChatConversationSummary) => void;
  onDelete: (conversation: ChatConversationSummary) => void;
  deletingConversationId?: string | null;
  onRefresh: () => void;
  onStart: () => void;
}>;

function ConversationList({
  conversations,
  initialKind,
  namesByPublicId,
  error,
  isLoading,
  onOpen,
  onDelete,
  deletingConversationId,
  onRefresh,
  onStart,
}: ConversationListProps) {
  const [kind, setKind] = useState<"private" | "market">(
    initialKind ?? "private",
  );
  useEffect(() => {
    if (initialKind) setKind(initialKind);
  }, [initialKind]);
  const visibleConversations = conversations.filter(
    (conversation) => (conversation.kind ?? "private") === kind,
  );
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#D8D8D8] dark:bg-night-canvas text-xs font-semibold text-black/45 dark:text-night-muted">
        Loading conversations…
      </div>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#D8D8D8] dark:bg-night-canvas px-7">
        <p className="text-center text-sm font-bold text-[#C62828]">{error}</p>
        <button
          className="mt-4 h-11 rounded-full bg-white dark:bg-night-surface px-6 font-black text-[#111] dark:text-night-text"
          onClick={onRefresh}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#D8D8D8] dark:bg-night-canvas p-3">
      <div
        className="mb-3 flex gap-2"
        role="tablist"
        aria-label="Conversation type"
      >
        {(["private", "market"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            onClick={() => setKind(value)}
            className={`rounded-full px-4 py-2 text-xs font-black ${kind === value ? "bg-black text-white" : "bg-white dark:bg-night-surface text-black dark:text-night-text"}`}
          >
            {value === "market" ? "Trading chats" : "Private chats"}
          </button>
        ))}
      </div>
      {error ? (
        <div
          aria-live="polite"
          className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 rounded-[14px] border border-[#C62828]/20 bg-white/95 dark:bg-night-surface px-3 py-2 shadow-sm"
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
      {visibleConversations.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-black/45 dark:text-night-muted">
            {kind === "market"
              ? "Your Trading chats will appear here."
              : "Your private chats will appear here."}
          </p>
          {kind === "private" && (
            <button
              className="mt-4 rounded-full bg-[#9A9A9A] dark:bg-night-control px-6 py-3 font-black text-white"
              onClick={onStart}
              type="button"
            >
              Start private chat
            </button>
          )}
        </div>
      )}
      {visibleConversations.map((conversation) => (
        <div
          className="mb-2 flex w-full items-center rounded-[18px] border border-white/60 dark:border-white/20 bg-[#E2E2E2] dark:bg-night-raised"
          key={conversation.conversationId}
        >
          <button
            className="flex min-w-0 flex-1 items-center p-3 text-left"
            onClick={() => onOpen(conversation)}
            type="button"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9A9A9A] dark:bg-night-control text-base font-black text-white">
              g
            </span>
            <span className="ml-3 min-w-0 flex-1">
              <span className="block font-mono text-[12px] font-black text-[#111] dark:text-night-text">
                {conversation.participantStatus === "deleted"
                  ? "Deleted account"
                  : namesByPublicId[conversation.participantPublicId] ||
                  conversation.participantDisplayName ||
                  shortId(conversation.participantPublicId)}
              </span>
              <span className="mt-1 block truncate text-xs font-semibold text-black/45 dark:text-night-muted">
                {conversation.lastMessagePreview ||
                  (conversation.kind === "market"
                    ? "Market conversation"
                    : "Private conversation")}
                {conversation.kind === "market" && (
                  <span className="ml-2 text-[#C62828]">
                    Market · Listing {conversation.marketPostId?.slice(0, 8)} ·
                    30 days
                  </span>
                )}
              </span>
            </span>
            <span className="ml-2 flex shrink-0 flex-col items-end">
              <span className="text-[10px] font-bold text-black/40 dark:text-night-muted">
                {formatTime(conversation.updatedAtMs)}
              </span>
              {conversation.unreadCount > 0 ? (
                <span className="mt-1 min-w-5 rounded-full bg-[#C62828] px-1.5 py-0.5 text-center text-[10px] font-black text-white">
                  {Math.min(conversation.unreadCount, 99)}
                </span>
              ) : null}
            </span>
          </button>
          <button
            aria-label="Delete conversation"
            className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#C62828] hover:bg-black/5 disabled:opacity-40"
            disabled={deletingConversationId === conversation.conversationId}
            onClick={() => onDelete(conversation)}
            type="button"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function PrivateChatPage() {
  const searchParams = useSearchParams();
  const requestedConversationId =
    searchParams.get("conversationId") ?? undefined;
  const chat = usePrivateChat(requestedConversationId);
  const activeIsMarket =
    chat.conversations.find(
      (item) => item.conversationId === chat.activeConversation?.conversationId,
    )?.kind === "market";
  const [blurMessages, setBlurMessages] = useState(false);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [namesByPublicId, setNamesByPublicId] = useState<
    Record<string, string>
  >({});
  const [isNameOpen, setIsNameOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const handleBlur = () => setIsWindowBlurred(true);
    const handleFocus = () => setIsWindowBlurred(false);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
  const [peerPreferences, setPeerPreferences] =
    useState<PeerPreferences | null>(null);
  const [followingPeer, setFollowingPeer] = useState<boolean | null>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const voiceRecorder = useVoiceRecorder();
  const { confirm } = useConfirmModal();
  const { callUser } = useCalling();
  const bottomRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const didScrollToUnreadRef = useRef<string | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartRef = useRef<{ x: number; y: number } | null>(null);

  function cancelMessageHold() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    holdStartRef.current = null;
  }

  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    setActionMessage(null);
    cancelMessageHold();
  }, [chat.activeConversation?.conversationId]);

  useEffect(() => {
    void listContactNicknames()
      .then((contacts) =>
        setNamesByPublicId(
          Object.fromEntries(
            contacts.map((contact) => [contact.publicId, contact.nickname]),
          ),
        ),
      )
      .catch(() => undefined);
  }, []);

  const peerPublicId = chat.activeConversation?.participantPublicId;
  useEffect(() => {
    let active = true;
    setPeerPreferences(null);
    setFollowingPeer(null);
    setIsActionsOpen(false);
    if (
      peerPublicId &&
      chat.activeConversation?.participantStatus !== "deleted"
    ) {
      void getPeerPreferences(peerPublicId)
        .then((value) => {
          if (active) setPeerPreferences(value);
        })
        .catch(() => undefined);
      void getSocialProfile(peerPublicId)
        .then((profile) => {
          if (active) setFollowingPeer(profile.campedByViewer);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [peerPublicId, chat.activeConversation?.participantStatus]);

  async function changePeerPreferences(changes: Partial<PeerPreferences>) {
    if (!peerPublicId) return;
    try {
      setPeerPreferences(await updatePeerPreferences(peerPublicId, changes));
      setIsActionsOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update contact settings.",
      );
    }
  }

  async function togglePeerFollow() {
    if (!peerPublicId) return;
    try {
      const result = await toggleSocialCamp(peerPublicId);
      setFollowingPeer(result.camped);
      setIsActionsOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update follow.",
      );
    }
  }

  async function saveName(publicId: string) {
    try {
      const next = nickname.trim();
      if (!next && !namesByPublicId[publicId]) {
        setIsNameOpen(false);
        return;
      }
      await updateContactNickname(publicId, next);
      setNamesByPublicId((current) => ({ ...current, [publicId]: next }));
      setIsNameOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save name.",
      );
    }
  }

  async function saveMessage() {
    if (!editingMessage || !messageDraft.trim()) return;
    try {
      await editChatMessage(
        editingMessage.conversationId,
        editingMessage.id,
        messageDraft.trim(),
      );
      setEditingMessage(null);
      await Promise.all([chat.refreshMessages(), chat.refreshConversations()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not edit message.",
      );
    }
  }

  async function removeMessage(message: ChatMessage) {
    setActionMessage(null);
    const approved = await confirm({
      title: "Delete message?",
      message:
        "This message will be removed from the conversation for both people.",
      confirmLabel: "Delete",
      isDangerous: true,
    });
    if (!approved) return;
    try {
      await deleteChatMessage(message.conversationId, message.id);
      await Promise.all([chat.refreshMessages(), chat.refreshConversations()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete message.",
      );
    }
  }

  async function removeConversation(conversation: ChatConversationSummary) {
    if (deletingConversationId) return;
    const approved = await confirm({
      title: "Delete conversation?",
      message:
        "This conversation will leave your list. It will appear again if either person sends a new message.",
      confirmLabel: "Delete",
      isDangerous: true,
    });
    if (!approved) return;
    setDeletingConversationId(conversation.conversationId);
    try {
      await chat.deleteConversation(conversation.conversationId);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete conversation.",
      );
    } finally {
      setDeletingConversationId(null);
    }
  }

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
      title: isCurrentlyOn
        ? "Disable Burn After Read?"
        : "Enable Burn After Read?",
      message: isCurrentlyOn
        ? "Messages will no longer burn 60 seconds after they are opened."
        : "Messages will burn 60 seconds after they are opened. Are you sure you want to enable this?",
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
      const message = document.getElementById(
        `chat-message-${chat.firstUnreadMessageId}`,
      );
      if (!message) return;
      didScrollToUnreadRef.current = chat.firstUnreadMessageId;
      message.scrollIntoView({ behavior: "instant", block: "center" });
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [chat.firstUnreadMessageId, chat.messages.length]);

  const participantDeleted =
    chat.activeConversation?.participantStatus === "deleted";
  const canSend =
    (chat.draft.trim().length > 0 || chat.attachments.length > 0) &&
    !chat.isSending &&
    !participantDeleted &&
    !peerPreferences?.blocked;

  const sendVoiceMessage = async () => {
    const recording = voiceRecorder.recording ?? (await voiceRecorder.stop());
    if (!recording) return;
    const sent = await chat.submitVoiceMessage(
      recording.file,
      recording.durationMs,
    );
    if (sent) voiceRecorder.discard();
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden border-x border-black/10 dark:border-night-border bg-[#D8D8D8] dark:bg-night-canvas shadow-2xl select-none">
      {isWindowBlurred ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-[#D8D8D8] dark:bg-night-canvas text-center text-black/50 dark:text-night-muted">
          <p className="font-bold">
            Screenshots and background capture prevented.
          </p>
        </div>
      ) : null}
      <UserHeaderPortal>
        <h1 className="mr-auto text-sm font-black lg:text-base">Chat</h1>
        <span className="hidden sm:inline-flex"><OnlineSignal /></span>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 rounded-md border border-black/10 dark:border-night-border bg-white/50 px-1">
            <button
              aria-label="Decrease font size"
              className="flex h-6 w-6 items-center justify-center rounded-sm bg-white dark:bg-night-surface text-lg font-black leading-none text-black dark:text-night-text hover:bg-gray-100"
              onClick={() => setFontSize((s) => Math.max(10, s - 2))}
              type="button"
            >
              -
            </button>
            <button
              aria-label="Increase font size"
              className="flex h-6 w-6 items-center justify-center rounded-sm bg-white dark:bg-night-surface text-lg font-black leading-none text-black dark:text-night-text hover:bg-gray-100"
              onClick={() => setFontSize((s) => Math.min(32, s + 2))}
              type="button"
            >
              +
            </button>
          </div>
          <button
            aria-label="Start a new private chat"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-night-border bg-white/70 dark:bg-night-surface text-2xl font-black text-[#111] dark:text-night-text"
            onClick={chat.openNewChat}
            type="button"
          >
            +
          </button>
        </div>
      </UserHeaderPortal>

      {chat.activeConversation ? (
        <div className="flex min-h-0 flex-1 flex-col px-2">
          <div className="flex h-12 gap-2 items-center border-b border-black/10 dark:border-night-border bg-[#D0D0D0] dark:bg-night-header p-1">
            <button
              aria-label="Back to conversations"
              className="flex h-10 w-10 items-center justify-center rounded-full text-3xl font-black text-[#111] dark:text-night-text"
              onClick={chat.closeConversation}
              type="button"
            >
              ‹
            </button>
            <div className="ml-1 grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#DDD] dark:bg-night-raised">
              {!participantDeleted && chat.participantAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={chat.participantAvatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound size={16} />
              )}
            </div>
            <button
              className="ml-2 min-w-0 flex-1 text-left"
              type="button"
              aria-label="Edit friend's name"
              onClick={() => {
                setNickname(
                  namesByPublicId[
                  chat.activeConversation!.participantPublicId
                  ] ?? "",
                );
                setIsNameOpen(true);
              }}
            >
              {/* <p className="text-[10px] font-bold text-black/45 dark:text-night-muted">{activeIsMarket ? 'MARKET CHAT' : 'PRIVATE CHAT'}</p> */}
              <p className="text-[10px] font-bold text-black/45 dark:text-night-muted">
                {activeIsMarket ? "Trading CHAT" : ""}
              </p>
              <p className="truncate font-mono text-[12px] font-black text-[#111] dark:text-night-text">
                {participantDeleted
                  ? "Deleted account"
                  : namesByPublicId[
                  chat.activeConversation.participantPublicId
                  ] ||
                  chat.participantDisplayName ||
                  shortId(chat.activeConversation.participantPublicId)}
              </p>
            </button>
            <div className="mr-1 flex shrink-0 items-center gap-1.5">
              <span className="text-[9px] font-black text-black/45 dark:text-night-muted">
                BLUR
              </span>
              <button
                aria-checked={blurMessages}
                aria-label={`Message blur ${blurMessages ? "on" : "off"}`}
                className={`relative h-5 w-9 rounded-full transition-colors ${blurMessages ? "bg-[#111]" : "bg-black/20"}`}
                onClick={() => setBlurMessages((current) => !current)}
                role="switch"
                type="button"
              >
                <span
                  className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white dark:bg-night-surface shadow-sm transition-transform ${blurMessages ? "translate-x-[18px]" : "translate-x-0.5"}`}
                />
              </button>
            </div>
            {!participantDeleted ? (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  data-admin-part="whisper.call"
                  aria-label="Call"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-base hover:bg-black/5"
                  disabled={peerPreferences?.blocked}
                  onClick={() =>
                    void callUser(
                      chat.activeConversation!.participantPublicId,
                      "audio",
                    )
                  }
                  type="button"
                >
                  📞
                </button>
                <button
                  data-admin-part="whisper.call"
                  aria-label="Video call"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-base hover:bg-black/5"
                  disabled={peerPreferences?.blocked}
                  onClick={() =>
                    void callUser(
                      chat.activeConversation!.participantPublicId,
                      "video",
                    )
                  }
                  type="button"
                >
                  🎥
                </button>
              </div>
            ) : null}
            {!participantDeleted ? (
              <div className="relative">
                <button
                  aria-label="Conversation options"
                  aria-expanded={isActionsOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-2xl font-black hover:bg-black/5"
                  onClick={() => setIsActionsOpen((value) => !value)}
                  type="button"
                >
                  ⋮
                </button>
                {isActionsOpen ? (
                  <>
                    <button
                      aria-label="Close conversation options"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setIsActionsOpen(false)}
                      type="button"
                    />
                    <div className="absolute right-0 top-10 z-20 w-60 rounded-2xl border border-black/10 dark:border-night-border bg-white dark:bg-night-surface p-2 shadow-xl">
                      <button
                        disabled={followingPeer === null}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-black/5 disabled:opacity-40"
                        onClick={() => void togglePeerFollow()}
                        type="button"
                      >
                        {followingPeer ? "Unfollow" : "Follow"}
                      </button>
                      <button
                        disabled={!peerPreferences}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-black/5 disabled:opacity-40"
                        onClick={() =>
                          void changePeerPreferences({
                            blocked: !peerPreferences?.blocked,
                          })
                        }
                        type="button"
                      >
                        {peerPreferences?.blocked ? "Unblock" : "Block"}
                      </button>
                      <button
                        disabled={!peerPreferences}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-black/5 disabled:opacity-40"
                        onClick={() =>
                          void changePeerPreferences({
                            allowAudioCalls: !peerPreferences?.allowAudioCalls,
                          })
                        }
                        type="button"
                      >
                        {peerPreferences?.allowAudioCalls === false
                          ? "Allow voice calls"
                          : "Block voice calls"}
                      </button>
                      <button
                        disabled={!peerPreferences}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-black/5 disabled:opacity-40"
                        onClick={() =>
                          void changePeerPreferences({
                            allowVideoCalls: !peerPreferences?.allowVideoCalls,
                          })
                        }
                        type="button"
                      >
                        {peerPreferences?.allowVideoCalls === false
                          ? "Allow video calls"
                          : "Block video calls"}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {chat.isLoadingMessages && chat.messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-xs font-semibold text-black/45 dark:text-night-muted">
              Loading messages…
            </div>
          ) : chat.messagesError && chat.messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-7">
              <p className="text-center text-sm font-bold text-[#C62828]">
                {chat.messagesError}
              </p>
              <button
                className="mt-4 h-11 rounded-full bg-white dark:bg-night-surface px-6 font-black"
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
                  className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 rounded-[14px] border border-[#C62828]/20 bg-white/95 dark:bg-night-surface px-3 py-2 shadow-sm"
                >
                  <p className="text-[11px] font-bold text-[#C62828]">
                    {chat.messagesError}
                  </p>
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
                  className="mb-3 h-9 w-full rounded-full bg-white/60 dark:bg-night-surface text-[11px] font-black text-black/50 dark:text-night-muted disabled:opacity-60"
                  disabled={chat.isLoadingOlderMessages}
                  onClick={() => void chat.loadOlderMessages()}
                  type="button"
                >
                  {chat.isLoadingOlderMessages
                    ? "Loading…"
                    : "Load earlier messages"}
                </button>
              ) : null}
              {chat.messages.length === 0 ? (
                <div className="flex h-full items-center justify-center px-7">
                  <p className="text-center text-[13px] font-semibold leading-5 text-black/45 dark:text-night-muted">
                    {activeIsMarket
                      ? "This Market conversation is empty. Send the first message."
                      : "This private conversation is empty. Send the first message."}
                  </p>
                </div>
              ) : (
                chat.messages.map((message) => {
                  const mine = message.senderPublicId === chat.userPublicId;
                  const secondsLeft =
                    message.burnStartedAtMs && message.expiresAtMs !== undefined
                      ? Math.max(
                        0,
                        Math.ceil((message.expiresAtMs - chat.nowMs) / 1_000),
                      )
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
                          <span className="h-px flex-1 bg-[#C62828]/40 dark:bg-night-softred" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#C62828]">
                            Unread
                          </span>
                          <span className="h-px flex-1 bg-[#C62828]/40 dark:bg-night-softred" />
                        </div>
                      ) : null}
                      <div
                        className={`chat-message-enter mb-3 flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`min-w-0 max-w-[78%] px-3 py-2 text-left ${mine
                            ? "rounded-[18px] rounded-br bg-[#79201D] dark:bg-night-outgoing dark:ring-2 dark:ring-[#C1282D]"
                            : "rounded-[18px] rounded-bl bg-[#29292B] dark:bg-night-incoming dark:ring-2 dark:ring-[#C1282D]"
                            }`}
                          onPointerDown={(event) => {
                            if (
                              !mine ||
                              event.button !== 0 ||
                              (event.target instanceof Element &&
                                event.target.closest(
                                  "button, a, input, audio, video",
                                ))
                            )
                              return;
                            cancelMessageHold();
                            holdStartRef.current = {
                              x: event.clientX,
                              y: event.clientY,
                            };
                            holdTimerRef.current = setTimeout(() => {
                              setActionMessage(message);
                              holdTimerRef.current = null;
                            }, 2000);
                          }}
                          onPointerMove={(event) => {
                            if (
                              holdStartRef.current &&
                              (Math.abs(
                                event.clientX - holdStartRef.current.x,
                              ) > 12 ||
                                Math.abs(
                                  event.clientY - holdStartRef.current.y,
                                ) > 12)
                            )
                              cancelMessageHold();
                          }}
                          onPointerUp={cancelMessageHold}
                          onPointerCancel={cancelMessageHold}
                          onPointerLeave={cancelMessageHold}
                          onContextMenu={(event) => {
                            if (mine) {
                              event.preventDefault();
                              cancelMessageHold();
                              setActionMessage(message);
                            }
                          }}
                          onClick={() =>
                            message.locked &&
                            void chat.openBurnMessage(message.id)
                          }
                          onKeyDown={(event) => {
                            if (
                              !message.locked ||
                              (event.key !== "Enter" && event.key !== " ")
                            )
                              return;
                            event.preventDefault();
                            void chat.openBurnMessage(message.id);
                          }}
                          role={message.locked ? "button" : undefined}
                          tabIndex={message.locked ? 0 : undefined}
                        >
                          {message.locked || message.content ? (
                            <p
                              aria-label={
                                !message.locked && blurMessages
                                  ? "Message hidden by blur"
                                  : undefined
                              }
                              className={`whitespace-pre-wrap font-bold text-white ${!message.locked && blurMessages ? "pointer-events-none select-none" : ""}`}
                              style={{
                                fontSize,
                                overflowWrap: "anywhere",
                                ...(!message.locked && blurMessages
                                  ? { filter: "blur(10px)" }
                                  : {}),
                              }}
                            >
                              {message.locked
                                ? `🔒 Click to open · burns in ${message.burnAfterReadSeconds}s`
                                : message.content}
                            </p>
                          ) : null}
                          {!message.locked && message.attachments?.length ? (
                            <div className="mt-2 flex flex-col gap-1">
                              {message.attachments.map((attachment) => (
                                <span
                                  className="block overflow-hidden rounded-[14px]"
                                  key={attachment.id}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MessageAttachment
                                    attachment={attachment}
                                    conversationId={message.conversationId}
                                    messageId={message.id}
                                  />
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <p className="mt-1 text-right text-[10px] font-bold text-white/75">
                            {message.burnAfterReadSeconds ? (
                              <span className="text-white">
                                {secondsLeft === null
                                  ? `🔥 Burn ${message.burnAfterReadSeconds}s · `
                                  : `🔥 ${secondsLeft}s · `}
                              </span>
                            ) : null}
                            {formatTime(message.createdAtMs)}
                            {message.editedAtMs ? " · edited" : null}
                            {deliveryLabel ? ` · ${deliveryLabel}` : null}
                          </p>
                          {mine ? (
                            <button
                              type="button"
                              className="mt-1 text-[10px] font-bold text-white"
                              onClick={() => setActionMessage(message)}
                            >
                              Options
                            </button>
                          ) : null}
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
            <p
              aria-live="polite"
              className="bg-[#D0D0D0] dark:bg-night-header px-4 pt-1 text-center text-[11px] font-bold text-[#C62828]"
            >
              {chat.sendError}
            </p>
          ) : null}

          {participantDeleted || peerPreferences?.blocked ? (
            <div className="shrink-0 border-t border-black/10 dark:border-night-border bg-[#D0D0D0] dark:bg-night-header px-4 py-3">
              <p className="text-center text-xs font-bold text-black/50 dark:text-night-muted">
                {participantDeleted
                  ? "This account was deleted. You can read retained messages, but cannot send new ones."
                  : "You blocked this account. Unblock it to send messages or call."}
              </p>
            </div>
          ) : (
            <div className="shrink-0 border-t border-black/10 dark:border-night-border bg-[#D0D0D0] dark:bg-night-header px-[10px] pb-1 pt-1.5">
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
                  {!activeIsMarket && (
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
                  )}
                </div>
                {voiceRecorder.isRecording ? (
                  <div className="flex min-h-11 flex-1 items-center gap-3 rounded-[22px] border border-[#C62828]/25 bg-white dark:bg-night-surface px-3 shadow-inner">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#C62828]" />
                    <span className="font-mono text-sm font-black text-[#C62828]">
                      {formatDuration(voiceRecorder.durationMs)}
                    </span>
                    <span
                      className="flex flex-1 items-center justify-center gap-1"
                      aria-hidden="true"
                    >
                      {waveform.slice(0, 11).map((height, index) => (
                        <span
                          className="w-1 animate-pulse rounded-full bg-[#C62828]/55 dark:bg-night-softred"
                          key={index}
                          style={{ height }}
                        />
                      ))}
                    </span>
                    <button
                      aria-label="Cancel recording"
                      className="grid h-8 w-8 place-items-center rounded-full text-black/45 dark:text-night-muted hover:bg-black/5"
                      onClick={voiceRecorder.cancel}
                      type="button"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ) : voiceRecorder.recording ? (
                  <div className="flex min-h-11 flex-1 items-center gap-2 rounded-[22px] border border-black/15 dark:border-night-border bg-white dark:bg-night-surface px-2">
                    <audio
                      className="h-8 min-w-0 flex-1"
                      controls
                      src={voiceRecorder.recording.previewUrl}
                    />
                    <span className="font-mono text-[11px] font-black text-black/45 dark:text-night-muted">
                      {formatDuration(voiceRecorder.recording.durationMs)}
                    </span>
                    <button
                      aria-label="Delete recording"
                      className="grid h-8 w-8 place-items-center rounded-full text-[#C62828] hover:bg-[#C62828]/10"
                      onClick={voiceRecorder.discard}
                      type="button"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ) : (
                  <div className="flex min-h-11 flex-1 items-center rounded-[22px] border border-black/15 dark:border-night-border bg-white dark:bg-night-surface px-1.5">
                    <textarea
                      aria-label="Message"
                      autoFocus
                      className="max-h-28 px-3 min-h-11 w-full resize-none bg-transparent pb-1.5 pt-2.5 text-[15px] text-[#111] dark:text-night-text outline-none"
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
                  <button
                    aria-label="Stop recording"
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#C62828] text-white shadow-md"
                    onClick={() => void voiceRecorder.stop()}
                    type="button"
                  >
                    <Square fill="currentColor" size={15} />
                  </button>
                ) : voiceRecorder.recording ? (
                  <button
                    aria-label="Send voice message"
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#111] text-white shadow-md disabled:opacity-50"
                    disabled={chat.isSending}
                    onClick={() => void sendVoiceMessage()}
                    type="button"
                  >
                    <Send size={18} />
                  </button>
                ) : chat.draft.trim() || chat.attachments.length ? (
                  <button
                    aria-label="Send"
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#9A9A9A] dark:bg-night-control text-white disabled:opacity-50"
                    disabled={!canSend}
                    onClick={() => void chat.submitMessage()}
                    type="button"
                  >
                    <Send size={18} />
                  </button>
                ) : (
                  <button
                    aria-label="Record a voice message"
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#111] text-white shadow-md transition hover:scale-105 disabled:opacity-50"
                    disabled={chat.isSending}
                    onClick={() => void voiceRecorder.start()}
                    type="button"
                  >
                    <Mic size={20} />
                  </button>
                )}
              </div>
              {voiceRecorder.error ? (
                <p
                  aria-live="polite"
                  className="pt-1 text-center text-[10px] font-bold text-[#C62828]"
                >
                  {voiceRecorder.error}
                </p>
              ) : null}
              {chat.attachments.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {chat.attachments.map((file, index) => (
                    <button
                      className="max-w-full rounded-full bg-white/70 dark:bg-night-surface px-2 py-1 text-left text-[10px] font-bold text-[#111] dark:text-night-text"
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
              <p className="pt-0.5 text-center text-[10px] font-bold leading-3 text-black/40 dark:text-night-muted">
                {activeIsMarket
                  ? "Market messages are removed after 30 days."
                  : "Regular private messages remain available here. They disappear from the phone after 2 hours."}{" "}
                screenshot NOT available
              </p>
            </div>
          )}
        </div>
      ) : (
        <ConversationList
          conversations={chat.conversations}
          initialKind={
            chat.conversations.find(
              (item) => item.conversationId === requestedConversationId,
            )?.kind ??
            (searchParams.get("kind") === "market" ? "market" : undefined)
          }
          namesByPublicId={namesByPublicId}
          error={chat.conversationsError}
          isLoading={chat.isLoadingConversations}
          onOpen={chat.openConversation}
          onDelete={(conversation) => void removeConversation(conversation)}
          deletingConversationId={deletingConversationId}
          onRefresh={() => void chat.refreshConversations()}
          onStart={chat.openNewChat}
        />
      )}

      {editingMessage ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5">
          <div className="w-full max-w-[400px] space-y-3 rounded-2xl bg-white dark:bg-night-surface p-5">
            <h2 className="text-lg font-black">Edit message</h2>
            <textarea
              value={messageDraft}
              maxLength={4000}
              onChange={(event) => setMessageDraft(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-black/15 dark:border-night-border p-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditingMessage(null)}
                className="flex-1 rounded-xl bg-[#ddd] dark:bg-night-raised p-3 font-bold"
              >
                Cancel
              </button>
              <button
                disabled={!messageDraft.trim()}
                onClick={() => void saveMessage()}
                className="flex-1 rounded-xl bg-black p-3 font-bold text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {actionMessage ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActionMessage(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Message options"
            className="w-full max-w-[360px] space-y-2 rounded-2xl bg-white dark:bg-night-surface p-5"
          >
            <h2 className="mb-3 text-lg font-black">Message options</h2>
            <button
              type="button"
              disabled={
                !!actionMessage.burnAfterReadSeconds ||
                !!actionMessage.attachments?.length ||
                actionMessage.type !== "text" ||
                !actionMessage.content
              }
              onClick={() => {
                setEditingMessage(actionMessage);
                setMessageDraft(actionMessage.content);
                setActionMessage(null);
              }}
              className="w-full rounded-xl bg-[#eee] dark:bg-night-surface p-3 font-bold disabled:opacity-40"
            >
              Edit
            </button>
            {actionMessage.burnAfterReadSeconds ||
              actionMessage.attachments?.length ||
              actionMessage.type !== "text" ||
              !actionMessage.content ? (
              <p className="text-center text-xs text-black/50 dark:text-night-muted">
                Only plain text messages can be edited.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void removeMessage(actionMessage)}
              className="w-full rounded-xl bg-[#C62828] p-3 font-bold text-white"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="w-full p-2 font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {isNameOpen && chat.activeConversation ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5">
          <div className="w-full max-w-[400px] space-y-3 rounded-2xl bg-white dark:bg-night-surface p-5">
            <h2 className="text-lg font-black">Friend's name</h2>
            <input
              value={nickname}
              maxLength={80}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Name shown only to you"
              className="w-full rounded-xl border border-black/15 dark:border-night-border p-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIsNameOpen(false)}
                className="flex-1 rounded-xl bg-[#ddd] dark:bg-night-raised p-3 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  void saveName(chat.activeConversation!.participantPublicId)
                }
                className="flex-1 rounded-xl bg-black p-3 font-bold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {chat.isNewChatOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
          <form
            className="w-full max-w-[360px] rounded-[24px] border border-white/60 dark:border-white/20 bg-[#D8D8D8] dark:bg-night-canvas p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void chat.submitNewChat();
            }}
          >
            <h2 className="text-lg font-black text-[#111] dark:text-night-text">
              New private chat
            </h2>
            <p className="mb-4 mt-1 text-xs font-semibold leading-5 text-black/55 dark:text-night-muted">
              Enter the other person&apos;s shareable 50-character Public ID.
            </p>
            <input
              aria-label="Participant Public ID"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-12 w-full rounded-[14px] border border-black/15 dark:border-night-border bg-white dark:bg-night-surface px-3 font-mono text-[13px] text-[#111] dark:text-night-text outline-none focus:border-[#9A9A9A]"
              disabled={chat.isStartingChat}
              maxLength={50}
              onChange={(event) =>
                chat.updateParticipantInput(event.target.value)
              }
              placeholder="Public ID"
              value={chat.participantInput}
            />
            {chat.participantError ? (
              <p
                aria-live="polite"
                className="mb-2 mt-1 text-xs font-semibold text-[#C62828]"
              >
                {chat.participantError}
              </p>
            ) : null}
            <p className="mb-4 mt-1 text-right text-[10px] font-bold text-black/40 dark:text-night-muted">
              {chat.participantInput.length}/50
            </p>
            <div className="flex gap-2">
              <button
                className="h-11 flex-1 rounded-full border border-black/15 dark:border-night-border bg-white dark:bg-night-surface font-bold text-[#111] dark:text-night-text"
                disabled={chat.isStartingChat}
                onClick={chat.closeNewChat}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-11 flex-1 rounded-full bg-[#9A9A9A] dark:bg-night-control font-black text-white disabled:opacity-50"
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
