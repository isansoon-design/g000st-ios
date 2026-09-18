import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { G000stWordmark } from '@/components/brand/g000st-wordmark';
import { FeatureScreen } from '@/components/layout/feature-screen';
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
      {chat.activeConversation ? (
        <ChatThread
          burnAfterRead={chat.burnAfterRead}
          draft={chat.draft}
          error={chat.messagesError}
          firstUnreadMessageId={chat.firstUnreadMessageId}
          hasOlderMessages={chat.hasOlderMessages}
          isLoading={chat.isLoadingMessages}
          isLoadingOlderMessages={chat.isLoadingOlderMessages}
          isParticipantDeleted={chat.activeConversation.participantStatus === 'deleted'}
          messages={chat.messages}
          nowMs={chat.nowMs}
          onBack={chat.closeConversation}
          onChangeDraft={chat.updateDraft}
          onLoadOlder={() => void chat.loadOlderMessages()}
          onOpenBurn={chat.openBurnMessage}
          onRefresh={() => void chat.refreshMessages()}
          onRetry={chat.retryMessage}
          onSend={chat.submitMessage}
          onToggleBurn={chat.toggleBurnAfterRead}
          participantPublicId={chat.activeConversation.participantPublicId}
          userPublicId={chat.userPublicId}
        />
      ) : (
        <ChatConversationList
          conversations={chat.conversations}
          error={chat.conversationsError}
          isLoading={chat.isLoadingConversations}
          onOpen={chat.openConversation}
          onRefresh={() => void chat.refreshConversations()}
          onStart={chat.openNewChat}
        />
      )}

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
