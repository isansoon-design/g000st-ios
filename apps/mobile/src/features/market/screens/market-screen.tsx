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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { startMarketChatConversation } from "@/api/chat";
import {
  createMarketComment,
  createMarketPost,
  deleteMarketComment,
  deleteMarketPost,
  listMarketComments,
  listMarketPosts,
  reportMarketPost,
  toggleMarketLike,
  updateMarketPost,
  uploadMarketMedia,
} from "@/api/market";
import { toggleSocialCamp } from "@/api/social";
import { FeatureScreen } from "@/components/layout/feature-screen";
import type {
  MarketComment,
  MarketPost,
  MarketPostFields,
} from "@/domain/market/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCalling } from "@/features/calling/hooks/use-calling";
import { useConfirmModal } from "@/providers/confirm-modal-provider";

cssInterop(VideoView, { className: "style" });
cssInterop(Image, { className: "style" });
type ViewName = "home" | "mine";
const EMPTY_FIELDS: MarketPostFields = {
  content: "",
  price: 0,
  currency: "GBP",
  quantity: 1,
  city: "",
  allowCalls: false,
  allowVideoCalls: false,
};

export function MarketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePublicId } = useAuth();
  const { callUser } = useCalling();
  const [view, setView] = useState<ViewName>("home");
  const [posts, setPosts] = useState<MarketPost[]>([]);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [selectedMedia, setSelectedMedia] = useState<
    readonly ImagePicker.ImagePickerAsset[]
  >([]);
  const [posting, setPosting] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [commentsPost, setCommentsPost] = useState<MarketPost>();
  const [editingPost, setEditingPost] = useState<MarketPost>();
  const loadingMoreRef = useRef(false);
  const userPublicId = activePublicId ?? undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listMarketPosts(
        view === "mine" ? userPublicId : undefined,
      );
      setPosts(page.items);
      setNextCursor(page.nextCursor);
    } catch (error) {
      showError(error, "Could not load Market.");
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
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await listMarketPosts(
        view === "mine" ? userPublicId : undefined,
        nextCursor,
      );
      setPosts((current) => [
        ...current,
        ...page.items.filter(
          (item) => !current.some((known) => known.id === item.id),
        ),
      ]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      showError(error, "Could not load more listings.");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor, userPublicId, view]);

  async function pickMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: 2,
      quality: 0.85,
    });
    if (result.canceled) return;
    const videos = result.assets.filter((asset) => asset.type === "video");
    if (
      (videos.length && result.assets.length !== 1) ||
      result.assets.some(
        (asset) =>
          !asset.fileSize ||
          !asset.mimeType ||
          asset.fileSize > 5 * 1024 * 1024,
      )
    )
      return Toast.show({
        type: "error",
        text1: "Traiding",
        text2: "Choose up to two images or one video, max 5 MB each.",
      });
    setSelectedMedia(result.assets);
  }

  async function publish() {
    if (!validFields(fields) || posting)
      return Toast.show({
        type: "error",
        text1: "Traiding",
        text2: "Add description, price, quantity, and city.",
      });
    setPosting(true);
    try {
      const clientPostId = randomUUID();
      const media = selectedMedia.length
        ? await Promise.all(
          selectedMedia.map((asset) =>
            uploadMarketMedia({
              byteSize: asset.fileSize!,
              clientPostId,
              contentType: asset.mimeType!,
              fileName:
                asset.fileName ??
                `${randomUUID()}.${asset.type === "video" ? "mp4" : "jpg"}`,
              uri: asset.uri,
            }),
          ),
        )
        : undefined;
      const post = await createMarketPost(clientPostId, fields, media);
      setPosts((current) => [post, ...current]);
      setFields(EMPTY_FIELDS);
      setSelectedMedia([]);
      setIsComposerOpen(false);
      Toast.show({ type: "success", text1: "Listing published" });
    } catch (error) {
      showError(error, "Could not publish listing.");
    } finally {
      setPosting(false);
    }
  }

  async function openChat(post: MarketPost) {
    try {
      const conversation = await startMarketChatConversation(post.id);
      router.push({
        pathname: "/(app)/(tabs)/chat/[conversationId]",
        params: {
          conversationId: conversation.id,
          notificationRequestId: randomUUID(),
        },
      }, { withAnchor: true });
    } catch (error) {
      showError(error, "Could not open chat.");
    }
  }

  return (
    <FeatureScreen
      title={
        <View className="h-14 flex-row items-center justify-between border-b border-black/10 dark:border-night-border bg-[#D2D2D4] dark:bg-night-header px-4">
          <Text className="text-lg font-black text-[#1A1A1A] dark:text-night-text">
            g<Text className="text-[#C62828]">000</Text>
            st
            <Text className="text-[#C62828]">T</Text>
            rading
          </Text>
        </View>
      }
    >
      <View className="flex-1 bg-[#E7E7E9] dark:bg-night-canvas">
        {!loading && (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 p-3"
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={1.2}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => void load()}
              />
            }
            ListHeaderComponent={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create a Market listing"
                onPress={() => setIsComposerOpen(true)}
                className="mb-1 flex-row items-center gap-3 rounded-2xl border border-black/10 dark:border-night-border bg-white dark:bg-night-surface p-4 shadow-sm"
              >
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#C62828]">
                  <Text className="text-2xl font-light text-white">＋</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-black text-[#17191D] dark:text-night-text">Create a Market post</Text>
                  <Text className="mt-0.5 text-xs text-black/50 dark:text-night-muted">Sell something to the community</Text>
                </View>
                <Text className="text-xl font-bold text-[#C62828]">›</Text>
              </Pressable>
            }
            ListEmptyComponent={
              <Text className="py-16 text-center font-bold text-black/40 dark:text-night-muted">
                No listings yet.
              </Text>
            }
            ListFooterComponent={
              loadingMore ? <ActivityIndicator className="py-3" /> : null
            }
            renderItem={({ item }) => (
              <MarketCard
                post={item}
                onLike={async () => {
                  const result = await toggleMarketLike(item.id);
                  setPosts((current) =>
                    current.map((post) =>
                      post.id === item.id
                        ? {
                          ...post,
                          likeCount: result.likeCount,
                          likedByViewer: result.liked,
                        }
                        : post,
                    ),
                  );
                }}
                onComments={() => setCommentsPost(item)}
                onFollow={async () => {
                  try {
                    const result = await toggleSocialCamp(item.ownerPublicId);
                    setPosts((current) => current.map((post) =>
                      post.ownerPublicId === item.ownerPublicId
                        ? { ...post, campedByViewer: result.camped }
                        : post,
                    ));
                  } catch (error) {
                    showError(error, "Could not update follow.");
                  }
                }}
                onChat={() => openChat(item)}
                onCall={() =>
                  callUser(item.ownerPublicId, item.author.displayName, "audio")
                }
                onVideoCall={() =>
                  callUser(item.ownerPublicId, item.author.displayName, "video")
                }
                onEdit={() => setEditingPost(item)}
                onDelete={async () => {
                  await deleteMarketPost(item.id);
                  setPosts((current) =>
                    current.filter((post) => post.id !== item.id),
                  );
                }}
                onReport={() => reportMarketPost(item.id)}
              />
            )}
          />
        )}
        {loading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        )}
        <View className="h-14 flex-row border-t border-black/15 dark:border-night-border bg-white dark:bg-night-surface">
          <ViewButton
            label="Market"
            active={view === "home"}
            onPress={() => setView("home")}
          />
          <ViewButton
            label="My Listings"
            active={view === "mine"}
            onPress={() => setView("mine")}
          />
          <ViewButton label="Market Chats" active={false} onPress={() => router.push({ pathname: '/(app)/(tabs)/chat', params: { kind: 'market' } })} />
        </View>
      </View>
      <Modal
        visible={isComposerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!posting) setIsComposerOpen(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="max-h-[92%] rounded-t-[28px] bg-[#F7F7F8] dark:bg-night-surface pt-5">
            <View className="flex-row items-center justify-between px-5 pb-4">
              <View>
                <Text className="text-xl font-black text-[#17191D] dark:text-night-text">New listing</Text>
                <Text className="mt-1 text-xs text-black/50 dark:text-night-muted">Add the details buyers need</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close new listing"
                disabled={posting}
                onPress={() => setIsComposerOpen(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-night-surface"
              >
                <Text className="text-xl text-[#17191D] dark:text-night-text">×</Text>
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-5 pb-8"
            >
              <MarketComposer
                fields={fields}
                media={selectedMedia}
                onChange={setFields}
                onMedia={() => void pickMedia()}
                onRemoveMedia={(index) =>
                  setSelectedMedia((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              />
            </ScrollView>
            <View
              className="border-t border-black/10 dark:border-night-border bg-white dark:bg-night-surface px-5 pt-3"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              <Pressable
                accessibilityRole="button"
                disabled={posting}
                onPress={() => void publish()}
                className="items-center rounded-2xl bg-[#17191D] px-6 py-4 disabled:opacity-40"
              >
                <Text className="text-base font-black text-white">
                  {posting ? "Publishing…" : "Publish listing"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {commentsPost && (
        <CommentsModal
          post={commentsPost}
          onClose={() => setCommentsPost(undefined)}
          onCountChange={(postId, delta) =>
            setPosts((current) =>
              current.map((post) =>
                post.id === postId
                  ? {
                    ...post,
                    commentCount: Math.max(0, post.commentCount + delta),
                  }
                  : post,
              ),
            )
          }
        />
      )}
      {editingPost && (
        <EditMarketModal
          post={editingPost}
          onClose={() => setEditingPost(undefined)}
          onSave={async (postId, next) => {
            const updated = await updateMarketPost(postId, next);
            setPosts((current) =>
              current.map((post) => (post.id === postId ? updated : post)),
            );
            setEditingPost(undefined);
          }}
        />
      )}
    </FeatureScreen>
  );
}

function MarketComposer({
  fields,
  media,
  onChange,
  onMedia,
  onRemoveMedia,
}: {
  fields: MarketPostFields;
  media: readonly ImagePicker.ImagePickerAsset[];
  onChange: (value: MarketPostFields) => void;
  onMedia: () => void;
  onRemoveMedia: (index: number) => void;
}) {
  return (
    <View className="gap-5">
      <View className="gap-2">
        <Text className="text-xs font-black uppercase tracking-wider text-black/55 dark:text-night-muted">
          Description
        </Text>
        <TextInput
          accessibilityLabel="Listing description"
          value={fields.content}
          onChangeText={(content) => onChange({ ...fields, content })}
          placeholder="What are you selling? Add condition and key details."
          multiline
          maxLength={4000}
          className="min-h-28 rounded-2xl border border-black/10 dark:border-night-border bg-white dark:bg-night-surface px-4 py-3 text-base"
          textAlignVertical="top"
        />
      </View>
      <View className="flex-row gap-3">
        <View className="min-w-0 flex-1 gap-2">
          <Text className="text-xs font-black uppercase tracking-wider text-black/55 dark:text-night-muted">
            Price (£)
          </Text>
          <NumberField
            value={fields.price || undefined}
            placeholder="0"
            accessibilityLabel="Price in pounds"
            elevated
            onChange={(price) => onChange({ ...fields, price })}
          />
        </View>
        <View className="min-w-0 flex-1 gap-2">
          <Text className="text-xs font-black uppercase tracking-wider text-black/55 dark:text-night-muted">
            Quantity
          </Text>
          <NumberField
            value={fields.quantity}
            placeholder="1"
            accessibilityLabel="Quantity"
            elevated
            onChange={(quantity) =>
              onChange({ ...fields, quantity: Math.floor(quantity) })
            }
          />
        </View>
      </View>
      <View className="gap-2">
        <Text className="text-xs font-black uppercase tracking-wider text-black/55 dark:text-night-muted">
          City
        </Text>
        <TextInput
          accessibilityLabel="City"
          value={fields.city}
          onChangeText={(city) => onChange({ ...fields, city })}
          placeholder="Where is it located?"
          maxLength={100}
          className="rounded-2xl border border-black/10 dark:border-night-border bg-white dark:bg-night-surface px-4 py-3 text-base"
        />
      </View>
      <View className="gap-3 rounded-2xl bg-white dark:bg-night-surface p-4">
        <Text className="text-xs font-black uppercase tracking-wider text-black/55 dark:text-night-muted">
          Contact options
        </Text>
        <MarketCallOptions fields={fields} onChange={onChange} />
      </View>
      <View className="gap-3">
        <View>
          <Text className="text-xs font-black uppercase tracking-wider text-black/55 dark:text-night-muted">
            Photos or video
          </Text>
          <Text className="mt-1 text-xs text-black/45 dark:text-night-muted">
            Up to 2 photos or 1 video · 5 MB each
          </Text>
        </View>
        {media.length > 0 && (
          <ScrollView horizontal contentContainerClassName="gap-2">
            {media.map((asset, index) => (
              <View key={asset.assetId ?? asset.uri} className="relative">
                <Image
                  source={{ uri: asset.uri }}
                  className="h-20 w-20 rounded-xl"
                  contentFit="cover"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove media ${index + 1}`}
                  onPress={() => onRemoveMedia(index)}
                  className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/70"
                >
                  <Text className="font-black text-white">×</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onMedia}
          className="items-center rounded-2xl border border-dashed border-black/20 dark:border-night-border bg-white dark:bg-night-surface px-4 py-4"
        >
          <Text className="text-sm font-black text-[#17191D] dark:text-night-text">
            ＋ {media.length
              ? `${media.length} selected · Add or change media`
              : "Add photos or video"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MarketCard({
  post,
  onLike,
  onComments,
  onFollow,
  onChat,
  onCall,
  onVideoCall,
  onEdit,
  onDelete,
  onReport,
}: {
  post: MarketPost;
  onLike: () => Promise<void>;
  onComments: () => void;
  onFollow: () => Promise<void>;
  onChat: () => Promise<void>;
  onCall: () => Promise<void>;
  onVideoCall: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onReport: () => Promise<void>;
}) {
  const { confirm } = useConfirmModal();
  const router = useRouter();
  return (
    <View className="overflow-hidden rounded-2xl border-2 border-black dark:border-night-border bg-white dark:bg-night-surface shadow-sm">
      <View className="flex-row items-center gap-3 p-4">
        {/* Start Image */}
        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-black">
          {post.author.avatarUrl ? (
            <Image
              source={{ uri: post.author.avatarUrl }}
              className="h-full w-full"
              contentFit="cover"
            />
          ) : (
            <Text className="text-white">👻</Text>
          )}
        </View>
        {/* End Image */}
        {/* Start Username && date  */}
        <Pressable onPress={() => router.push(`/users/${post.ownerPublicId}` as Href)} accessibilityRole="button" className="min-w-0 flex-1">
          <Text className="font-black">{post.author.displayName}</Text>
          <Text className="text-[10px] text-black/45 dark:text-night-muted">
            {new Date(post.createdAtMs).toLocaleString()}
            {post.editedAtMs ? " · edited" : ""}
          </Text>
        </Pressable>
        {/* End Username && date  */}

        {post.ownedByViewer ? (
          <View className="flex-row gap-2">
            <Pressable
              accessibilityLabel="Edit listing"
              accessibilityRole="button"
              onPress={onEdit}
              className="rounded-full border border-black/20 dark:border-night-border px-3 py-2"
            >
              <Text className="text-xs font-black">Edit</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Delete listing"
              accessibilityRole="button"
              onPress={async () => {
                if (
                  await confirm({
                    title: "Delete listing?",
                    message: "This cannot be undone.",
                    confirmLabel: "Delete",
                    isDangerous: true,
                  })
                )
                  await onDelete();
              }}
              className="rounded-full border border-[#C62828] px-3 py-2"
            >
              <Text className="text-xs font-black text-[#C62828]">Delete</Text>
            </Pressable>
          </View>
        )
          :
          <View className="flex-row  w-32  ">
            {/* Start Call Actions */}
            {!post.ownedByViewer && post.allowCalls && (
              <Action minW="min-w-[30px]" label="📞" onPress={onCall} />
            )}
            {!post.ownedByViewer && post.allowVideoCalls && (
              <Action minW="min-w-[30px]" label="🎥" onPress={onVideoCall} />
            )}
            {!post.ownedByViewer && (
              <Pressable
                accessibilityLabel="Report listing"
                accessibilityRole="button"
                className="self-end px-4 py-3"
                onPress={async () => {
                  if (await confirm({
                    title: "Report listing?",
                    message: "Are you sure you want to report this listing?",
                    confirmLabel: "Report",
                    isDangerous: true,
                  })) {
                    try {
                      await onReport();
                      Toast.show({ type: "success", text1: "Report sent" });
                    } catch (error) {
                      showError(error, "Could not report listing.");
                    }
                  }
                }}
              >
                <Text className="text-xs font-black">Report</Text>
              </Pressable>
            )}
          </View>
        }
        {/* End Call Actions */}

      </View>
      <Text className="px-4 pb-3 text-[15px] leading-6">{post.content}</Text>
      <View className="mx-4 mb-3 flex-row flex-wrap gap-2">
        <Badge
          text={
            post.currency === "GBP"
              ? `£${post.price.toLocaleString()}`
              : `${post.price.toLocaleString()} ${post.currency}`
          }
        />
        <Badge text={`Qty ${post.quantity}`} />
        <Badge text={`⌖ ${post.city}`} />
      </View>
      {post.media?.map((item) =>
        item.kind === "video" ? (
          <MarketVideo key={item.id} uri={item.url} />
        ) : (
          <Image
            key={item.id}
            source={{ uri: item.url }}
            style={{
              width: "100%",
              height: post.media?.length === 2 ? 224 : 320,
            }}
            contentFit="cover"
          />
        ),
      )}
      <View className="flex-row flex-wrap items-center border-t border-black/10 dark:border-night-border p-2">
        <Action
          label={`♥ ${post.likeCount}`}
          active={post.likedByViewer}
          onPress={onLike}
        />
        <Action
          label={`💬 ${post.commentCount}`}
          onPress={async () => onComments()}
        />
        {!post.ownedByViewer && (
          <Action label={post.campedByViewer ? "✓" : " ➕"} onPress={onFollow} />
        )}

        {!post.ownedByViewer && <Pressable
          onPress={() => void onChat()}
          className="mx-1 px-5 py-3"
        >
          <Text className="font-black">Chat</Text>
        </Pressable>}
      </View>

    </View>
  );
}

function CommentsModal({
  post,
  onClose,
  onCountChange,
}: {
  post: MarketPost;
  onClose: () => void;
  onCountChange: (postId: string, delta: number) => void;
}) {
  const [comments, setComments] = useState<MarketComment[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      try {
        const page = await listMarketComments(post.id);
        setComments(page.items);
        setCursor(page.nextCursor);
      } catch (error) {
        showError(error, "Could not load comments.");
      } finally {
        setLoading(false);
      }
    });
  }, [post.id]);
  async function send() {
    const content = value.trim();
    if (!content) return;
    try {
      const comment = await createMarketComment(post.id, content);
      setComments((current) => [...current, comment]);
      setValue("");
      onCountChange(post.id, 1);
    } catch (error) {
      showError(error, "Could not add comment.");
    }
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="h-[75%] pb-16 rounded-t-[28px] bg-white dark:bg-night-surface p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-black">Comments</Text>
            <Pressable onPress={onClose}>
              <Text className="text-2xl">×</Text>
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator className="flex-1" />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerClassName="gap-3 py-2"
              onEndReached={async () => {
                if (!cursor || loading) return;
                setLoading(true);
                try {
                  const page = await listMarketComments(post.id, cursor);
                  setComments((current) => [...current, ...page.items]);
                  setCursor(page.nextCursor);
                } finally {
                  setLoading(false);
                }
              }}
              renderItem={({ item }) => (
                <View className="flex-row gap-2 rounded-xl bg-black/[.04] dark:bg-white/10 p-3">
                  <Text className="min-w-0 flex-1">
                    <Text className="font-black">
                      {item.author.displayName}{" "}
                    </Text>
                    {item.content}
                  </Text>
                  {item.ownedByViewer && (
                    <Pressable
                      onPress={async () => {
                        await deleteMarketComment(post.id, item.id);
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
                <Text className="py-16 text-center text-black/40 dark:text-night-muted">
                  No comments yet.
                </Text>
              }
            />
          )}
          <View className="flex-row gap-2 border-t border-black/10 dark:border-night-border pt-3  ">
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Write a comment…"
              maxLength={1000}
              className="min-w-0 flex-1 rounded-xl border border-black/15 dark:border-night-border px-3 py-2"
            />
            <Pressable
              onPress={() => void send()}
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

function EditMarketModal({
  post,
  onClose,
  onSave,
}: {
  post: MarketPost;
  onClose: () => void;
  onSave: (id: string, fields: MarketPostFields) => Promise<void>;
}) {
  const [fields, setFields] = useState<MarketPostFields>({
    content: post.content,
    price: post.price,
    currency: post.currency,
    quantity: post.quantity,
    city: post.city,
    allowCalls: post.allowCalls,
    allowVideoCalls: post.allowVideoCalls,
  });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-black/50 p-5">
        <View className="gap-3 rounded-[24px] bg-white dark:bg-night-surface p-5">
          <Text className="text-lg font-black">Edit listing</Text>
          <TextInput
            value={fields.content}
            onChangeText={(content) => setFields({ ...fields, content })}
            multiline
            className="min-h-24 rounded-xl border border-black/15 dark:border-night-border p-3"
          />
          <View className="flex-row gap-2">
            <NumberField
              value={fields.price}
              placeholder={
                fields.currency === "GBP"
                  ? "Price £"
                  : `Price ${fields.currency}`
              }
              onChange={(price) =>
                setFields({ ...fields, price, currency: "GBP" })
              }
            />
            <NumberField
              value={fields.quantity}
              placeholder="Quantity"
              onChange={(quantity) =>
                setFields({ ...fields, quantity: Math.floor(quantity) })
              }
            />
            <TextInput
              value={fields.city}
              onChangeText={(city) => setFields({ ...fields, city })}
              placeholder="City"
              className="min-w-0 flex-1 rounded-xl border border-black/15 dark:border-night-border px-3"
            />
          </View>
          {post.currency !== "GBP" && (
            <Text className="text-xs text-black/60 dark:text-night-muted">
              This listing is {post.currency}. Enter a new price to switch to £.
            </Text>
          )}
          <MarketCallOptions fields={fields} onChange={setFields} />
          <View className="flex-row gap-2">
            <Pressable
              onPress={onClose}
              className="flex-1 rounded-xl bg-[#DDD] dark:bg-night-raised p-3"
            >
              <Text className="text-center font-black">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (validFields(fields)) void onSave(post.id, fields);
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
function MarketCallOptions({
  fields,
  onChange,
}: {
  fields: MarketPostFields;
  onChange: (fields: MarketPostFields) => void;
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        <Text>Allow voice calls</Text>
        <Switch
          accessibilityLabel="Allow voice calls"
          thumbColor="#000000"
          trackColor={{ false: "#9A9A9A", true: "#C62828" }}
          value={fields.allowCalls}
          onValueChange={(allowCalls) => onChange({ ...fields, allowCalls })}
        />
      </View>
      <View className="flex-row items-center justify-between">
        <Text>Allow video calls</Text>
        <Switch
          accessibilityLabel="Allow video calls"
          thumbColor="#000000"
          trackColor={{ false: "#9A9A9A", true: "#C62828" }}
          value={fields.allowVideoCalls}
          onValueChange={(allowVideoCalls) =>
            onChange({ ...fields, allowVideoCalls })
          }
        />
      </View>
    </View>
  );
}
function NumberField({
  value,
  placeholder,
  accessibilityLabel,
  elevated,
  onChange,
}: {
  value?: number;
  placeholder: string;
  accessibilityLabel?: string;
  elevated?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={value ? String(value) : ""}
      onChangeText={(text) => onChange(Number(text.replace(",", ".")) || 0)}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      className={elevated
        ? "w-full rounded-2xl border border-black/10 dark:border-night-border bg-white dark:bg-night-surface px-4 py-3 text-base"
        : "min-w-0 flex-1 rounded-xl border border-black/15 dark:border-night-border px-3 py-2"}
    />
  );
}
function Badge({ text }: { text: string }) {
  return (
    <View className="rounded-full bg-black px-3 py-1.5">
      <Text className="text-xs font-black text-white">{text}</Text>
    </View>
  );
}
function Action({
  label,
  active,
  onPress,
  minW,
}: {
  label: string;
  active?: boolean;
  onPress: () => Promise<void>;
  minW?: string
}) {
  return (
    <Pressable
      onPress={() => void onPress()}
      className={`${minW ? minW : " min-w-[64px]"} flex-1 items-center rounded-xl py-3`}
    >
      <Text
        className={`font-black ${active ? "text-[#C62828]" : "text-black/70 dark:text-night-muted"}`}
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
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center justify-center ${active ? "border-t-2 border-[#C62828]" : ""}`}
    >
      <Text
        className={`text-xs font-black ${active ? "text-black dark:text-night-text" : "text-black/45 dark:text-night-muted"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function MarketVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      className="h-80 w-full bg-black"
    />
  );
}
function validFields(fields: MarketPostFields) {
  return Boolean(
    fields.content.trim() &&
    fields.city.trim() &&
    fields.price >= 0 &&
    fields.quantity > 0,
  );
}
function showError(error: unknown, fallback: string) {
  Toast.show({
    type: "error",
    text1: "Market",
    text2: error instanceof Error ? error.message : fallback,
  });
}
