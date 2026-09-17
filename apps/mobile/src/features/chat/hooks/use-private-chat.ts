import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listChatConversations,
  listChatMessages,
  markChatConversationRead,
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

type ActiveConversation = Readonly<{
  conversationId: string;
  participantPublicId: string;
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function usePrivateChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [draft, setDraft] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
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
    mutationFn: ({ content, conversationId }: { content: string; conversationId: string }) =>
      sendChatTextMessage(conversationId, content),
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessagePage>(messagesKey(message.conversationId), (current) => {
        if (current?.messages.some((candidate) => candidate.id === message.id)) return current;
        return { ...current, messages: [...(current?.messages ?? []), message] };
      });
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
    },
  });

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
    sendMutation.reset();
  }, [sendMutation]);

  const closeConversation = useCallback(() => {
    setActiveConversation(null);
    setDraft('');
    sendMutation.reset();
  }, [sendMutation]);

  const updateDraft = useCallback((value: string) => {
    setDraft(value);
    sendMutation.reset();
  }, [sendMutation]);

  const submitMessage = useCallback(() => {
    const content = draft.trim();
    if (!activeConversation || !content || sendMutation.isPending) return;
    sendMutation.mutate({ content, conversationId: activeConversation.conversationId });
  }, [activeConversation, draft, sendMutation]);

  const closeNewChat = useCallback(() => {
    if (startMutation.isPending) return;
    setIsNewChatOpen(false);
    setParticipantInput('');
    setParticipantError(null);
    startMutation.reset();
  }, [startMutation]);

  return {
    activeConversation,
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
    isSending: sendMutation.isPending,
    isStartingChat: startMutation.isPending,
    messages: (messagesQuery.data?.messages ?? []) as readonly ChatMessage[],
    messagesError: messagesQuery.error ? errorMessage(messagesQuery.error) : null,
    openConversation,
    openNewChat: () => setIsNewChatOpen(true),
    participantError:
      participantError ?? (startMutation.error ? errorMessage(startMutation.error) : null),
    participantInput,
    refreshConversations: conversationsQuery.refetch,
    refreshMessages: messagesQuery.refetch,
    sendError: sendMutation.error ? errorMessage(sendMutation.error) : null,
    submitMessage,
    submitNewChat,
    updateDraft,
    updateParticipantInput,
    userPublicId: user?.publicId ?? '',
  };
}
