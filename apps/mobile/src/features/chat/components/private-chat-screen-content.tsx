import { useNavigation } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { G000stWordmark } from '@/components/brand/g000st-wordmark';
import { FeatureScreen } from '@/components/layout/feature-screen';
import { useCalling } from '@/features/calling/hooks/use-calling';
import { AttachmentPreviewModal } from '@/features/chat/components/attachment-preview-modal';
import { ChatConversationList } from '@/features/chat/components/chat-conversation-list';
import { ChatThread } from '@/features/chat/components/chat-thread';
import { NewChatModal } from '@/features/chat/components/new-chat-modal';
import { usePrivateChat } from '@/features/chat/hooks/use-private-chat';

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
  const navigation = useNavigation();

  useEffect(() => {
    // @ts-expect-error tabPress is available on tab screens
    const unsubscribe = navigation.addListener('tabPress', () => {
      chat.closeConversation();
    });
    return unsubscribe;
  }, [navigation, chat.closeConversation]);

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
          onCallAudio={() => void callUser(participantPublicId, undefined, 'audio')}
          onCallVideo={() => void callUser(participantPublicId, undefined, 'video')}
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
          participantDisplayName={chat.participantDisplayName}
          participantPublicId={chat.activeConversation.participantPublicId}
          userPublicId={chat.userPublicId}
        />
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
