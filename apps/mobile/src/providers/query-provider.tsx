import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useState } from 'react';

import { ApiError } from '@/api/api-error';

function canRetry(failureCount: number, error: Error): boolean {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return true;
  return !error.status || error.status >= 500;
}

export function QueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
