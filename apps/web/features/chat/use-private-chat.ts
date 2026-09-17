"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { sessionStorage } from "@/app/api/session-storage";
import {
  listChatConversations,
  listChatMessages,
  markChatConversationRead,
  sendChatTextMessage,
  startChatConversation,
} from "@/features/chat/api";
import type {
  ChatConversationSummary,
  ChatMessage,
} from "@/features/chat/types";

const PUBLIC_ID_LENGTH = 50;

type ActiveConversation = Readonly<{
  conversationId: string;
  participantPublicId: string;
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function usePrivateChat() {
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [conversations, setConversations] = useState<readonly ChatConversationSummary[]>([]);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
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
      setMessages(page.messages);
      setMessagesError(null);
    } catch (error) {
      setMessagesError(errorMessage(error));
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations(true);
    const interval = window.setInterval(() => void loadConversations(), 5_000);
    return () => window.clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      setMessagesError(null);
      return;
    }

    void loadMessages(activeConversation.conversationId, true);
    const interval = window.setInterval(
      () => void loadMessages(activeConversation.conversationId),
      3_000,
    );
    return () => window.clearInterval(interval);
  }, [activeConversation, loadMessages]);

  const activeSummary = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.conversationId === activeConversation?.conversationId,
      ),
    [activeConversation?.conversationId, conversations],
  );

  useEffect(() => {
    if (!activeConversation || !activeSummary?.unreadCount) return;
    const conversationId = activeConversation.conversationId;
    void markChatConversationRead(conversationId)
      .then(() =>
        setConversations((items) =>
          items.map((item) =>
            item.conversationId === conversationId ? { ...item, unreadCount: 0 } : item,
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
      setActiveConversation({ conversationId: conversation.id, participantPublicId });
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
    if (!activeConversation || !content || isSending) return;

    setIsSending(true);
    setSendError(null);
    try {
      const message = await sendChatTextMessage(activeConversation.conversationId, content);
      setMessages((items) =>
        items.some((item) => item.id === message.id) ? items : [...items, message],
      );
      setDraft("");
      await loadConversations();
    } catch (error) {
      setSendError(errorMessage(error));
    } finally {
      setIsSending(false);
    }
  }, [activeConversation, draft, isSending, loadConversations]);

  const openConversation = useCallback((conversation: ChatConversationSummary) => {
    setActiveConversation({
      conversationId: conversation.conversationId,
      participantPublicId: conversation.participantPublicId,
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
    closeConversation: () => setActiveConversation(null),
    closeNewChat,
    conversations,
    conversationsError,
    draft,
    isLoadingConversations,
    isLoadingMessages,
    isNewChatOpen,
    isSending,
    isStartingChat,
    messages,
    messagesError,
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
    updateDraft,
    updateParticipantInput,
    userPublicId,
  };
}
