import { useCallback, useEffect, useState } from 'react';

import { getBalance } from '@/api/mobile';
import type { Balance } from '@/domain/mobile/types';

export function useMobileBalance() {
  const [balance, setBalance] = useState<Balance | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBalance(await getBalance());
    } catch {
      // Non-critical: the dial pad just falls back to showing no balance yet.
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  return { balance, refresh };
}
