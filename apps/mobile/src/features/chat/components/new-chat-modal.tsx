import { FieldError } from '@/components/forms/field-error';
import { G000ST_ID_LENGTH } from '@/domain/identity/constants';
import { memo } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useAppTheme } from '@/theme/app-theme';

type NewChatModalProps = Readonly<{
  error: string | null;
  isBusy: boolean;
  isOpen: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  value: string;
}>;

function NewChatModalComponent({
  error,
  isBusy,
  isOpen,
  onChange,
  onClose,
  onSubmit,
  value,
}: NewChatModalProps) {
  const { colors, isDark } = useAppTheme();
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={isOpen}
    >
      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ alignItems: 'center', flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', flex: 1, paddingHorizontal: 20 }}
      >
        <View className="w-full max-w-[360px] rounded-[24px] border border-white/60 dark:border-white/20 p-5" style={{ backgroundColor: isDark ? colors.toolbar : colors.canvas }}>
          <Text className="text-lg font-black" style={{ color: colors.text }}>New private chat</Text>
          <Text className="mb-4 mt-1 text-xs font-semibold leading-5" style={{ color: colors.muted }}>
            Enter the other person&apos;s shareable {G000ST_ID_LENGTH}-character Public ID.
          </Text>

          <TextInput
            accessibilityLabel="Participant Public ID"
            autoCapitalize="none"
            autoCorrect={false}
            className="h-12 rounded-field border border-black/15 dark:border-night-border bg-white dark:bg-night-surface px-3 font-mono text-[13px] text-g000st-black dark:text-night-text"
            editable={!isBusy}
            maxLength={G000ST_ID_LENGTH}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            placeholder="Public ID"
            placeholderTextColor={isDark ? '#C4C3C6' : '#777777'}
            returnKeyType="go"
            value={value}
          />
          <FieldError message={error ?? undefined} />

          <Text className="mb-4 text-right text-[10px] font-bold" style={{ color: colors.muted }}>
            {value.length}/{G000ST_ID_LENGTH}
          </Text>

          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-black/15 dark:border-night-border bg-white dark:bg-night-surface"
              disabled={isBusy}
              onPress={onClose}
            >
              <Text className="font-bold text-g000st-black dark:text-night-text">Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className={`h-11 flex-1 items-center justify-center rounded-full bg-g000st-silver dark:bg-night-control ${isBusy ? 'opacity-50' : ''}`}
              disabled={isBusy}
              onPress={onSubmit}
            >
              <Text className="font-black text-white">{isBusy ? 'Opening…' : 'Open chat'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}


export const NewChatModal = memo(NewChatModalComponent);
