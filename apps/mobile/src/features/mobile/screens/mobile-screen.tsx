import { useCallback, useEffect, useState } from 'react';
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

export function MobileScreen() {
  const dialer = useMobileDialer();
  const externalCall = useMobileExternalCall();
  const balance = useMobileBalance();
  const sms = useMobileSms();
  const checkout = useMobileCheckout(balance.refresh);

  const [isSmsOpen, setIsSmsOpen] = useState(false);
  const [smsTo, setSmsTo] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [skus, setSkus] = useState<BillingSku[]>([]);
  const [skusLoading, setSkusLoading] = useState(false);
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  const [callDurationSec, setCallDurationSec] = useState(0);

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
    const toE164 = dialer.dialValue.startsWith('+') ? dialer.dialValue : `+${dialer.dialValue}`;
    if (!E164_PATTERN.test(toE164)) {
      Toast.show({ text1: 'Call', text2: 'Enter the full number with country code, e.g. 15551234567', type: 'error' });
      return;
    }
    setCallDurationSec(0);
    void externalCall.placeCall(toE164);
  }, [dialer.dialValue, externalCall]);

  const openSms = useCallback(() => {
    setSmsTo(dialer.dialValue ? (dialer.dialValue.startsWith('+') ? dialer.dialValue : `+${dialer.dialValue}`) : '');
    setSmsBody('');
    setIsSmsOpen(true);
  }, [dialer.dialValue]);

  const handleSend = useCallback(async () => {
    const sent = await sms.send(smsTo, smsBody);
    if (sent) setSmsBody('');
  }, [sms, smsBody, smsTo]);

  const loadSkus = useCallback(async () => {
    setSkusLoading(true);
    try {
      setSkus(await listBillingSkus());
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
    if (skus.length === 0) void loadSkus();
  }, [loadSkus, skus.length]);

  const handleBuy = useCallback(() => {
    if (!selectedSkuId) return;
    void checkout.buy(selectedSkuId);
  }, [checkout, selectedSkuId]);

  return (
    <MobileScreenContent
      balance={balance.balance}
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
      onPressDigit={dialer.pressDigit}
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
