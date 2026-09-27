import { PrivateChatScreenContent } from '@/features/chat/components/private-chat-screen-content';

type ChatScreenProps = Readonly<{
  initialConversationId?: string;
  initialKind?: 'private' | 'market';
  openRequestId?: string;
  view: 'list' | 'conversation';
}>;

export function ChatScreen({ initialConversationId, initialKind, openRequestId, view }: ChatScreenProps) {
  return (
    <PrivateChatScreenContent
      initialConversationId={initialConversationId}
      initialKind={initialKind}
      openRequestId={openRequestId}
      view={view}
    />
  );
}
