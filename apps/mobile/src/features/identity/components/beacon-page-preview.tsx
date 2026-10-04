import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { PageAddress, type PageAddressFields } from "./page-address";

type Props = Readonly<{
  address?: PageAddressFields;
  avatarUrl?: string;
  bio?: string;
  compact?: boolean;
  coverUrl?: string;
  displayName?: string;
  onChangeAvatar?: () => void;
  onChangeCover?: () => void;
}>;

export function BeaconPagePreview({
  address,
  avatarUrl,
  bio,
  compact,
  coverUrl,
  displayName,
  onChangeAvatar,
  onChangeCover,
}: Props) {
  return (
    <View>
      <View
        className={`${compact ? "h-44" : "h-56"} overflow-hidden bg-[#171d29]`}
      >
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <View className="absolute -right-20 -top-20 h-80 w-80 rounded-full border-[36px] border-white/10 dark:border-white/20" />
        )}
        <View className="absolute inset-0 bg-black/20" />
        {onChangeCover && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change cover image"
            onPress={onChangeCover}
            className="absolute bottom-12 right-4 rounded-full bg-white px-4 py-2 dark:bg-night-surface"
          >
            <Text className="text-xs font-black text-[#17191d] dark:text-night-text">
              ✦ Change cover
            </Text>
          </Pressable>
        )}
      </View>
      <View className="mx-3 -mt-10 rounded-[28px] border border-white bg-white px-5 pb-5 pt-14 shadow-lg dark:border-night-border dark:bg-night-surface">
        {onChangeAvatar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change page photo"
            onPress={onChangeAvatar}
            className="absolute -top-11 left-5 h-24 w-24 overflow-hidden rounded-[28px] border-4 border-white bg-[#dfe2e9] dark:border-night-border dark:bg-night-raised"
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                contentFit="cover"
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <Text className="pt-5 text-center text-4xl">👻</Text>
            )}
          </Pressable>
        ) : (
          <View className="absolute -top-11 left-5 h-24 w-24 overflow-hidden rounded-[28px] border-4 border-white bg-[#dfe2e9] dark:border-night-border dark:bg-night-raised">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                contentFit="cover"
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <Text className="pt-5 text-center text-4xl">👻</Text>
            )}
          </View>
        )}
        <Text className="self-start rounded-full bg-[#c62828]/10 px-3 py-1 text-[10px] font-black tracking-widest text-[#a21e1e] dark:bg-night-softred dark:text-red-200">
          ✦ BEACON PAGE
        </Text>
        <Text className="mt-2 text-2xl font-black text-[#17191d] dark:text-night-text">
          {displayName?.trim() || "Untitled beacon"}
        </Text>
        {!!bio?.trim() && (
          <Text className="mt-4 leading-6 text-black/60 dark:text-night-muted">
            {bio.trim()}
          </Text>
        )}
        {address && <PageAddress profile={address} />}
        {onChangeAvatar && (
          <Pressable
            accessibilityRole="button"
            onPress={onChangeAvatar}
            className="mt-3 self-start rounded-full bg-[#f0f1f4] px-3 py-2 dark:bg-night-raised"
          >
            <Text className="text-xs font-black text-[#17191d] dark:text-night-text">
              Change photo
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
