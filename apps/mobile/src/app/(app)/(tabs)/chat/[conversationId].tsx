import { useLocalSearchParams } from 'expo-router';

import { ChatScreen } from '@/features/chat/screens/chat-screen';

export default function ChatConversationRoute() {
  const { conversationId, notificationRequestId } = useLocalSearchParams<{
    conversationId: string;
    notificationRequestId?: string;
  }>();

  return (
    <ChatScreen
      initialConversationId={conversationId}
      openRequestId={notificationRequestId}
      view="conversation"
    />
  );
}
