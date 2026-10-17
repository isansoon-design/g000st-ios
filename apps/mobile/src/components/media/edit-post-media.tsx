import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { cssInterop } from "nativewind";
import { Pressable, ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import {
  isValidPickedImage,
  MAX_POST_IMAGES,
  type PostMediaDraft,
} from "@/domain/media/post-media-edit";

cssInterop(Image, { className: "style" });

export function EditPostMedia({
  draft,
  disabled,
  onChange,
}: {
  draft: PostMediaDraft;
  disabled?: boolean;
  onChange: (draft: PostMediaDraft) => void;
}) {
  const count = draft.kept.length + draft.added.length;
  const remaining = MAX_POST_IMAGES - count;

  async function pick() {
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled) return;
    if (result.assets.length > remaining || !result.assets.every(isValidPickedImage)) {
      return Toast.show({
        type: "error",
        text1: "Media",
        text2: `Choose up to ${remaining} image${remaining === 1 ? "" : "s"}, max 5 MB each.`,
      });
    }
    onChange({ ...draft, added: [...draft.added, ...result.assets] });
  }

  return (
    <View className="gap-2">
      <Text className="text-xs font-black uppercase tracking-wider text-black/55 dark:text-night-muted">
        Photos · {count}/{MAX_POST_IMAGES}
      </Text>
      {count > 0 && (
        <ScrollView horizontal contentContainerClassName="gap-2">
          {draft.kept.map((item) => (
            <Thumb
              key={item.id}
              uri={item.url}
              label="Remove photo"
              disabled={disabled}
              onRemove={() => onChange({ ...draft, kept: draft.kept.filter((kept) => kept.id !== item.id) })}
            />
          ))}
          {draft.added.map((asset) => (
            <Thumb
              key={asset.assetId ?? asset.uri}
              uri={asset.uri}
              label="Remove new photo"
              disabled={disabled}
              onRemove={() => onChange({ ...draft, added: draft.added.filter((added) => added !== asset) })}
            />
          ))}
        </ScrollView>
      )}
      {remaining > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photo"
          disabled={disabled}
          onPress={() => void pick()}
          className="items-center rounded-xl border border-dashed border-black/20 dark:border-night-border px-4 py-3 disabled:opacity-50"
        >
          <Text className="text-sm font-black text-g000st-black dark:text-night-text">
            ＋ Add photo
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Thumb({
  uri,
  label,
  disabled,
  onRemove,
}: {
  uri: string;
  label: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <View className="relative">
      <Image source={{ uri }} className="h-20 w-20 rounded-xl" contentFit="cover" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onRemove}
        className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/70"
      >
        <Text className="font-black text-white">×</Text>
      </Pressable>
    </View>
  );
}
