import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { File } from "expo-file-system";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  listChatConversations,
  listChatMessages,
  markChatConversationRead,
  openChatBurnMessage,
  sendChatMessage,
  startChatConversation,
} from "@/api/chat";
import { createChatAttachmentUpload, uploadChatAttachment } from "@/api/media";
import { getSocialProfile } from "@/api/social";
import type {
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
} from "@/domain/chat/types";
import { G000ST_ID_LENGTH } from "@/domain/identity/constants";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useChatAttachments } from "@/features/chat/hooks/use-chat-attachments";
import {
  chatConversationsQueryKey,
  chatMessagesQueryKey,
} from "@/features/chat/query-keys";
import {
  dismissConversationNotifications,
  focusConversationNotifications,
} from "@/services/notifications/chat-notification-presentation";

const MESSAGE_RETENTION_MS = 2 * 60 * 60 * 1_000;

type ActiveConversation = Readonly<{
  conversationId: string;
  firstUnreadMessageId?: string;
  participantPublicId: string;
  participantStatus: "active" | "deleted";
}>;

type MessagePages = InfiniteData<ChatMessagePage, string | undefined>;

export type OutboxMessage = ChatMessage &
  Readonly<{ status: "failed" | "pending" }>;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function appendServerMessage(
  current: MessagePages | undefined,
  message: ChatMessage,
): MessagePages {
  if (!current) {
    return { pageParams: [undefined], pages: [{ messages: [message] }] };
  }
  if (
    current.pages.some((page) =>
      page.messages.some((item) => item.id === message.id),
    )
  ) {
    return current;
  }

  const [newest = { messages: [] }, ...older] = current.pages;
  return {
    ...current,
    pages: [{ ...newest, messages: [...newest.messages, message] }, ...older],
  };
}

