import { randomUUID } from "expo-crypto";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { cssInterop } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Toast from "react-native-toast-message";

import { startChatConversation } from "@/api/chat";
import {
  createSocialPost,
  deleteSocialPost,
  followSocialProfile,
  getSocialProfile,
  listSocialAlerts,
  listSocialPosts,
  listSocialSuggestions,
  markSocialAlertsRead,
  reportSocialPost,
  toggleSocialCamp,
  toggleSocialLike,
  updateSocialPost,
  updateSocialProfile,
  uploadSocialMedia,
} from "@/api/social";
import { FeatureScreen } from "@/components/layout/feature-screen";
import { KeyboardAvoidingView } from "@/components/layout/keyboard-avoiding-view";
import { PostImage } from "@/components/media/post-image";
import { useTabBarScroll } from "@/components/navigation/tab-bar-scroll";
import { PostContentText } from "@/components/posts/post-content-text";
import type {
  SocialAlert,
  SocialPost,
  SocialProfile,
  SocialSuggestion,
  SocialVisibility,
} from "@/domain/social/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { chatConversationHref } from "@/features/chat/navigation";
import { useConfirmModal } from "@/providers/confirm-modal-provider";
import { avatarImageSource } from "@/services/media/avatar-image-source";

type ViewName = "home" | "mine" | "alerts";
cssInterop(VideoView, { className: "style" });
cssInterop(Image, { className: "style" });

