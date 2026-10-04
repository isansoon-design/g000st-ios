"use client";

import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
  createMarketComment,
  deleteMarketComment,
  getMarketPost,
  listMarketComments,
  toggleMarketLike,
  type MarketComment,
  type MarketPost,
} from "@/app/api/market";
import { sessionStorage } from "@/app/api/session-storage";
import {
  createSocialComment,
  deleteSocialComment,
  getSocialPost,
  listSocialComments,
  toggleSocialCamp,
  toggleSocialLike,
  type SocialComment,
  type SocialMedia,
  type SocialPost,
  type SocialVisibility,
} from "@/app/api/social";
import { PostImage } from "@/components/media/PostImage";
import { UserHeaderPortal } from "@/components/navigation/header-portal";
import { LinkifiedText } from "@/components/text/LinkifiedText";
import { PostContentLink } from "@/components/posts/PostContentLink";

type Kind = "social" | "market";
type Post = SocialPost | MarketPost;
type Comment = SocialComment | MarketComment;

function isKind(value: string): value is Kind {
  return value === "social" || value === "market";
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function PostMedia({ media }: { media?: SocialMedia[] }) {
  if (!media?.length) return null;
  return (
    <div
      className={`grid gap-1 ${media.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {media.map((item) =>
        item.kind === "video" ? (
          <video
            key={item.id}
            src={item.url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[32rem] w-full bg-black object-contain"
          />
        ) : (
          <PostImage
            key={item.id}
            src={item.url}
            className="max-h-[32rem] h-full w-full object-cover"
          />
        ),
      )}
    </div>
  );
}

export default function PostDetailPage() {
  const { kind, postId } = useParams<{ kind: string; postId: string }>();
  return (
    <PostDetailContent key={`${kind}:${postId}`} kind={kind} postId={postId} />
  );
}

function PostDetailContent({ kind, postId }: { kind: string; postId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<Post>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [draft, setDraft] = useState("");
  const [visibility, setVisibility] = useState<SocialVisibility>("anonymous");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [following, setFollowing] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const [hydrated, setHydrated] = useState(false);
  const loadingMoreRef = useRef(false);
  const isPage =
    hydrated &&
    !!sessionStorage.getActingPublicId() &&
    sessionStorage.getActingPublicId() !== sessionStorage.get()?.user.publicId;

  useEffect(() => {
    setHydrated(true);
  }, []);

  const load = useCallback(async () => {
    if (!isKind(kind) || !postId) return;
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
        if (!active || !result) return;
        setPost(result.nextPost);
        setComments(result.page.items);
        setCursor(result.page.nextCursor);
      })
      .catch((error) => {
        if (active) toast.error(message(error, "Could not load post."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function loadMore() {
    if (!isKind(kind) || !postId || !cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page =
        kind === "social"
          ? await listSocialComments(postId, cursor)
          : await listMarketComments(postId, cursor);
      setComments((current) => {
        const known = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...page.items.filter((item) => !known.has(item.id)),
        ].sort(
          (a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id),
        );
      });
      setCursor(page.nextCursor);
    } catch (error) {
      toast.error(message(error, "Could not load more comments."));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  async function sendComment() {
    const content = draft.trim();
    if (!isKind(kind) || !postId || !content || posting) return;
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
      setDraft("");
    } catch (error) {
      toast.error(message(error, "Could not add comment."));
    } finally {
      setPosting(false);
    }
  }

  async function removeComment(commentId: string) {
    if (!isKind(kind) || !postId || deletingId) return;
    setDeletingId(commentId);
    try {
      if (kind === "social") await deleteSocialComment(postId, commentId);
      else await deleteMarketComment(postId, commentId);
      setComments((current) => current.filter((item) => item.id !== commentId));
      setPost((current) =>
        current
          ? { ...current, commentCount: Math.max(0, current.commentCount - 1) }
          : current,
      );
    } catch (error) {
      toast.error(message(error, "Could not delete comment."));
    } finally {
      setDeletingId(undefined);
    }
  }

  async function like() {
    if (!isKind(kind) || !postId || liking) return;
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
            likedByViewer: result.liked,
            likeCount: result.likeCount,
          }
          : current,
      );
    } catch (error) {
      toast.error(message(error, "Could not update reaction."));
    } finally {
      setLiking(false);
    }
  }

  async function follow() {
    if (!post?.ownerPublicId || following) return;
    setFollowing(true);
    try {
      const result = await toggleSocialCamp(post.ownerPublicId);
      setPost((current) =>
        current ? { ...current, campedByViewer: result.camped } : current,
      );
    } catch (error) {
      toast.error(message(error, "Could not update follow."));
    } finally {
      setFollowing(false);
    }
  }

  async function share() {
    if (!post) return;
    const url = window.location.href;
    try {
      if (navigator.share)
        await navigator.share({
          title: `${post.author.displayName}'s post`,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Post link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(message(error, "Could not share post."));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <UserHeaderPortal>
        <button
          type="button"
          aria-label="Back"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push(kind === "market" ? "/market" : "/social");
          }}
          className="rounded-lg p-2"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="mr-auto text-sm font-black lg:text-base">
          {kind === "market" ? "Market post" : "Social post"}
        </h1>
      </UserHeaderPortal>
      {!isKind(kind) || !postId ? (
        <p className="p-8 text-center">Invalid post link.</p>
      ) : loading ? (
        <div className="grid flex-1 place-items-center text-sm">
          Loading post…
        </div>
      ) : !post ? (
        <div className="grid flex-1 place-content-center gap-3 text-center">
          <p>Post unavailable.</p>
          <button
            type="button"
            onClick={() => {
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
                  toast.error(message(error, "Could not load post.")),
                )
                .finally(() => setLoading(false));
            }}
            className="rounded-xl bg-black px-4 py-2 font-bold text-white"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl pb-8">
              <article className="bg-white dark:bg-night-surface">
                <button
                  type="button"
                  disabled={!post.author.publicId}
                  onClick={() =>
                    post.author.publicId &&
                    router.push(`/users/${post.author.publicId}`)
                  }
                  className="flex w-full items-center gap-3 p-4 text-left disabled:cursor-default"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-black text-white">
                    <img
                      src={post.author.avatarUrl || "/g000st-icon.jpeg"}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">
                      {post.author.displayName}
                    </strong>
                    <span className="text-xs text-black/45 dark:text-night-muted">
                      {new Date(post.createdAtMs).toLocaleString()}
                      {post.editedAtMs ? " · edited" : ""}
                    </span>
                  </span>
                </button>
                {!!post.content && (
                  <PostContentLink
                    linkPreview={"linkPreview" in post ? post.linkPreview : undefined}
                    content={post.content}
                    className="px-4 pb-4 text-[15px] leading-6"
                  />
                )}
                {kind === "social" &&
                  "sharedPostId" in post &&
                  post.sharedPostId && (
                    <div className="mx-4 mb-4 overflow-hidden rounded-xl border border-black/10 dark:border-night-border">
                      {post.sharedPost ? (
                        <>
                          <p className="px-3 pt-3 text-xs font-black">
                            {post.sharedPost.author.displayName}
                          </p>
                          <PostContentLink
                            linkPreview={post.sharedPost.linkPreview}
                            content={post.sharedPost.content}
                            href={`/posts/social/${post.sharedPost.id}`}
                            className="p-3 text-sm leading-5"
                          />
                          <PostMedia media={post.sharedPost.media} />
                        </>
                      ) : (
                        <p className="p-3 text-black/50">
                          Original post unavailable
                        </p>
                      )}
                    </div>
                  )}
                {kind === "market" && "price" in post && (
                  <div className="flex flex-wrap gap-2 px-4 pb-4 text-xs font-black">
                    <span className="rounded-full bg-[#c62828] px-3 py-1.5 text-white">
                      {post.price.toLocaleString()} {post.currency}
                    </span>
                    <span className="rounded-full bg-black/5 px-3 py-1.5 dark:bg-night-raised">
                      Qty {post.quantity}
                    </span>
                    <span className="rounded-full bg-black/5 px-3 py-1.5 dark:bg-night-raised">
                      ⌖ {post.city}
                    </span>
                  </div>
                )}
                <PostMedia media={post.media} />
                <div className="flex items-center justify-around gap-2 border-t border-black/10 p-2 dark:border-night-border">
                  <button
                    type="button"
                    disabled={liking}
                    onClick={() => void like()}
                    className={`flex items-center gap-1 rounded-lg px-3 py-2 font-black ${post.likedByViewer ? "text-[#c62828]" : ""}`}
                    aria-label="Like post"
                  >
                    <Heart
                      size={18}
                      fill={post.likedByViewer ? "currentColor" : "none"}
                    />{" "}
                    {post.likeCount}
                  </button>
                  <span className="flex items-center gap-1 font-black">
                    <MessageCircle size={18} /> {post.commentCount}
                  </span>
                  {!post.ownedByViewer && post.ownerPublicId && (
                    <button
                      type="button"
                      disabled={following}
                      onClick={() => void follow()}
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-black"
                    >
                      {post.campedByViewer ? (
                        <UserCheck size={26} className="text-[#c62828]" />
                      ) : (
                        <UserPlus size={18} />
                      )}
                      {/* {post.campedByViewer ? "Following" : "Follow"} */}
                      {post.campedByViewer ? "" : "Follow"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void share()}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-black"
                  >
                    <Share2 size={18} /> Share
                  </button>
                </div>
              </article>
              <section aria-label="Comments" className="px-3">
                <h2 className="px-1 pb-3 pt-5 text-lg font-black">Comments</h2>
                {comments.length === 0 && (
                  <p className="py-10 text-center text-black/40 dark:text-night-muted">
                    No comments yet.
                  </p>
                )}
                <div className="space-y-2">
                  {comments.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-xl bg-white p-3 dark:bg-night-surface"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/10 text-xs font-black dark:bg-night-raised">
                        {item.author.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="text-sm">
                          {item.author.displayName}
                        </strong>
                        <p className="whitespace-pre-wrap text-sm">
                          <LinkifiedText content={item.content} />
                        </p>
                        <time className="text-xs text-black/40 dark:text-night-muted">
                          {new Date(item.createdAtMs).toLocaleString()}
                        </time>
                      </div>
                      {item.ownedByViewer && (
                        <button
                          type="button"
                          disabled={!!deletingId}
                          onClick={() => void removeComment(item.id)}
                          className="self-start text-xs font-black text-[#c62828]"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {cursor && (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                    className="mt-3 w-full rounded-xl p-3 text-sm font-black disabled:opacity-40"
                  >
                    {loadingMore ? "Loading…" : "Load more comments"}
                  </button>
                )}
              </section>
            </div>
          </main>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void sendComment();
            }}
            className="shrink-0 border-t border-black/10 bg-white p-3 dark:border-night-border dark:bg-night-surface"
          >
            <div className="mx-auto max-w-2xl">
              {kind === "social" && (
                <label className="mb-2 flex items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={isPage || visibility === "public"}
                    disabled={isPage}
                    onChange={(event) =>
                      setVisibility(
                        event.target.checked ? "public" : "anonymous",
                      )
                    }
                  />
                  {isPage ? "Commenting as page" : "Show my identity"}
                </label>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a comment…"
                  maxLength={1000}
                  rows={2}
                  className="max-h-28 min-w-0 flex-1 resize-none rounded-xl border border-black/15 bg-white px-3 py-2 outline-none dark:border-night-border dark:bg-night-surface"
                />
                <button
                  type="submit"
                  disabled={posting || !draft.trim()}
                  className="rounded-xl bg-black px-5 py-3 font-black text-white disabled:opacity-40"
                >
                  {posting ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
