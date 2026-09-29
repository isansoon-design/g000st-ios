import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import {
  InteractionManager,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOpenBeaconPageEditor } from "@/components/navigation/app-sidebar";
import { AppThemeSwitch } from "@/components/navigation/app-theme-switch";
import { BeaconPagePreview } from "@/features/identity/components/beacon-page-preview";

export default function NewBeaconScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const openPageEditor = useOpenBeaconPageEditor();
  const opened = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (opened.current || !openPageEditor) return;
      const task = InteractionManager.runAfterInteractions(() => {
        if (opened.current) return;
        opened.current = true;
        openPageEditor();
      });
      return () => task.cancel();
    }, [openPageEditor]),
  );

  return (
    <View
      className="flex-1 bg-[#e6e8eb] dark:bg-night-canvas"
      style={{ paddingTop: insets.top }}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View>
          <BeaconPagePreview />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="absolute left-4 top-4 h-10 w-10 items-center justify-center rounded-full bg-black/50"
          >
            <Text className="text-xl font-bold text-white">‹</Text>
          </Pressable>
          <View className="absolute right-4 top-4 rounded-full bg-white/80 dark:bg-night-surface">
            <AppThemeSwitch />
          </View>
        </View>
        <View className="mx-3 mt-5 gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={() => openPageEditor?.()}
            className="rounded-2xl bg-g000st-red px-4 py-4"
          >
            <Text className="text-center font-black text-white">
              Add beacon details
            </Text>
          </Pressable>
          <Text className="rounded-3xl bg-white p-12 text-center text-sm text-black/45 dark:bg-night-surface dark:text-night-muted">
            No posts yet.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
