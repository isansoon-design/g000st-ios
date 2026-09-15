import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FeatureScreen } from '@/components/layout/feature-screen';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;

type MobileScreenContentProps = Readonly<{
  dialValue: string;
  onBackspace: () => void;
  onPressDigit: (digit: string) => void;
}>;

function MobileScreenContentComponent({
  dialValue,
  onBackspace,
  onPressDigit,
}: MobileScreenContentProps) {
  return (
    <FeatureScreen title="g000st Mobile">
      <View className="flex-1 px-5 py-4">
        <Text className="text-center text-[34px] font-black tracking-[2px] text-g000st-black">
          {dialValue || 'g000st'}
        </Text>
        <Text className="mt-1 text-center text-[10px] font-black tracking-[1px] text-black/45">
          PRIVATE NUMBER · NO RECORDING
        </Text>
        <Text className="mb-3 mt-1 text-center text-xs font-extrabold text-[#333333]">
          No credit
        </Text>

        <View className="mx-auto w-full max-w-[300px] flex-row flex-wrap justify-center gap-3">
          {DIAL_KEYS.map((digit) => (
            <Pressable
              accessibilityLabel={`Dial ${digit}`}
              accessibilityRole="button"
              className="h-[62px] w-[82px] items-center justify-center rounded-[20px] border border-black/15 bg-white active:bg-[#EEEEEE]"
              key={digit}
              onPress={() => onPressDigit(digit)}
            >
              <Text className="text-[24px] font-black text-g000st-black">{digit}</Text>
            </Pressable>
          ))}
        </View>

        <View className="mx-auto mt-5 w-full max-w-[300px] flex-row items-center justify-between">
          <Pressable className="h-12 flex-1 items-center justify-center rounded-full opacity-40" disabled>
            <Text className="font-black text-g000st-silver">SMS</Text>
          </Pressable>
          <Pressable className="mx-3 h-16 w-16 items-center justify-center rounded-full bg-g000st-silver opacity-50" disabled>
            <Text className="text-xs font-black text-white">CALL</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Delete digit"
            accessibilityRole="button"
            className="h-12 flex-1 items-center justify-center rounded-full active:bg-black/5"
            onPress={onBackspace}
          >
            <Text className="text-xl font-black text-g000st-black">⌫</Text>
          </Pressable>
        </View>

        <Text className="mt-5 text-center text-xs font-semibold text-black/45">
          Calls and SMS activate after the server telephony integration is connected.
        </Text>
      </View>
    </FeatureScreen>
  );
}

export const MobileScreenContent = memo(MobileScreenContentComponent);
