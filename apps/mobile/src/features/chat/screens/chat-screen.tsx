import { PrivateChatScreenContent } from '@/features/chat/components/private-chat-screen-content';

type ChatScreenProps = Readonly<{
  initialConversationId?: string;
  initialKind?: 'private' | 'market';
  openRequestId?: string;
}>;

export function ChatScreen({ initialConversationId, initialKind, openRequestId }: ChatScreenProps) {
  return (
    <PrivateChatScreenContent
      initialConversationId={initialConversationId}
      initialKind={initialKind}
      openRequestId={openRequestId}
    />
  );
}
