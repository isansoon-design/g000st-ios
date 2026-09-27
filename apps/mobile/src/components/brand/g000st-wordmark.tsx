import { memo } from 'react';
import { Text } from 'react-native';
import { useAppTheme } from '@/theme/app-theme';

type G000stWordmarkProps = Readonly<{
  className?: string;
  color?: string;
}>;

function G000stWordmarkComponent({ className = '', color }: G000stWordmarkProps) {
  const { colors } = useAppTheme();
  return (
    <Text className={`font-black ${className}`} style={{ color: color ?? colors.text }} accessibilityRole="header">
      g<Text className="text-g000st-red">000</Text>st
    </Text>
  );
}

export const G000stWordmark = memo(G000stWordmarkComponent);