export function usePrivateChat(
  initialConversationId?: string,
  openRequestId?: string,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] =
    useState<ActiveConversation | null>(null);
  const [burnAfterRead, setBurnAfterRead] = useState(true);
  const [clockMs, setClockMs] = useState(Date.now);
  const [draft, setDraft] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [outbox, setOutbox] = useState<readonly OutboxMessage[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [attachmentUploadError, setAttachmentUploadError] = useState<
    string | null
  >(null);
  const chatAttachments = useChatAttachments();
  const handledOpenRequestRef = useRef<string | null>(null);

  const conversationsQuery = useQuery({
    queryKey: chatConversationsQueryKey,
    queryFn: listChatConversations,
    refetchInterval: 5_000,
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: chatMessagesQueryKey(activeConversation?.conversationId ?? "none"),
    queryFn: ({ pageParam }) =>
      listChatMessages(activeConversation!.conversationId, pageParam),
    enabled: activeConversation !== null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    refetchInterval: activeConversation ? 3_000 : false,
  });

  useFocusEffect(
    useCallback(() => {
      const conversationId = activeConversation?.conversationId;
      if (!conversationId) return;

      const removeConversationFocus =
        focusConversationNotifications(conversationId);
      void dismissConversationNotifications(conversationId).catch(
        () => undefined,
      );

      return removeConversationFocus;
    }, [activeConversation?.conversationId]),
  );

  useEffect(() => {
    if (!activeConversation) return;
    const timer = setInterval(() => setClockMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [activeConversation]);

  const participantPublicId = activeConversation?.participantPublicId;
  const participantProfileQuery = useQuery({
    enabled: !!participantPublicId && activeConversation?.participantStatus !== "deleted",
    queryFn: () => getSocialProfile(participantPublicId!),
    queryKey: ["social-profile", participantPublicId],
    staleTime: 5 * 60 * 1_000,
  });

  const startMutation = useMutation({
    mutationFn: startChatConversation,
    onSuccess: (conversation, participantPublicId) => {
      setClockMs(Date.now());
      setActiveConversation({
        conversationId: conversation.id,
        participantPublicId,
        participantStatus: "active",
      });
      setIsNewChatOpen(false);
      setParticipantInput("");
      setParticipantError(null);
      void queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
    },
  });

  const sendMutation = useMutation({
    mutationFn: ({
      burn,
      clientMessageId,
      content,
      conversationId,
      attachments,
    }: {
      attachments?: Parameters<typeof sendChatMessage>[4];
      burn: boolean;
      clientMessageId: string;
      content: string;
      conversationId: string;
    }) =>
      sendChatMessage(
        conversationId,
        content,
        clientMessageId,
        burn,
        attachments,
      ),
    onError: (_error, variables) => {
      setOutbox((current) =>
        current.map((item) =>
          item.clientMessageId === variables.clientMessageId
            ? { ...item, status: "failed" as const }
            : item,
        ),
      );
    },
    onSuccess: (message) => {
      queryClient.setQueryData<MessagePages>(
        chatMessagesQueryKey(message.conversationId),
        (current) => appendServerMessage(current, message),
      );
      setOutbox((current) =>
        current.filter(
          (item) => item.clientMessageId !== message.clientMessageId,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
    },
  });

  const openMutation = useMutation({
    mutationFn: ({
      conversationId,
      messageId,
    }: {
      conversationId: string;
      messageId: string;
    }) => openChatBurnMessage(conversationId, messageId),
    onError: (_error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: chatMessagesQueryKey(variables.conversationId),
      });
    },
    onSuccess: (message) => {
      queryClient.setQueryData<MessagePages>(
        chatMessagesQueryKey(message.conversationId),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              messages: page.messages.map((candidate) =>
                candidate.id === message.id ? message : candidate,
              ),
            })),
          };
        },
      );
      setClockMs(Date.now());
    },
  });

  const displayMessages = useMemo(() => {
    const unique = new Map<string, ChatMessage>();
    const pages = messagesQuery.data?.pages ?? [];
    for (const page of [...pages].reverse()) {
      for (const message of page.messages) {
        if (message.expiresAtMs > clockMs) unique.set(message.id, message);
      }
    }
    const serverMessages = [...unique.values()];
    const outstanding = outbox.filter(
      (item) => !serverMessages.some((message) => message.id === item.id),
    );
    return [...serverMessages, ...outstanding] as readonly (
      ChatMessage | OutboxMessage
    )[];
  }, [clockMs, messagesQuery.data?.pages, outbox]);

  const activeSummary = useMemo(
    () =>
      conversationsQuery.data?.find(
        (conversation) =>
          conversation.conversationId === activeConversation?.conversationId,
      ),
    [activeConversation?.conversationId, conversationsQuery.data],
  );

  useEffect(() => {
    const firstUnreadMessageId = activeConversation?.firstUnreadMessageId;
    if (
      !firstUnreadMessageId ||
      messagesQuery.isLoading ||
      messagesQuery.isFetchingNextPage ||
      displayMessages.some((message) => message.id === firstUnreadMessageId) ||
      !messagesQuery.hasNextPage
    ) {
      return;
    }
    void messagesQuery.fetchNextPage();
  }, [
    activeConversation?.firstUnreadMessageId,
    displayMessages,
    messagesQuery,
  ]);

  useEffect(() => {
    if (!activeConversation || !activeSummary?.unreadCount) return;

    let current = true;
    void markChatConversationRead(activeConversation.conversationId)
      .then(() => {
        if (!current) return;
        queryClient.setQueryData<readonly ChatConversationSummary[]>(
          chatConversationsQueryKey,
          (items) =>
            items?.map((item) =>
              item.conversationId === activeConversation.conversationId
                ? {
                    ...item,
                    firstUnreadCreatedAtMs: undefined,
                    firstUnreadMessageId: undefined,
                    unreadCount: 0,
                  }
                : item,
            ),
        );
      })
      .catch(() => undefined);

    return () => {
      current = false;
    };
  }, [activeConversation, activeSummary?.unreadCount, queryClient]);

  const updateParticipantInput = useCallback(
    (value: string) => {
      setParticipantInput(value.replace(/\s/g, ""));
      setParticipantError(null);
      startMutation.reset();
    },
    [startMutation],
  );

  const submitNewChat = useCallback(() => {
    const participantPublicId = participantInput.trim();

    if (
      participantPublicId.length !== G000ST_ID_LENGTH ||
      !/^[A-Za-z0-9]+$/.test(participantPublicId)
    ) {
      setParticipantError(
        `Enter a valid ${G000ST_ID_LENGTH}-character Public ID.`,
      );
      return;
    }
    if (participantPublicId === user?.publicId) {
      setParticipantError(
        "You cannot start a conversation with your own account.",
      );
      return;
    }

    startMutation.mutate(participantPublicId);
  }, [participantInput, startMutation, user?.publicId]);

  const openConversation = useCallback(
    (conversation: ChatConversationSummary) => {
      setClockMs(Date.now());
      setActiveConversation({
        conversationId: conversation.conversationId,
        ...(conversation.firstUnreadMessageId
          ? { firstUnreadMessageId: conversation.firstUnreadMessageId }
          : {}),
        participantPublicId: conversation.participantPublicId,
        participantStatus: conversation.participantStatus,
      });
      setDraft("");
      setOutbox([]);
      sendMutation.reset();
    },
    [sendMutation],
  );

  useEffect(() => {
    const openKey = openRequestId ?? initialConversationId;
    if (
      !initialConversationId ||
      !openKey ||
      handledOpenRequestRef.current === openKey
    ) {
      return;
    }
    const requested = conversationsQuery.data?.find(
      (conversation) => conversation.conversationId === initialConversationId,
    );
    if (!requested) return;

    handledOpenRequestRef.current = openKey;
    const timer = setTimeout(() => openConversation(requested), 0);
    return () => clearTimeout(timer);
  }, [
    conversationsQuery.data,
    initialConversationId,
    openConversation,
    openRequestId,
  ]);

  const closeConversation = useCallback(() => {
    setActiveConversation(null);
    setDraft("");
    setOutbox([]);
    sendMutation.reset();
  }, [sendMutation]);

  const updateDraft = useCallback((value: string) => {
    setDraft(value);
  }, []);

  const submitMessage = useCallback(async () => {
    const content = draft.trim();
    if (
      !activeConversation ||
      activeConversation.participantStatus === "deleted" ||
      (!content && chatAttachments.attachments.length === 0) ||
      !user?.publicId
    ) {
      return;
    }

    const nowMs = Date.now();
    const clientMessageId = randomUUID();
    setIsUploadingAttachments(true);
    setAttachmentUploadError(null);
    try {
      const attachments = await Promise.all(
        chatAttachments.attachments.map(async (attachment) => {
          const upload = await createChatAttachmentUpload({
            byteSize: attachment.byteSize,
            clientMessageId,
            contentType: attachment.contentType,
            conversationId: activeConversation.conversationId,
            fileName: attachment.fileName,
          });
          await uploadChatAttachment(attachment.localUri, upload);
          return upload.attachment;
        }),
      );
      setOutbox((current) => [
        ...current,
        {
          ...(burnAfterRead ? { burnAfterReadSeconds: 5 as const } : {}),
          clientMessageId,
          content,
          conversationId: activeConversation.conversationId,
          createdAtMs: nowMs,
          expiresAtMs: nowMs + MESSAGE_RETENTION_MS,
          id: clientMessageId,
          locked: false,
          senderPublicId: user.publicId,
          status: "pending",
          type: "text",
        },
      ]);
      setDraft("");
      chatAttachments.clearAttachments();
      sendMutation.mutate({
        ...(attachments.length ? { attachments } : {}),
        burn: burnAfterRead,
        clientMessageId,
        content,
        conversationId: activeConversation.conversationId,
      });
    } catch (error) {
      setAttachmentUploadError(errorMessage(error));
    } finally {
      setIsUploadingAttachments(false);
    }
  }, [
    activeConversation,
    burnAfterRead,
    chatAttachments,
    draft,
    sendMutation,
    user,
  ]);

  const submitVoiceMessage = useCallback(async (uri: string, durationMs: number) => {
    if (
      !activeConversation ||
      activeConversation.participantStatus === "deleted" ||
      !user?.publicId ||
      sendMutation.isPending ||
      isUploadingAttachments
    ) {
      return false;
    }

    const file = new File(uri);
    const byteSize = file.size ?? 0;
    if (!byteSize || byteSize > 5 * 1024 * 1024) {
      setAttachmentUploadError("Voice messages must be 5 MB or smaller.");
      return false;
    }

    const clientMessageId = randomUUID();
    setIsUploadingAttachments(true);
    setAttachmentUploadError(null);
    try {
      const upload = await createChatAttachmentUpload({
        byteSize,
        clientMessageId,
        contentType: "audio/mp4",
        conversationId: activeConversation.conversationId,
        durationMs,
        fileName: `voice-${Date.now()}.m4a`,
      });
      await uploadChatAttachment(uri, upload);
      await sendMutation.mutateAsync({
        attachments: [upload.attachment],
        burn: burnAfterRead,
        clientMessageId,
        content: "",
        conversationId: activeConversation.conversationId,
      });
      return true;
    } catch (error) {
      setAttachmentUploadError(errorMessage(error));
      return false;
    } finally {
      setIsUploadingAttachments(false);
    }
  }, [
    activeConversation,
    burnAfterRead,
    isUploadingAttachments,
    sendMutation,
    user?.publicId,
  ]);

  const retryMessage = useCallback(
    (clientMessageId: string) => {
      const failed = outbox.find(
        (item) =>
          item.clientMessageId === clientMessageId && item.status === "failed",
      );
      if (!failed || activeConversation?.participantStatus === "deleted")
        return;

      setOutbox((current) =>
        current.map((item) =>
          item.clientMessageId === clientMessageId
            ? { ...item, status: "pending" as const }
            : item,
        ),
      );
      sendMutation.mutate({
        burn: Boolean(failed.burnAfterReadSeconds),
        clientMessageId: failed.clientMessageId,
        content: failed.content,
        conversationId: failed.conversationId,
      });
    },
    [activeConversation?.participantStatus, outbox, sendMutation],
  );

  const openBurnMessage = useCallback(
    (messageId: string) => {
      if (!activeConversation || openMutation.isPending) return;
      openMutation.mutate({
        conversationId: activeConversation.conversationId,
        messageId,
      });
    },
    [activeConversation, openMutation],
  );

  const closeNewChat = useCallback(() => {
    if (startMutation.isPending) return;
    setIsNewChatOpen(false);
    setParticipantInput("");
    setParticipantError(null);
    startMutation.reset();
  }, [startMutation]);

  return {
    activeConversation,
    burnAfterRead,
    attachmentError: attachmentUploadError ?? chatAttachments.error,
    attachments: chatAttachments.attachments,
    captureAttachment: chatAttachments.captureWithCamera,
    discardAttachments: chatAttachments.clearAttachments,
    closeConversation,
    closeNewChat,
    conversations: conversationsQuery.data ?? [],
    conversationsError: conversationsQuery.error
      ? errorMessage(conversationsQuery.error)
      : null,
    draft,
    firstUnreadMessageId: activeConversation?.firstUnreadMessageId,
    hasOlderMessages: Boolean(messagesQuery.hasNextPage),
    isLoadingConversations: conversationsQuery.isLoading,
    isLoadingMessages: messagesQuery.isLoading,
    isLoadingOlderMessages: messagesQuery.isFetchingNextPage,
    isNewChatOpen,
    isSending: sendMutation.isPending || isUploadingAttachments,
    isStartingChat: startMutation.isPending,
    isUploadingAttachments,
    messages: displayMessages,
    messagesError: messagesQuery.error
      ? errorMessage(messagesQuery.error)
      : null,
    nowMs: clockMs,
    openBurnMessage,
    openConversation,
    participantAvatarUrl: participantProfileQuery.data?.avatarUrl,
    participantDisplayName: participantProfileQuery.data?.displayName,
    openNewChat: () => setIsNewChatOpen(true),
    pickDocumentAttachment: chatAttachments.pickDocument,
    pickLibraryAttachment: chatAttachments.pickFromLibrary,
    participantError:
      participantError ??
      (startMutation.error ? errorMessage(startMutation.error) : null),
    participantInput,
    refreshConversations: conversationsQuery.refetch,
    refreshMessages: messagesQuery.refetch,
    removeAttachment: chatAttachments.removeAttachment,
    retryMessage,
    setVoiceError: setAttachmentUploadError,
    submitMessage,
    submitVoiceMessage,
    submitNewChat,
    toggleBurnAfterRead: () => setBurnAfterRead((current) => !current),
    updateDraft,
    updateParticipantInput,
    userPublicId: user?.publicId ?? "",
    loadOlderMessages: messagesQuery.fetchNextPage,
  };
}
