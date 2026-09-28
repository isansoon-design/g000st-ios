import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { createBeaconPage, listBeaconPages, type BeaconPage } from "@/api/auth";
import { useAuth } from "@/features/auth/hooks/use-auth";

export function BeaconSwitcher() {
  const router = useRouter();
  const { activePublicId, setActivePublicId, user } = useAuth();
  const personalSelected =
    !!user && (activePublicId ?? user.publicId) === user.publicId;
  const [pages, setPages] = useState<BeaconPage[]>([]);
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void listBeaconPages()
        .then((items) => {
          if (mounted) setPages(items);
        })
        .catch((error) => {
          Toast.show({
            type: "error",
            text1: "Pages",
            text2:
              error instanceof Error ? error.message : "Could not load pages.",
          });
        });
      return () => {
        mounted = false;
      };
    }, []),
  );

  const switchTo = (publicId: string, displayName: string) => {
    if (activePublicId !== publicId) setActivePublicId(publicId);
    Toast.show({
      type: "success",
      text1: "You are now interacting as",
      text2: displayName,
    });
    router.replace("/(app)/(tabs)/social");
  };

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const page = await createBeaconPage();
      setPages((items) => [...items, page]);
      router.push(`/users/${page.publicId}`);
      Toast.show({
        type: "success",
        text1: "Beacon created",
        text2: "Open Edit profile to add its details.",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not create page",
        text2: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <View className="mb-4 w-full rounded-[22px] border border-white/60 dark:border-white/20 bg-[#D0D0D0] dark:bg-night-header p-4">
      <Text className="mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/45 dark:text-night-muted">
        Your profiles
      </Text>
      {user && (
        <View
          className={`mb-2 flex-row items-stretch rounded-xl ${personalSelected ? "bg-[#17191d]" : "bg-white dark:bg-night-surface"}`}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View my personal profile"
            onPress={() => router.push(`/users/${user.publicId}`)}
            className="min-w-0 flex-1 rounded-l-xl px-4 py-3 active:opacity-75"
          >
            <Text
              className={`font-black ${personalSelected ? "text-white" : "text-[#17191d] dark:text-night-text"}`}
            >
              My personal profile
            </Text>
            <Text
              className={`text-xs ${personalSelected ? "text-white/65" : "text-black/50 dark:text-night-muted"}`}
            >
              {user.publicId.slice(0, 8)} · View profile
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch interaction as your profile"
            accessibilityState={{ selected: personalSelected }}
            onPress={() => switchTo(user.publicId, "Personal profile")}
            className="min-w-14 flex-row items-center justify-center rounded-r-xl border-l border-black/10 px-3 dark:border-white/20"
          >
            <Text
              className={`text-xl font-black ${personalSelected ? "text-white" : "text-[#17191d] dark:text-night-text"}`}
            >
              ⇄
            </Text>
            {personalSelected && (
              <Text className="ml-1 text-xs font-black text-white">✓</Text>
            )}
          </Pressable>
        </View>
      )}
      {pages.map((page) => {
        const selected = activePublicId === page.publicId;
        return (
          <View
            key={page.publicId}
            className={`mb-2 flex-row items-stretch rounded-xl ${selected ? "bg-[#17191d]" : "bg-white dark:bg-night-surface"}`}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${page.displayName || "page"}`}
              onPress={() => router.push(`/users/${page.publicId}`)}
              className="min-w-0 flex-1 rounded-l-xl px-4 py-3 active:opacity-75"
            >
              <Text
                className={`font-black ${selected ? "text-white" : "text-[#17191d] dark:text-night-text"}`}
              >
                {page.displayName || "Untitled beacon"}
              </Text>
              <Text
                className={`text-xs ${selected ? "text-white/65" : "text-black/50 dark:text-night-muted"}`}
              >
                {page.publicId.slice(0, 8)} · View page
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Switch interaction as ${page.displayName || "this page"}`}
              accessibilityState={{ selected }}
              onPress={() =>
                switchTo(page.publicId, page.displayName || "Untitled page")
              }
              className="min-w-14 flex-row items-center justify-center rounded-r-xl border-l border-black/10 px-3 dark:border-white/20"
            >
              <Text
                className={`text-xl font-black ${selected ? "text-white" : "text-[#17191d] dark:text-night-text"}`}
              >
                ⇄
              </Text>
              {selected && (
                <Text className="ml-1 text-xs font-black text-white">✓</Text>
              )}
            </Pressable>
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        disabled={creating}
        onPress={() => void create()}
        className="mt-1 rounded-xl bg-g000st-red px-4 py-3 disabled:opacity-60"
      >
        {creating ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-center text-sm font-black text-white">
            BUILD YOUR BEACON
          </Text>
        )}
      </Pressable>
    </View>
  );
}
