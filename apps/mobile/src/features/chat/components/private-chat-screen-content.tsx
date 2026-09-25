import { useFocusEffect, useNavigation } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { editChatMessage } from '@/api/chat';
import { addContact, listContacts, updateContactNickname } from '@/api/contacts';
import { G000stWordmark } from '@/components/brand/g000st-wordmark';
import { FeatureScreen } from '@/components/layout/feature-screen';
import type { ChatMessage } from '@/domain/chat/types';
import { useCalling } from '@/features/calling/hooks/use-calling';
import { AttachmentPreviewModal } from '@/features/chat/components/attachment-preview-modal';
import { ChatConversationList } from '@/features/chat/components/chat-conversation-list';
import { ChatThread } from '@/features/chat/components/chat-thread';
import { NewChatModal } from '@/features/chat/components/new-chat-modal';
import { usePrivateChat } from '@/features/chat/hooks/use-private-chat';
import Toast from 'react-native-toast-message';

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

type PrivateChatScreenContentProps = Readonly<{
  initialConversationId?: string;
  openRequestId?: string;
}>;

function PrivateChatScreenContentComponent({
  initialConversationId,
  openRequestId,
}: PrivateChatScreenContentProps) {
  const chat = usePrivateChat(initialConversationId, openRequestId);
  const { callUser } = useCalling();
  const [blurMessages, setBlurMessages] = useState(false);
  const [namesByPublicId, setNamesByPublicId] = useState<Record<string, string>>({});
  const [isNameOpen, setIsNameOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const navigation = useNavigation();
  const closeConversation = chat.closeConversation;

  useFocusEffect(useCallback(() => {
    let active = true;
    void listContacts().then((contacts) => {
      if (active) setNamesByPublicId(Object.fromEntries(contacts.filter((contact) => contact.nickname).map((contact) => [contact.publicId, contact.nickname!])));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []));

  async function saveName(publicId: string) {
    try {
      const next = nickname.trim();
      if (!next && !namesByPublicId[publicId]) { setIsNameOpen(false); return; }
      if (next && !(await listContacts()).some((contact) => contact.publicId === publicId)) await addContact(publicId);
      await updateContactNickname(publicId, next);
      setNamesByPublicId((current) => ({ ...current, [publicId]: next }));
      setIsNameOpen(false);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Chat', text2: error instanceof Error ? error.message : 'Could not save name.' });
    }
  }

  async function saveMessage() {
    if (!editingMessage || !messageDraft.trim()) return;
    try {
      await editChatMessage(editingMessage.conversationId, editingMessage.id, messageDraft.trim());
      setEditingMessage(null);
      await Promise.all([chat.refreshMessages(), chat.refreshConversations()]);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Chat', text2: error instanceof Error ? error.message : 'Could not edit message.' });
    }
  }

  useEffect(() => {
    // @ts-expect-error tabPress is available on tab screens
    const unsubscribe = navigation.addListener('tabPress', () => {
      closeConversation();
    });
    return unsubscribe;
  }, [navigation, closeConversation]);

  if (chat.activeConversation) {
    const participantPublicId = chat.activeConversation.participantPublicId;
    return (
      <>
        <ChatThread
          attachmentError={chat.attachmentError}
          attachments={chat.attachments}
          burnAfterRead={chat.burnAfterRead}
          blurMessages={blurMessages}
          draft={chat.draft}
          error={chat.messagesError}
          firstUnreadMessageId={chat.firstUnreadMessageId}
          hasOlderMessages={chat.hasOlderMessages}
          isLoading={chat.isLoadingMessages}
          isLoadingOlderMessages={chat.isLoadingOlderMessages}
          isParticipantDeleted={chat.activeConversation.participantStatus === 'deleted'}
          isSending={chat.isSending}
          messages={chat.messages}
          nowMs={chat.nowMs}
          onBack={chat.closeConversation}
          onEditName={() => { setNickname(namesByPublicId[participantPublicId] ?? ''); setIsNameOpen(true); }}
          onEditMessage={(message) => { setEditingMessage(message); setMessageDraft(message.content); }}
          onCallAudio={() => void callUser(participantPublicId, namesByPublicId[participantPublicId], 'audio')}
          onCallVideo={() => void callUser(participantPublicId, namesByPublicId[participantPublicId], 'video')}
          onCaptureAttachment={chat.captureAttachment}
          onChangeDraft={chat.updateDraft}
          onLoadOlder={() => void chat.loadOlderMessages()}
          onPickDocumentAttachment={chat.pickDocumentAttachment}
          onPickLibraryAttachment={chat.pickLibraryAttachment}
          onOpenBurn={chat.openBurnMessage}
          onRefresh={() => void chat.refreshMessages()}
          onRetry={chat.retryMessage}
          onRemoveAttachment={chat.removeAttachment}
          onSend={chat.submitMessage}
          onSendVoice={chat.submitVoiceMessage}
          onToggleBurn={chat.toggleBurnAfterRead}
          onToggleMessageBlur={() => setBlurMessages((current) => !current)}
          onVoiceError={chat.setVoiceError}
          participantAvatarUrl={chat.participantAvatarUrl}
          participantDisplayName={namesByPublicId[participantPublicId] || chat.participantDisplayName}
          participantPublicId={chat.activeConversation.participantPublicId}
          userPublicId={chat.userPublicId}
        />
        <Modal visible={isNameOpen} transparent animationType="fade" onRequestClose={() => setIsNameOpen(false)}>
          <View className="flex-1 items-center justify-center bg-black/60 px-5"><View className="w-full max-w-[400px] gap-3 rounded-[22px] bg-white p-5"><Text className="text-lg font-black">Friend name</Text><TextInput value={nickname} onChangeText={setNickname} placeholder="Name shown only to you" maxLength={80} autoFocus className="h-12 rounded-xl border border-black/15 px-3" /><View className="flex-row gap-2"><Pressable onPress={() => setIsNameOpen(false)} className="flex-1 rounded-xl bg-[#DDD] p-3"><Text className="text-center font-black">Cancel</Text></Pressable><Pressable onPress={() => void saveName(participantPublicId)} className="flex-1 rounded-xl bg-black p-3"><Text className="text-center font-black text-white">Save</Text></Pressable></View></View></View>
        </Modal>
        <Modal visible={!!editingMessage} transparent animationType="fade" onRequestClose={() => setEditingMessage(null)}>
          <View className="flex-1 items-center justify-center bg-black/60 px-5"><View className="w-full max-w-[400px] gap-3 rounded-[22px] bg-white p-5"><Text className="text-lg font-black">Edit message</Text><TextInput value={messageDraft} onChangeText={setMessageDraft} multiline maxLength={4000} autoFocus className="min-h-24 rounded-xl border border-black/15 p-3" /><View className="flex-row gap-2"><Pressable onPress={() => setEditingMessage(null)} className="flex-1 rounded-xl bg-[#DDD] p-3"><Text className="text-center font-black">Cancel</Text></Pressable><Pressable disabled={!messageDraft.trim()} onPress={() => void saveMessage()} className="flex-1 rounded-xl bg-black p-3 disabled:opacity-40"><Text className="text-center font-black text-white">Save</Text></Pressable></View></View></View>
        </Modal>
        <AttachmentPreviewModal
          attachments={chat.attachments}
          error={chat.attachmentError}
          isSending={chat.isSending}
          onCancel={chat.discardAttachments}
          onRemove={chat.removeAttachment}
          onSend={() => void chat.submitMessage()}
        />
        <NewChatModal
          error={chat.participantError}
          isBusy={chat.isStartingChat}
          isOpen={chat.isNewChatOpen}
          onChange={chat.updateParticipantInput}
          onClose={chat.closeNewChat}
          onSubmit={chat.submitNewChat}
          value={chat.participantInput}
        />
      </>
    );
  }

  return (
    <FeatureScreen
      rightAction={
        <Pressable
          accessibilityLabel="Start a new private chat"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70"
          onPress={chat.openNewChat}
        >
          <Text className="text-2xl font-black text-g000st-black">+</Text>
        </Pressable>
      }
      title={
        <View className="flex-row items-center">
          <G000stWordmark className="text-[15px]" />
          <OnlineSignal />
        </View>
      }
    >
      <ChatConversationList
        conversations={chat.conversations}
        namesByPublicId={namesByPublicId}
        error={chat.conversationsError}
        isLoading={chat.isLoadingConversations}
        onOpen={chat.openConversation}
        onRefresh={() => void chat.refreshConversations()}
        onStart={chat.openNewChat}
      />

      <NewChatModal
        error={chat.participantError}
        isBusy={chat.isStartingChat}
        isOpen={chat.isNewChatOpen}
        onChange={chat.updateParticipantInput}
        onClose={chat.closeNewChat}
        onSubmit={chat.submitNewChat}
        value={chat.participantInput}
      />
    </FeatureScreen>
  );
}

export const PrivateChatScreenContent = memo(PrivateChatScreenContentComponent);
