import { memo } from 'react';
import { Text } from 'react-native';

type G000stWordmarkProps = Readonly<{
  className?: string;
}>;

function G000stWordmarkComponent({ className = '' }: G000stWordmarkProps) {
  return (
    <Text className={`font-black text-g000st-black ${className}`} accessibilityRole="header">
      g<Text className="text-g000st-red">000</Text>st
    </Text>
  );
}

export const G000stWordmark = memo(G000stWordmarkComponent);
