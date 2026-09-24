import { memo } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { G000stWordmark } from '@/components/brand/g000st-wordmark';
import type { RegistrationModalStage } from '@/features/auth/hooks/use-id-gate';

type RegistrationModalProps = Readonly<{
  createdRecoveryId: string | null;
  isCreating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onCopy: () => void;
  onLoginWithId: () => void;
  stage: RegistrationModalStage;
}>;

function RegistrationModalComponent({
  createdRecoveryId,
  isCreating,
  onCancel,
  onConfirm,
  onCopy,
  onLoginWithId,
  stage,
}: RegistrationModalProps) {
  const isConfirming = stage === 'confirm';

  return (
    <Modal
      animationType="fade"
      onRequestClose={isConfirming ? onCancel : () => undefined}
      statusBarTranslucent
      transparent
      visible={stage !== 'closed'}
    >
      <View
        accessibilityViewIsModal
        className="flex-1 items-center justify-center bg-black/60 px-4"
      >
        <View className="w-full max-w-[400px] rounded-[22px] border border-white/70 bg-[#F2F2F2] p-5">
          <G000stWordmark className="mb-2 text-center text-[24px]" />

          {isConfirming ? (
            <>
              <Text className="text-center text-lg font-black text-g000st-black">
                Create a new account
              </Text>
              <View className="flex-row gap-3">
                <Pressable
                  accessibilityRole="button"
                  className="h-12 flex-1 items-center justify-center rounded-field border-2 border-g000st-black active:opacity-70 disabled:opacity-60"
                  disabled={isCreating}
                  onPress={onCancel}
                >
                  <Text className="font-black text-g000st-black">Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  className="h-12 flex-1 items-center justify-center rounded-field bg-g000st-red active:opacity-80 disabled:opacity-60"
                  disabled={isCreating}
                  onPress={onConfirm}
                  testID="confirm-registration-button"
                >
                  {isCreating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="font-black text-white">Create</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text className="text-center text-lg font-black text-g000st-black">
                Your new account ID
              </Text>
              <Text className="mb-4 mt-2 text-center text-xs font-semibold leading-[18px] text-g000st-muted">
                Copy this ID now and keep it private. You will use it to log in.
              </Text>
              <View className="h-[50px] flex-row overflow-hidden rounded-field border-2 border-g000st-red bg-white">
                <TextInput
                  accessibilityLabel="New account ID"
                  className="min-w-0 flex-1 bg-white px-3 font-mono text-xs font-black text-g000st-red"
                  editable={false}
                  value={createdRecoveryId ?? ''}
                />
                <Pressable
                  accessibilityLabel="Copy new account ID"
                  accessibilityRole="button"
                  className="w-[70px] items-center justify-center bg-g000st-red active:opacity-80"
                  onPress={onCopy}
                  testID="copy-created-id-button"
                >
                  <Text className="text-xs font-black text-white">Copy</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                className="mt-3 h-12 w-full items-center justify-center rounded-field bg-g000st-red active:opacity-80 disabled:opacity-60"
                onPress={onLoginWithId}
              >
                <Text className="font-black text-white">Login</Text>
              </Pressable>
              <Text className="mt-4 text-center text-xs font-bold leading-[17px] text-g000st-red">
                If you lose this ID, support cannot reveal it to you.
              </Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export const RegistrationModal = memo(RegistrationModalComponent);
