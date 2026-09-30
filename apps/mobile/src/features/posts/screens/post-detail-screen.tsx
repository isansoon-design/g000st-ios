import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useRouter, type Href } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import {
  createMarketComment,
  deleteMarketComment,
  getMarketPost,
  listMarketComments,
  toggleMarketLike,
} from "@/api/market";
import {
  createSocialComment,
  deleteSocialComment,
  getSocialPost,
  listSocialComments,
  toggleSocialCamp,
  toggleSocialLike,
} from "@/api/social";
import { FeatureScreen } from "@/components/layout/feature-screen";
import { KeyboardAvoidingView } from "@/components/layout/keyboard-avoiding-view";
import { PostImage } from "@/components/media/post-image";
import { PostContentText } from "@/components/posts/post-content-text";
import type { MarketComment, MarketPost } from "@/domain/market/types";
import type {
  SocialComment,
  SocialPost,
  SocialVisibility,
} from "@/domain/social/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { avatarImageSource } from "@/services/media/avatar-image-source";

type PostKind = "social" | "market";
type Post = SocialPost | MarketPost;
type Comment = SocialComment | MarketComment;

function isPostKind(value: string | undefined): value is PostKind {
  return value === "social" || value === "market";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function DetailVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      style={{ height: 320, width: "100%", backgroundColor: "black" }}
    />
  );
}

function MediaList({ media }: { media?: Post["media"] }) {
  return media?.map((item) =>
    item.kind === "video" ? (
      <DetailVideo key={item.id} uri={item.url} />
    ) : (
      <PostImage
        key={item.id}
        uri={item.url}
        contentType={item.contentType}
        height={media.length === 2 ? 224 : 320}
      />
    ),
  );
}

