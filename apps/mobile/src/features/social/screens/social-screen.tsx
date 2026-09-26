import { randomUUID } from "expo-crypto";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { cssInterop } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  createSocialComment,
  createSocialPost,
  deleteSocialComment,
  deleteSocialPost,
  getSocialProfile,
  listSocialAlerts,
  listSocialComments,
  listSocialPosts,
  markSocialAlertsRead,
  reportSocialPost,
  toggleSocialCamp,
  toggleSocialLike,
  updateSocialPost,
  updateSocialProfile,
  uploadSocialMedia,
} from "@/api/social";
import { FeatureScreen } from "@/components/layout/feature-screen";
import type {
  SocialAlert,
  SocialComment,
  SocialPost,
  SocialProfile,
  SocialVisibility,
} from "@/domain/social/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useConfirmModal } from "@/providers/confirm-modal-provider";

type ViewName = "home" | "mine" | "alerts";
cssInterop(VideoView, { className: "style" });
cssInterop(Image, { className: "style" });

export function SocialScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [view, setView] = useState<ViewName>("home");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [alerts, setAlerts] = useState<SocialAlert[]>([]);
  const [commentsPost, setCommentsPost] = useState<SocialPost>();
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
  const [selectedMedia, setSelectedMedia] = useState<
    readonly ImagePicker.ImagePickerAsset[]
  >([]);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const userPublicId = user?.publicId;

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
  useFocusEffect(
    useCallback(() => {
      void load();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void load();
      });
      return () => subscription.remove();
    }, [load]),
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
      mediaTypes: ["images", "videos"],
      quality: 0.9,
      selectionLimit: 2,
    });
    if (result.canceled) return;
    const videos = result.assets.filter((item) => item.type === "video");
    if (
      result.assets.some(
        (item) =>
          !item.fileSize || !item.mimeType || item.fileSize > 5 * 1024 * 1024,
      )
    )
      return Toast.show({
        type: "error",
        text1: "Media",
        text2: "Each file must be 5 MB or smaller.",
      });
    if (
      (videos.length && result.assets.length !== 1) ||
      videos.length > 1 ||
      (!videos.length && result.assets.length > 2)
    )
      return Toast.show({
        type: "error",
        text1: "Media",
        text2: "Choose up to two images or one video.",
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
      mediaTypes: ["images", "videos"],
      quality: 0.9,
    });
    if (result.canceled) return;
    if (
      result.assets.some(
        (item) =>
          !item.fileSize || !item.mimeType || item.fileSize > 5 * 1024 * 1024,
      )
    )
      return Toast.show({
        type: "error",
        text1: "Media",
        text2: "Each file must be 5 MB or smaller.",
      });
    setSelectedMedia((prev) => {
      const next = [...prev, ...result.assets];
      const nextVideos = next.filter((item) => item.type === "video");
      if (
        (nextVideos.length && next.length !== 1) ||
        nextVideos.length > 1 ||
        (!nextVideos.length && next.length > 2)
      ) {
        return result.assets;
      }
      return next;
    });
  };

  async function publish() {
    const content = draft.trim();
    if (!content || posting) return;
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
        visibility,
        media,
      );
      setPosts((items) => [post, ...items]);
      setDraft("");
      setSelectedMedia([]);
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
      router.navigate({
        pathname: "/(app)/(tabs)/chat",
        params: { conversationId: conversation.id },
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
        shareVisibility,
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
      rightAction={
        <Pressable onPress={() => setView("alerts")}>
          <Text className="text-xl">🔔</Text>
        </Pressable>
      }
      title={
        <View className="h-14 flex-row items-center justify-between border-b border-black/10 bg-[#D2D2D4] px-4">
          <Text className="text-lg font-black text-[#1A1A1A]">
            g<Text className="text-[#C62828]">000</Text>
            st
            <Text className="text-[#C62828]">S</Text>
            ocial
          </Text>
        </View>
      }
    >
      <View className="flex-1 bg-[#E7E7E9]">
        {view !== "alerts" && (
          <View className="border-b border-black/10 bg-white/80 p-3">
            <TextInput
              multiline
              maxLength={4000}
              value={draft}
              onChangeText={setDraft}
              placeholder="Share without a name…"
              className="min-h-20 rounded-2xl border border-black/15 bg-white p-3 text-[15px]"
              textAlignVertical="top"
            />

            {selectedMedia.length > 0 && (
              <View className="mt-3 flex-row gap-3">
                {selectedMedia.map((media, index) => (
                  <View key={index} className="relative">
                    <Image
                      source={{ uri: media.uri }}
                      className="h-16 w-16 rounded-lg bg-black/5"
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
                className="mr-2 rounded-xl border border-black/10 px-3 py-3"
              >
                <Text className="text-xs font-black">
                  {selectedMedia.length
                    ? `✓ ${selectedMedia.length}`
                    : "📎 Media"}
                </Text>
              </Pressable>
              <Switch
                value={visibility === "public"}
                onValueChange={(value) =>
                  setVisibility(value ? "public" : "anonymous")
                }
              />
              <Text className="ml-2 flex-1 text-xs font-bold">
                Show identity
              </Text>
              <Pressable
                disabled={!draft.trim() || posting}
                onPress={() => void publish()}
                className="rounded-xl bg-[#222] px-5 py-3 disabled:opacity-40"
              >
                <Text className="font-black text-white">
                  {posting ? "Posting…" : "Post"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : view === "alerts" ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-3 p-3"
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => void load()}
              />
            }
          >
            <AlertList alerts={alerts} />
          </ScrollView>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(post) => post.id}
            className="flex-1"
            contentContainerClassName="gap-3 p-3"
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={1.5}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => void load()}
              />
            }
            ListHeaderComponent={
              view === "mine" && profile ? (
                <ProfileEditor
                  profile={profile}
                  onSave={async (value) =>
                    setProfile(await updateSocialProfile(value))
                  }
                />
              ) : null
            }
            ListEmptyComponent={
              <Text className="py-20 text-center font-bold text-black/40">
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
                }}
                onComments={() => setCommentsPost(post)}
              />
            )}
          />
        )}
        <View className="h-14 flex-row border-t border-black/15 bg-white">
          <ViewButton
            label="Home"
            active={view === "home"}
            onPress={() => setView("home")}
          />
          <ViewButton
            label="My Page"
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
        animationType="fade"
        transparent
        visible={isAttachmentMenuOpen}
        onRequestClose={() => setIsAttachmentMenuOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-end bg-black/45 p-5"
          onPress={() => setIsAttachmentMenuOpen(false)}
        >
          <View className="mb-10 w-full rounded-[24px] bg-white p-4">
            {[
              ["Photo or video library", onPickLibraryAttachment],
              ["Camera", onCaptureAttachment],
            ].map(([label, action], index, arr) => (
              <Pressable
                key={label as string}
                className={`py-4 ${index < arr.length - 1 ? "border-b border-black/10" : ""}`}
                onPress={() => {
                  setIsAttachmentMenuOpen(false);
                  void (action as () => Promise<void>)();
                }}
              >
                <Text className="text-center font-bold text-[#1A1A1A]">
                  {label as string}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      <Modal
        visible={!!sharingPost}
        transparent
        animationType="slide"
        onRequestClose={() => setSharingPost(undefined)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="gap-3 rounded-t-[28px] bg-white p-5 pb-12">
            <Text className="text-lg font-black">Share to Social</Text>
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
              className="min-h-20 rounded-xl border border-black/15 p-3"
              textAlignVertical="top"
            />
            <View className="flex-row items-center">
              <Switch
                value={shareVisibility === "public"}
                onValueChange={(value) =>
                  setShareVisibility(value ? "public" : "anonymous")
                }
              />
              <Text className="ml-2 flex-1 text-sm font-bold">
                Show my identity
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setSharingPost(undefined)}
                className="flex-1 rounded-xl bg-[#DDD] p-3"
              >
                <Text className="text-center font-black">Cancel</Text>
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
      {commentsPost && (
        <SocialCommentsModal
          post={commentsPost}
          visibility={visibility}
          onClose={() => setCommentsPost(undefined)}
          onCountChange={(postId, delta) =>
            setPosts((items) =>
              items.map((item) =>
                item.id === postId
                  ? {
                    ...item,
                    commentCount: Math.max(0, item.commentCount + delta),
                  }
                  : item,
              ),
            )
          }
        />
      )}
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
  const { confirm } = useConfirmModal();
  return (
    <View className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-sm">
      <View className="flex-row items-center gap-3 p-4">
        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-black">
          {post.author.avatarUrl ? (
            <Image
              source={{ uri: post.author.avatarUrl }}
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
          onPress={() => void onChat(post.ownerPublicId)}
        >
          <Text className="font-black">{post.author.displayName}</Text>
          <Text className="text-[10px] text-black/45">
            {new Date(post.createdAtMs).toLocaleString()}
            {post.editedAtMs ? " · edited" : ""}
          </Text>
        </Pressable>
        {post.ownedByViewer ? (
          <View className="flex-row gap-2">
            <Pressable
              accessibilityLabel="Edit post"
              accessibilityRole="button"
              className="rounded-full border border-black/20 px-3 py-2"
              onPress={onEdit}
            >
              <Text className="text-xs font-black">Edit</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Delete post"
              accessibilityRole="button"
              className="rounded-full border border-[#C62828] px-3 py-2"
              onPress={async () => {
                if (await confirm({
                  title: "Delete post?",
                  message: "Are you sure you want to delete this post?",
                  confirmLabel: "Delete",
                  isDangerous: true,
                })) await onDelete();
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
              if (await confirm({
                title: "Report post?",
                message: "Are you sure you want to report this post?",
                confirmLabel: "Report",
                isDangerous: true,
              })) await onReport();
            }}
          >
            <Text className="text-xs font-black">Report</Text>
          </Pressable>
        )}
      </View>
      {!!post.content && (
        <Text className="px-4 pb-3 text-[15px] leading-6">{post.content}</Text>
      )}
      {post.sharedPostId && (
        <View className="mx-4 mb-4">
          {post.sharedPost ? (
            <SharedPostPreview sharedPost={post.sharedPost} />
          ) : (
            <View className="rounded-xl border border-black/10 p-4">
              <Text className="text-black/50">Original post unavailable</Text>
            </View>
          )}
        </View>
      )}
      {post.media?.map((item) =>
        item.kind === "video" ? (
          <SocialVideo key={item.id} uri={item.url} />
        ) : (
          <Image
            key={item.id}
            source={{ uri: item.url }}
            contentFit="cover"
            style={{
              width: "100%",
              height: post.media?.length === 2 ? 224 : 320,
            }}
          />
        ),
      )}
      <View className="flex-row items-center border-t border-black/10 p-2">
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
            label={post.campedByViewer ? "Following" : "+ Follow"}
            onPress={onCamp}
          />
        )}

        <Action label="Share" onPress={onShare} />
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
  return (
    <View className="overflow-hidden rounded-xl border border-black/15 bg-black/[.03]">
      <View className="p-3">
        <Text className="text-xs font-black">
          {sharedPost.author.displayName}
        </Text>
        <Text
          numberOfLines={compact ? 3 : undefined}
          className="mt-1 text-sm leading-5"
        >
          {sharedPost.content}
        </Text>
      </View>
      {!compact &&
        sharedPost.media?.map((item) =>
          item.kind === "video" ? (
            <SocialVideo key={item.id} uri={item.url} />
          ) : (
            <Image
              key={item.id}
              source={{ uri: item.url }}
              contentFit="cover"
              style={{
                width: "100%",
                height: sharedPost.media?.length === 2 ? 180 : 260,
              }}
            />
          ),
        )}
      {compact && !!sharedPost.media?.length && (
        <Text className="px-3 pb-3 text-xs text-black/50">
          {sharedPost.media.length} media attachment
          {sharedPost.media.length === 1 ? "" : "s"}
        </Text>
      )}
    </View>
  );
}

function SocialCommentsModal({
  post,
  visibility,
  onClose,
  onCountChange,
}: {
  post: SocialPost;
  visibility: SocialVisibility;
  onClose: () => void;
  onCountChange: (postId: string, delta: number) => void;
}) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      try {
        const page = await listSocialComments(post.id);
        setComments(page.items);
        setCursor(page.nextCursor);
      } catch {
        Toast.show({
          type: "error",
          text1: "Comments",
          text2: "Could not load comments.",
        });
      } finally {
        setLoading(false);
      }
    });
  }, [post.id]);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="h-[75%] rounded-t-[28px] bg-white p-4 pb-16">
          <View className="mb-3 flex-row justify-between">
            <Text className="text-lg font-black">Comments</Text>
            <Pressable onPress={onClose}>
              <Text className="text-2xl">×</Text>
            </Pressable>
          </View>
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 py-2"
            renderItem={({ item }) => (
              <View className="flex-row rounded-xl bg-black/[.04] p-3">
                <Text className="min-w-0 flex-1">
                  <Text className="font-black">{item.author.displayName}</Text>
                  {item.content}
                </Text>
                {item.ownedByViewer && (
                  <Pressable
                    onPress={async () => {
                      await deleteSocialComment(post.id, item.id);
                      setComments((current) =>
                        current.filter((comment) => comment.id !== item.id),
                      );
                      onCountChange(post.id, -1);
                    }}
                  >
                    <Text className="text-xs font-black text-[#C62828]">
                      Delete
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
            ListEmptyComponent={
              !loading ? (
                <Text className="py-16 text-center text-black/40">
                  {" "}
                  No comments yet.
                </Text>
              ) : null
            }
            ListFooterComponent={
              cursor ? (
                <Pressable
                  disabled={loading}
                  onPress={async () => {
                    setLoading(true);
                    try {
                      const page = await listSocialComments(post.id, cursor);
                      setComments((current) => [...current, ...page.items]);
                      setCursor(page.nextCursor);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="p-3"
                >
                  <Text className="text-center font-black">
                    {loading ? "Loading…" : "Load more"}
                  </Text>
                </Pressable>
              ) : null
            }
          />
          <View className="flex-row gap-2 border-t border-black/10 pt-3 ">
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Write a comment…"
              maxLength={1000}
              className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2"
            />
            <Pressable
              onPress={async () => {
                const content = value.trim();
                if (!content) return;
                const item = await createSocialComment(
                  post.id,
                  content,
                  visibility,
                );
                setComments((current) => [...current, item]);
                setValue("");
                onCountChange(post.id, 1);
              }}
              className="rounded-xl bg-black px-4 py-3"
            >
              <Text className="text-white">➤</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
        <View className="gap-3 rounded-[24px] bg-white p-5">
          <Text className="text-lg font-black">Edit post</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={4000}
            className="min-h-28 rounded-xl border border-black/15 p-3"
            textAlignVertical="top"
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={onClose}
              className="flex-1 rounded-xl bg-[#DDD] p-3"
            >
              <Text className="text-center font-black">Cancel</Text>
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
        className="rounded-2xl bg-white p-4"
      >
        <Text className="text-base font-black">
          {profile.displayName || "My social profile"}
        </Text>
        <Text className="mt-1 text-xs text-black/45">
          {profile.country ||
            profile.hobby ||
            "Tap to complete your optional profile"}
        </Text>
      </Pressable>
    );
  return (
    <View className="gap-2 rounded-2xl bg-white p-4">
      <Text className="text-base font-black">Edit social profile</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Display name"
        className="rounded-xl border border-black/15 px-3 py-2"
      />
      <TextInput
        value={country}
        onChangeText={setCountry}
        placeholder="Country"
        className="rounded-xl border border-black/15 px-3 py-2"
      />
      <TextInput
        value={hobby}
        onChangeText={setHobby}
        placeholder="Hobby"
        className="rounded-xl border border-black/15 px-3 py-2"
      />
      <TextInput
        value={bio}
        onChangeText={setBio}
        placeholder="About me"
        multiline
        className="min-h-20 rounded-xl border border-black/15 px-3 py-2"
        textAlignVertical="top"
      />
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setEditing(false)}
          className="flex-1 rounded-xl bg-[#DDD] p-3"
        >
          <Text className="text-center font-black">Cancel</Text>
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
  if (!alerts.length)
    return (
      <Text className="py-20 text-center font-bold text-black/40">
        No alerts yet.
      </Text>
    );
  return (
    <>
      {alerts.map((item) => (
        <View key={item.id} className="rounded-2xl bg-white p-4">
          <Text>
            <Text className="font-black">{item.actor.displayName} </Text>
            {item.kind === "like"
              ? "liked your post."
              : item.kind === "comment"
                ? "commented on your post."
                : "started following you."}
          </Text>
          <Text className="mt-1 text-[10px] text-black/40">
            {new Date(item.createdAtMs).toLocaleString()}
          </Text>
        </View>
      ))}
    </>
  );
}
function Action({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void | Promise<void>;
}) {
  return (
    <Pressable
      onPress={() => void onPress()}
      className="flex-1 items-center rounded-xl py-3"
    >
      <Text
        className={`font-black ${active ? "text-[#C62828]" : "text-black/70"}`}
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
          className={`text-xs font-black ${active ? "text-black" : "text-black/40"}`}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
