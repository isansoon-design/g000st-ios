import { memo } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { G000stWordmark } from '@/components/brand/g000st-wordmark';
import { FieldError } from '@/components/forms/field-error';
import { KeyboardAwareScroll } from '@/components/layout/keyboard-aware-scroll';
import type { BusyAction } from '@/features/auth/hooks/use-id-gate';
import type { IdGateErrors } from '@/features/auth/validation/id-validation';

type IdGateFormProps = Readonly<{
  busyAction: BusyAction;
  errors: IdGateErrors;
  onChangeRecoveryId: (value: string) => void;
  onLogin: () => void;
  onRegister: () => void;
  recoveryId: string;
}>;

function IdGateFormComponent({
  busyAction,
  errors,
  onChangeRecoveryId,
  onLogin,
  onRegister,
  recoveryId,
}: IdGateFormProps) {
  const isBusy = busyAction !== null;

  return (
    <KeyboardAwareScroll
      className="flex-1 bg-g000st-metal"
      contentContainerClassName="flex-grow justify-center px-[22px] py-6"
      keyboardShouldPersistTaps="handled"
      bottomOffset={20}
    >
      <View className="w-full max-w-[400px] self-center">
        <G000stWordmark className="mb-[10px] text-center text-[28px]" />

        <Text className="mb-[22px] text-center text-xs font-bold leading-[17px] text-g000st-muted">
          By downloading the app you are agreeing to our Terms &amp; Conditions and Privacy
          Policy.
        </Text>

        <TextInput
          accessibilityLabel="Account ID"
          autoCapitalize="none"
          autoCorrect={false}
          className={`h-[50px] w-full rounded-field bg-white px-[14px] font-extrabold text-g000st-red ${
            errors.recoveryId ? 'border-2 border-red-600' : 'border-2 border-g000st-red'
          }`}
          editable={!isBusy}
          maxLength={50}
          onChangeText={onChangeRecoveryId}
          onSubmitEditing={onLogin}
          placeholder="Enter your ID"
          placeholderTextColor="#C62828"
          returnKeyType="go"
          secureTextEntry
          testID="account-id-input"
          value={recoveryId}
        />
        <FieldError message={errors.recoveryId} />

        <Pressable
          accessibilityRole="button"
          className="mt-2 h-[50px] w-full items-center justify-center rounded-field bg-g000st-red active:opacity-80 disabled:opacity-60"
          disabled={isBusy}
          onPress={onLogin}
          testID="login-button"
        >
          {busyAction === 'restore' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="font-black text-white">Login</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          className="mt-3 h-[50px] w-full items-center justify-center rounded-field border-2 border-g000st-black active:opacity-70 disabled:opacity-60"
          disabled={isBusy}
          onPress={onRegister}
          testID="register-button"
        >
          <Text className="font-black text-g000st-black">Register</Text>
        </Pressable>
      </View>
    </KeyboardAwareScroll>
  );
}

export const IdGateForm = memo(IdGateFormComponent);
