import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { listBeaconPages, type BeaconPage } from "@/api/auth";
import { useAuth } from "@/features/auth/hooks/use-auth";

export function BeaconSwitcher() {
  const router = useRouter();
  const { activePublicId, user } = useAuth();
  const personalSelected =
    !!user && (activePublicId ?? user.publicId) === user.publicId;
  const [pages, setPages] = useState<BeaconPage[]>([]);

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
            className="min-w-0 flex-1 rounded-xl px-4 py-3 active:opacity-75"
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
              className="min-w-0 flex-1 rounded-xl px-4 py-3 active:opacity-75"
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
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/beacons/new')}
        className="mt-1 rounded-xl bg-g000st-red px-4 py-3 disabled:opacity-60"
      >
        <Text className="text-center text-sm font-black text-white">BUILD YOUR BEACON</Text>
      </Pressable>
    </View>
  );
}