export function SocialScreen() {
  const router = useRouter();
  const tabScroll = useTabBarScroll();
  const { activePublicId, user } = useAuth();
  const isPage = !!activePublicId && activePublicId !== user?.publicId;
  const [view, setView] = useState<ViewName>("home");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [alerts, setAlerts] = useState<SocialAlert[]>([]);
  const [editingPost, setEditingPost] = useState<SocialPost>();
  const [sharingPost, setSharingPost] = useState<SocialPost>();
  const [shareDraft, setShareDraft] = useState("");
  const [shareVisibility, setShareVisibility] =
    useState<SocialVisibility>("anonymous");
  const [sharing, setSharing] = useState(false);
  const [draft, setDraft] = useState("");
  const [visibility, setVisibility] = useState<SocialVisibility>("anonymous");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<
    readonly ImagePicker.ImagePickerAsset[]
  >([]);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [suggestions, setSuggestions] = useState<SocialSuggestion[]>([]);
  const [followingSuggestionId, setFollowingSuggestionId] = useState<
    string | null
  >(null);
  const followingSuggestionIdRef = useRef<string | null>(null);
  const followedSuggestionIdsRef = useRef(new Set<string>());
  const [followedSuggestionIds, setFollowedSuggestionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const userPublicId = activePublicId ?? undefined;

  const load = useCallback(async () => {
    try {
      if (view === "alerts") {
        setAlerts(await listSocialAlerts());
        await markSocialAlertsRead();
      } else {
        const page = await listSocialPosts(
          view === "mine" ? userPublicId : undefined,
        );
        setPosts(page.items);
        setNextCursor(page.nextCursor ?? null);
        if (view === "mine" && userPublicId)
          setProfile(await getSocialProfile(userPublicId));
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Social",
        text2:
          error instanceof Error ? error.message : "Could not load Social.",
      });
    } finally {
      setLoading(false);
    }
  }, [userPublicId, view]);
  const loadSuggestions = useCallback(async () => {
    if (!userPublicId || view !== "home") return;
    try {
      const items = (await listSocialSuggestions()).items;
      const receivedIds = new Set(items.map((person) => person.publicId));
      setSuggestions((current) => [
        ...items,
        ...current.filter(
          (person) =>
            (followedSuggestionIdsRef.current.has(person.publicId) ||
              followingSuggestionIdRef.current === person.publicId) &&
            !receivedIds.has(person.publicId),
        ),
      ]);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Suggestions",
        text2:
          error instanceof Error
            ? error.message
            : "Could not load suggestions.",
      });
    }
  }, [userPublicId, view]);

  async function followSuggestion(publicId: string) {
    if (
      followingSuggestionIdRef.current ||
      followedSuggestionIdsRef.current.has(publicId)
    ) return;
    followingSuggestionIdRef.current = publicId;
    setFollowingSuggestionId(publicId);
    try {
      await followSocialProfile(publicId);
      followedSuggestionIdsRef.current.add(publicId);
      setFollowedSuggestionIds(new Set(followedSuggestionIdsRef.current));
      Toast.show({ type: "success", text1: "Following" });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Follow",
        text2:
          error instanceof Error
            ? error.message
            : "Could not follow this person.",
      });
    } finally {
      followingSuggestionIdRef.current = null;
      setFollowingSuggestionId(null);
    }
  }
  useFocusEffect(
    useCallback(() => {
      void load();
      void loadSuggestions();
      let timer: ReturnType<typeof setTimeout>;
      const schedule = () => {
        const nextDayMs =
          (Math.floor(Date.now() / 86_400_000) + 1) * 86_400_000 + 1_000;
        timer = setTimeout(() => {
          void loadSuggestions();
          schedule();
        }, nextDayMs - Date.now());
      };
      if (view === "home") schedule();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          void load();
          void loadSuggestions();
        }
      });
      return () => {
        clearTimeout(timer);
        subscription.remove();
      };
    }, [load, loadSuggestions, view]),
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current || view === "alerts") return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await listSocialPosts(
        view === "mine" ? userPublicId : undefined,
        nextCursor,
      );
      setPosts((current) => {
        const known = new Set(current.map((post) => post.id));
        return [
          ...current,
          ...page.items.filter((post) => !known.has(post.id)),
        ];
      });
      setNextCursor(page.nextCursor ?? null);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Social",
        text2:
          error instanceof Error ? error.message : "Could not load more posts.",
      });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor, userPublicId, view]);

  const onPickLibraryAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: "error",
        text1: "Media",
        text2: "Photo library permission is required.",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 0.9,
      selectionLimit: 2,
    });
    if (result.canceled) return;
    if (
      result.assets.some(
        (item) =>
          !item.fileSize || !item.mimeType?.startsWith("image/") || item.fileSize > 5 * 1024 * 1024,
      )
    )
      return Toast.show({
        type: "error",
        text1: "Media",
        text2: "Choose images up to 5 MB per file.",
      });
    if (
      result.assets.length > 2
    )
      return Toast.show({
        type: "error",
        text1: "Media",
        text2: "Choose up to two images.",
      });
    setSelectedMedia(result.assets);
  };

  const onCaptureAttachment = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: "error",
        text1: "Media",
        text2: "Camera permission is required.",
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled) return;
    if (
      result.assets.some(
        (item) =>
          !item.fileSize || !item.mimeType?.startsWith("image/") || item.fileSize > 5 * 1024 * 1024,
      )
    )
      return Toast.show({
        type: "error",
        text1: "Media",
        text2: "Choose images up to 5 MB per file.",
      });
    setSelectedMedia((prev) => {
      const next = [...prev, ...result.assets];
      if (
        next.length > 2
      ) {
        return result.assets;
      }
      return next;
    });
  };

  async function publish() {
    const content = draft.trim();
    if ((!content && selectedMedia.length === 0) || posting) return;
    setPosting(true);
    try {
      const clientPostId = randomUUID();
      const media = selectedMedia.length
        ? await Promise.all(
            selectedMedia.map((item) =>
              uploadSocialMedia({
                byteSize: item.fileSize!,
                clientPostId,
                contentType: item.mimeType!,
                fileName: item.fileName || "social-media",
                uri: item.uri,
              }),
            ),
          )
        : undefined;
      const post = await createSocialPost(
        clientPostId,
        content,
        isPage ? "public" : visibility,
        media,
      );
      setPosts((items) => [post, ...items]);
      setDraft("");
      setSelectedMedia([]);
      setIsAttachmentMenuOpen(false);
      setIsComposerOpen(false);
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

  async function openChat(publicId?: string) {
    if (!publicId)
      return Toast.show({
        type: "info",
        text1: "Anonymous post",
        text2: "This author chose not to show their identity.",
      });
    try {
      const conversation = await startChatConversation(publicId);
      router.navigate(chatConversationHref(conversation.id), {
        withAnchor: true,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Chat",
        text2: error instanceof Error ? error.message : "Could not open chat.",
      });
    }
  }

  async function publishShare() {
    if (!sharingPost || sharing) return;
    setSharing(true);
    try {
      const post = await createSocialPost(
        randomUUID(),
        shareDraft.trim(),
        isPage ? "public" : shareVisibility,
        undefined,
        sharingPost.sharedPostId ?? sharingPost.id,
      );
      setPosts((items) => [post, ...items]);
      setSharingPost(undefined);
      setShareDraft("");
      Toast.show({ type: "success", text1: "Shared to Social" });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Share",
        text2: error instanceof Error ? error.message : "Could not share post.",
      });
    } finally {
      setSharing(false);
    }
  }

  return (
    <FeatureScreen
      title={
        <View className="h-14 flex-row items-center justify-between border-b border-black/10 dark:border-night-border px-4">
          <Text className="text-lg font-black text-[#1A1A1A] dark:text-night-text">
            g<Text className="text-[#C62828]">000</Text>
            st
            <Text className="text-[#C62828]">S</Text>
            ocial
          </Text>
        </View>
      }
    >
      <View className="flex-1 bg-[#E7E7E9] dark:bg-night-canvas">
        <Modal
          visible={isComposerOpen}
          transparent
          statusBarTranslucent
          navigationBarTranslucent
          animationType="slide"
          onRequestClose={() => {
            if (!posting) {
              setIsAttachmentMenuOpen(false);
              setIsComposerOpen(false);
            }
          }}
        >
          <KeyboardAvoidingView
            behavior="padding"
            className="flex-1 justify-end bg-black/50"
          >
            <View className="max-h-[92%] mb-7 rounded-t-[28px] bg-[#F7F7F8] dark:bg-night-surface pt-5">
              <View className="flex-row items-center justify-between px-5 pb-4">
                <View>
                  <Text className="text-xl font-black text-[#17191D] dark:text-night-text">
                    New Social post
                  </Text>
                  <Text className="mt-1 text-xs text-black/50 dark:text-night-muted">
                    Share with the community
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close new Social post"
                  disabled={posting}
                  onPress={() => {
                    setIsAttachmentMenuOpen(false);
                    setIsComposerOpen(false);
                  }}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-night-raised"
                >
                  <Text className="text-xl text-[#17191D] dark:text-night-text">
                    ×
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerClassName="px-5 pb-8"
              >
                <View className="rounded-2xl bg-white dark:bg-night-surface p-3">
                  <TextInput
                    multiline
                    maxLength={4000}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Share without a name…"
                    className="min-h-20 rounded-2xl border border-black/15 dark:border-night-border bg-white dark:bg-night-surface p-3 text-[15px] text-g000st-black dark:text-night-text"
                    textAlignVertical="top"
                  />

                  {selectedMedia.length > 0 && (
                    <View className="mt-3 flex-row gap-3">
                      {selectedMedia.map((media, index) => (
                        <View key={index} className="relative">
                          <Image
                            source={{ uri: media.uri }}
                            className="h-16 w-16 rounded-lg bg-black/5 dark:bg-white/10"
                            contentFit="cover"
                          />
                          {media.type === "video" && (
                            <View className="absolute inset-0 items-center justify-center rounded-lg bg-black/20">
                              <Text className="text-[10px] font-black text-white">
                                ▶
                              </Text>
                            </View>
                          )}
                          <Pressable
                            onPress={() =>
                              setSelectedMedia((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                            hitSlop={8}
                            className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-black/50"
                          >
                            <Text className="text-[10px] font-bold text-white">
                              ✕
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  <View className="mt-2 flex-row items-center">
                    <Pressable
                      onPress={() => setIsAttachmentMenuOpen(true)}
                      className="mr-2 rounded-xl border border-black/10 dark:border-night-border px-3 py-3"
                    >
                      <Text className="text-xs font-black text-black dark:text-night-text">
                        {selectedMedia.length
                          ? `✓ ${selectedMedia.length}`
                          : "📎 Media"}
                      </Text>
                    </Pressable>
                    <Switch
                      disabled={isPage}
                      thumbColor="#000000"
                      trackColor={{ false: "#9A9A9A", true: "#C62828" }}
                      value={isPage || visibility === "public"}
                      onValueChange={(value) =>
                        setVisibility(value ? "public" : "anonymous")
                      }
                    />
                    <Text className="ml-2 text-black dark:text-night-text flex-1 text-xs font-bold">
                      {isPage ? "Page name is always shown" : "Show identity"}
                    </Text>
                    <Pressable
                      disabled={(!draft.trim() && selectedMedia.length === 0) || posting}
                      onPress={() => void publish()}
                      className="rounded-xl bg-[#222] px-5 py-3 disabled:opacity-40"
                    >
                      <Text className="font-black text-white">
                        {posting ? "Posting…" : "Post"}
                      </Text>
                    </Pressable>
                  </View>
                  {isAttachmentMenuOpen && (
                    <View className="mt-3 rounded-2xl border border-black/10 bg-white px-4 dark:border-night-border dark:bg-night-raised">
                      {[
                        ["Photo library", onPickLibraryAttachment],
                        ["Camera", onCaptureAttachment],
                      ].map(([label, action], index) => (
                        <Pressable
                          key={label as string}
                          className={`py-4 ${index === 0 ? "border-b border-black/10 dark:border-night-border" : ""}`}
                          onPress={() => {
                            setIsAttachmentMenuOpen(false);
                            void (action as () => Promise<void>)();
                          }}
                        >
                          <Text className="text-center font-bold text-[#1A1A1A] dark:text-night-text">
                            {label as string}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : view === "alerts" ? (
          <ScrollView
            className="flex-1"
            onScroll={tabScroll?.onScroll}
            scrollEventThrottle={16}
            contentContainerClassName="gap-3 p-3"
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => {
                  void load();
                  void loadSuggestions();
                }}
              />
            }
          >
            <AlertList alerts={alerts} />
          </ScrollView>
        ) : (
          <FlatList
            data={posts}
            onScroll={tabScroll?.onScroll}
            scrollEventThrottle={16}
            keyExtractor={(post) => post.id}
            className="flex-1"
            contentContainerClassName="gap-3 p-3"
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={1.5}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => {
                  void load();
                  void loadSuggestions();
                }}
              />
            }
            ListHeaderComponent={
              <View className="gap-3">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create a Social post"
                  onPress={() => setIsComposerOpen(true)}
                  className="mb-1 flex-row items-center gap-3 rounded-2xl border border-black/10 dark:border-night-border bg-white dark:bg-night-surface p-4 shadow-sm"
                >
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#C62828]">
                    <Text className="text-2xl font-light text-white">＋</Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[15px] font-black text-[#17191D] dark:text-night-text">
                      Create a Social post
                    </Text>
                    <Text className="mt-0.5 text-xs text-black/50 dark:text-night-muted">
                      Share with the community
                    </Text>
                  </View>
                  <Text className="text-xl font-bold text-[#C62828]">›</Text>
                </Pressable>
                {view === "home" && suggestions.length > 0 ? (
                  <SuggestedPeople
                    suggestions={suggestions}
                    followingId={followingSuggestionId}
                    followedIds={followedSuggestionIds}
                    onFollow={followSuggestion}
                  />
                ) : view === "mine" && profile ? (
                  <ProfileEditor
                    profile={profile}
                    onSave={async (value) =>
                      setProfile(await updateSocialProfile(value))
                    }
                  />
                ) : null}
              </View>
            }
            ListEmptyComponent={
              <Text className="py-20 text-center font-bold text-black/40 dark:text-night-muted">
                No posts yet.
              </Text>
            }
            ListFooterComponent={
              loadingMore ? <ActivityIndicator className="py-3" /> : null
            }
            renderItem={({ item: post }) => (
              <PostCard
                post={post}
                onChat={openChat}
                onShare={() => {
                  setShareDraft("");
                  setShareVisibility("anonymous");
                  setSharingPost(post);
                }}
                onEdit={() => setEditingPost(post)}
                onDelete={async () => {
                  await deleteSocialPost(post.id);
                  setPosts((items) =>
                    items.filter((item) => item.id !== post.id),
                  );
                }}
                onReport={() => reportSocialPost(post.id)}
                onLike={async () => {
                  const result = await toggleSocialLike(post.id);
                  setPosts((items) =>
                    items.map((item) =>
                      item.id === post.id
                        ? { ...item, ...result, likedByViewer: result.liked }
                        : item,
                    ),
                  );
                }}
                onCamp={async () => {
                  if (!post.ownerPublicId) return;
                  const result = await toggleSocialCamp(post.ownerPublicId);
                  setPosts((items) =>
                    items.map((item) =>
                      item.ownerPublicId === post.ownerPublicId
                        ? { ...item, campedByViewer: result.camped }
                        : item,
                    ),
                  );
                  if (result.camped) {
                    setSuggestions((current) =>
                      current.filter(
                        (person) => person.publicId !== post.ownerPublicId,
                      ),
                    );
                    void loadSuggestions();
                  }
                }}
                onComments={() =>
                  router.push(`/posts/social/${post.id}` as Href)
                }
              />
            )}
          />
        )}
        <View className="h-14 flex-row border-t border-black/15 dark:border-night-border bg-white dark:bg-night-surface">
          <ViewButton
            label="Home"
            active={view === "home"}
            onPress={() => setView("home")}
          />
          <ViewButton
            label="My Posts"
            active={view === "mine"}
            onPress={() => setView("mine")}
          />
          <ViewButton
            label="Alerts"
            active={view === "alerts"}
            onPress={() => setView("alerts")}
          />
        </View>
      </View>

      <Modal
        visible={!!sharingPost}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setSharingPost(undefined)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1 justify-end bg-black/50"
        >
          <View className="gap-3 rounded-t-[28px] bg-white dark:bg-night-surface p-5 pb-12">
            <Text className="text-lg font-black text-g000st-black dark:text-night-text">
              Share to Social
            </Text>
            {sharingPost && (
              <SharedPostPreview
                compact
                sharedPost={
                  sharingPost.sharedPost ?? {
                    id: sharingPost.id,
                    author: sharingPost.author,
                    content: sharingPost.content,
                    media: sharingPost.media,
                    createdAtMs: sharingPost.createdAtMs,
                  }
                }
              />
            )}
            <TextInput
              value={shareDraft}
              onChangeText={setShareDraft}
              placeholder="Add a note (optional)"
              maxLength={4000}
              multiline
              className="min-h-20 rounded-xl border border-black/15 dark:border-night-border p-3 text-g000st-black dark:text-night-text"
              textAlignVertical="top"
            />
            <View className="flex-row items-center">
              <Switch
                disabled={isPage}
                value={isPage || shareVisibility === "public"}
                onValueChange={(value) =>
                  setShareVisibility(value ? "public" : "anonymous")
                }
              />
              <Text className="ml-2 flex-1 text-sm font-bold text-g000st-black dark:text-night-text">
                {isPage ? "Page name is always shown" : "Show my identity"}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setSharingPost(undefined)}
                className="flex-1 rounded-xl bg-[#DDD] dark:bg-night-raised p-3"
              >
                <Text className="text-center font-black text-g000st-black dark:text-night-text">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={sharing}
                onPress={() => void publishShare()}
                className="flex-1 rounded-xl bg-black p-3 disabled:opacity-40"
              >
                <Text className="text-center font-black text-white">
                  {sharing ? "Sharing…" : "Share"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {editingPost && (
        <EditSocialPostModal
          post={editingPost}
          onClose={() => setEditingPost(undefined)}
          onSave={async (postId, content) => {
            const updated = await updateSocialPost(postId, content);
            setPosts((items) =>
              items.map((item) => (item.id === postId ? updated : item)),
            );
            setEditingPost(undefined);
          }}
        />
      )}
    </FeatureScreen>
  );
}

function SuggestedPeople({
  suggestions,
  followingId,
  followedIds,
  onFollow,
}: {
  suggestions: SocialSuggestion[];
  followingId: string | null;
  followedIds: ReadonlySet<string>;
  onFollow: (publicId: string) => Promise<void>;
}) {
  const router = useRouter();
  return (
    <View className="rounded-2xl border border-black/15 dark:border-night-border bg-white dark:bg-night-surface py-4">
      <Text className="px-4 text-sm font-black text-g000st-black dark:text-night-text">
        People you may know
      </Text>
      <Text className="mt-1 px-4 text-xs text-black/55 dark:text-night-muted">
        Fresh suggestions every day
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-3 pb-2 pt-3"
      >
        {suggestions.map((person) => (
          <View
            key={person.publicId}
            className="w-44 items-center rounded-xl border border-black/10 dark:border-night-border bg-[#F6F6F7] dark:bg-night-surface p-3"
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`View ${person.displayName}'s profile`}
              onPress={() => router.push(`/users/${person.publicId}` as Href)}
              className="w-full items-center"
            >
              <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#222]">
                {person.avatarUrl ? (
                  <Image
                    source={avatarImageSource(person.avatarUrl)}
                    className="h-12 w-12"
                  />
                ) : (
                  <Text className="text-sm font-bold text-white">
                    {person.displayName.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text
                numberOfLines={1}
                className="mt-2 w-full text-center text-sm font-bold text-black dark:text-night-muted"
              >
                {person.displayName}
              </Text>
            </Pressable>
            <Text
              numberOfLines={2}
              className="mt-1 h-8 text-center text-[11px] text-black/55 dark:text-night-muted"
            >
              {person.reason === "friends_of_friends"
                ? "Followed by people you follow"
                : "Discover someone new"}
            </Text>
            <Pressable
              disabled={followingId !== null || followedIds.has(person.publicId)}
              accessibilityRole="button"
              accessibilityLabel={
                followingId === person.publicId
                  ? `Following ${person.displayName}`
                  : followedIds.has(person.publicId)
                    ? `Followed ${person.displayName}`
                    : `Follow ${person.displayName}`
              }
              onPress={() => void onFollow(person.publicId)}
              className="mt-2 h-9 w-full items-center justify-center rounded-lg bg-[#222] px-3"
            >
              {followingId === person.publicId ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-center text-xs font-bold text-white">
                  {followedIds.has(person.publicId) ? "✓" : "➕ Follow"}
                </Text>
              )}
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

type PostCardProps = {
  post: SocialPost;
  onChat: (id?: string) => Promise<void>;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onReport: () => Promise<void>;
  onLike: () => Promise<void>;
  onCamp: () => Promise<void>;
  onComments: () => void;
};
function PostCard({
  post,
  onChat,
  onShare,
  onEdit,
  onDelete,
  onReport,
  onLike,
  onCamp,
  onComments,
}: PostCardProps) {
  const router = useRouter();
  const { confirm } = useConfirmModal();
  return (
    <View className="overflow-hidden rounded-2xl border-2 border-black dark:border-night-border bg-white dark:bg-night-surface shadow-sm" style={{ shadowColor: post.author.isPage ? "#c62828" : "#000000" }}>
      <View className="flex-row items-center gap-3 p-4">
        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-black">
          {post.author.avatarUrl ? (
            <Image
              source={avatarImageSource(post.author.avatarUrl)}
              contentFit="cover"
              style={{ height: "100%", width: "100%" }}
            />
          ) : (
            <Image
              source={require("../../../../assets/g000st-icon.jpeg")}
              contentFit="cover"
              style={{ height: "100%", width: "100%" }}
            />
          )}
        </View>
        <Pressable
          className="min-w-0 flex-1"
          onPress={() => {
            if (post.author.publicId)
              router.push(`/users/${post.author.publicId}` as Href);
          }}
          accessibilityRole={post.author.publicId ? "button" : undefined}
        >
          <Text className="text-black dark:text-night-text">
            {post.author.displayName}
          </Text>
          <Text className="text-[10px] text-black/45 dark:text-night-muted">
            {new Date(post.createdAtMs).toLocaleString()}
            {post.editedAtMs ? " · edited" : ""}
          </Text>
        </Pressable>
        {post.ownedByViewer ? (
          <View className="flex-row gap-2">
            <Pressable
              accessibilityLabel="Edit post"
              accessibilityRole="button"
              className="rounded-full border border-black/20 text-black dark:text-night-text dark:border-night-border px-3 py-2"
              onPress={onEdit}
            >
              <Text className="text-xs font-black text-g000st-black dark:text-night-text">
                Edit
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Delete post"
              accessibilityRole="button"
              className="rounded-full border border-[#C62828] px-3 py-2"
              onPress={async () => {
                if (
                  await confirm({
                    title: "Delete post?",
                    message: "Are you sure you want to delete this post?",
                    confirmLabel: "Delete",
                    isDangerous: true,
                  })
                )
                  await onDelete();
              }}
            >
              <Text className="text-xs font-black text-[#C62828]">Delete</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityLabel="Report post"
            accessibilityRole="button"
            onPress={async () => {
              if (
                await confirm({
                  title: "Report post?",
                  message: "Are you sure you want to report this post?",
                  confirmLabel: "Report",
                  isDangerous: true,
                })
              )
                await onReport();
            }}
          >
            <Text className="text-xs font-black text-g000st-black dark:text-night-text">
              Report
            </Text>
          </Pressable>
        )}
      </View>
      {!!post.content && (
        <PostContentText
          content={post.content}
          onOpen={() => router.push(`/posts/social/${post.id}` as Href)}
          className="px-4 pb-3 text-[15px] text-black dark:text-night-text leading-6"
        />
      )}
      {post.sharedPostId && (
        <View className="mx-4 mb-4">
          {post.sharedPost ? (
            <SharedPostPreview sharedPost={post.sharedPost} />
          ) : (
            <View className="rounded-xl border border-black/10 dark:border-night-border p-4">
              <Text className="text-black/50 dark:text-night-muted">
                Original post unavailable
              </Text>
            </View>
          )}
        </View>
      )}
      {post.media?.map((item) =>
        item.kind === "video" ? (
          <SocialVideo key={item.id} uri={item.url} />
        ) : (
          <PostImage
            key={item.id}
            uri={item.url}
            contentType={item.contentType}
            height={post.media?.length === 2 ? 224 : 320}
          />
        ),
      )}
      <View className="flex-row items-center border-t border-black/10 dark:border-night-border p-2">
        <Action
          label={`♥ ${post.likeCount}`}
          active={post.likedByViewer}
          onPress={onLike}
        />
        <Action
          label={`💬 ${post.commentCount}`}
          onPress={async () => onComments()}
        />
        {post.ownerPublicId && !post.ownedByViewer && (
          <Action
            label={post.campedByViewer ? "✓" : "➕"}
            active={post.campedByViewer}
            enlarged={post.campedByViewer}
            accessibilityLabel={post.campedByViewer ? "Following author. Unfollow" : "Follow author"}
            onPress={onCamp}
          />
        )}

        <Action label="↗️" onPress={onShare} />
        {post.ownerPublicId && !post.ownedByViewer && (
          <Action label="Chat" onPress={() => onChat(post.ownerPublicId)} />
        )}
      </View>
    </View>
  );
}

function SharedPostPreview({
  sharedPost,
  compact = false,
}: {
  sharedPost: NonNullable<SocialPost["sharedPost"]>;
  compact?: boolean;
}) {
  const router = useRouter();
  return (
    <View className="overflow-hidden rounded-xl border border-black/15 dark:border-night-border bg-black/[.03] dark:bg-white/10">
      <View className="p-3">
        <Text className="text-xs font-black text-g000st-black dark:text-night-text">
          {sharedPost.author.displayName}
        </Text>
        <PostContentText
          content={sharedPost.content}
          onOpen={() => router.push(`/posts/social/${sharedPost.id}` as Href)}
          numberOfLines={compact ? 3 : undefined}
          className="mt-1 text-sm leading-5 text-g000st-black dark:text-night-text"
        />
      </View>
      {!compact &&
        sharedPost.media?.map((item) =>
          item.kind === "video" ? (
            <SocialVideo key={item.id} uri={item.url} />
          ) : (
            <PostImage
              key={item.id}
              uri={item.url}
              contentType={item.contentType}
              height={sharedPost.media?.length === 2 ? 180 : 260}
            />
          ),
        )}
      {compact && !!sharedPost.media?.length && (
        <Text className="px-3 pb-3 text-xs text-black/50 dark:text-night-muted">
          {sharedPost.media.length} media attachment
          {sharedPost.media.length === 1 ? "" : "s"}
        </Text>
      )}
    </View>
  );
}

function EditSocialPostModal({
  post,
  onClose,
  onSave,
}: {
  post: SocialPost;
  onClose: () => void;
  onSave: (postId: string, content: string) => Promise<void>;
}) {
  const [content, setContent] = useState(post.content);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-black/50 p-5">
        <View className="gap-3 rounded-[24px] bg-white dark:bg-night-surface p-5">
          <Text className="text-lg font-black text-g000st-black dark:text-night-text">
            Edit post
          </Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={4000}
            className="min-h-28 rounded-xl border border-black/15 dark:border-night-border p-3 text-g000st-black dark:text-night-text"
            textAlignVertical="top"
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={onClose}
              className="flex-1 rounded-xl bg-[#DDD] dark:bg-night-raised p-3"
            >
              <Text className="text-center font-black text-g000st-black dark:text-night-text">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const next = content.trim();
                if (next) void onSave(post.id, next);
              }}
              className="flex-1 rounded-xl bg-black p-3"
            >
              <Text className="text-center font-black text-white">Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
function SocialVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      className="h-80 w-full bg-black"
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      nativeControls
      player={player}
    />
  );
}
function ProfileEditor({
  profile,
  onSave,
}: {
  profile: SocialProfile;
  onSave: (profile: Partial<SocialProfile>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [hobby, setHobby] = useState(profile.hobby ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  if (!editing)
    return (
      <Pressable
        onPress={() => setEditing(true)}
        className="rounded-2xl bg-white dark:bg-night-surface p-4"
      >
        <Text className="text-base font-black text-g000st-black dark:text-night-text">
          {profile.displayName || profile.publicId.slice(0, 8)}
        </Text>
        <Text className="mt-1 text-xs text-black/45 dark:text-night-muted">
          {profile.country ||
            profile.hobby ||
            "Tap to complete your optional profile"}
        </Text>
      </Pressable>
    );
  return (
    <View className="gap-2 rounded-2xl bg-white dark:bg-night-surface p-4">
      <Text className="text-base font-black text-g000st-black dark:text-night-text">
        Edit social profile
      </Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Display name"
        className="rounded-xl border border-black/15 dark:border-night-border px-3 py-2 text-g000st-black dark:text-night-text"
      />
      <TextInput
        value={country}
        onChangeText={setCountry}
        placeholder="Country"
        className="rounded-xl border border-black/15 dark:border-night-border px-3 py-2 text-g000st-black dark:text-night-text"
      />
      <TextInput
        value={hobby}
        onChangeText={setHobby}
        placeholder="Hobby"
        className="rounded-xl border border-black/15 dark:border-night-border px-3 py-2 text-g000st-black dark:text-night-text"
      />
      <TextInput
        value={bio}
        onChangeText={setBio}
        placeholder="About me"
        multiline
        className="min-h-20 rounded-xl border border-black/15 dark:border-night-border px-3 py-2 text-g000st-black dark:text-night-text"
        textAlignVertical="top"
      />
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setEditing(false)}
          className="flex-1 rounded-xl bg-[#DDD] dark:bg-night-raised p-3"
        >
          <Text className="text-center font-black text-g000st-black dark:text-night-text">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            void onSave({
              displayName: displayName.trim() || undefined,
              country: country.trim() || undefined,
              hobby: hobby.trim() || undefined,
              bio: bio.trim() || undefined,
            }).then(() => setEditing(false))
          }
          className="flex-1 rounded-xl bg-[#222] p-3"
        >
          <Text className="text-center font-black text-white">Save</Text>
        </Pressable>
      </View>
    </View>
  );
}
function AlertList({ alerts }: { alerts: SocialAlert[] }) {
  const router = useRouter();
  if (!alerts.length)
    return (
      <Text className="py-20 text-center font-bold text-black/40 dark:text-night-muted">
        No alerts yet.
      </Text>
    );
  return (
    <>
      {alerts.map((item) => (
        <Pressable
          key={item.id}
          disabled={item.kind !== "camp" || !item.actor.publicId}
          accessibilityRole={
            item.kind === "camp" && item.actor.publicId ? "link" : undefined
          }
          onPress={() => {
            if (item.actor.publicId)
              router.push(`/users/${item.actor.publicId}` as Href);
          }}
          className="rounded-2xl bg-white dark:bg-night-surface p-4"
        >
          <Text className="text-g000st-black dark:text-night-text">
            <Text className="font-black">{item.actor.displayName} </Text>
            {item.kind === "like"
              ? "liked your post."
              : item.kind === "comment"
                ? "commented on your post."
                : "started following you."}
          </Text>
          <Text className="mt-1 text-[10px] text-black/40 dark:text-night-muted">
            {new Date(item.createdAtMs).toLocaleString()}
          </Text>
        </Pressable>
      ))}
    </>
  );
}
function Action({
  label,
  active,
  enlarged,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  active?: boolean;
  enlarged?: boolean;
  accessibilityLabel?: string;
  onPress: () => void | Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => void onPress()}
      className="flex-1 items-center rounded-xl py-3"
    >
      <Text
        className={`font-black ${active ? "text-[#C62828]" : "text-black/70 dark:text-night-muted"}`}
        style={enlarged ? { transform: [{ scale: 1.6 }] } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function ViewButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(active ? 1.08 : 1);
  const translateY = useSharedValue(active ? -2 : 0);

  useEffect(() => {
    scale.value = withSpring(active ? 1.08 : 1, {
      damping: 14,
      stiffness: 180,
    });
    translateY.value = withSpring(active ? -2 : 0, {
      damping: 14,
      stiffness: 180,
    });
  }, [active, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Pressable onPress={onPress} className="flex-1 items-center justify-center">
      <Animated.View
        style={animatedStyle}
        className="items-center justify-center"
      >
        {active && (
          <View className="mb-1 h-[3px] w-8 rounded-full bg-[#C62828]" />
        )}
        <Text
          className={`text-xs font-black ${active ? "text-black dark:text-night-text" : "text-black/40 dark:text-night-muted"}`}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
