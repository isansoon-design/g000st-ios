import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfilePostComposer } from "@/features/social/components/profile-post-composer";

export default function FirstBeaconPostScreen() {
  const { publicId } = useLocalSearchParams<{ publicId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewPage = () => {
    if (publicId) router.replace(`/users/${publicId}`);
  };

  return (
    <View
      className="flex-1 bg-[#e6e8eb] dark:bg-night-canvas"
      style={{ paddingTop: insets.top }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Text className="mb-2 text-2xl font-black text-[#17191d] dark:text-night-text">
          Share your first post
        </Text>
        <Text className="mb-5 text-sm text-black/60 dark:text-night-muted">
          Your beacon is published. Share a post from your new page.
        </Text>
        {publicId && (
          <ProfilePostComposer
            publicId={publicId}
            isPage
            pageNamed
            onPublished={viewPage}
          />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={viewPage}
          className="mt-4 rounded-xl border border-black/15 px-4 py-3 dark:border-night-border"
        >
          <Text className="text-center font-bold text-[#17191d] dark:text-night-text">
            View page
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
