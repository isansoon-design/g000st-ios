import { useLocalSearchParams } from 'expo-router';

import { ChatScreen } from '@/features/chat/screens/chat-screen';

const CONVERSATION_ID_PATTERN = /^[a-f0-9]{64}$/;

export default function ChatRoute() {
  const { conversationId, kind, notificationRequestId } = useLocalSearchParams<{
    conversationId?: string;
    kind?: string;
    notificationRequestId?: string;
  }>();
  const initialConversationId =
    typeof conversationId === 'string' && CONVERSATION_ID_PATTERN.test(conversationId)
      ? conversationId
      : undefined;

  return (
    <ChatScreen
      initialConversationId={initialConversationId}
      initialKind={kind === 'market' ? 'market' : undefined}
      openRequestId={notificationRequestId}
    />
  );
}
