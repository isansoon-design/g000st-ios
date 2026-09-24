import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import Toast from 'react-native-toast-message';

import { createCheckoutSession } from '@/api/mobile';
import type { Balance } from '@/domain/mobile/types';

const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 2_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/**
 * `refreshBalance` is called after the browser returns — a successful redirect only means the
 * *browser* came back, not that the balance updated. The balance only becomes real once the
 * signature-verified Stripe webhook lands, which is often a moment behind but can just as
 * easily have already finished before this even runs — so the first successful fetch is trusted
 * outright rather than waiting for a detected change (there's no reliable "before" snapshot to
 * diff against anyway; see docs/API_CONTRACT_V1.md and the web equivalent's fix notes).
 */
export function useMobileCheckout(refreshBalance: () => Promise<Balance | null>) {
  const [starting, setStarting] = useState(false);

  const buy = useCallback(
    async (skuId: string) => {
      setStarting(true);
      try {
        const { checkoutUrl } = await createCheckoutSession(skuId);
        const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, 'g000st://checkout/success');

        if (result.type === 'success') {
          Toast.show({ text1: 'Purchase', text2: 'Payment received — confirming your balance…', type: 'success' });
          let confirmed = false;
          for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
            if (await refreshBalance()) {
              confirmed = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
          }
          Toast.show(
            confirmed
              ? { text1: 'Purchase', text2: 'Balance updated!', type: 'success' }
              : { text1: 'Purchase', text2: "Still confirming — check back in a moment if the balance hasn't updated.", type: 'info' },
          );
          return true;
        } else {
          await refreshBalance();
          return false;
        }
      } catch (error) {
        Toast.show({ text1: 'Checkout', text2: errorMessage(error), type: 'error' });
        return false;
      } finally {
        setStarting(false);
      }
    },
    [refreshBalance],
  );

  return { buy, starting };
}
