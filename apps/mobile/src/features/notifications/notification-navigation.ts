import { router, type Href } from 'expo-router';
import { chatConversationHref } from '@/features/chat/navigation';

/** Allow only known app destinations; payloads never get arbitrary URL access. */
export function openNotificationPath(path: string): void {
  const post = /^\/posts\/(social|market)\/([a-f0-9-]{36})$/.exec(path);
  const profile = /^\/users\/([A-Za-z0-9]{50})$/.exec(path);
  const chat = /^\/chat\?conversationId=([a-f0-9]{64})$/.exec(path);
  if (post) router.push({ pathname: '/(app)/posts/[kind]/[postId]', params: { kind: post[1], postId: post[2] } } as Href);
  else if (profile) router.push({ pathname: '/(app)/users/[publicId]', params: { publicId: profile[1] } } as Href);
  else if (chat) router.push(chatConversationHref(chat[1]!));
  else if (path === '/mobile') router.push('/(app)/(tabs)/mobile');
  else if (path.startsWith('/reports') || path.startsWith('/client-desk')) router.push('/(app)/notifications?scope=admin' as Href);
  else router.push('/(app)/notifications' as Href);
}
