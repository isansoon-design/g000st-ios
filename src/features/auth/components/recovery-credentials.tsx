import { memo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { G000stWordmark } from '@/components/brand/g000st-wordmark';
import { KeyboardAwareScroll } from '@/components/layout/keyboard-aware-scroll';

type RecoveryCredentialsProps = Readonly<{
  isConfirming: boolean;
  onConfirm: () => void;
  onCopyPublicId: () => void;
  onCopyRecoveryId: () => void;
  publicId: string;
  recoveryId: string;
}>;

function RecoveryCredentialsComponent({
  isConfirming,
  onConfirm,
  onCopyPublicId,
  onCopyRecoveryId,
  publicId,
  recoveryId,
}: RecoveryCredentialsProps) {
  return (
    <KeyboardAwareScroll
      className="flex-1 bg-g000st-metal"
      contentContainerClassName="flex-grow justify-center px-[22px] py-8"
      keyboardShouldPersistTaps="handled"
      bottomOffset={20}
    >
      <View className="w-full max-w-[400px] self-center rounded-[22px] border border-white/70 bg-[#F2F2F2] p-5">
        <G000stWordmark className="mb-2 text-center text-[24px]" />
        <Text className="text-center text-lg font-black text-g000st-black">
          Save your Recovery ID
        </Text>
        <Text className="mb-5 mt-2 text-center text-xs font-semibold leading-[18px] text-g000st-muted">
          Your Public ID is safe to share. Your Recovery ID is private and is shown only now.
        </Text>

        <Text className="mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/50">
          Public ID · shareable
        </Text>
        <View className="mb-3 rounded-field border border-black/15 bg-white p-3">
          <Text selectable className="font-mono text-xs font-black leading-[18px] text-g000st-red">
            {publicId}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-3 h-9 items-center justify-center rounded-full border border-black/15 bg-g000st-metal active:opacity-70"
            onPress={onCopyPublicId}
          >
            <Text className="text-xs font-black text-g000st-black">Copy Public ID</Text>
          </Pressable>
        </View>

        <Text className="mb-1 text-[10px] font-black uppercase tracking-[1px] text-g000st-red">
          Recovery ID · private
        </Text>
        <View className="rounded-field border-2 border-g000st-red bg-white p-3">
          <Text selectable className="font-mono text-xs font-black leading-[18px] text-g000st-red">
            {recoveryId}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-3 h-10 items-center justify-center rounded-full bg-g000st-red active:opacity-80"
            onPress={onCopyRecoveryId}
          >
            <Text className="text-xs font-black text-white">Copy Recovery ID</Text>
          </Pressable>
        </View>

        <Text className="my-4 text-center text-xs font-bold leading-[17px] text-g000st-red">
          If you lose this Recovery ID, support cannot reveal it to you.
        </Text>

        <Pressable
          accessibilityRole="button"
          className="h-[50px] items-center justify-center rounded-field bg-g000st-black active:opacity-80 disabled:opacity-60"
          disabled={isConfirming}
          onPress={onConfirm}
          testID="confirm-recovery-button"
        >
          {isConfirming ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="font-black text-white">I saved it · Continue</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAwareScroll>
  );
}

export const RecoveryCredentials = memo(RecoveryCredentialsComponent);
