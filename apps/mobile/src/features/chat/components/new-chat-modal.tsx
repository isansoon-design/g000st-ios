import { FieldError } from '@/components/forms/field-error';
import { G000ST_ID_LENGTH } from '@/domain/identity/constants';
import { memo } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

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
        <View className="w-full max-w-[360px] rounded-[24px] border border-white/60 bg-[#D8D8D8] p-5">
          <Text className="text-lg font-black text-g000st-black">New private chat</Text>
          <Text className="mb-4 mt-1 text-xs font-semibold leading-5 text-black/55">
            Enter the other person&apos;s shareable {G000ST_ID_LENGTH}-character Public ID.
          </Text>

          <TextInput
            accessibilityLabel="Participant Public ID"
            autoCapitalize="none"
            autoCorrect={false}
            className="h-12 rounded-field border border-black/15 bg-white px-3 font-mono text-[13px] text-g000st-black"
            editable={!isBusy}
            maxLength={G000ST_ID_LENGTH}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            placeholder="Public ID"
            placeholderTextColor="#777777"
            returnKeyType="go"
            value={value}
          />
          <FieldError message={error ?? undefined} />

          <Text className="mb-4 text-right text-[10px] font-bold text-black/40">
            {value.length}/{G000ST_ID_LENGTH}
          </Text>

          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-black/15 bg-white"
              disabled={isBusy}
              onPress={onClose}
            >
              <Text className="font-bold text-g000st-black">Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className={`h-11 flex-1 items-center justify-center rounded-full bg-g000st-silver ${isBusy ? 'opacity-50' : ''}`}
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