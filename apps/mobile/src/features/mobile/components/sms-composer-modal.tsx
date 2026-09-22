import { memo } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import type { OutboundSms } from '@/domain/mobile/types';

type SmsComposerModalProps = Readonly<{
  history: readonly OutboundSms[];
  historyLoading: boolean;
  isOpen: boolean;
  onChangeBody: (value: string) => void;
  onChangeTo: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
  smsBody: string;
  smsTo: string;
}>;

function SmsComposerModalComponent({
  history,
  historyLoading,
  isOpen,
  onChangeBody,
  onChangeTo,
  onClose,
  onSend,
  sending,
  smsBody,
  smsTo,
}: SmsComposerModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={isOpen}>
      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ alignItems: 'center', flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', flex: 1, paddingHorizontal: 20 }}
      >
        <View className="w-full max-w-[380px] rounded-[24px] border border-white/60 bg-[#D8D8D8] p-5">
          <Text className="mb-3 text-lg font-black text-g000st-black">SMS</Text>

          <TextInput
            accessibilityLabel="Recipient phone number"
            autoCapitalize="none"
            autoCorrect={false}
            className="mb-2 h-12 rounded-field border border-black/15 bg-white px-3 text-[15px] font-bold text-g000st-black"
            keyboardType="phone-pad"
            onChangeText={onChangeTo}
            placeholder="To: +15551234567"
            placeholderTextColor="#777777"
            value={smsTo}
          />
          <TextInput
            accessibilityLabel="Message body"
            className="mb-3 min-h-[90px] rounded-field border border-black/15 bg-white p-3 text-[14px] text-g000st-black"
            multiline
            onChangeText={onChangeBody}
            placeholder="Write your message"
            placeholderTextColor="#777777"
            textAlignVertical="top"
            value={smsBody}
          />

          <Pressable
            accessibilityRole="button"
            className={`mb-3 h-12 items-center justify-center rounded-full bg-g000st-silver ${sending ? 'opacity-50' : ''}`}
            disabled={sending}
            onPress={onSend}
          >
            <Text className="font-black text-white">{sending ? 'Sending…' : 'Send'}</Text>
          </Pressable>

          <ScrollView className="max-h-[160px] rounded-[16px] bg-black/5 p-3" nestedScrollEnabled>
            {historyLoading ? (
              <Text className="text-xs text-black/45">Loading…</Text>
            ) : history.length === 0 ? (
              <Text className="text-xs text-black/45">SMS log will appear here</Text>
            ) : (
              history.map((message) => (
                <Text className="mb-1.5 text-xs font-semibold text-g000st-black" key={message.id}>
                  → {message.toE164}: {message.body}{' '}
                  <Text className="text-[10px] font-bold text-black/45">[{message.status}]</Text>
                </Text>
              ))
            )}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            className="mt-3 h-11 items-center justify-center rounded-full border border-black/15 bg-white"
            onPress={onClose}
          >
            <Text className="font-bold text-g000st-black">Close</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}

export const SmsComposerModal = memo(SmsComposerModalComponent);
