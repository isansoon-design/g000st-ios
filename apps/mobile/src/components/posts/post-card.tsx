import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { cssInterop } from "nativewind";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { PostImage } from "@/components/media/post-image";
import { PostCardFrame } from "@/components/posts/post-card-frame";
import { PostContentText } from "@/components/posts/post-content-text";
import type { SocialPost } from "@/domain/social/types";
import { useConfirmModal } from "@/providers/confirm-modal-provider";
import { avatarImageSource } from "@/services/media/avatar-image-source";

cssInterop(VideoView, { className: "style" });
cssInterop(Image, { className: "style" });

type PostCardProps = {
  post: SocialPost;
  onChat?: (id?: string) => Promise<void> | void;
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  onReport?: () => Promise<void>;
  onLike?: () => Promise<void>;
  onCamp?: () => Promise<void>;
  onComments?: () => void;
  /** Extra content rendered under the action bar (e.g. profile-only buttons). */
  footer?: ReactNode;
};

/** The single post card used by the feed and by profile/page screens. */
export function PostCard({
  post,
  onChat,
  onShare,
  onEdit,
  onDelete,
  onReport,
  onLike,
  onCamp,
  onComments,
  footer,
}: PostCardProps) {
  const router = useRouter();
  const { confirm } = useConfirmModal();
  return (
    <PostCardFrame isPage={post.author.isPage}>
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
                  await onDelete?.();
              }}
            >
              <Text className="text-xs font-black text-[#C62828]">Delete</Text>
            </Pressable>
          </View>
        ) : onReport ? (
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
                await onReport?.();
            }}
          >
            <Text className="text-xs font-black text-g000st-black dark:text-night-text">
              Report
            </Text>
          </Pressable>
        ) : null}
      </View>
      {!!post.content && (
        <PostContentText
          linkPreview={post.linkPreview}
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
          onPress={onComments ? async () => onComments() : undefined}
        />
        {onCamp && post.ownerPublicId && !post.ownedByViewer && (
          <Action
            label={post.campedByViewer ? "✓" : "➕"}
            active={post.campedByViewer}
            enlarged={post.campedByViewer}
            accessibilityLabel={post.campedByViewer ? "Following author. Unfollow" : "Follow author"}
            onPress={onCamp}
          />
        )}
        {onShare && <Action label="↗️" onPress={onShare} />}
        {onChat && post.ownerPublicId && !post.ownedByViewer && (
          <Action label="Chat" onPress={() => onChat(post.ownerPublicId)} />
        )}
      </View>
      {footer}
    </PostCardFrame>
  );
}

export function SharedPostPreview({
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
          linkPreview={sharedPost.linkPreview}
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

export function SocialVideo({ uri }: { uri: string }) {
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
  onPress?: () => void | Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={!onPress}
      onPress={() => void onPress?.()}
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
