import { randomUUID } from "expo-crypto";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";

import { createSocialPost, uploadSocialMedia } from "@/api/social";
import type { SocialPost, SocialVisibility } from "@/domain/social/types";

type Props = Readonly<{
  publicId: string;
  isPage: boolean;
  pageNamed: boolean;
  onPublished: (post: SocialPost) => void;
}>;

const ALLOWED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export function ProfilePostComposer({
  publicId,
  isPage,
  pageNamed,
  onPublished,
}: Props) {
  const [draft, setDraft] = useState("");
  const [visibility, setVisibility] = useState<SocialVisibility>("public");
  const [selectedMedia, setSelectedMedia] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [posting, setPosting] = useState(false);

  const anonymous = !isPage && visibility === "anonymous";
  const canPost = !!draft.trim() && !posting && !(isPage && !pageNamed);

  function acceptMedia(items: ImagePicker.ImagePickerAsset[]) {
    const videos = items.filter((item) => item.type === "video");
    if (
      items.some(
        (item) =>
          !item.fileSize ||
          !item.mimeType ||
          !ALLOWED_MEDIA.has(item.mimeType) ||
          item.fileSize > 5 * 1024 * 1024,
      )
    ) {
      Toast.show({
        type: "error",
        text1: "Media",
        text2: "Choose supported media up to 5 MB per file.",
      });
      return false;
    }
    if (items.length > 2 || (videos.length > 0 && items.length !== 1)) {
      Toast.show({
        type: "error",
        text1: "Media",
        text2: "Choose up to two images or one video.",
      });
      return false;
    }
    setSelectedMedia(items);
    return true;
  }

  async function pickMedia(source: "library" | "camera") {
    try {
      const permission =
        source === "library"
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Toast.show({
          type: "error",
          text1: "Media",
          text2:
            source === "library"
              ? "Photo library permission is required."
              : "Camera permission is required.",
        });
        return;
      }
      const result =
        source === "library"
          ? await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: true,
            mediaTypes: ["images", "videos"],
            quality: 0.9,
            selectionLimit: 2,
          })
          : await ImagePicker.launchCameraAsync({
            mediaTypes: ["images", "videos"],
            quality: 0.9,
          });
      if (!result.canceled)
        acceptMedia(
          source === "library"
            ? result.assets
            : [...selectedMedia, ...result.assets],
        );
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Media",
        text2:
          error instanceof Error ? error.message : "Could not select media.",
      });
    }
  }

  async function publish(shareToSocial: boolean) {
    const content = draft.trim();
    if (!content || posting || (isPage && !pageNamed)) return;
    setPosting(true);
    try {
      const clientPostId = randomUUID();
      const media = selectedMedia.length
        ? await Promise.all(
          selectedMedia.map((item) =>
            uploadSocialMedia(
              {
                byteSize: item.fileSize!,
                clientPostId,
                contentType: item.mimeType!,
                fileName: item.fileName || "social-media",
                uri: item.uri,
              },
              publicId,
            ),
          ),
        )
        : undefined;
      const post = await createSocialPost(
        clientPostId,
        content,
        isPage ? "public" : visibility,
        media,
        undefined,
        publicId,
        shareToSocial,
      );
      if (post.visibility === "public") onPublished(post);
      setDraft("");
      setSelectedMedia([]);
      Toast.show({
        type: "success",
        text1: "Posted",
        text2:
          post.visibility === "public"
            ? shareToSocial
              ? "Your post is on this profile and in g000st Social."
              : "Your post is on this profile."
            : "Anonymous posts appear in Social, not on this public profile.",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not post",
        text2: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setPosting(false);
    }
  }

  return (
    <View className="rounded-3xl border border-white bg-white/90 p-4 dark:border-night-border dark:bg-night-surface">
      <Text className="mb-3 text-sm font-black text-[#17191d] dark:text-night-text">
        New Social post
      </Text>
      <TextInput
        accessibilityLabel="Post text"
        multiline
        maxLength={4000}
        value={draft}
        onChangeText={setDraft}
        placeholder={
          isPage ? "Share something from this page…" : "Share something…"
        }
        textAlignVertical="top"
        className="min-h-24 rounded-2xl border border-black/15 bg-white p-3 text-sm text-[#17191d] dark:border-night-border dark:bg-night-raised dark:text-night-text"
      />
      {selectedMedia.length > 0 && (
        <View className="mt-3 flex-row gap-3">
          {selectedMedia.map((media, index) => (
            <View key={`${media.uri}-${index}`} className="relative">
              <Image
                source={{ uri: media.uri }}
                contentFit="cover"
                className="h-16 w-16 rounded-lg bg-black/5"
              />
              {media.type === "video" && (
                <View className="absolute inset-0 items-center justify-center bg-black/20">
                  <Text className="font-black text-white">▶</Text>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove attachment"
                onPress={() =>
                  setSelectedMedia((items) =>
                    items.filter((_, i) => i !== index),
                  )
                }
                className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-black/70"
              >
                <Text className="text-xs font-black text-white">×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {isPage && !pageNamed && (
        <Text className="mt-2 text-xs font-bold text-g000st-red">
          Name this page before posting.
        </Text>
      )}
      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        <Pressable
          accessibilityRole="button"
          disabled={posting}
          onPress={() => void pickMedia("library")}
          className="rounded-xl border border-black/10 px-3 py-2 dark:border-night-border"
        >
          <Text className="text-xs font-bold text-[#17191d] dark:text-night-text">
            📎{" "}
            {selectedMedia.length
              ? `${selectedMedia.length} selected`
              : "Media"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture media"
          disabled={posting}
          onPress={() => void pickMedia("camera")}
          className="rounded-xl border border-black/10 px-3 py-2 dark:border-night-border"
        >
          <Text className="text-xs font-bold text-[#17191d] dark:text-night-text">
            📷
          </Text>
        </Pressable>
        <View className="min-w-0 flex-1 flex-row items-center">
          <Switch
            disabled={isPage || posting}
            value={isPage || visibility === "public"}
            onValueChange={(value) =>
              setVisibility(value ? "public" : "anonymous")
            }
            thumbColor="#000000"
            trackColor={{ false: "#9A9A9A", true: "#C62828" }}
          />
          <Text className="ml-1 text-xs font-bold text-[#17191d] dark:text-night-text">
            {isPage ? "Page name shown" : "Show identity"}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          disabled={!canPost}
          onPress={() => void publish(anonymous)}
          className="rounded-xl bg-[#222] px-5 py-3 disabled:opacity-40"
        >
          <Text className="font-black text-white">
            {posting ? "Posting…" : anonymous ? "Post to Social" : "Create"}
          </Text>
        </Pressable>
        {!anonymous && (
          <Pressable
            accessibilityRole="button"
            disabled={!canPost}
            onPress={() => void publish(true)}
            className="rounded-xl bg-g000st-red px-5 py-3 disabled:opacity-40"
          >
            <Text className="font-black text-white">
              Create & share on g000st Social
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
