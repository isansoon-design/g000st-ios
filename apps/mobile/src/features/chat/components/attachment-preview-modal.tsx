import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { SelectedChatAttachment } from '@/features/chat/hooks/use-chat-attachments';

type AttachmentPreviewModalProps = Readonly<{
  attachments: readonly SelectedChatAttachment[];
  error: string | null;
  isSending: boolean;
  onCancel: () => void;
  onRemove: (localUri: string) => void;
  onSend: () => void;
}>;

function kindOf(contentType: string): 'document' | 'image' | 'video' {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  return 'document';
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function VideoPreview({ uri }: Readonly<{ uri: string }>) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      className="h-full w-full rounded-[18px]"
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      nativeControls
      player={player}
    />
  );
}

function AttachmentPreviewModalComponent({
  attachments,
  error,
  isSending,
  onCancel,
  onRemove,
  onSend,
}: AttachmentPreviewModalProps) {
  const [activeUri, setActiveUri] = useState<string | null>(null);
  const active = useMemo(
    () => attachments.find((item) => item.localUri === activeUri) ?? attachments[0],
    [activeUri, attachments],
  );

  return (
    <Modal animationType="slide" onRequestClose={onCancel} transparent visible={attachments.length > 0}>
      <View className="flex-1 justify-end bg-black/70">
        <View className="max-h-[92%] rounded-t-[30px] bg-[#EFEFEF] px-4 pb-5 pt-3">
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable className="h-10 justify-center px-2" disabled={isSending} onPress={onCancel}>
              <Text className="font-bold text-g000st-red">Cancel</Text>
            </Pressable>
            <View className="items-center">
              <Text className="font-black text-g000st-black">Preview</Text>
              <Text className="text-[10px] font-bold text-black/45">{attachments.length}/3 selected</Text>
            </View>
            <Pressable
              className="h-10 min-w-16 items-center justify-center rounded-full bg-g000st-silver px-4 disabled:opacity-50"
              disabled={isSending}
              onPress={onSend}
            >
              {isSending ? <ActivityIndicator color="white" size="small" /> : <Text className="font-black text-white">Send</Text>}
            </Pressable>
          </View>

          <View className="h-[390px] items-center justify-center overflow-hidden rounded-[22px] bg-black">
            {active && kindOf(active.contentType) === 'image' ? (
              <Image className="h-full w-full" contentFit="contain" source={active.localUri} />
            ) : active && kindOf(active.contentType) === 'video' ? (
              <VideoPreview key={active.localUri} uri={active.localUri} />
            ) : active ? (
              <View className="items-center px-8">
                <Text className="text-6xl">📄</Text>
                <Text className="mt-4 text-center text-base font-black text-white" numberOfLines={2}>{active.fileName}</Text>
                <Text className="mt-2 text-xs font-bold text-white/60">{formatBytes(active.byteSize)}</Text>
              </View>
            ) : null}
          </View>

          {error ? <Text className="mt-2 text-center text-xs font-bold text-g000st-red">{error}</Text> : null}

          <ScrollView className="mt-3" contentContainerClassName="gap-2 px-1" horizontal showsHorizontalScrollIndicator={false}>
            {attachments.map((attachment) => {
              const selected = attachment.localUri === active?.localUri;
              const kind = kindOf(attachment.contentType);
              return (
                <Pressable
                  className={`h-20 w-20 overflow-hidden rounded-[14px] border-2 bg-black ${selected ? 'border-g000st-red' : 'border-transparent'}`}
                  key={attachment.localUri}
                  onPress={() => setActiveUri(attachment.localUri)}
                >
                  {kind === 'image' ? <Image className="h-full w-full" contentFit="cover" source={attachment.localUri} /> : (
                    <View className="h-full w-full items-center justify-center px-1">
                      <Text className="text-2xl">{kind === 'video' ? '▶️' : '📄'}</Text>
                      <Text className="mt-1 text-center text-[8px] font-bold text-white" numberOfLines={1}>{attachment.fileName}</Text>
                    </View>
                  )}
                  <Pressable
                    accessibilityLabel={`Remove ${attachment.fileName}`}
                    className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/80"
                    disabled={isSending}
                    onPress={() => onRemove(attachment.localUri)}
                  >
                    <Text className="text-xs font-black text-white">×</Text>
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const AttachmentPreviewModal = memo(AttachmentPreviewModalComponent);
