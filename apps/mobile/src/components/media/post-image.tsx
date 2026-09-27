import { randomUUID } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { cssInterop } from "nativewind";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

cssInterop(Image, { className: "style" });

type PostImageProps = {
  uri: string;
  contentType: string;
  height: number;
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function PostImage({ uri, contentType, height }: PostImageProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"options" | "viewer" | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveImage() {
    if (saving) return;
    setSaving(true);
    let downloaded: File | undefined;
    try {
      const permission = await requestPermissionsAsync(true, []);
      if (!permission.granted) {
        setMode(null);
        Toast.show({ type: "error", text1: "Allow photo access to save this image." });
        return;
      }

      const extension = IMAGE_EXTENSIONS[contentType.toLowerCase()] ?? "jpg";
      downloaded = await File.downloadFileAsync(
        uri,
        new File(Paths.cache, `g000st-${randomUUID()}.${extension}`),
      );
      await Asset.create(downloaded.uri);
      setMode(null);
      Toast.show({ type: "success", text1: "Image saved to Photos" });
    } catch (error) {
      setMode(null);
      Toast.show({
        type: "error",
        text1: "Could not save image",
        text2: error instanceof Error ? error.message : undefined,
      });
    } finally {
      if (downloaded?.exists) {
        try {
          downloaded.delete();
        } catch {
          // The temporary file can be removed by the system cache cleanup.
        }
      }
      setSaving(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Image options"
        accessibilityHint="Tap to view, or long press for image options"
        onPress={() => setMode("viewer")}
        onLongPress={() => setMode("options")}
      >
        <Image source={{ uri }} contentFit="cover" style={{ width: "100%", height }} />
      </Pressable>
      <Modal
        visible={mode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMode(null)}
      >
        {mode === "options" ? (
          <View className="flex-1 justify-end bg-black/70 p-4" style={{ paddingBottom: insets.bottom + 16 }}>
            <Pressable className="absolute inset-0" onPress={() => setMode(null)} accessibilityLabel="Close image options" />
            <View className="rounded-2xl bg-white p-3 dark:bg-night-surface">
              <Pressable className="rounded-xl p-4" accessibilityRole="button" onPress={() => setMode("viewer")}>
                <Text className="text-base font-bold text-black dark:text-night-text">View image</Text>
              </Pressable>
              <Pressable className="rounded-xl p-4" accessibilityRole="button" disabled={saving} onPress={() => void saveImage()}>
                <View className="flex-row items-center gap-3">
                  {saving && <ActivityIndicator />}
                  <Text className="text-base font-bold text-black dark:text-night-text">{saving ? "Saving…" : "Save image"}</Text>
                </View>
              </Pressable>
              <Pressable className="rounded-xl p-4" accessibilityRole="button" onPress={() => setMode(null)}>
                <Text className="text-base text-black/60 dark:text-night-muted">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-1 bg-black">
            <Image source={{ uri }} contentFit="contain" style={{ flex: 1, width: "100%" }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close image"
              className="absolute right-5 rounded-full bg-black/70 px-4 py-2"
              style={{ top: insets.top + 12 }}
              onPress={() => setMode(null)}
            >
              <Text className="text-lg font-bold text-white">✕</Text>
            </Pressable>
          </View>
        )}
      </Modal>
    </>
  );
}
