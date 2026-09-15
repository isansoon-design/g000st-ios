import { MobileScreenContent } from '@/features/mobile/components/mobile-screen-content';
import { useMobileDialer } from '@/features/mobile/hooks/use-mobile-dialer';

export function MobileScreen() {
  const dialer = useMobileDialer();

  return (
    <MobileScreenContent
      dialValue={dialer.dialValue}
      onBackspace={dialer.backspace}
      onPressDigit={dialer.pressDigit}
    />
  );
}
