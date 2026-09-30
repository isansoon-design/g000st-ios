"use client";

import {
  Bell,
  Loader2,
  Heart,
  MessageCircle,
  Share2,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { sessionStorage } from "@/app/api/session-storage";
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
  type SocialAlert,
  type SocialPost,
  type SocialProfile,
  type SocialSuggestion,
  type SocialVisibility,
} from "@/app/api/social";
import { PostImage } from "@/components/media/PostImage";
import { UserHeaderPortal } from "@/components/navigation/header-portal";
import { PostContentLink } from "@/components/posts/PostContentLink";
import { useConfirmModal } from "@/context/ConfirmModalContext";
import { startChatConversation } from "@/features/chat/api";

type View = "home" | "mine" | "alerts";

export default function SocialPage() {
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const [view, setView] = useState<View>("home");
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
  const [busy, setBusy] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
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
  const feedScrollRef = useRef<HTMLElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const myId = sessionStorage.getActingPublicId() ?? undefined;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const isPage =
    hydrated && !!myId && myId !== sessionStorage.get()?.user.publicId;

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
    feedScrollRef.current?.scrollTo(0, 0);
    void load();
  }, [load]);

  const loadSuggestions = useCallback(async () => {
    if (!myId || view !== "home") return;
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
      toast.error(
        error instanceof Error ? error.message : "Could not load suggestions.",
      );
    }
  }, [myId, view]);
  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);
  useEffect(() => {
    if (!myId || view !== "home") return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const nextDayMs =
        (Math.floor(Date.now() / 86_400_000) + 1) * 86_400_000 + 1_000;
      timer = setTimeout(() => {
        void loadSuggestions();
        schedule();
      }, nextDayMs - Date.now());
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadSuggestions();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadSuggestions, myId, view]);

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
      toast.success("Following");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not follow this person.",
      );
    } finally {
      followingSuggestionIdRef.current = null;
      setFollowingSuggestionId(null);
    }
  }

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
    if ((!draft.trim() && mediaFiles.length === 0) || busy) return;
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
        isPage ? "public" : visibility,
        uploaded,
      );
      setPosts((items) => [post, ...items]);
      setDraft("");
      setMediaFiles([]);
      setIsComposerOpen(false);
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
        isPage ? "public" : shareVisibility,
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
    <div className="flex h-full flex-col bg-[#e7e7e9] dark:bg-night-canvas text-[#171717] dark:text-night-text">
      <UserHeaderPortal>
        <h1 className="mr-auto text-sm font-black lg:text-base"><span className="text-[#c62828]">S</span>ocial</h1>
        <nav aria-label="Social navigation" className="hidden items-center gap-1 lg:flex">
          {(["home", "mine", "alerts"] as const).map((item) => (
            <button key={item} type="button" aria-current={view === item ? "page" : undefined} onClick={() => setView(item)} className={`rounded-xl px-3 py-2 text-sm font-bold ${view === item ? "bg-[#C62828] text-white" : "text-[#444b56] hover:bg-black/5 dark:text-night-text dark:hover:bg-white/10"}`}>
              {item === "home" ? "Home" : item === "mine" ? "My Posts" : "Alerts"}
            </button>
          ))}
          <button type="button" onClick={() => setView("alerts")} aria-label="Alerts" className="ml-1 rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10"><Bell size={20} /></button>
        </nav>
        <select aria-label="Social navigation" value={view} onChange={(event) => setView(event.target.value as View)} className="w-[104px] rounded-lg border border-black/15 bg-white px-1 py-2 text-xs font-bold text-[#17191d] dark:border-white/20 dark:bg-night-surface dark:text-night-text sm:w-[140px] lg:hidden">
          <option value="home">Home</option>
          <option value="mine">My Posts</option>
          <option value="alerts">Alerts</option>
        </select>
      </UserHeaderPortal>
      <main ref={feedScrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {view === "alerts" ? (
          <Alerts alerts={alerts} />
        ) : (
          <div data-admin-part="centre.feed" className="mx-auto max-w-2xl space-y-3 p-3">
            <button
              type="button"
              aria-label="Create a Social post"
              onClick={() => setIsComposerOpen(true)}
              className="mb-1 flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 text-left shadow-sm dark:border-night-border dark:bg-night-surface"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#c62828] text-2xl font-light text-white">＋</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black text-[#17191d] dark:text-night-text">Create a Social post</span>
                <span className="mt-0.5 block text-xs text-black/50 dark:text-night-muted">Share with the community</span>
              </span>
              <span aria-hidden="true" className="text-xl font-bold text-[#c62828]">›</span>
            </button>
            {view === "mine" && profile && (
              <ProfileEditor
                profile={profile}
                onSave={async (value) =>
                  setProfile(await updateSocialProfile(value))
                }
              />
            )}
            {view === "home" && suggestions.length > 0 && (
              <section
                aria-label="Suggested people"
                className="overflow-hidden rounded-2xl border border-black/15 dark:border-night-border bg-white dark:bg-night-surface p-4"
              >
                <h2 className="text-sm font-black">People you may know</h2>
                <p className="mt-1 text-xs text-black/55 dark:text-night-muted">
                  Fresh suggestions every day
                </p>
                <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
                  {suggestions.map((person) => (
                    <div
                      key={person.publicId}
                      className="flex w-44 shrink-0 snap-start flex-col items-center rounded-xl border border-black/10 dark:border-night-border bg-[#f6f6f7] dark:bg-night-surface p-3 text-center"
                    >
                      <Link
                        href={`/users/${person.publicId}`}
                        aria-label={`View ${person.displayName}'s profile`}
                        className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[#222] text-sm font-bold text-white"
                      >
                        {person.avatarUrl ? (
                          <img
                            src={person.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          person.displayName.slice(0, 1).toUpperCase()
                        )}
                      </Link>
                      <Link
                        href={`/users/${person.publicId}`}
                        className="mt-2 w-full truncate text-sm font-bold hover:underline"
                        title={person.displayName}
                      >
                        {person.displayName}
                      </Link>
                      <div className="mt-1 h-8 text-[11px] text-black/55 dark:text-night-muted">
                        {person.reason === "friends_of_friends"
                          ? "Followed by people you follow"
                          : "Discover someone new"}
                      </div>
                      <button
                        type="button"
                        disabled={
                          followingSuggestionId !== null ||
                          followedSuggestionIds.has(person.publicId)
                        }
                        aria-label={
                          followingSuggestionId === person.publicId
                            ? `Following ${person.displayName}`
                            : followedSuggestionIds.has(person.publicId)
                              ? `Followed ${person.displayName}`
                              : `Follow ${person.displayName}`
                        }
                        aria-live="polite"
                        onClick={() => void followSuggestion(person.publicId)}
                        className="mt-2 flex h-10 w-full items-center justify-center rounded-lg bg-[#222] px-3 text-white"
                      >
                        {followingSuggestionId === person.publicId ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : followedSuggestionIds.has(person.publicId) ? (
                          <span aria-hidden="true">✓</span>
                        ) : (
                          <>
                            <UserPlus size={16} /> Follow
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
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
                className="overflow-hidden rounded-2xl border-2 border-black dark:border-night-border bg-white dark:bg-night-surface shadow-[5px_6px_0_#111]"
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-black text-white">
                    <img
                      src={post.author.avatarUrl || "/g000st-icon.jpeg"}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      if (post.author.publicId)
                        router.push(`/users/${post.author.publicId}`);
                    }}
                    disabled={!post.author.publicId}
                  >
                    <div className="truncate font-black">
                      {post.author.displayName}
                    </div>
                    <div className="text-xs text-black/45 dark:text-night-muted">
                      {new Date(post.createdAtMs).toLocaleString()}
                      {post.editedAtMs ? " · edited" : ""}
                    </div>
                  </button>
                  {post.ownedByViewer ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        aria-label="Edit post"
                        onClick={() => setEditingPost(post)}
                        className="rounded-full border border-black/20 dark:border-night-border px-3 py-2 text-xs font-black"
                      >
                        Edit
                      </button>
                      <button
                        aria-label="Delete post"
                        className="rounded-full border border-[#c62828] px-3 py-2 text-xs font-black text-[#c62828]"
                        onClick={async () => {
                          if (
                            await confirm({
                              title: "Delete post?",
                              message:
                                "Are you sure you want to delete this post?",
                              confirmLabel: "Delete",
                              isDangerous: true,
                            })
                          ) {
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
                  <PostContentLink content={post.content} href={`/posts/social/${post.id}`} className="px-4 pb-3 text-[15px] leading-6" />
                )}
                {post.sharedPostId && (
                  <div className="mx-4 mb-4">
                    {post.sharedPost ? (
                      <SharedPostPreview post={post.sharedPost} />
                    ) : (
                      <div className="rounded-xl border border-black/10 dark:border-night-border p-4 text-black/50 dark:text-night-muted">
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
                        <PostImage
                          key={item.id}
                          src={item.url}
                          className="max-h-[32rem] h-full w-full object-cover"
                        />
                      ),
                    )}
                  </div>
                ) : null}
                <div className="flex items-center border-t border-black/10 dark:border-night-border p-2">
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
                    onClick={() => router.push(`/posts/social/${post.id}`)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-black"
                  >
                    <MessageCircle size={18} />
                    {post.commentCount}
                  </button>
                  {post.ownerPublicId && !post.ownedByViewer && (
                    <button
                      aria-label={post.campedByViewer ? "Following author. Unfollow" : "Follow author"}
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
                        if (result.camped) {
                          setSuggestions((current) =>
                            current.filter(
                              (person) =>
                                person.publicId !== post.ownerPublicId,
                            ),
                          );
                          void loadSuggestions();
                        }
                      }}
                      className={`flex flex-1 items-center justify-center rounded-xl py-3 font-black ${post.campedByViewer ? "text-[#c62828]" : ""}`}
                    >
                      {post.campedByViewer ? (
                        <UserCheck size={28} />
                      ) : (
                        <UserPlus size={18} />
                      )}
                    </button>
                  )}

                  <button
                    className="flex flex-1 items-center justify-center rounded-xl py-3 font-black"
                    onClick={() => {
                      setShareDraft("");
                      setShareVisibility("anonymous");
                      setSharingPost(post);
                    }}
                  >
                    <Share2 size={18} />
                  </button>
                  {post.ownerPublicId && !post.ownedByViewer && (
                    <button
                      data-admin-part="centre.whisper"
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
              <div className="py-3 text-center text-xs font-bold text-black/45 dark:text-night-muted">
                Loading more…
              </div>
            )}
          </div>
        )}
      </main>
      {isComposerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New Social post"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
        >
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-[28px] bg-[#f7f7f8] pt-5 dark:bg-night-surface sm:rounded-[28px]">
            <div className="flex items-center justify-between px-5 pb-4">
              <div>
                <h2 className="text-xl font-black">New Social post</h2>
                <p className="mt-1 text-xs text-black/50 dark:text-night-muted">Share with the community</p>
              </div>
              <button
                type="button"
                aria-label="Close new Social post"
                disabled={busy}
                onClick={() => setIsComposerOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl disabled:opacity-40 dark:bg-night-raised"
              >×</button>
            </div>
            <div className="overflow-y-auto px-5 pb-5">
              <div data-admin-part="centre.composer" className="border-b border-black/10 dark:border-night-border bg-white/80 dark:bg-night-surface p-4">
                <textarea
                  className="min-h-24 w-full resize-none rounded-2xl border border-black/15 dark:border-night-border bg-white dark:bg-night-surface p-3 outline-none"
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-night-border px-3 py-2 text-xs font-bold">
                    📎{" "}
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
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={isPage || visibility === "public"}
                      disabled={isPage}
                      onChange={(event) =>
                        setVisibility(event.target.checked ? "public" : "anonymous")
                      }
                    />{" "}
                    {isPage ? "Page name is always shown" : "Show my identity"}
                  </label>
                  <button
                    disabled={busy || (!draft.trim() && mediaFiles.length === 0)}
                    onClick={() => void publish()}
                    className="rounded-xl bg-[#222] px-5 py-2 text-sm font-black text-white disabled:opacity-40"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
          <div className="w-full max-w-lg space-y-3 rounded-[24px] bg-white dark:bg-night-surface p-5">
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
              className="min-h-20 w-full rounded-xl border border-black/15 dark:border-night-border p-3"
            />
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={isPage || shareVisibility === "public"}
                disabled={isPage}
                onChange={(event) =>
                  setShareVisibility(
                    event.target.checked ? "public" : "anonymous",
                  )
                }
              />
              {isPage ? "Page name is always shown" : "Show my identity"}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSharingPost(undefined)}
                className="flex-1 rounded-xl bg-[#ddd] dark:bg-night-raised p-3 font-black"
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
    <div className="overflow-hidden rounded-xl border border-black/15 dark:border-night-border bg-black/[.03] dark:bg-white/10">
      <div className="p-3">
        <p className="text-xs font-black">{post.author.displayName}</p>
        <PostContentLink content={post.content} href={`/posts/social/${post.id}`} className={`mt-1 text-sm ${compact ? "line-clamp-3" : ""}`} />
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
              <PostImage
                key={item.id}
                src={item.url}
                className="max-h-80 w-full object-cover"
              />
            ),
          )}
        </div>
      ) : null}
      {compact && !!post.media?.length && (
        <p className="px-3 pb-3 text-xs text-black/50 dark:text-night-muted">
          {post.media.length} media attachment
          {post.media.length === 1 ? "" : "s"}
        </p>
      )}
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
      <div className="w-full max-w-lg space-y-3 rounded-[24px] bg-white dark:bg-night-surface p-5">
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
          className="min-h-32 w-full rounded-xl border border-black/15 dark:border-night-border p-3"
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
        alerts.map((alert) => {
          const content = (
            <>
              <b>{alert.actor.displayName}</b>{" "}
              {alert.kind === "like"
                ? "liked your post."
                : alert.kind === "comment"
                  ? "commented on your post."
                  : "started following you."}
              <div className="mt-1 text-xs text-black/45 dark:text-night-muted">
                {new Date(alert.createdAtMs).toLocaleString()}
              </div>
            </>
          );
          return alert.kind === "camp" && alert.actor.publicId ? (
            <Link
              key={alert.id}
              href={`/users/${alert.actor.publicId}`}
              className="block rounded-2xl bg-white dark:bg-night-surface p-4 shadow-sm transition hover:bg-[#f7f7f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c62828]"
            >
              {content}
            </Link>
          ) : (
            <div key={alert.id} className="rounded-2xl bg-white dark:bg-night-surface p-4 shadow-sm">
              {content}
            </div>
          );
        })
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
        className="w-full rounded-2xl bg-white dark:bg-night-surface p-4 text-left shadow-sm"
      >
        <div className="font-black">
          {profile.displayName || profile.publicId.slice(0, 8)}
        </div>
        <div className="mt-1 text-xs text-black/45 dark:text-night-muted">
          {profile.country ||
            profile.hobby ||
            "Click to complete your optional profile"}
        </div>
      </button>
    );
  return (
    <div className="space-y-2 rounded-2xl bg-white dark:bg-night-surface p-4 shadow-sm">
      <h2 className="font-black">Edit social profile</h2>
      <input
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="Display name"
        className="w-full rounded-xl border border-black/15 dark:border-night-border px-3 py-2"
      />
      <input
        value={country}
        onChange={(event) => setCountry(event.target.value)}
        placeholder="Country"
        className="w-full rounded-xl border border-black/15 dark:border-night-border px-3 py-2"
      />
      <input
        value={hobby}
        onChange={(event) => setHobby(event.target.value)}
        placeholder="Hobby"
        className="w-full rounded-xl border border-black/15 dark:border-night-border px-3 py-2"
      />
      <textarea
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        placeholder="About me"
        className="min-h-20 w-full rounded-xl border border-black/15 dark:border-night-border px-3 py-2"
      />
      <div className="flex gap-2">
        <button
          onClick={() => setEditing(false)}
          className="flex-1 rounded-xl bg-[#ddd] dark:bg-night-raised p-3 font-black"
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
    <div className="py-16 text-center font-bold text-black/45 dark:text-night-muted">{text}</div>
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
  if (!url) return <div className="h-20 w-20 shrink-0 rounded-xl bg-black/5 dark:bg-white/10" />;
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-black/10 dark:border-night-border bg-black/5 dark:bg-white/10">
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
