import { PrivateChatScreenContent } from '@/features/chat/components/private-chat-screen-content';

type ChatScreenProps = Readonly<{
  initialConversationId?: string;
  openRequestId?: string;
}>;

export function ChatScreen({ initialConversationId, openRequestId }: ChatScreenProps) {
  return (
    <PrivateChatScreenContent
      initialConversationId={initialConversationId}
      openRequestId={openRequestId}
    />
  );
}
