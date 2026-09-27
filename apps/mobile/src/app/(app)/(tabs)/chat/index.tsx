import { useLocalSearchParams } from 'expo-router';

import { ChatScreen } from '@/features/chat/screens/chat-screen';

export default function ChatRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <ChatScreen initialKind={kind === 'market' ? 'market' : undefined} view="list" />;
}
