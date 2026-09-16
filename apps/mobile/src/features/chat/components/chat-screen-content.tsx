import { memo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { G000stWordmark } from '@/components/brand/g000st-wordmark';
import { FeatureScreen } from '@/components/layout/feature-screen';

function OnlineSignal() {
  return (
    <View className="ml-1 h-3 flex-row items-end gap-0.5" accessibilityLabel="Online">
      <View className="h-1 w-[3px] rounded-sm bg-g000st-silver" />
      <View className="h-1.5 w-[3px] rounded-sm bg-g000st-silver" />
      <View className="h-[9px] w-[3px] rounded-sm bg-g000st-silver" />
      <View className="h-3 w-[3px] rounded-sm bg-g000st-silver" />
    </View>
  );
}

function ChatScreenContentComponent() {
  return (
    <FeatureScreen
      title={
        <View className="flex-row items-center">
          <G000stWordmark className="text-[15px]" />
          <OnlineSignal />
        </View>
      }
    >
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        <Pressable
          accessibilityRole="button"
          className="h-12 items-center justify-center border-[3px] border-black bg-[#D0D0D0]"
        >
          <Text className="text-lg font-black text-g000st-black">
            g<Text className="text-g000st-red">000</Text>st{' '}
            <Text className="text-g000st-red">S</Text>ocial
          </Text>
        </Pressable>

        <View className="grow items-center justify-center bg-[#D8D8D8] px-6">
          <Text className="text-center text-[13px] font-semibold text-black/45">
            Your private conversations will appear here.
          </Text>
        </View>

        <View className="border-t border-black/10 bg-[#D0D0D0] px-[10px] pb-1 pt-1.5">
          <View className="flex-row items-end gap-2">
            <Pressable
              accessibilityLabel="Attach"
              accessibilityRole="button"
              className="h-10 w-10 items-center justify-center rounded-full"
              disabled
            >
              <Text className="text-[28px] font-bold text-g000st-silver">+</Text>
            </Pressable>
            <View className="min-h-11 flex-1  justify-center rounded-[22px] border border-black/15 bg-white px-1.5">
              <TextInput
                className="px-2.5 pb-1.5 w-full min-h-11 pt-2.5 text-[15px] text-g000st-black"
                placeholder="Type a message"
                placeholderTextColor="#777777"
                onChange={() => { console.log('TextInput pressed'); }}
              />
            </View>
            <Pressable
              accessibilityLabel="Send"
              accessibilityRole="button"
              className="h-[42px] w-[42px] items-center justify-center rounded-full bg-g000st-silver opacity-60"
              disabled
            >
              <Text className="text-base font-black text-white">➤</Text>
            </Pressable>
          </View>
          <Text className="pt-0.5 text-center text-[10px] font-bold leading-3 text-black/40">
            Kept 2 hours · extra 5s burn if on · Screenshots possible
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </FeatureScreen>
  );
}

export const ChatScreenContent = memo(ChatScreenContentComponent);
