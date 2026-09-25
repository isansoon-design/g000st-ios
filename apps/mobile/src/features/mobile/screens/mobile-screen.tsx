import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';

import { listBillingSkus } from '@/api/mobile';
import type { BillingSku } from '@/domain/mobile/types';
import { MobileScreenContent } from '@/features/mobile/components/mobile-screen-content';
import { useMobileBalance } from '@/features/mobile/hooks/use-mobile-balance';
import { useMobileCheckout } from '@/features/mobile/hooks/use-mobile-checkout';
import { useMobileDialer } from '@/features/mobile/hooks/use-mobile-dialer';
import { useMobileExternalCall } from '@/features/mobile/hooks/use-mobile-external-call';
import { useMobileSms } from '@/features/mobile/hooks/use-mobile-sms';

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;
const CHECKOUT_POLL_ATTEMPTS = 6;
const CHECKOUT_POLL_DELAY_MS = 2_000;

/** Accepts "+", the "00" international trunk prefix (common outside the US), or bare digits. */
function normalizeE164(input: string): string {
  const sanitized = input.replace(/[\s\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
  if (sanitized.startsWith('+')) return sanitized;
  if (sanitized.startsWith('00')) return `+${sanitized.slice(2)}`;
  return `+${sanitized}`;
}

export function MobileScreen() {
  const router = useRouter();
  const { checkout: checkoutResult } = useLocalSearchParams<{ checkout?: string }>();
  const dialer = useMobileDialer();
  const externalCall = useMobileExternalCall();
  const { balance, refresh: refreshBalance } = useMobileBalance();
  const sms = useMobileSms();
  const checkout = useMobileCheckout(refreshBalance);

  const [isSmsOpen, setIsSmsOpen] = useState(false);
  const [smsTo, setSmsTo] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [skus, setSkus] = useState<BillingSku[]>([]);
  const [skusLoading, setSkusLoading] = useState(false);
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const handledCheckoutResult = useRef<string | null>(null);

  useEffect(() => {
    if (checkoutResult !== 'success' && checkoutResult !== 'cancel') return;
    if (handledCheckoutResult.current === checkoutResult) return;
    handledCheckoutResult.current = checkoutResult;

    // Consume the callback once so it is not replayed when this tab is revisited.
    router.replace('/(app)/(tabs)/mobile');

    if (checkoutResult === 'cancel') {
      Toast.show({ text1: 'Purchase', text2: 'Checkout cancelled.', type: 'info' });
      return;
    }

    Toast.show({ text1: 'Purchase', text2: 'Payment received — confirming your balance…', type: 'success' });

    const confirmBalance = async () => {
      for (let attempt = 0; attempt < CHECKOUT_POLL_ATTEMPTS; attempt += 1) {
        if (await refreshBalance()) {
          Toast.show({ text1: 'Purchase', text2: 'Balance updated!', type: 'success' });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, CHECKOUT_POLL_DELAY_MS));
      }

      Toast.show({
        text1: 'Purchase',
        text2: "Still confirming — check back in a moment if the balance hasn't updated.",
        type: 'info',
      });
    };

    void confirmBalance();
  }, [checkoutResult, refreshBalance, router]);

  useEffect(() => {
    if (externalCall.status !== 'active') return;
    const interval = setInterval(() => setCallDurationSec((previous) => previous + 1), 1_000);
    return () => clearInterval(interval);
  }, [externalCall.status]);

  useEffect(() => {
    if (externalCall.status !== 'error' || !externalCall.errorText) return;
    Toast.show({
      text1: 'Call',
      text2:
        externalCall.errorCode === 'INSUFFICIENT_BALANCE'
          ? 'Not enough call credit — buy a bundle first'
          : externalCall.errorText,
      type: 'error',
    });
    externalCall.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCall.status]);

  const handleCall = useCallback(() => {
    if (!dialer.dialValue) {
      Toast.show({ text1: 'Call', text2: 'Enter a number first', type: 'error' });
      return;
    }
    const toE164 = normalizeE164(dialer.dialValue);
    if (!E164_PATTERN.test(toE164)) {
      Toast.show({ text1: 'Call', text2: 'Enter the full number with country code, e.g. 15551234567', type: 'error' });
      return;
    }
    setCallDurationSec(0);
    void externalCall.placeCall(toE164);
  }, [dialer.dialValue, externalCall]);

  const openSms = useCallback(() => {
    setSmsTo(dialer.dialValue ? normalizeE164(dialer.dialValue) : '');
    setSmsBody('');
    setIsSmsOpen(true);
  }, [dialer.dialValue]);

  const handleSend = useCallback(async () => {
    const sent = await sms.send(smsTo ? normalizeE164(smsTo) : smsTo, smsBody);
    if (sent) {
      setSmsBody('');
      await refreshBalance();
    }
  }, [refreshBalance, sms, smsBody, smsTo]);

  const loadSkus = useCallback(async () => {
    setSkusLoading(true);
    try {
      const fetchedSkus = await listBillingSkus();
      setSkus(fetchedSkus);
      if (fetchedSkus.length >= 3) {
        setSelectedSkuId(fetchedSkus[1].id);
      } else if (fetchedSkus.length > 0) {
        setSelectedSkuId(fetchedSkus[0].id);
      }
    } catch (error) {
      Toast.show({
        text1: 'Plans',
        text2: error instanceof Error ? error.message : 'Could not load bundles.',
        type: 'error',
      });
    } finally {
      setSkusLoading(false);
    }
  }, []);

  const openPlans = useCallback(() => {
    setIsPlansOpen(true);
    if (skus.length === 0) {
      void loadSkus();
    } else if (skus.length >= 3) {
      setSelectedSkuId(skus[1].id);
    } else if (skus.length > 0) {
      setSelectedSkuId(skus[0].id);
    }
  }, [loadSkus, skus]);

  const handleBuy = useCallback(async () => {
    if (!selectedSkuId) return;
    const completed = await checkout.buy(selectedSkuId);
    if (completed) setIsPlansOpen(false);
  }, [checkout, selectedSkuId]);

  const handlePressDigit = useCallback((digit: string) => {
    if (digit === '0' && (!balance || (balance.voiceSecondsRemaining === 0 && balance.smsRemaining === 0))) {
      Toast.show({ text1: 'Balance', text2: 'Please top up your balance.', type: 'error' });
      return;
    }
    dialer.pressDigit(digit);
  }, [balance, dialer]);

  return (
    <MobileScreenContent
      balance={balance}
      buying={checkout.starting}
      callDurationSec={callDurationSec}
      callStatus={externalCall.status}
      dialValue={dialer.dialValue}
      isCallActionDisabled={externalCall.status !== 'idle' && externalCall.status !== 'error'}
      isMuted={externalCall.isMuted}
      isPlansOpen={isPlansOpen}
      isSmsOpen={isSmsOpen}
      onBackspace={dialer.backspace}
      onBuy={handleBuy}
      onCall={handleCall}
      onCallClose={externalCall.reset}
      onChangeSmsBody={setSmsBody}
      onChangeSmsTo={setSmsTo}
      onClosePlans={() => setIsPlansOpen(false)}
      onCloseSms={() => setIsSmsOpen(false)}
      onHangUp={externalCall.hangup}
      onOpenPlans={openPlans}
      onOpenSms={openSms}
      onPressDigit={handlePressDigit}
      onSelectSku={setSelectedSkuId}
      onSend={() => void handleSend()}
      onToggleMute={externalCall.toggleMute}
      selectedSkuId={selectedSkuId}
      skus={skus}
      skusLoading={skusLoading}
      smsBody={smsBody}
      smsHistory={sms.history}
      smsHistoryLoading={sms.loading}
      smsSending={sms.sending}
      smsTo={smsTo}
    />
  );
}
