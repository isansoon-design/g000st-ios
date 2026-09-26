"use client";

import {
  Bell,
  Heart,
  MessageCircle,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { sessionStorage } from "@/app/api/session-storage";
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
  type SocialAlert,
  type SocialComment,
  type SocialPost,
  type SocialProfile,
  type SocialVisibility,
} from "@/app/api/social";
import { useConfirmModal } from "@/context/ConfirmModalContext";
import { startChatConversation } from "@/features/chat/api";

type View = "home" | "mine" | "alerts";

export default function SocialPage() {
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const [view, setView] = useState<View>("home");
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
  const [busy, setBusy] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const feedScrollRef = useRef<HTMLElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const myId = sessionStorage.get()?.user.publicId;

  const load = useCallback(async () => {
    try {
      if (view === "alerts") {
        setAlerts(await listSocialAlerts());
        await markSocialAlertsRead();
      } else {
        const page = await listSocialPosts(
          undefined,
          view === "mine" ? myId : undefined,
        );
        setPosts(page.items);
        setNextCursor(page.nextCursor ?? null);
        if (view === "mine" && myId) setProfile(await getSocialProfile(myId));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load Social.",
      );
    }
  }, [myId, view]);
  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || view === "alerts") return;
    setLoadingMore(true);
    try {
      const page = await listSocialPosts(
        nextCursor,
        view === "mine" ? myId : undefined,
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
      toast.error(
        error instanceof Error ? error.message : "Could not load more posts.",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, myId, nextCursor, view]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !nextCursor || view === "alerts") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMore();
      },
      { root: feedScrollRef.current, rootMargin: "800px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, nextCursor, view]);

  async function publish() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const clientPostId = crypto.randomUUID();
      const uploaded = mediaFiles.length
        ? await Promise.all(
          mediaFiles.map((file) => uploadSocialMedia(clientPostId, file)),
        )
        : undefined;
      const post = await createSocialPost(
        clientPostId,
        draft,
        visibility,
        uploaded,
      );
      setPosts((items) => [post, ...items]);
      setDraft("");
      setMediaFiles([]);
      toast.success("Posted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post.");
    } finally {
      setBusy(false);
    }
  }

  async function openChat(publicId?: string) {
    if (!publicId) return toast.error("This author is anonymous.");
    try {
      const conversation = await startChatConversation(publicId);
      router.push(`/chat?conversationId=${conversation.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open chat.",
      );
    }
  }

  async function publishShare() {
    if (!sharingPost || sharing) return;
    setSharing(true);
    try {
      const post = await createSocialPost(
        crypto.randomUUID(),
        shareDraft.trim(),
        shareVisibility,
        undefined,
        sharingPost.sharedPostId ?? sharingPost.id,
      );
      setPosts((items) => [post, ...items]);
      setSharingPost(undefined);
      setShareDraft("");
      toast.success("Shared to Social");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not share post.",
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#e7e7e9] text-[#171717]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 bg-gradient-to-b from-white to-[#c9c9cb] px-4 shadow-sm">
        <h1 className="text-lg font-black">
          g<span className="text-[#c62828]">000</span>
          st
          <span className="text-[#c62828]">S</span>
          ocial
        </h1>
        <button onClick={() => setView("alerts")} aria-label="Alerts">
          <Bell size={21} />
        </button>
      </header>
      <main ref={feedScrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {view !== "alerts" && (
          <div className="border-b border-black/10 bg-white/80 p-4">
            <textarea
              className="min-h-24 w-full resize-none rounded-2xl border border-black/15 bg-white p-3 outline-none"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Share without a name…"
              maxLength={4000}
            />
            {mediaFiles.length > 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {mediaFiles.map((file, index) => (
                  <MediaPreview
                    key={index}
                    file={file}
                    onRemove={() =>
                      setMediaFiles((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  />
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-xs font-bold">
                📎
                <input
                  className="hidden"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                  onChange={(event) => {
                    const files = [...(event.target.files ?? [])];
                    const videos = files.filter((file) =>
                      file.type.startsWith("video/"),
                    );
                    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
                      toast.error("Each file must be 5 MB or smaller.");
                      event.target.value = "";
                      return;
                    }
                    if (
                      (videos.length && files.length !== 1) ||
                      videos.length > 1 ||
                      (!videos.length && files.length > 2)
                    ) {
                      toast.error("Choose up to two images or one video.");
                      event.target.value = "";
                      return;
                    }
                    setMediaFiles(files);
                  }}
                />
                {mediaFiles.length ? `${mediaFiles.length} selected` : "Media"}
              </label>
              <label className="flex flex-1 items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={visibility === "public"}
                  onChange={(event) =>
                    setVisibility(event.target.checked ? "public" : "anonymous")
                  }
                />{" "}
                Show my identity
              </label>
              <button
                disabled={busy || !draft.trim()}
                onClick={() => void publish()}
                className="rounded-xl bg-[#222] px-5 py-2 text-sm font-black text-white disabled:opacity-40"
              >
                Post
              </button>
            </div>
          </div>
        )}
        {view === "alerts" ? (
          <Alerts alerts={alerts} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-3 p-3">
            {view === "mine" && profile && (
              <ProfileEditor
                profile={profile}
                onSave={async (value) =>
                  setProfile(await updateSocialProfile(value))
                }
              />
            )}
            {posts.length === 0 && (
              <Empty
                text={
                  view === "mine"
                    ? "No posts yet — share something."
                    : "No posts yet."
                }
              />
            )}
            {posts.map((post) => (
              <article
                key={post.id}
                className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-[5px_6px_0_#111]"
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-black text-white">
                    {post.author.avatarUrl ? (
                      <img
                        src={post.author.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound size={20} />
                    )}
                  </div>
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => void openChat(post.ownerPublicId)}
                  >
                    <div className="truncate font-black">
                      {post.author.displayName}
                    </div>
                    <div className="text-xs text-black/45">
                      {new Date(post.createdAtMs).toLocaleString()}
                      {post.editedAtMs ? " · edited" : ""}
                    </div>
                  </button>
                  {post.ownedByViewer ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        aria-label="Edit post"
                        onClick={() => setEditingPost(post)}
                        className="rounded-full border border-black/20 px-3 py-2 text-xs font-black"
                      >
                        Edit
                      </button>
                      <button
                        aria-label="Delete post"
                        className="rounded-full border border-[#c62828] px-3 py-2 text-xs font-black text-[#c62828]"
                        onClick={async () => {
                          if (await confirm({
                            title: "Delete post?",
                            message: "Are you sure you want to delete this post?",
                            confirmLabel: "Delete",
                            isDangerous: true,
                          })) {
                            await deleteSocialPost(post.id);
                            setPosts((items) =>
                              items.filter((item) => item.id !== post.id),
                            );
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <button
                      aria-label="Report post"
                      className="text-xs font-black"
                      onClick={async () => {
                        await reportSocialPost(post.id, "other");
                        toast.success("Report sent");
                      }}
                    >
                      Report
                    </button>
                  )}
                </div>
                {!!post.content && (
                  <p className="whitespace-pre-wrap px-4 pb-3 text-[15px] leading-6">
                    {post.content}
                  </p>
                )}
                {post.sharedPostId && (
                  <div className="mx-4 mb-4">
                    {post.sharedPost ? (
                      <SharedPostPreview post={post.sharedPost} />
                    ) : (
                      <div className="rounded-xl border border-black/10 p-4 text-black/50">
                        Original post unavailable
                      </div>
                    )}
                  </div>
                )}
                {post.media?.length ? (
                  <div
                    className={`grid gap-1 ${post.media.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
                  >
                    {post.media.map((item) =>
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
                        <img
                          key={item.id}
                          src={item.url}
                          alt=""
                          className="max-h-[32rem] h-full w-full object-cover"
                        />
                      ),
                    )}
                  </div>
                ) : null}
                <div className="flex items-center border-t border-black/10 p-2">
                  <button
                    onClick={async () => {
                      const result = await toggleSocialLike(post.id);
                      setPosts((items) =>
                        items.map((item) =>
                          item.id === post.id
                            ? {
                              ...item,
                              likedByViewer: result.liked,
                              likeCount: result.likeCount,
                            }
                            : item,
                        ),
                      );
                    }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-black ${post.likedByViewer ? "text-[#c62828]" : ""}`}
                  >
                    <Heart
                      size={18}
                      fill={post.likedByViewer ? "currentColor" : "none"}
                    />
                    {post.likeCount}
                  </button>
                  <button
                    onClick={() => setCommentsPost(post)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-black"
                  >
                    <MessageCircle size={18} />
                    {post.commentCount}
                  </button>
                  {post.ownerPublicId && !post.ownedByViewer && (
                    <button
                      onClick={async () => {
                        const result = await toggleSocialCamp(
                          post.ownerPublicId!,
                        );
                        setPosts((items) =>
                          items.map((item) =>
                            item.ownerPublicId === post.ownerPublicId
                              ? { ...item, campedByViewer: result.camped }
                              : item,
                          ),
                        );
                      }}
                      className="flex-1 rounded-xl py-3 font-black"
                    >
                      {post.campedByViewer ? "Following" : "+ Follow"}
                    </button>
                  )}

                  <button
                    className="flex-1 rounded-xl py-3 font-black"
                    onClick={() => {
                      setShareDraft("");
                      setShareVisibility("anonymous");
                      setSharingPost(post);
                    }}
                  >
                    Share
                  </button>
                  {post.ownerPublicId && !post.ownedByViewer && (
                    <button
                      className="flex-1 rounded-xl py-3 font-black"
                      onClick={() => void openChat(post.ownerPublicId)}
                    >
                      Chat
                    </button>
                  )}
                </div>
              </article>
            ))}
            <div ref={loadMoreRef} className="h-1" aria-hidden="true" />
            {loadingMore && (
              <div className="py-3 text-center text-xs font-bold text-black/45">
                Loading more…
              </div>
            )}
          </div>
        )}
      </main>
      <nav className="flex h-14 shrink-0 border-t border-black/15 bg-white/90">
        <ViewButton
          active={view === "home"}
          onClick={() => setView("home")}
          label="Home"
        />
        <ViewButton
          active={view === "mine"}
          onClick={() => setView("mine")}
          label="My Page"
        />
        <ViewButton
          active={view === "alerts"}
          onClick={() => setView("alerts")}
          label="Alerts"
        />
      </nav>
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
      {sharingPost && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-5 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Share to Social"
        >
          <div className="w-full max-w-lg space-y-3 rounded-[24px] bg-white p-5">
            <h2 className="text-lg font-black">Share to Social</h2>
            <SharedPostPreview
              compact
              post={
                sharingPost.sharedPost ?? {
                  id: sharingPost.id,
                  author: sharingPost.author,
                  content: sharingPost.content,
                  media: sharingPost.media,
                  createdAtMs: sharingPost.createdAtMs,
                }
              }
            />
            <textarea
              value={shareDraft}
              onChange={(event) => setShareDraft(event.target.value)}
              maxLength={4000}
              placeholder="Add a note (optional)"
              className="min-h-20 w-full rounded-xl border border-black/15 p-3"
            />
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={shareVisibility === "public"}
                onChange={(event) =>
                  setShareVisibility(
                    event.target.checked ? "public" : "anonymous",
                  )
                }
              />
              Show my identity
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSharingPost(undefined)}
                className="flex-1 rounded-xl bg-[#ddd] p-3 font-black"
              >
                Cancel
              </button>
              <button
                disabled={sharing}
                onClick={() => void publishShare()}
                className="flex-1 rounded-xl bg-black p-3 font-black text-white disabled:opacity-40"
              >
                {sharing ? "Sharing…" : "Share"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SharedPostPreview({
  post,
  compact = false,
}: {
  post: NonNullable<SocialPost["sharedPost"]>;
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/15 bg-black/[.03]">
      <div className="p-3">
        <p className="text-xs font-black">{post.author.displayName}</p>
        <p
          className={`mt-1 whitespace-pre-wrap text-sm ${compact ? "line-clamp-3" : ""}`}
        >
          {post.content}
        </p>
      </div>
      {!compact && post.media?.length ? (
        <div
          className={`grid gap-1 ${post.media.length === 2 ? "grid-cols-2" : ""}`}
        >
          {post.media.map((item) =>
            item.kind === "video" ? (
              <video
                key={item.id}
                src={item.url}
                controls
                playsInline
                className="max-h-80 w-full bg-black object-contain"
              />
            ) : (
              <img
                key={item.id}
                src={item.url}
                alt=""
                className="max-h-80 w-full object-cover"
              />
            ),
          )}
        </div>
      ) : null}
      {compact && !!post.media?.length && (
        <p className="px-3 pb-3 text-xs text-black/50">
          {post.media.length} media attachment
          {post.media.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

function SocialCommentsModal({
  post,
  visibility,
  onClose,
  onCountChange,
}: {
  post?: SocialPost;
  visibility: SocialVisibility;
  onClose: () => void;
  onCountChange: (postId: string, delta: number) => void;
}) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!post) return;
    setLoading(true);
    setComments([]);
    void listSocialComments(post.id)
      .then((page) => {
        setComments(page.items);
        setCursor(page.nextCursor);
      })
      .catch(() => toast.error("Could not load comments."))
      .finally(() => setLoading(false));
  }, [post]);
  if (!post) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-[75dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-white p-4 shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-black">Comments</h2>
          <button aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
          {comments.map((item) => (
            <div
              key={item.id}
              className="flex gap-2 rounded-xl bg-black/[.04] p-3"
            >
              <p className="min-w-0 flex-1 text-sm">
                <b>{item.author.displayName}</b> {item.content}
              </p>
              {item.ownedByViewer && (
                <button
                  onClick={async () => {
                    await deleteSocialComment(post.id, item.id);
                    setComments((current) =>
                      current.filter((comment) => comment.id !== item.id),
                    );
                    onCountChange(post.id, -1);
                  }}
                  className="text-xs font-black text-[#c62828]"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          {!loading && !comments.length && (
            <div className="py-16 text-center text-black/40">
              No comments yet.
            </div>
          )}
          {cursor && (
            <button
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  const page = await listSocialComments(post.id, cursor);
                  setComments((current) => [...current, ...page.items]);
                  setCursor(page.nextCursor);
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full py-3 text-sm font-black"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
        <form
          className="flex gap-2 border-t pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            const content = value.trim();
            if (!content) return;
            void createSocialComment(post.id, content, visibility)
              .then((item) => {
                setComments((current) => [...current, item]);
                setValue("");
                onCountChange(post.id, 1);
              })
              .catch(() => toast.error("Could not add comment."));
          }}
        >
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2"
            placeholder="Write a comment…"
            maxLength={1000}
          />
          <button
            aria-label="Send"
            className="rounded-xl bg-black px-4 text-white"
          >
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
function EditSocialPostModal({
  post,
  onClose,
  onSave,
}: {
  post?: SocialPost;
  onClose: () => void;
  onSave: (postId: string, content: string) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  useEffect(() => {
    if (post) setContent(post.content);
  }, [post]);
  if (!post) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-5">
      <div className="w-full max-w-lg space-y-3 rounded-[24px] bg-white p-5">
        <div className="flex justify-between">
          <h2 className="text-lg font-black">Edit post</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={4000}
          className="min-h-32 w-full rounded-xl border border-black/15 p-3"
        />
        <button
          onClick={() => {
            const next = content.trim();
            if (next) void onSave(post.id, next);
          }}
          className="w-full rounded-xl bg-black p-3 font-black text-white"
        >
          Save
        </button>
      </div>
    </div>
  );
}
function Alerts({ alerts }: { alerts: SocialAlert[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-2 p-3">
      {alerts.length === 0 ? (
        <Empty text="No alerts yet." />
      ) : (
        alerts.map((alert) => (
          <div key={alert.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <b>{alert.actor.displayName}</b>
            {alert.kind === "like"
              ? "liked your post."
              : alert.kind === "comment"
                ? "commented on your post."
                : "started following you."}
            <div className="mt-1 text-xs text-black/45">
              {new Date(alert.createdAtMs).toLocaleString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
function ProfileEditor({
  profile,
  onSave,
}: {
  profile: SocialProfile;
  onSave: (value: Partial<SocialProfile>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [hobby, setHobby] = useState(profile.hobby ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  if (!editing)
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full rounded-2xl bg-white p-4 text-left shadow-sm"
      >
        <div className="font-black">
          {profile.displayName || "My social profile"}
        </div>
        <div className="mt-1 text-xs text-black/45">
          {profile.country ||
            profile.hobby ||
            "Click to complete your optional profile"}
        </div>
      </button>
    );
  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-black">Edit social profile</h2>
      <input
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="Display name"
        className="w-full rounded-xl border border-black/15 px-3 py-2"
      />
      <input
        value={country}
        onChange={(event) => setCountry(event.target.value)}
        placeholder="Country"
        className="w-full rounded-xl border border-black/15 px-3 py-2"
      />
      <input
        value={hobby}
        onChange={(event) => setHobby(event.target.value)}
        placeholder="Hobby"
        className="w-full rounded-xl border border-black/15 px-3 py-2"
      />
      <textarea
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        placeholder="About me"
        className="min-h-20 w-full rounded-xl border border-black/15 px-3 py-2"
      />
      <div className="flex gap-2">
        <button
          onClick={() => setEditing(false)}
          className="flex-1 rounded-xl bg-[#ddd] p-3 font-black"
        >
          Cancel
        </button>
        <button
          onClick={() =>
            void onSave({
              displayName: displayName.trim() || undefined,
              country: country.trim() || undefined,
              hobby: hobby.trim() || undefined,
              bio: bio.trim() || undefined,
            }).then(() => setEditing(false))
          }
          className="flex-1 rounded-xl bg-[#222] p-3 font-black text-white"
        >
          Save
        </button>
      </div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="py-16 text-center font-bold text-black/45">{text}</div>
  );
}
function ViewButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-xs font-black ${active ? "border-t-2 border-[#c62828] text-black" : "text-black/45"}`}
    >
      {label}
    </button>
  );
}

function MediaPreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!url) return <div className="h-20 w-20 shrink-0 rounded-xl bg-black/5" />;
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-black/5">
      {file.type.startsWith("video/") ? (
        <video src={url} className="h-full w-full object-cover" />
      ) : (
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white"
      >
        ×
      </button>
    </div>
  );
}
