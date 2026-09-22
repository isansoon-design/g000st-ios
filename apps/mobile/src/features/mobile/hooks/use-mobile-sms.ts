import { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';

import { listSms, sendSms } from '@/api/mobile';
import type { OutboundSms } from '@/domain/mobile/types';

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined;
}

export function useMobileSms() {
  const [history, setHistory] = useState<OutboundSms[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listSms();
      setHistory(page.items);
    } catch (error) {
      Toast.show({ text1: 'SMS', text2: errorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const send = useCallback(async (toE164: string, body: string): Promise<boolean> => {
    if (!E164_PATTERN.test(toE164)) {
      Toast.show({ text1: 'SMS', text2: 'Use full international format, e.g. +15551234567', type: 'error' });
      return false;
    }
    if (!body.trim()) {
      Toast.show({ text1: 'SMS', text2: 'Write a message first', type: 'error' });
      return false;
    }

    setSending(true);
    try {
      const message = await sendSms(toE164, body.trim());
      setHistory((current) => [message, ...current]);
      Toast.show({ text1: 'SMS', text2: 'Sent!', type: 'success' });
      return true;
    } catch (error) {
      const message =
        errorCode(error) === 'INSUFFICIENT_BALANCE'
          ? 'Not enough SMS credit — buy a bundle first'
          : errorMessage(error);
      Toast.show({ text1: 'SMS', text2: message, type: 'error' });
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  return { history, loading, load, send, sending };
}
