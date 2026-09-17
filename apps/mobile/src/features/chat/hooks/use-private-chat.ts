import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listChatConversations,
  listChatMessages,
  markChatConversationRead,
  openChatBurnMessage,
  sendChatTextMessage,
  startChatConversation,
} from '@/api/chat';
import type {
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
} from '@/domain/chat/types';
import { G000ST_ID_LENGTH } from '@/domain/identity/constants';
import { useAuth } from '@/features/auth/hooks/use-auth';

const conversationsKey = ['chat', 'conversations'] as const;
const messagesKey = (conversationId: string) => ['chat', 'messages', conversationId] as const;
const MESSAGE_RETENTION_MS = 2 * 60 * 60 * 1_000;

type ActiveConversation = Readonly<{
  conversationId: string;
  participantPublicId: string;
}>;

export type OutboxMessage = ChatMessage & Readonly<{ status: 'failed' | 'pending' }>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function usePrivateChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [burnAfterRead, setBurnAfterRead] = useState(true);
  const [clockMs, setClockMs] = useState(Date.now);
  const [draft, setDraft] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [outbox, setOutbox] = useState<readonly OutboxMessage[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [participantError, setParticipantError] = useState<string | null>(null);

  const conversationsQuery = useQuery({
    queryKey: conversationsKey,
    queryFn: listChatConversations,
    refetchInterval: 5_000,
  });

  const messagesQuery = useQuery({
    queryKey: messagesKey(activeConversation?.conversationId ?? 'none'),
    queryFn: () => listChatMessages(activeConversation!.conversationId),
    enabled: activeConversation !== null,
    refetchInterval: activeConversation ? 3_000 : false,
  });

  useEffect(() => {
    if (!activeConversation) return;
    setClockMs(Date.now());
    const timer = setInterval(() => setClockMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [activeConversation]);

  const startMutation = useMutation({
    mutationFn: startChatConversation,
    onSuccess: (conversation, participantPublicId) => {
      setActiveConversation({ conversationId: conversation.id, participantPublicId });
      setIsNewChatOpen(false);
      setParticipantInput('');
      setParticipantError(null);
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
    },
  });

  const sendMutation = useMutation({
    mutationFn: ({
      burn,
      clientMessageId,
      content,
      conversationId,
    }: {
      burn: boolean;
      clientMessageId: string;
      content: string;
      conversationId: string;
    }) => sendChatTextMessage(conversationId, content, clientMessageId, burn),
    onError: (_error, variables) => {
      setOutbox((current) =>
        current.map((item) =>
          item.clientMessageId === variables.clientMessageId
            ? { ...item, status: 'failed' as const }
            : item,
        ),
      );
    },
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessagePage>(messagesKey(message.conversationId), (current) => {
        if (current?.messages.some((candidate) => candidate.id === message.id)) return current;
        return { ...current, messages: [...(current?.messages ?? []), message] };
      });
      setOutbox((current) =>
        current.filter((item) => item.clientMessageId !== message.clientMessageId),
      );
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
    },
  });

  const openMutation = useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      openChatBurnMessage(conversationId, messageId),
    onError: (_error, variables) => {
      void queryClient.invalidateQueries({ queryKey: messagesKey(variables.conversationId) });
    },
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessagePage>(messagesKey(message.conversationId), (current) => ({
        ...current,
        messages: (current?.messages ?? []).map((candidate) =>
          candidate.id === message.id ? message : candidate,
        ),
      }));
      setClockMs(Date.now());
    },
  });

  const displayMessages = useMemo(() => {
    const serverMessages = (messagesQuery.data?.messages ?? []).filter(
      (message) => message.expiresAtMs > clockMs,
    );
    const outstanding = outbox.filter(
      (item) => !serverMessages.some((message) => message.id === item.id),
    );
    return [...serverMessages, ...outstanding] as readonly (ChatMessage | OutboxMessage)[];
  }, [clockMs, messagesQuery.data, outbox]);

  const activeSummary = useMemo(
    () =>
      conversationsQuery.data?.find(
        (conversation) => conversation.conversationId === activeConversation?.conversationId,
      ),
    [activeConversation?.conversationId, conversationsQuery.data],
  );

  useEffect(() => {
    if (!activeConversation || !activeSummary?.unreadCount) return;

    let current = true;
    void markChatConversationRead(activeConversation.conversationId)
      .then(() => {
        if (!current) return;
        queryClient.setQueryData<readonly ChatConversationSummary[]>(conversationsKey, (items) =>
          items?.map((item) =>
            item.conversationId === activeConversation.conversationId
              ? { ...item, unreadCount: 0 }
              : item,
          ),
        );
      })
      .catch(() => undefined);

    return () => {
      current = false;
    };
  }, [activeConversation, activeSummary?.unreadCount, queryClient]);

  const updateParticipantInput = useCallback((value: string) => {
    setParticipantInput(value.replace(/\s/g, ''));
    setParticipantError(null);
    startMutation.reset();
  }, [startMutation]);

  const submitNewChat = useCallback(() => {
    const participantPublicId = participantInput.trim();

    if (participantPublicId.length !== G000ST_ID_LENGTH || !/^[A-Za-z0-9]+$/.test(participantPublicId)) {
      setParticipantError(`Enter a valid ${G000ST_ID_LENGTH}-character Public ID.`);
      return;
    }
    if (participantPublicId === user?.publicId) {
      setParticipantError('You cannot start a conversation with your own account.');
      return;
    }

    startMutation.mutate(participantPublicId);
  }, [participantInput, startMutation, user?.publicId]);

  const openConversation = useCallback((conversation: ChatConversationSummary) => {
    setActiveConversation({
      conversationId: conversation.conversationId,
      participantPublicId: conversation.participantPublicId,
    });
    setDraft('');
    setOutbox([]);
    sendMutation.reset();
  }, [sendMutation]);

  const closeConversation = useCallback(() => {
    setActiveConversation(null);
    setDraft('');
    setOutbox([]);
    sendMutation.reset();
  }, [sendMutation]);

  const updateDraft = useCallback((value: string) => {
    setDraft(value);
  }, []);

  const submitMessage = useCallback(() => {
    const content = draft.trim();
    if (!activeConversation || !content || !user?.publicId) return;

    const nowMs = Date.now();
    const clientMessageId = randomUUID();
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
        status: 'pending',
        type: 'text',
      },
    ]);
    setDraft('');
    sendMutation.mutate({
      burn: burnAfterRead,
      clientMessageId,
      content,
      conversationId: activeConversation.conversationId,
    });
  }, [activeConversation, burnAfterRead, draft, sendMutation, user]);

  const retryMessage = useCallback(
    (clientMessageId: string) => {
      const failed = outbox.find(
        (item) => item.clientMessageId === clientMessageId && item.status === 'failed',
      );
      if (!failed) return;

      setOutbox((current) =>
        current.map((item) =>
          item.clientMessageId === clientMessageId ? { ...item, status: 'pending' as const } : item,
        ),
      );
      sendMutation.mutate({
        burn: Boolean(failed.burnAfterReadSeconds),
        clientMessageId: failed.clientMessageId,
        content: failed.content,
        conversationId: failed.conversationId,
      });
    },
    [outbox, sendMutation],
  );

  const openBurnMessage = useCallback(
    (messageId: string) => {
      if (!activeConversation || openMutation.isPending) return;
      openMutation.mutate({ conversationId: activeConversation.conversationId, messageId });
    },
    [activeConversation, openMutation],
  );

  const closeNewChat = useCallback(() => {
    if (startMutation.isPending) return;
    setIsNewChatOpen(false);
    setParticipantInput('');
    setParticipantError(null);
    startMutation.reset();
  }, [startMutation]);

  return {
    activeConversation,
    burnAfterRead,
    closeConversation,
    closeNewChat,
    conversations: conversationsQuery.data ?? [],
    conversationsError: conversationsQuery.error
      ? errorMessage(conversationsQuery.error)
      : null,
    draft,
    isLoadingConversations: conversationsQuery.isLoading,
    isLoadingMessages: messagesQuery.isLoading,
    isNewChatOpen,
    isStartingChat: startMutation.isPending,
    messages: displayMessages,
    messagesError: messagesQuery.error ? errorMessage(messagesQuery.error) : null,
    nowMs: clockMs,
    openBurnMessage,
    openConversation,
    openNewChat: () => setIsNewChatOpen(true),
    participantError:
      participantError ?? (startMutation.error ? errorMessage(startMutation.error) : null),
    participantInput,
    refreshConversations: conversationsQuery.refetch,
    refreshMessages: messagesQuery.refetch,
    retryMessage,
    submitMessage,
    submitNewChat,
    toggleBurnAfterRead: () => setBurnAfterRead((current) => !current),
    updateDraft,
    updateParticipantInput,
    userPublicId: user?.publicId ?? '',
  };
}
