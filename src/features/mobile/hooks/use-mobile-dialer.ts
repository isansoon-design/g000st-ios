import { useCallback, useState } from 'react';

const MAX_DIAL_LENGTH = 24;

export function useMobileDialer() {
  const [dialValue, setDialValue] = useState('');

  const pressDigit = useCallback((digit: string) => {
    setDialValue((current) => `${current}${digit}`.slice(0, MAX_DIAL_LENGTH));
  }, []);

  const backspace = useCallback(() => {
    setDialValue((current) => current.slice(0, -1));
  }, []);

  return { backspace, dialValue, pressDigit };
}
