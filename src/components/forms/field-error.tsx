import { memo } from 'react';
import { Text, View } from 'react-native';

type FieldErrorProps = Readonly<{
  message?: string;
}>;

function FieldErrorComponent({ message }: FieldErrorProps) {
  if (!message) return null;

  return (
    <View className="mb-2 mt-1 flex-row items-center gap-1" accessibilityLiveRegion="polite">
      <View className="h-3.5 w-3.5 items-center justify-center rounded-full bg-g000st-red">
        <Text className="text-[9px] font-black leading-[11px] text-white">!</Text>
      </View>
      <Text className="flex-1 text-xs font-semibold text-g000st-red">{message}</Text>
    </View>
  );
}

export const FieldError = memo(FieldErrorComponent);
