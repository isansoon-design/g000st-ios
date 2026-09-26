import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/api-error';
import { subscribeToSessionChanged } from '@/services/session/session-events';

function canRetry(failureCount: number, error: Error): boolean {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return true;
  return !error.status || error.status >= 500;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        retry: canRetry,
        staleTime: 30_000,
      },
      mutations: {
        networkMode: 'online',
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: PropsWithChildren) {
  const [cache, setCache] = useState(() => ({ client: createQueryClient(), generation: 0 }));
  const clientRef = useRef(cache.client);

  useEffect(() => subscribeToSessionChanged(() => {
    clientRef.current.clear();
    const client = createQueryClient();
    clientRef.current = client;
    setCache((previous) => ({ client, generation: previous.generation + 1 }));
  }), []);

  return <QueryClientProvider client={cache.client} key={cache.generation}>{children}</QueryClientProvider>;
}
