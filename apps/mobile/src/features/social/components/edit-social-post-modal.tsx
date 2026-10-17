import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { KeyboardAvoidingView } from "@/components/layout/keyboard-avoiding-view";
import type { SocialPost } from "@/domain/social/types";

export function EditSocialPostModal({
  post,
  onClose,
  onSave,
}: {
  post: SocialPost;
  onClose: () => void;
  onSave: (postId: string, content: string) => Promise<void>;
}) {
  const [content, setContent] = useState(post.content);
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
        <View className="gap-3 rounded-[24px] bg-white dark:bg-night-surface p-5">
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
                if (!next) return;
                setSaving(true);
                try {
                  await onSave(post.id, next);
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
