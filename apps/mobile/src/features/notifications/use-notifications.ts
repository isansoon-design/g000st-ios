import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { listNotifications, type NotificationScope } from '@/api/notification-center';

export function useNotifications(scope: NotificationScope = 'user') {
  const { activePublicId, user, status } = useAuth();
  const publicId = scope === 'admin' ? user?.publicId : activePublicId;
  return useInfiniteQuery({
    queryKey: ['notifications', publicId, scope],
    enabled: status === 'authenticated' && !!publicId && (scope !== 'admin' || user?.role === 'admin'),
    queryFn: ({ pageParam }) => listNotifications(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
