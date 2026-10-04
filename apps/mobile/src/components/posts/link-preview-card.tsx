import { useState } from "react";
import { Image } from "expo-image";
import { Linking, Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import type { SocialLinkPreviewV1 } from "@/domain/social/types";

export function LinkPreviewCard({ preview }: { preview: SocialLinkPreviewV1 }) {
  const [failedImage, setFailedImage] = useState<string>();
  const domain = new URL(preview.url).hostname.replace(/^www\./, "");
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Read ${preview.title} on ${preview.siteName}`}
      onPress={() => { void Linking.openURL(preview.url).catch(() => Toast.show({ type: "error", text1: "Could not open article" })); }}
      className="mx-4 mb-4 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.025] dark:border-night-border dark:bg-night-surface">
      {preview.imageUrl && failedImage !== preview.imageUrl && (
        <Image source={{ uri: preview.imageUrl }} accessibilityLabel={preview.title} contentFit="cover" recyclingKey={preview.imageUrl} onError={() => setFailedImage(preview.imageUrl)} style={{ width: "100%", aspectRatio: 1.91 }} />
      )}
      <View className="gap-2 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text numberOfLines={1} className="flex-1 text-xs text-black/50 dark:text-night-muted">{preview.siteName} · {domain}</Text>
          <Text className="text-base text-black/50 dark:text-night-muted">↗</Text>
        </View>
        <Text numberOfLines={2} className="text-base font-bold leading-6 text-g000st-black dark:text-night-text">{preview.title}</Text>
        {!!preview.description && <Text numberOfLines={2} className="text-sm leading-5 text-black/60 dark:text-night-muted">{preview.description}</Text>}
      </View>
    </Pressable>
  );
}
