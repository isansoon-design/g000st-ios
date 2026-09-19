import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { getChatAttachmentDownload } from '@/api/chat';
import type { ChatMessage } from '@/domain/chat/types';

type ChatAttachment = NonNullable<ChatMessage['attachments']>[number];

type MessageAttachmentProps = Readonly<{
  attachment: ChatAttachment;
  conversationId: string;
  messageId: string;
}>;

function RemoteVideo({ uri }: Readonly<{ uri: string }>) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      className="h-full w-full"
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      nativeControls
      player={player}
    />
  );
}

function MessageAttachmentComponent({
  attachment,
  conversationId,
  messageId,
}: MessageAttachmentProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getChatAttachmentDownload(conversationId, messageId, attachment.id)
        .then((url) => {
          if (!active) return;
          setDownloadUrl(url);
          setFailed(false);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    };
    refresh();
    const timer = setInterval(refresh, 4 * 60 * 1_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [attachment.id, conversationId, messageId]);

  if (!downloadUrl && !failed) {
    return (
      <View className="h-32 w-60 items-center justify-center rounded-[14px] bg-black/10">
        <ActivityIndicator color="#9A9A9A" />
      </View>
    );
  }

  if (failed || !downloadUrl) {
    return (
      <View className="w-60 rounded-[14px] bg-black/10 px-3 py-4">
        <Text className="text-center text-xs font-bold text-g000st-red">Attachment unavailable</Text>
      </View>
    );
  }

  if (attachment.kind === 'document') {
    return (
      <Pressable
        className="w-60 flex-row items-center rounded-[14px] bg-black/10 p-3"
        onPress={() => void Linking.openURL(downloadUrl)}
      >
        <Text className="mr-3 text-3xl">📄</Text>
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-g000st-black" numberOfLines={2}>{attachment.fileName}</Text>
          <Text className="mt-1 text-[10px] font-bold text-black/45">Open document</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <>
      <Pressable className="h-52 w-64 overflow-hidden rounded-[16px] bg-black" onPress={() => setIsOpen(true)}>
        {attachment.kind === 'image' ? (
          <Image className="h-full w-full" contentFit="cover" source={downloadUrl} />
        ) : (
          <View className="h-full w-full">
            <RemoteVideo uri={downloadUrl} />
          </View>
        )}
      </Pressable>
      <Modal animationType="fade" transparent visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <View className="flex-1 bg-black">
          <Pressable className="absolute right-4 top-12 z-10 h-11 w-11 items-center justify-center rounded-full bg-white/20" onPress={() => setIsOpen(false)}>
            <Text className="text-2xl font-black text-white">×</Text>
          </Pressable>
          <View className="flex-1 items-center justify-center">
            {attachment.kind === 'image' ? (
              <Image className="h-full w-full" contentFit="contain" source={downloadUrl} />
            ) : (
              <RemoteVideo uri={downloadUrl} />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

export const MessageAttachment = memo(MessageAttachmentComponent);