export function PostDetailScreen({
  kind,
  postId,
}: {
  kind?: string;
  postId?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePublicId, user } = useAuth();
  const isPage = !!activePublicId && activePublicId !== user?.publicId;
  const [visibility, setVisibility] = useState<SocialVisibility>("anonymous");
  const [post, setPost] = useState<Post>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [following, setFollowing] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const loadingMoreRef = useRef(false);

  const load = useCallback(async () => {
    if (!postId || !isPostKind(kind)) return;
    const [nextPost, page] = await Promise.all([
      kind === "social" ? getSocialPost(postId) : getMarketPost(postId),
      kind === "social"
        ? listSocialComments(postId)
        : listMarketComments(postId),
    ]);
    return { nextPost, page };
  }, [kind, postId]);

  useEffect(() => {
    let active = true;
    void load()
      .then((result) => {
        if (!active) return;
        if (result) {
          setPost(result.nextPost);
          setComments(result.page.items);
          setCursor(result.page.nextCursor);
        }
      })
      .catch((error) => {
        if (active)
          Toast.show({
            type: "error",
            text1: "Post",
            text2: errorMessage(error, "Could not load post."),
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function loadMore() {
    if (!postId || !isPostKind(kind) || !cursor || loadingMoreRef.current)
      return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page =
        kind === "social"
          ? await listSocialComments(postId, cursor)
          : await listMarketComments(postId, cursor);
      setComments((current) => {
        const known = new Set(current.map((comment) => comment.id));
        return [
          ...current,
          ...page.items.filter((comment) => !known.has(comment.id)),
        ].sort(
          (a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id),
        );
      });
      setCursor(page.nextCursor);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Comments",
        text2: errorMessage(error, "Could not load more comments."),
      });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  async function sendComment() {
    const content = value.trim();
    if (!post || !postId || !isPostKind(kind) || !content || posting) return;
    setPosting(true);
    try {
      const comment =
        kind === "social"
          ? await createSocialComment(
            postId,
            content,
            isPage ? "public" : visibility,
          )
          : await createMarketComment(postId, content);
      setComments((current) => [...current, comment]);
      setPost((current) =>
        current
          ? { ...current, commentCount: current.commentCount + 1 }
          : current,
      );
      setValue("");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Comment",
        text2: errorMessage(error, "Could not add comment."),
      });
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!postId || !isPostKind(kind) || deletingId) return;
    setDeletingId(commentId);
    try {
      if (kind === "social") await deleteSocialComment(postId, commentId);
      else await deleteMarketComment(postId, commentId);
      setComments((current) =>
        current.filter((comment) => comment.id !== commentId),
      );
      setPost((current) =>
        current
          ? { ...current, commentCount: Math.max(0, current.commentCount - 1) }
          : current,
      );
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Comment",
        text2: errorMessage(error, "Could not delete comment."),
      });
    } finally {
      setDeletingId(undefined);
    }
  }

  async function toggleLike() {
    if (!postId || !isPostKind(kind) || liking) return;
    setLiking(true);
    try {
      const result =
        kind === "social"
          ? await toggleSocialLike(postId)
          : await toggleMarketLike(postId);
      setPost((current) =>
        current
          ? {
            ...current,
            likeCount: result.likeCount,
            likedByViewer: result.liked,
          }
          : current,
      );
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Like",
        text2: errorMessage(error, "Could not update reaction."),
      });
    } finally {
      setLiking(false);
    }
  }

  async function toggleFollow() {
    if (!post?.ownerPublicId || following) return;
    setFollowing(true);
    try {
      const result = await toggleSocialCamp(post.ownerPublicId);
      setPost((current) =>
        current ? { ...current, campedByViewer: result.camped } : current,
      );
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Follow",
        text2: errorMessage(error, "Could not update follow."),
      });
    } finally {
      setFollowing(false);
    }
  }

  async function sharePost() {
    if (!postId || !isPostKind(kind) || !post) return;
    try {
      const url = Linking.createURL(`/posts/${kind}/${postId}`);
      await Share.share({ message: `${post.content}\n${url}`.trim() });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Share",
        text2: errorMessage(error, "Could not share post."),
      });
    }
  }

  const valid = !!postId && isPostKind(kind);
  return (
    <FeatureScreen
      title={
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else
                router.replace(
                  (kind === "market" ? "/trading" : "/social") as Href,
                );
            }}
            className="px-2 py-2"
          >
            <Text className="text-xl font-bold text-g000st-black dark:text-night-text">
              ‹
            </Text>
          </Pressable>
          <Text className="text-base font-black text-g000st-black dark:text-night-text">
            {kind === "market" ? "Market post" : "Social post"}
          </Text>
        </View>
      }
    >
      {!valid ? (
        <Text className="p-8 text-center text-g000st-black dark:text-night-text">
          Invalid post link.
        </Text>
      ) : loading ? (
        <ActivityIndicator className="flex-1" />
      ) : !post ? (
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="text-center text-g000st-black dark:text-night-text">
            Post unavailable.
          </Text>
          <Pressable
            onPress={() => {
              setLoading(true);
              void load()
                .then((result) => {
                  if (result) {
                    setPost(result.nextPost);
                    setComments(result.page.items);
                    setCursor(result.page.nextCursor);
                  }
                })
                .catch((error) =>
                  Toast.show({
                    type: "error",
                    text1: "Post",
                    text2: errorMessage(error, "Could not load post."),
                  }),
                )
                .finally(() => setLoading(false));
            }}
            className="rounded-xl bg-black px-5 py-3"
          >
            <Text className="font-bold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView
          className="flex-1"
          behavior="padding"
          automaticOffset
        >
          <FlatList
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerClassName="pb-6"
            ListHeaderComponent={
              <View>
                <View className="border-b border-black/10 bg-white dark:border-night-border dark:bg-night-surface">
                  <Pressable
                    className="flex-row items-center gap-3 p-4"
                    disabled={!post.author.publicId}
                    onPress={() =>
                      post.author.publicId &&
                      router.push(`/users/${post.author.publicId}` as Href)
                    }
                  >
                    <View className="h-11 w-11 overflow-hidden rounded-full bg-black">
                      {post.author.avatarUrl ? (
                        <Image
                          source={avatarImageSource(post.author.avatarUrl)}
                          contentFit="cover"
                          style={{ width: "100%", height: "100%" }}
                        />
                      ) : (
                        <Image
                          source={require("../../../../assets/g000st-icon.jpeg")}
                          contentFit="cover"
                          style={{ width: "100%", height: "100%" }}
                        />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="font-black text-g000st-black dark:text-night-text">
                        {post.author.displayName}
                      </Text>
                      <Text className="text-xs text-black/45 dark:text-night-muted">
                        {new Date(post.createdAtMs).toLocaleString()}
                        {post.editedAtMs ? " · edited" : ""}
                      </Text>
                    </View>
                  </Pressable>
                  {!!post.content && (
                    <PostContentText
                      content={post.content}
                      className="px-4 pb-4 text-[15px] leading-6 text-g000st-black dark:text-night-text"
                    />
                  )}
                  {kind === "social" &&
                    "sharedPostId" in post &&
                    post.sharedPostId && (
                      <View className="mx-4 mb-4 overflow-hidden rounded-xl border border-black/10 dark:border-night-border">
                        {post.sharedPost ? (
                          <>
                            <Text className="px-3 pt-3 text-xs font-black text-g000st-black dark:text-night-text">
                              {post.sharedPost.author.displayName}
                            </Text>
                            <PostContentText
                              content={post.sharedPost.content}
                              onOpen={() =>
                                router.push(
                                  `/posts/social/${post.sharedPost!.id}` as Href,
                                )
                              }
                              className="p-3 text-sm leading-5 text-g000st-black dark:text-night-text"
                            />
                            <MediaList media={post.sharedPost.media} />
                          </>
                        ) : (
                          <Text className="p-3 text-black/50 dark:text-night-muted">
                            Original post unavailable
                          </Text>
                        )}
                      </View>
                    )}
                  {kind === "market" && "price" in post && (
                    <View className="flex-row flex-wrap gap-2 px-4 pb-4">
                      <Text className="rounded-full bg-[#c62828] px-3 py-1.5 text-xs font-black text-white">
                        {post.price.toLocaleString()} {post.currency}
                      </Text>
                      <Text className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-black text-g000st-black dark:bg-night-raised dark:text-night-text">
                        Qty {post.quantity}
                      </Text>
                      <Text className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-black text-g000st-black dark:bg-night-raised dark:text-night-text">
                        ⌖ {post.city}
                      </Text>
                    </View>
                  )}
                  <MediaList media={post.media} />
                  <View className="flex-row items-center justify-around border-t border-black/10 p-2 dark:border-night-border">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Like post"
                      disabled={liking}
                      onPress={() => void toggleLike()}
                      className="px-3 py-3"
                    >
                      <Text
                        className={
                          post.likedByViewer
                            ? "font-black text-[#c62828]"
                            : "font-black text-g000st-black dark:text-night-text"
                        }
                      >
                        ♥ {post.likeCount}
                      </Text>
                    </Pressable>
                    <Text className="font-black text-g000st-black dark:text-night-text">
                      💬 {post.commentCount}
                    </Text>
                    {!post.ownedByViewer && post.ownerPublicId && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={post.campedByViewer ? "Following author. Unfollow" : "Follow author"}
                        disabled={following}
                        onPress={() => void toggleFollow()}
                        className="px-3 py-3"
                      >
                        {post.campedByViewer ? (
                          <View className="flex-row items-center gap-1">
                            <Text className="text-[26px] font-black leading-[28px] text-g000st-red">✓</Text>
                            <Text className="font-black text-g000st-black dark:text-night-text">Following</Text>
                          </View>
                        ) : (
                          <Text className="font-black text-g000st-black dark:text-night-text">+ Follow</Text>
                        )}
                      </Pressable>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Share post"
                      onPress={() => void sharePost()}
                      className="px-3 py-3"
                    >
                      <Text className="font-black text-g000st-black dark:text-night-text">
                        ↗ Share
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <Text className="px-4 pb-2 pt-5 text-lg font-black text-g000st-black dark:text-night-text">
                  Comments
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View className="mx-4 mb-2 flex-row gap-3 rounded-xl bg-white p-3 dark:bg-night-surface">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-black/10 dark:bg-night-raised">
                  <Text className="font-black text-g000st-black dark:text-night-text">
                    {item.author.displayName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-black text-g000st-black dark:text-night-text">
                    {item.author.displayName}
                  </Text>
                  <Text className="mt-1 text-g000st-black dark:text-night-text">
                    {item.content}
                  </Text>
                  <Text className="mt-1 text-xs text-black/40 dark:text-night-muted">
                    {new Date(item.createdAtMs).toLocaleString()}
                  </Text>
                </View>
                {item.ownedByViewer && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete comment"
                    disabled={!!deletingId}
                    onPress={() => void deleteComment(item.id)}
                    className="p-1"
                  >
                    <Text className="text-xs font-black text-[#c62828]">
                      Delete
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
            ListEmptyComponent={
              <Text className="py-10 text-center text-black/40 dark:text-night-muted">
                No comments yet.
              </Text>
            }
            ListFooterComponent={
              cursor ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={loadingMore}
                  onPress={() => void loadMore()}
                  className="mx-4 rounded-xl p-4"
                >
                  {loadingMore ? (
                    <ActivityIndicator />
                  ) : (
                    <Text className="text-center font-black text-g000st-black dark:text-night-text">
                      Load more comments
                    </Text>
                  )}
                </Pressable>
              ) : null
            }
          />
          <View
            className="border-t border-black/10 bg-white px-4 pt-3 dark:border-night-border dark:bg-night-surface"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            {kind === "social" && (
              <View className="mb-2 flex-row items-center gap-2">
                <Switch
                  value={isPage || visibility === "public"}
                  disabled={isPage}
                  onValueChange={(show) =>
                    setVisibility(show ? "public" : "anonymous")
                  }
                />
                <Text className="text-xs font-bold text-g000st-black dark:text-night-text">
                  {isPage ? "Commenting as page" : "Show my identity"}
                </Text>
              </View>
            )}
            <View className="flex-row items-end gap-2">
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder="Write a comment…"
                maxLength={1000}
                multiline
                className="max-h-28 min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2 text-g000st-black dark:border-night-border dark:text-night-text"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send comment"
                disabled={posting || !value.trim()}
                onPress={() => void sendComment()}
                className="rounded-xl bg-black px-4 py-3 disabled:opacity-40"
              >
                <Text className="font-black text-white">
                  {posting ? "…" : "➤"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </FeatureScreen>
  );
}
