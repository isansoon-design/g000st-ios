import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { startChatConversation } from "@/api/chat";
import { listMarketPosts } from "@/api/market";
import {
  getSocialProfile,
  listSocialPosts,
  toggleSocialCamp,
  updateSocialProfile,
  uploadCoverMedia,
} from "@/api/social";
import type { MarketPost } from "@/domain/market/types";
import type { SocialPost, SocialProfile } from "@/domain/social/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCalling } from "@/features/calling/hooks/use-calling";
import { chatConversationHref } from "@/features/chat/navigation";
import { AppThemeSwitch } from "@/components/navigation/app-theme-switch";

type Tab = "social" | "market";

export default function UserProfileScreen() {
  const { publicId } = useLocalSearchParams<{ publicId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePublicId } = useAuth();
  const { callUser } = useCalling();
  const own = publicId === activePublicId;
  const [profile, setProfile] = useState<SocialProfile>();
  const [social, setSocial] = useState<SocialPost[]>([]);
  const [market, setMarket] = useState<MarketPost[]>([]);
  const [tab, setTab] = useState<Tab>("social");
  const [cursors, setCursors] = useState<{ social?: string; market?: string }>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!publicId) return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoading(true);
        setProfile(undefined);
        setSocial([]);
        setMarket([]);
        setCursors({});
        setError("");
        return Promise.all([
          getSocialProfile(publicId),
          listSocialPosts(publicId),
          listMarketPosts(publicId),
        ]);
      })
      .then((result) => {
        if (!active || !result) return;
        const [person, socialPage, marketPage] = result;
        setProfile(person);
        setSocial(socialPage.items);
        setMarket(marketPage.items);
        setCursors({
          social: socialPage.nextCursor,
          market: marketPage.nextCursor,
        });
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load profile.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [publicId]);

  const loadMore = useCallback(async () => {
    if (!publicId || !cursors[tab] || loadingMore) return;
    setLoadingMore(true);
    try {
      if (tab === "social") {
        const page = await listSocialPosts(publicId, cursors.social);
        setSocial((current) => [
          ...current,
          ...page.items.filter(
            (item) => !current.some((old) => old.id === item.id),
          ),
        ]);
        setCursors((current) => ({ ...current, social: page.nextCursor }));
      } else {
        const page = await listMarketPosts(publicId, cursors.market);
        setMarket((current) => [
          ...current,
          ...page.items.filter(
            (item) => !current.some((old) => old.id === item.id),
          ),
        ]);
        setCursors((current) => ({ ...current, market: page.nextCursor }));
      }
    } catch (reason) {
      Toast.show({
        type: "error",
        text1: "Profile",
        text2:
          reason instanceof Error
            ? reason.message
            : "Could not load more posts.",
      });
    } finally {
      setLoadingMore(false);
    }
  }, [cursors, loadingMore, publicId, tab]);

  async function openChat() {
    if (!publicId) return;
    try {
      const conversation = await startChatConversation(publicId);
      router.push(chatConversationHref(conversation.id), { withAnchor: true });
    } catch (reason) {
      Toast.show({
        type: "error",
        text1: "Chat",
        text2:
          reason instanceof Error ? reason.message : "Could not open chat.",
      });
    }
  }

  async function toggleFollow() {
    if (!publicId || !profile || own || followBusy) return;
    setFollowBusy(true);
    try {
      const { camped } = await toggleSocialCamp(publicId);
      setProfile((current) => current?.publicId === publicId ? { ...current, campedByViewer: camped } : current);
      Toast.show({ type: "success", text1: camped ? "Following" : "Unfollowed" });
    } catch (reason) {
      Toast.show({ type: "error", text1: "Follow", text2: reason instanceof Error ? reason.message : "Could not update follow." });
    } finally {
      setFollowBusy(false);
    }
  }

  async function changeCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Toast.show({
        type: "error",
        text1: "Allow photo access to choose a cover.",
      });
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled) return;
    const selected = result.assets[0];
    if (
      !selected?.fileSize ||
      !selected.mimeType ||
      selected.fileSize > 3 * 1024 * 1024
    )
      return Toast.show({
        type: "error",
        text1: "Choose an image up to 3 MB.",
      });
    setUploading(true);
    try {
      const coverMedia = await uploadCoverMedia({
        byteSize: selected.fileSize,
        contentType: selected.mimeType,
        fileName: selected.fileName ?? "cover.jpg",
        uri: selected.uri,
      });
      setProfile(await updateSocialProfile({ coverMedia }));
      Toast.show({ type: "success", text1: "Cover updated." });
    } catch (reason) {
      Toast.show({
        type: "error",
        text1: "Cover",
        text2:
          reason instanceof Error ? reason.message : "Could not update cover.",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <View className="flex-1 bg-[#e6e8eb] dark:bg-night-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View className="h-56 overflow-hidden bg-[#171d29]">
          {profile?.coverUrl ? (
            <Image
              source={{ uri: profile.coverUrl }}
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <View className="absolute -right-20 -top-20 h-80 w-80 rounded-full border-[36px] border-white/10 dark:border-white/20" />
          )}
          <View className="absolute inset-0 bg-black/20" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="absolute left-4 top-4 h-10 w-10 items-center justify-center rounded-full bg-black/50"
          >
            <Text className="text-xl font-bold text-white">‹</Text>
          </Pressable>
          <View className="absolute right-4 top-4 rounded-full bg-white/80 dark:bg-night-surface"><AppThemeSwitch /></View>
          {own && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void changeCover()}
              disabled={uploading}
              className="absolute bottom-4 right-4 rounded-full bg-white dark:bg-night-surface px-4 py-2"
            >
              <Text className="text-xs font-black">
                {uploading ? "Uploading…" : "✦ Change cover"}
              </Text>
            </Pressable>
          )}
        </View>
        {loading ? (
          <ActivityIndicator className="mt-12" color="#c62828" />
        ) : error ? (
          <Text className="m-5 rounded-3xl bg-white dark:bg-night-surface p-8 text-center text-black/60 dark:text-night-muted">
            {error}
          </Text>
        ) : (
          profile && (
            <>
              <Animated.View
                entering={FadeInDown.duration(450).springify()}
                className="mx-3 -mt-10 rounded-[28px] border border-white bg-white dark:bg-night-surface px-5 pb-5 pt-14 shadow-lg"
              >
                <View className="absolute -top-11 left-5 h-24 w-24 overflow-hidden rounded-[28px] border-4 border-white bg-[#dfe2e9] dark:bg-night-raised">
                  {profile.avatarUrl ? (
                    <Image
                      source={{ uri: profile.avatarUrl }}
                      contentFit="cover"
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : (
                    <Text className="pt-5 text-center text-4xl">👻</Text>
                  )}
                </View>
                <Text className="self-start rounded-full bg-[#c62828]/10 dark:bg-night-softred px-3 py-1 text-[10px] font-black tracking-widest text-[#a21e1e] dark:text-red-200">
                  {profile.isPage ? '✦ BEACON PAGE' : '✦ G000ST PROFILE'}
                </Text>
                <Text className="mt-2 text-2xl font-black text-[#17191d] dark:text-night-text">
                  {profile.displayName || (profile.isPage ? 'Untitled beacon' : `User ${publicId?.slice(0, 8)}`)}
                </Text>
                <Pressable
                  onPress={() => {
                    if (publicId)
                      void Clipboard.setStringAsync(publicId).then(() =>
                        Toast.show({
                          type: "success",
                          text1: "Public ID copied.",
                        }),
                      );
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Copy public ID"
                  className="mt-3 flex-row items-center self-start rounded-xl bg-[#f0f1f4] dark:bg-night-surface px-3 py-2"
                >
                  <Text
                    numberOfLines={1}
                    className="max-w-[250px] text-xs text-[#333] dark:text-night-text"
                  >
                    {publicId}
                  </Text>
                  <Text className="ml-2 text-sm">▢</Text>
                </Pressable>
                {!!profile.bio && (
                  <Text className="mt-4 leading-6 text-black/60 dark:text-night-muted">
                    {profile.bio}
                  </Text>
                )}
                {own && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push("/(app)/(tabs)/identity")}
                    className="mt-4 self-start rounded-full border border-black/15 dark:border-night-border px-4 py-2"
                  >
                    <Text className="text-xs font-black">Edit profile</Text>
                  </Pressable>
                )}
                {!own && (
                  <View className="mt-5 gap-2">
                    <View className="flex-row gap-2">
                      <Action label={followBusy ? "Updating…" : profile.campedByViewer ? "✓ Unfollow" : "➕ Follow"} disabled={followBusy} onPress={() => void toggleFollow()} />
                      <Action label="✉ Chat" primary onPress={() => void openChat()} />
                    </View>
                    <View className="flex-row gap-2">
                      <Action label="📞 Voice" onPress={() => { if (publicId) void callUser(publicId, profile.displayName, "audio"); }} />
                      <Action label="🎥 Video" onPress={() => { if (publicId) void callUser(publicId, profile.displayName, "video"); }} />
                    </View>
                  </View>
                )}
                {profile.isPage && (profile.whatsappNumber || profile.landlineNumber || profile.contactEmail || profile.facebookUrl || profile.instagramUrl || profile.tiktokUrl || profile.linkedinUrl) && <View className="mt-5 border-t border-black/10 pt-4 dark:border-night-border">
                  {profile.whatsappNumber && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://wa.me/${profile.whatsappNumber!.replace(/\D/g, '')}`)} className="mb-3 flex-row items-center justify-between rounded-2xl bg-[#d8f8e6] px-4 py-3 dark:bg-[#173d2b]"><View><Text className="text-sm font-black text-[#126c3d] dark:text-[#8de5b3]">✆  Chat on WhatsApp</Text><Text className="mt-0.5 text-[11px] text-[#126c3d]/70 dark:text-[#8de5b3]">Open a direct conversation</Text></View><Text className="text-xl font-black text-[#126c3d] dark:text-[#8de5b3]">↗</Text></Pressable>}
                  {profile.landlineNumber && <Pressable accessibilityRole="link" accessibilityLabel={`Call landline ${profile.landlineNumber}`} onPress={() => void Linking.openURL(`tel:${profile.landlineNumber}`)} className="mb-3 flex-row items-center justify-between rounded-2xl border border-[#b7cbe5] bg-[#eef4fc] px-4 py-3 dark:border-[#405a7a] dark:bg-[#202e42]"><View className="min-w-0 flex-1"><Text className="text-[10px] font-black uppercase tracking-[1px] text-[#587398] dark:text-[#9cb9da]">☎ LANDLINE · TAP TO CALL</Text><Text selectable className="mt-1 text-base font-black text-[#233e63] dark:text-[#d3e3f6]">{profile.landlineNumber}</Text></View><View className="ml-3 h-10 w-10 items-center justify-center rounded-full bg-[#2d4669] dark:bg-[#6288b6]"><Text className="text-lg font-black text-white">☎</Text></View></Pressable>}
                  <View className="flex-row flex-wrap gap-2">
                    {([
                      ['Email', profile.contactEmail ? `mailto:${profile.contactEmail}` : undefined],
                      ['Facebook', profile.facebookUrl],
                      ['Instagram', profile.instagramUrl],
                      ['TikTok', profile.tiktokUrl],
                      ['LinkedIn', profile.linkedinUrl],
                    ] as const).filter((item) => !!item[1]).map(([label, url]) => <Pressable key={label} accessibilityRole="link" onPress={() => { if (url) void Linking.openURL(url); }} className="rounded-full border border-black/10 bg-[#f0f1f4] px-4 py-2 dark:border-night-border dark:bg-night-raised"><Text className="text-xs font-black text-[#17191d] dark:text-night-text">{label} ↗</Text></Pressable>)}
                  </View>
                </View>}
              </Animated.View>

              <View className="mx-3 mt-5 flex-row rounded-2xl bg-white dark:bg-night-surface p-1.5">
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === "social" }}
                  onPress={() => setTab("social")}
                  className={`flex-1 rounded-xl py-3 ${tab === "social" ? "bg-[#17191d]" : ""}`}
                >
                  <Text
                    className={`text-center text-sm font-black ${tab === "social" ? "text-white" : "text-black/45 dark:text-night-muted"}`}
                  >
                    ◎ Social
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === "market" }}
                  onPress={() => setTab("market")}
                  className={`flex-1 rounded-xl py-3 ${tab === "market" ? "bg-[#17191d]" : ""}`}
                >
                  <Text
                    className={`text-center text-sm font-black ${tab === "market" ? "text-white" : "text-black/45 dark:text-night-muted"}`}
                  >
                    ◈ Market
                  </Text>
                </Pressable>
              </View>
              <View className="mx-3 mt-4 gap-3">
                {(tab === "social" ? social : market).length === 0 && (
                  <Text className="rounded-3xl bg-white dark:bg-night-surface p-12 text-center text-sm text-black/45 dark:text-night-muted">
                    {tab === "social"
                      ? "No public social posts yet."
                      : "No market listings yet."}
                  </Text>
                )}
                {tab === "social"
                  ? social.map((post, index) => (
                    <Animated.View
                      entering={FadeInDown.delay(
                        Math.min(index * 45, 250),
                      ).duration(350)}
                      key={post.id}
                    >
                      <SocialCard post={post} />
                    </Animated.View>
                  ))
                  : market.map((post, index) => (
                    <Animated.View
                      entering={FadeInDown.delay(
                        Math.min(index * 45, 250),
                      ).duration(350)}
                      key={post.id}
                    >
                      <MarketCard post={post} />
                    </Animated.View>
                  ))}
                {!!cursors[tab] && (
                  <Pressable
                    onPress={() => void loadMore()}
                    disabled={loadingMore}
                    className="rounded-2xl bg-white dark:bg-night-surface p-4"
                  >
                    <Text className="text-center text-sm font-black">
                      {loadingMore ? "Loading…" : "Load more"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          )
        )}
      </ScrollView>
    </View>
  );
}

function Action({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`flex-1 rounded-2xl py-3 ${primary ? "bg-[#c62828]" : "bg-[#17191d]"} ${disabled ? "opacity-50" : ""}`}
    >
      <Text className="text-center text-xs font-black text-white">{label}</Text>
    </Pressable>
  );
}

