import { memo } from 'react';
import { Text, View } from 'react-native';

type ToastBannerProps = Readonly<{
  message: string | null;
}>;

function ToastBannerComponent({ message }: ToastBannerProps) {
  if (!message) return null;

  return (
    <View
      className="absolute bottom-8 left-5 right-5 items-center"
      pointerEvents="none"
      accessibilityLiveRegion="assertive"
    >
      <View className="max-w-[340px] rounded-full bg-black px-4 py-2">
        <Text className="text-center text-xs font-bold text-white">{message}</Text>
      </View>
    </View>
  );
}

export const ToastBanner = memo(ToastBannerComponent);
