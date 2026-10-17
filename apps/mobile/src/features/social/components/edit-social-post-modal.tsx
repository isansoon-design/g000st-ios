import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";

import { KeyboardAvoidingView } from "@/components/layout/keyboard-avoiding-view";
import { EditPostMedia } from "@/components/media/edit-post-media";
import {
  initialMediaDraft,
  mediaDraftEdit,
  type ExistingPostMedia,
  type PostMediaEdit,
} from "@/domain/media/post-media-edit";
import type { SocialPost } from "@/domain/social/types";

export function EditSocialPostModal({
  post,
  onClose,
  onSave,
}: {
  post: SocialPost;
  onClose: () => void;
  onSave: (postId: string, content: string, media?: PostMediaEdit) => Promise<void>;
}) {
  const original: readonly ExistingPostMedia[] | undefined = post.media;
  const editableMedia = !post.sharedPostId;
  const [content, setContent] = useState(post.content);
  const [mediaDraft, setMediaDraft] = useState(() => initialMediaDraft(original));
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center bg-black/50 p-5">
        <Pressable
          accessibilityLabel="Close editor"
          className="absolute inset-0"
          onPress={() => !saving && onClose()}
        />
        <View className="max-h-full rounded-[24px] bg-white dark:bg-night-surface">
          <ScrollView contentContainerClassName="gap-3 p-5" keyboardShouldPersistTaps="handled">
          <Text className="text-lg font-black text-g000st-black dark:text-night-text">
            Edit post
          </Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={4000}
            className="min-h-28 max-h-64 rounded-xl border border-black/15 dark:border-night-border p-3 text-g000st-black dark:text-night-text"
            textAlignVertical="top"
          />
          {editableMedia && (
            <EditPostMedia draft={mediaDraft} disabled={saving} onChange={setMediaDraft} />
          )}
          <View className="flex-row gap-2">
            <Pressable
              onPress={onClose}
              disabled={saving}
              className="flex-1 rounded-xl bg-[#DDD] dark:bg-night-raised p-3"
            >
              <Text className="text-center font-black text-g000st-black dark:text-night-text">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={async () => {
                const next = content.trim();
                const media = editableMedia ? mediaDraftEdit(mediaDraft, original) : undefined;
                const hasMedia = mediaDraft.kept.length + mediaDraft.added.length > 0;
                if (!next && !hasMedia && !post.sharedPostId) return;
                setSaving(true);
                try {
                  await onSave(post.id, next, media);
                } catch (error) {
                  Toast.show({
                    type: "error",
                    text1: "Post",
                    text2: error instanceof Error ? error.message : "Could not save post.",
                  });
                } finally {
                  setSaving(false);
                }
              }}
              className="flex-1 rounded-xl bg-black p-3 disabled:opacity-50"
            >
              <Text className="text-center font-black text-white">
                {saving ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