function CardHeader({
  name,
  avatarUrl,
  createdAtMs,
}: {
  name: string;
  avatarUrl?: string;
  createdAtMs: number;
}) {
  return (
    <View className="flex-row items-center gap-3 p-4">
      <View className="h-10 w-10 overflow-hidden rounded-full bg-[#222]">
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 40, height: 40 }}
            contentFit="cover"
          />
        ) : (
          <Text className="pt-2 text-center text-white">👻</Text>
        )}
      </View>
      <View>
        <Text className="text-sm font-black">{name}</Text>
        <Text className="text-xs text-black/40 dark:text-night-muted">
          {new Date(createdAtMs).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

function SocialCard({ post }: { post: SocialPost }) {
  return (
    <View className="overflow-hidden rounded-3xl bg-white dark:bg-night-surface">
      <CardHeader
        name={post.author.displayName}
        avatarUrl={post.author.avatarUrl}
        createdAtMs={post.createdAtMs}
      />
      <Text className="px-4 pb-4 text-sm leading-6">{post.content}</Text>
      {post.sharedPost && (
        <View className="mx-4 mb-4 overflow-hidden rounded-2xl bg-[#f1f2f4] dark:bg-night-raised">
          <View className="p-4">
            <Text className="text-xs font-black">
              {post.sharedPost.author.displayName}
            </Text>
            <Text className="mt-1 text-sm">{post.sharedPost.content}</Text>
          </View>
          {post.sharedPost.media?.map((item) => (
            <CardMedia key={item.id} item={item} />
          ))}
        </View>
      )}
      {post.media?.map((item) => (
        <CardMedia key={item.id} item={item} />
      ))}
      <Text className="p-4 text-xs text-black/40 dark:text-night-muted">
        ♡ {post.likeCount} ◌ {post.commentCount}
      </Text>
    </View>
  );
}

function MarketCard({ post }: { post: MarketPost }) {
  return (
    <View className="overflow-hidden rounded-3xl bg-white dark:bg-night-surface">
      <CardHeader
        name={post.author.displayName}
        avatarUrl={post.author.avatarUrl}
        createdAtMs={post.createdAtMs}
      />
      <Text className="px-4 pb-3 text-sm leading-6">{post.content}</Text>
      <View className="flex-row flex-wrap gap-2 px-4 pb-4">
        <Text className="rounded-full bg-[#c62828] px-3 py-1.5 text-xs font-black text-white">
          {post.price.toLocaleString()} {post.currency}
        </Text>
        <Text className="rounded-full bg-[#f0f1f4] dark:bg-night-surface px-3 py-1.5 text-xs font-black">
          {post.city}
        </Text>
        <Text className="rounded-full bg-[#f0f1f4] dark:bg-night-surface px-3 py-1.5 text-xs font-black">
          Qty {post.quantity}
        </Text>
      </View>
      {post.media?.map((item) => (
        <CardMedia key={item.id} item={item} />
      ))}
      <Text className="p-4 text-xs text-black/40 dark:text-night-muted">
        ♡ {post.likeCount} ◌ {post.commentCount}
      </Text>
    </View>
  );
}

function CardMedia({
  item,
}: {
  item: { kind: "image" | "video"; url: string };
}) {
  return item.kind === "video" ? (
    <ProfileVideo url={item.url} />
  ) : (
    <Image
      source={{ uri: item.url }}
      contentFit="cover"
      style={{ width: "100%", height: 220 }}
    />
  );
}

function ProfileVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return (
    <VideoView
      player={player}
      nativeControls
      style={{ width: "100%", height: 220 }}
    />
  );
}
