import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import Toast from 'react-native-toast-message';

import { createCheckoutSession } from '@/api/mobile';

const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 2_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/**
 * `refreshBalance` is called repeatedly after the browser returns — a successful redirect only
 * means the *browser* came back, not that the balance updated. The balance only becomes real
 * once the signature-verified Stripe webhook lands, which can be a moment behind (see
 * docs/API_CONTRACT_V1.md). Polling briefly catches that instead of trusting the redirect alone.
 */
export function useMobileCheckout(refreshBalance: () => Promise<void>) {
  const [starting, setStarting] = useState(false);

  const buy = useCallback(
    async (skuId: string) => {
      setStarting(true);
      try {
        const { checkoutUrl } = await createCheckoutSession(skuId);
        const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, 'g000st://checkout/success');

        if (result.type === 'success') {
          Toast.show({ text1: 'Purchase', text2: 'Payment received — confirming your balance…', type: 'success' });
          for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
            await refreshBalance();
          }
        } else {
          await refreshBalance();
        }
      } catch (error) {
        Toast.show({ text1: 'Checkout', text2: errorMessage(error), type: 'error' });
      } finally {
        setStarting(false);
      }
    },
    [refreshBalance],
  );

  return { buy, starting };
}
