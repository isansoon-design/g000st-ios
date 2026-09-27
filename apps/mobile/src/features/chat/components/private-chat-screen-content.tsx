import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { deleteChatMessage, editChatMessage } from '@/api/chat';
import { getPeerPreferences, listContactNicknames, updateContactNickname, updatePeerPreferences, type PeerPreferences } from '@/api/contacts';
import { getSocialProfile, toggleSocialCamp } from '@/api/social';
import { G000stWordmark } from '@/components/brand/g000st-wordmark';
import { FeatureScreen } from '@/components/layout/feature-screen';
import type { ChatConversationSummary, ChatMessage } from '@/domain/chat/types';
import { useCalling } from '@/features/calling/hooks/use-calling';
import { AttachmentPreviewModal } from '@/features/chat/components/attachment-preview-modal';
import { ChatConversationList } from '@/features/chat/components/chat-conversation-list';
import { ChatThread } from '@/features/chat/components/chat-thread';
import { NewChatModal } from '@/features/chat/components/new-chat-modal';
import { usePrivateChat } from '@/features/chat/hooks/use-private-chat';
import { chatConversationHref } from '@/features/chat/navigation';
import { useConfirmModal } from '@/providers/confirm-modal-provider';
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
  initialKind?: 'private' | 'market';
  openRequestId?: string;
  view: 'list' | 'conversation';
}>;

