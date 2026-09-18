"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { sessionStorage } from "@/app/api/session-storage";
import {
  listChatConversations,
  listChatMessages,
  markChatConversationRead,
  openChatBurnMessage,
  sendChatTextMessage,
  startChatConversation,
} from "@/features/chat/api";
import type { ChatConversationSummary, ChatMessage } from "@/features/chat/types";

const PUBLIC_ID_LENGTH = 50;

type ActiveConversation = Readonly<{
  conversationId: string;
  firstUnreadMessageId?: string;
  participantPublicId: string;
  participantStatus: "active" | "deleted";
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function mergeMessages(
  current: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
): readonly ChatMessage[] {
  const unique = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) unique.set(message.id, message);
  return [...unique.values()].sort(
    (left, right) => left.createdAtMs - right.createdAtMs || left.id.localeCompare(right.id),
  );
}

export function usePrivateChat() {
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [burnAfterRead, setBurnAfterRead] = useState(true);
  const [clockMs, setClockMs] = useState(Date.now);
  const [conversations, setConversations] = useState<readonly ChatConversationSummary[]>([]);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [participantInput, setParticipantInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const userPublicId = sessionStorage.get()?.user.publicId ?? "";

  const loadConversations = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoadingConversations(true);
    try {
      setConversations(await listChatConversations());
      setConversationsError(null);
    } catch (error) {
      setConversationsError(errorMessage(error));
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string, showLoader = false) => {
    if (showLoader) setIsLoadingMessages(true);
    try {
      const page = await listChatMessages(conversationId);
      setMessages((current) => (showLoader ? page.messages : mergeMessages(current, page.messages)));
      setNextCursor((current) => current ?? page.nextCursor);
      setMessagesError(null);
    } catch (error) {
      setMessagesError(errorMessage(error));
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!activeConversation || !nextCursor || isLoadingOlderMessages) return;
    setIsLoadingOlderMessages(true);
    try {
      const page = await listChatMessages(activeConversation.conversationId, nextCursor);
      setMessages((current) => mergeMessages(page.messages, current));
      setNextCursor(page.nextCursor);
      setMessagesError(null);
    } catch (error) {
      setMessagesError(errorMessage(error));
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [activeConversation, isLoadingOlderMessages, nextCursor]);

  useEffect(() => {
    void loadConversations(true);
    const interval = window.setInterval(() => void loadConversations(), 5_000);
    return () => window.clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      setMessagesError(null);
      setNextCursor(undefined);
      return;
    }

    const conversationId = activeConversation.conversationId;
    void loadMessages(conversationId, true);
    const interval = window.setInterval(() => void loadMessages(conversationId), 3_000);
    return () => window.clearInterval(interval);
  }, [activeConversation, loadMessages]);

  useEffect(() => {
    if (!activeConversation) return;
    const interval = window.setInterval(() => setClockMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [activeConversation]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.expiresAtMs > clockMs),
    [clockMs, messages],
  );

  const activeSummary = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.conversationId === activeConversation?.conversationId,
      ),
    [activeConversation?.conversationId, conversations],
  );

  useEffect(() => {
    const firstUnreadMessageId = activeConversation?.firstUnreadMessageId;
    if (
      !firstUnreadMessageId ||
      visibleMessages.some((message) => message.id === firstUnreadMessageId) ||
      !nextCursor ||
      isLoadingOlderMessages
    ) {
      return;
    }
    void loadOlderMessages();
  }, [
    activeConversation?.firstUnreadMessageId,
    isLoadingOlderMessages,
    loadOlderMessages,
    nextCursor,
    visibleMessages,
  ]);

  useEffect(() => {
    if (!activeConversation || !activeSummary?.unreadCount) return;
    const conversationId = activeConversation.conversationId;
    void markChatConversationRead(conversationId)
      .then(() =>
        setConversations((items) =>
          items.map((item) =>
            item.conversationId === conversationId
              ? {
                  ...item,
                  firstUnreadCreatedAtMs: undefined,
                  firstUnreadMessageId: undefined,
                  unreadCount: 0,
                }
              : item,
          ),
        ),
      )
      .catch(() => undefined);
  }, [activeConversation, activeSummary?.unreadCount]);

  const updateParticipantInput = useCallback((value: string) => {
    setParticipantInput(value.replace(/\s/g, ""));
    setParticipantError(null);
  }, []);

  const submitNewChat = useCallback(async () => {
    const participantPublicId = participantInput.trim();
    if (
      participantPublicId.length !== PUBLIC_ID_LENGTH ||
      !/^[A-Za-z0-9]+$/.test(participantPublicId)
    ) {
      setParticipantError(`Enter a valid ${PUBLIC_ID_LENGTH}-character Public ID.`);
      return;
    }
    if (participantPublicId === userPublicId) {
      setParticipantError("You cannot start a conversation with your own account.");
      return;
    }

    setIsStartingChat(true);
    try {
      const conversation = await startChatConversation(participantPublicId);
      setClockMs(Date.now());
      setActiveConversation({
        conversationId: conversation.id,
        participantPublicId,
        participantStatus: "active",
      });
      setIsNewChatOpen(false);
      setParticipantInput("");
      setParticipantError(null);
      await loadConversations();
    } catch (error) {
      setParticipantError(errorMessage(error));
    } finally {
      setIsStartingChat(false);
    }
  }, [loadConversations, participantInput, userPublicId]);

  const submitMessage = useCallback(async () => {
    const content = draft.trim();
    if (
      !activeConversation ||
      activeConversation.participantStatus === "deleted" ||
      !content ||
      isSending
    ) {
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      const message = await sendChatTextMessage(
        activeConversation.conversationId,
        content,
        burnAfterRead,
      );
      setMessages((items) => mergeMessages(items, [message]));
      setDraft("");
      await loadConversations();
    } catch (error) {
      setSendError(errorMessage(error));
    } finally {
      setIsSending(false);
    }
  }, [activeConversation, burnAfterRead, draft, isSending, loadConversations]);

  const openBurnMessage = useCallback(
    async (messageId: string) => {
      if (!activeConversation) return;
      try {
        const message = await openChatBurnMessage(activeConversation.conversationId, messageId);
        setMessages((items) => items.map((item) => (item.id === message.id ? message : item)));
        setClockMs(Date.now());
      } catch (error) {
        setMessagesError(errorMessage(error));
        await loadMessages(activeConversation.conversationId);
      }
    },
    [activeConversation, loadMessages],
  );

  const openConversation = useCallback((conversation: ChatConversationSummary) => {
    setClockMs(Date.now());
    setNextCursor(undefined);
    setActiveConversation({
      conversationId: conversation.conversationId,
      ...(conversation.firstUnreadMessageId
        ? { firstUnreadMessageId: conversation.firstUnreadMessageId }
        : {}),
      participantPublicId: conversation.participantPublicId,
      participantStatus: conversation.participantStatus,
    });
    setDraft("");
    setSendError(null);
  }, []);

  const updateDraft = useCallback((value: string) => {
    setDraft(value);
    setSendError(null);
  }, []);

  const closeNewChat = useCallback(() => {
    if (isStartingChat) return;
    setIsNewChatOpen(false);
    setParticipantInput("");
    setParticipantError(null);
  }, [isStartingChat]);

  return {
    activeConversation,
    burnAfterRead,
    closeConversation: () => setActiveConversation(null),
    closeNewChat,
    conversations,
    conversationsError,
    draft,
    firstUnreadMessageId: activeConversation?.firstUnreadMessageId,
    hasOlderMessages: Boolean(nextCursor),
    isLoadingConversations,
    isLoadingMessages,
    isLoadingOlderMessages,
    isNewChatOpen,
    isSending,
    isStartingChat,
    messages: visibleMessages,
    messagesError,
    loadOlderMessages,
    nowMs: clockMs,
    openBurnMessage,
    openConversation,
    openNewChat: () => setIsNewChatOpen(true),
    participantError,
    participantInput,
    refreshConversations: () => loadConversations(true),
    refreshMessages: () =>
      activeConversation ? loadMessages(activeConversation.conversationId, true) : Promise.resolve(),
    sendError,
    submitMessage,
    submitNewChat,
    toggleBurnAfterRead: () => setBurnAfterRead((current) => !current),
    updateDraft,
    updateParticipantInput,
    userPublicId,
  };
}
