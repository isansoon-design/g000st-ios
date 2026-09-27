import { memo } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';
import type { SavedAccount } from '@/services/session/saved-accounts';

import { G000stWordmark } from '@/components/brand/g000st-wordmark';
import { FieldError } from '@/components/forms/field-error';
import { KeyboardAwareScroll } from '@/components/layout/keyboard-aware-scroll';
import { AppThemeSwitch } from '@/components/navigation/app-theme-switch';
import type { BusyAction } from '@/features/auth/hooks/use-id-gate';
import type { IdGateErrors } from '@/features/auth/validation/id-validation';

type IdGateFormProps = Readonly<{
  accounts: SavedAccount[];
  busyAction: BusyAction;
  selectedId: string | null;
  onSelectAccount: (publicId: string) => void;
  onRemoveAccount: (publicId: string) => void;
  errors: IdGateErrors;
  onChangeRecoveryId: (value: string) => void;
  onLogin: () => void;
  onRegister: () => void;
  recoveryId: string;
}>;

function IdGateFormComponent({
  accounts,
  busyAction,
  selectedId,
  onSelectAccount,
  onRemoveAccount,
  errors,
  onChangeRecoveryId,
  onLogin,
  onRegister,
  recoveryId,
}: IdGateFormProps) {
  const isBusy = busyAction !== null || selectedId !== null;
  return (
    <KeyboardAwareScroll
      className="flex-1 bg-g000st-metal dark:bg-night-canvas"
      contentContainerClassName="flex-grow justify-center px-[22px] py-6"
      keyboardShouldPersistTaps="handled"
      bottomOffset={20}
    >
      <View className="absolute right-3 top-3 z-10"><AppThemeSwitch /></View>
      <View className="flex-1 w-full max-w-[400px] self-center justify-between pb-[20px]">
        <View className="justify-center flex-1">
          <G000stWordmark className="mb-[10px] text-center text-[28px]" />

          <Text className="mb-[22px] text-center text-xs font-bold leading-[17px] text-g000st-muted dark:text-night-muted">
            By downloading the app you are agreeing to our Terms &amp; Conditions and Privacy
            Policy.
          </Text>

          {accounts.length > 0 && (
            <View className="mb-6">
              <Text className="mb-2 text-sm font-black text-g000st-black dark:text-night-text">Saved accounts</Text>
              {accounts.map((account) => (
                <View key={account.publicId} className="mb-2 flex-row items-center rounded-xl bg-white dark:bg-night-surface p-2">
                  <Pressable accessibilityRole="button" accessibilityLabel={`Sign in as ${account.displayName || account.publicId.slice(0, 8)}`} disabled={isBusy} onPress={() => onSelectAccount(account.publicId)} className="min-w-0 flex-1 flex-row items-center">
                    {account.avatarUrl ? <Image source={{ uri: account.avatarUrl }} className="mr-3 h-10 w-10 rounded-full" /> : <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-g000st-red"><Text className="font-black text-white">{(account.displayName || account.publicId).slice(0, 1).toUpperCase()}</Text></View>}
                    <Text numberOfLines={1} className="flex-1 font-bold text-g000st-black dark:text-night-text">{account.displayName || account.publicId.slice(0, 8)}</Text>
                    {selectedId === account.publicId && <ActivityIndicator color="#C62828" />}
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove saved account ${account.displayName || account.publicId.slice(0, 8)}`} disabled={isBusy} onPress={() => onRemoveAccount(account.publicId)} className="px-3 py-2"><Text className="text-xs font-bold text-g000st-red">Remove</Text></Pressable>
                </View>
              ))}
            </View>
          )}

          <TextInput
            accessibilityLabel="Account ID"
            autoCapitalize="none"
            autoCorrect={false}
            className={`h-[50px] w-full rounded-field bg-white dark:bg-night-surface px-[14px] font-extrabold text-g000st-red ${errors.recoveryId ? 'border-2 border-red-600' : 'border-2 border-g000st-red'
              }`}
            editable={!isBusy}
            maxLength={50}
            onChangeText={onChangeRecoveryId}
            onSubmitEditing={onLogin}
            placeholder="Enter your ID"
            placeholderTextColor="#C62828"
            returnKeyType="go"
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
        </View>

        <Pressable
          accessibilityRole="button"
          className="mb-6 h-[50px] w-full items-center justify-center rounded-field border-2 border-g000st-black dark:border-night-border active:opacity-70 disabled:opacity-60"
          disabled={isBusy}
          onPress={onRegister}
          testID="register-button"
        >
          <Text className="font-black text-g000st-black dark:text-night-text">Register</Text>
        </Pressable>
      </View>
    </KeyboardAwareScroll>
  );
}

export const IdGateForm = memo(IdGateFormComponent);