function PrivateChatScreenContentComponent({
  initialConversationId,
  initialKind,
  openRequestId,
  view,
}: PrivateChatScreenContentProps) {
  const chat = usePrivateChat(initialConversationId, openRequestId);
  const { callUser } = useCalling();
  const [blurMessages, setBlurMessages] = useState(false);
  const [namesByPublicId, setNamesByPublicId] = useState<Record<string, string>>({});
  const [isNameOpen, setIsNameOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [openingTimedOutId, setOpeningTimedOutId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [peerPreferences, setPeerPreferences] = useState<PeerPreferences | null>(null);
  const [followingPeer, setFollowingPeer] = useState<boolean | null>(null);
  const { confirm } = useConfirmModal();
  const closeConversation = chat.closeConversation;
  const router = useRouter();
  useEffect(() => {
    if (view !== 'conversation' || !initialConversationId ||
      chat.activeConversation?.conversationId === initialConversationId ||
      openingTimedOutId === initialConversationId) return;
    const timer = setTimeout(() => setOpeningTimedOutId(initialConversationId), 8_000);
    return () => clearTimeout(timer);
  }, [view, initialConversationId, chat.activeConversation?.conversationId, openingTimedOutId]);

  useFocusEffect(useCallback(() => {
    if (view !== 'conversation') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.dismissTo('/(app)/(tabs)/chat');
      return true;
    });
    return () => subscription.remove();
  }, [view, router]));

  useEffect(() => {
    if (view !== 'list' || !chat.activeConversation) return;
    const conversationId = chat.activeConversation.conversationId;
    closeConversation();
    router.push(chatConversationHref(conversationId));
  }, [view, chat.activeConversation, closeConversation, router]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void listContactNicknames().then((contacts) => {
      if (active) setNamesByPublicId(Object.fromEntries(contacts.map((contact) => [contact.publicId, contact.nickname])));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []));

  const peerPublicId = chat.activeConversation?.participantPublicId;
  const participantDeleted = chat.activeConversation?.participantStatus === 'deleted';
  useFocusEffect(useCallback(() => {
    let active = true;
    setPeerPreferences(null);
    setFollowingPeer(null);
    if (peerPublicId && !participantDeleted) {
      void getPeerPreferences(peerPublicId).then((value) => { if (active) setPeerPreferences(value); }).catch(() => undefined);
      void getSocialProfile(peerPublicId).then((profile) => { if (active) setFollowingPeer(profile.campedByViewer ?? false); }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [peerPublicId, participantDeleted]));

  async function changePeerPreferences(changes: Partial<PeerPreferences>) {
    if (!peerPublicId) return;
    try {
      setPeerPreferences(await updatePeerPreferences(peerPublicId, changes));
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Chat', text2: error instanceof Error ? error.message : 'Could not update contact settings.' });
    }
  }

  async function togglePeerFollow() {
    if (!peerPublicId) return;
    try {
      setFollowingPeer((await toggleSocialCamp(peerPublicId)).camped);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Chat', text2: error instanceof Error ? error.message : 'Could not update follow.' });
    }
  }

  async function saveName(publicId: string) {
    try {
      const next = nickname.trim();
      if (!next && !namesByPublicId[publicId]) { setIsNameOpen(false); return; }
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

  async function removeMessage(message: ChatMessage) {
    setActionMessage(null);
    const approved = await confirm({
      title: 'Delete message?',
      message: 'This message will be removed from the conversation for both people.',
      confirmLabel: 'Delete',
      isDangerous: true,
    });
    if (!approved) return;
    try {
      await deleteChatMessage(message.conversationId, message.id);
      await Promise.all([chat.refreshMessages(), chat.refreshConversations()]);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Chat', text2: error instanceof Error ? error.message : 'Could not delete message.' });
    }
  }

  async function removeConversation(conversation: ChatConversationSummary) {
    if (deletingConversationId) return;
    const approved = await confirm({
      title: 'Delete conversation?',
      message: 'This conversation will leave your list. It will appear again if either person sends a new message.',
      confirmLabel: 'Delete',
      isDangerous: true,
    });
    if (!approved) return;
    setDeletingConversationId(conversation.conversationId);
    try {
      await chat.deleteConversation(conversation.conversationId);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Chat', text2: error instanceof Error ? error.message : 'Could not delete conversation.' });
    } finally {
      setDeletingConversationId(null);
    }
  }

  if (view === 'conversation' && chat.activeConversation && chat.activeConversation.conversationId === initialConversationId) {
    const participantPublicId = chat.activeConversation.participantPublicId;
    return (
      <>
        <ChatThread
          conversationKind={chat.conversations.find((item) => item.conversationId === chat.activeConversation?.conversationId)?.kind ?? 'private'}
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
          onBack={() => router.dismissTo('/(app)/(tabs)/chat')}
          onViewProfile={() => router.push(`/users/${participantPublicId}`)}
          onMessageActions={setActionMessage}
          onCallAudio={() => void callUser(participantPublicId, namesByPublicId[participantPublicId], 'audio')}
          onCallVideo={() => void callUser(participantPublicId, namesByPublicId[participantPublicId], 'video')}
          onToggleFollow={togglePeerFollow}
          onUpdatePeerPreferences={changePeerPreferences}
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
          peerPreferences={peerPreferences}
          followingPeer={followingPeer}
          participantPublicId={chat.activeConversation.participantPublicId}
          userPublicId={chat.userPublicId}
        />
        <Modal visible={isNameOpen} transparent animationType="fade" onRequestClose={() => setIsNameOpen(false)}>
          <View className="flex-1 items-center justify-center bg-black/60 px-5"><View className="w-full max-w-[400px] gap-3 rounded-[22px] bg-white p-5"><Text className="text-lg font-black">Friend name</Text><TextInput value={nickname} onChangeText={setNickname} placeholder="Name shown only to you" maxLength={80} autoFocus className="h-12 rounded-xl border border-black/15 px-3" /><View className="flex-row gap-2"><Pressable onPress={() => setIsNameOpen(false)} className="flex-1 rounded-xl bg-[#DDD] p-3"><Text className="text-center font-black">Cancel</Text></Pressable><Pressable onPress={() => void saveName(participantPublicId)} className="flex-1 rounded-xl bg-black p-3"><Text className="text-center font-black text-white">Save</Text></Pressable></View></View></View>
        </Modal>
        <Modal visible={!!editingMessage} transparent animationType="fade" onRequestClose={() => setEditingMessage(null)}>
          <View className="flex-1 items-center justify-center bg-black/60 px-5"><View className="w-full max-w-[400px] gap-3 rounded-[22px] bg-white p-5"><Text className="text-lg font-black">Edit message</Text><TextInput value={messageDraft} onChangeText={setMessageDraft} multiline maxLength={4000} autoFocus className="min-h-24 rounded-xl border border-black/15 p-3" /><View className="flex-row gap-2"><Pressable onPress={() => setEditingMessage(null)} className="flex-1 rounded-xl bg-[#DDD] p-3"><Text className="text-center font-black">Cancel</Text></Pressable><Pressable disabled={!messageDraft.trim()} onPress={() => void saveMessage()} className="flex-1 rounded-xl bg-black p-3 disabled:opacity-40"><Text className="text-center font-black text-white">Save</Text></Pressable></View></View></View>
        </Modal>
        <Modal visible={!!actionMessage} transparent animationType="fade" onRequestClose={() => setActionMessage(null)}>
          <View className="flex-1 items-center justify-center px-5">
            <Pressable className="absolute inset-0 bg-black/60" onPress={() => setActionMessage(null)} />
            <View className="w-full max-w-[360px] gap-2 rounded-[22px] bg-white p-5">
              <Text className="mb-1 text-lg font-black">Message options</Text>
              <Pressable
                accessibilityRole="button"
                disabled={!actionMessage || !!actionMessage.burnAfterReadSeconds || !!actionMessage.attachments?.length || actionMessage.type !== 'text' || !actionMessage.content}
                onPress={() => { if (actionMessage) { setEditingMessage(actionMessage); setMessageDraft(actionMessage.content); setActionMessage(null); } }}
                className="rounded-xl bg-[#EEE] p-3 disabled:opacity-40"
              ><Text className="text-center font-black">Edit</Text></Pressable>
              {actionMessage && (actionMessage.burnAfterReadSeconds || actionMessage.attachments?.length || actionMessage.type !== 'text' || !actionMessage.content) ? <Text className="text-center text-xs text-black/50">Only plain text messages can be edited.</Text> : null}
              <Pressable accessibilityRole="button" onPress={() => { if (actionMessage) void removeMessage(actionMessage); }} className="rounded-xl bg-[#C62828] p-3"><Text className="text-center font-black text-white">Delete</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setActionMessage(null)} className="p-2"><Text className="text-center font-bold">Cancel</Text></Pressable>
            </View>
          </View>
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

  if (view === 'conversation') {
    const requested = chat.conversations.find((item) => item.conversationId === initialConversationId);
    const timedOut = openingTimedOutId === initialConversationId;
    const isOpening = !timedOut && !chat.conversationsError &&
      (chat.isLoadingConversations || chat.isFetchingConversations || !!requested);
    return (
      <View className="flex-1 items-center justify-center bg-[#D8D8D8] px-7">
        {isOpening ? <ActivityIndicator color="#9A9A9A" /> : null}
        <Text className="mt-3 text-center text-sm font-bold text-g000st-black">
          {isOpening ? 'Opening conversation…' : chat.conversationsError ?? (timedOut ? 'Could not open conversation.' : 'Conversation unavailable.')}
        </Text>
        {!isOpening ? (
          <Pressable accessibilityRole="button" className="mt-4 rounded-full bg-white px-5 py-3" onPress={() => {
            setOpeningTimedOutId(null);
            if (requested) chat.openConversation(requested);
            else void chat.refreshConversations();
          }}>
            <Text className="font-black">Try again</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" className="mt-4 rounded-full bg-white px-5 py-3" onPress={() => router.dismissTo('/(app)/(tabs)/chat')}>
          <Text className="font-black">Back to chats</Text>
        </Pressable>
      </View>
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
        key={chat.conversations.find((item) => item.conversationId === initialConversationId)?.kind ?? initialKind ?? 'private'}
        conversations={chat.conversations}
        initialKind={chat.conversations.find((item) => item.conversationId === initialConversationId)?.kind ?? initialKind}
        namesByPublicId={namesByPublicId}
        error={chat.conversationsError}
        isLoading={chat.isLoadingConversations}
        onOpen={(conversation) => router.push(chatConversationHref(conversation.conversationId))}
        onDelete={(conversation) => void removeConversation(conversation)}
        deletingConversationId={deletingConversationId}
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
