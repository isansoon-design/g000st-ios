"use client";

import {
  Heart,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  ShoppingBag,
  UserCheck,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
  createMarketPost,
  deleteMarketPost,
  listMarketPosts,
  reportMarketPost,
  toggleMarketLike,
  updateMarketPost,
  uploadMarketMedia,
  type MarketPost,
  type MarketPostFields,
} from "@/app/api/market";
import { sessionStorage } from "@/app/api/session-storage";
import { toggleSocialCamp } from "@/app/api/social";
import { PostImage } from "@/components/media/PostImage";
import { UserHeaderPortal } from "@/components/navigation/header-portal";
import { PostContentLink } from "@/components/posts/PostContentLink";
import { useConfirmModal } from "@/context/ConfirmModalContext";
import { useCalling } from "@/features/calling/use-calling";
import { startMarketChatConversation } from "@/features/chat/api";

const EMPTY_FIELDS: MarketPostFields = {
  content: "",
  price: 0,
  currency: "GBP",
  quantity: 1,
  city: "",
  allowCalls: false,
  allowVideoCalls: false,
};

export default function MarketPage() {
  const router = useRouter();
  const { callUser } = useCalling();
  const { confirm } = useConfirmModal();
  const [view, setView] = useState<"home" | "mine">("home");
  const [posts, setPosts] = useState<MarketPost[]>([]);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingPost, setEditingPost] = useState<MarketPost>();
  const feedRef = useRef<HTMLElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const myId = sessionStorage.getActingPublicId() ?? undefined;

  const load = useCallback(async () => {
    try {
      const page = await listMarketPosts(
        undefined,
        view === "mine" ? myId : undefined,
      );
      setPosts(page.items);
      setNextCursor(page.nextCursor);
    } catch (error) {
      showError(error, "Could not load Market.");
    }
  }, [myId, view]);
  useEffect(() => {
    feedRef.current?.scrollTo(0, 0);
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listMarketPosts(
        nextCursor,
        view === "mine" ? myId : undefined,
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
      setLoadingMore(false);
    }
  }, [loadingMore, myId, nextCursor, view]);
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !nextCursor) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMore();
      },
      { root: feedRef.current, rootMargin: "800px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  async function publish() {
    if (!validFields(fields) || busy)
      return toast.error("Add description, price, quantity, and city.");
    setBusy(true);
    try {
      const clientPostId = crypto.randomUUID();
      const media = mediaFiles.length
        ? await Promise.all(
          mediaFiles.map((file) => uploadMarketMedia(clientPostId, file)),
        )
        : undefined;
      const post = await createMarketPost(clientPostId, fields, media);
      setPosts((current) => [post, ...current]);
      setFields(EMPTY_FIELDS);
      setMediaFiles([]);
      setIsComposerOpen(false);
      toast.success("Listing published");
    } catch (error) {
      showError(error, "Could not publish listing.");
    } finally {
      setBusy(false);
    }
  }

  async function openChat(post: MarketPost) {
    try {
      const conversation = await startMarketChatConversation(post.id);
      router.push(`/chat?conversationId=${conversation.id}`);
    } catch (error) {
      showError(error, "Could not open Market chat.");
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#e7e7e9] dark:bg-night-canvas text-[#171717] dark:text-night-text">
      <UserHeaderPortal>
        <h1 className="mr-auto flex items-center gap-2 text-sm font-black lg:text-base">
          <ShoppingBag
            size={19}
            aria-hidden="true"
            className="hidden sm:block"
          />
          Market
        </h1>
        <nav
          aria-label="Market navigation"
          className="hidden items-center gap-1 lg:flex"
        >
          <button
            type="button"
            aria-current={view === "home" ? "page" : undefined}
            onClick={() => setView("home")}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${view === "home" ? "bg-[#C62828] text-white" : "text-[#444b56] hover:bg-black/5 dark:text-night-text dark:hover:bg-white/10"}`}
          >
            Market
          </button>
          <button
            type="button"
            aria-current={view === "mine" ? "page" : undefined}
            onClick={() => setView("mine")}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${view === "mine" ? "bg-[#C62828] text-white" : "text-[#444b56] hover:bg-black/5 dark:text-night-text dark:hover:bg-white/10"}`}
          >
            My Listings
          </button>
          <Link
            href="/chat?kind=market"
            className="rounded-xl px-3 py-2 text-sm font-bold text-[#444b56] hover:bg-black/5 dark:text-night-text dark:hover:bg-white/10"
          >
            Market Chats
          </Link>
        </nav>
        <select
          aria-label="Market navigation"
          value={view}
          onChange={(event) =>
            event.target.value === "chats"
              ? router.push("/chat?kind=market")
              : setView(event.target.value as "home" | "mine")
          }
          className="w-[104px] rounded-lg border border-black/15 bg-white px-1 py-2 text-xs font-bold text-[#17191d] dark:border-white/20 dark:bg-night-surface dark:text-night-text sm:w-[140px] lg:hidden"
        >
          <option value="home">Market</option>
          <option value="mine">My Listings</option>
          <option value="chats">Market Chats</option>
        </select>
      </UserHeaderPortal>
      <main ref={feedRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-3 p-3">
          <button
            type="button"
            aria-label="Create a Market listing"
            onClick={() => setIsComposerOpen(true)}
            className="mb-1 flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 text-left shadow-sm dark:border-night-border dark:bg-night-surface"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#c62828] text-2xl font-light text-white">
              ＋
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-black text-[#17191d] dark:text-night-text">
                List item

              </span>
              <span className="mt-0.5 block text-xs text-black/50 dark:text-night-muted">
                Sell something to the community
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-xl font-bold text-[#c62828]"
            >
              ›
            </span>
          </button>
          {posts.length === 0 && (
            <div className="py-16 text-center font-bold text-black/40 dark:text-night-muted">
              No listings yet.
            </div>
          )}
          {posts.map((post) => (
            <article
              data-admin-part="trading.list"
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
                  onClick={() => router.push(`/users/${post.ownerPublicId}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate font-black hover:text-[#c62828]">
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
                      aria-label="Edit listing"
                      onClick={() => setEditingPost(post)}
                      className="rounded-full border border-black/20 dark:border-night-border px-3 py-2 text-xs font-black"
                    >
                      Edit
                    </button>
                    <button
                      aria-label="Delete listing"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: "Delete listing?",
                            message: "This cannot be undone.",
                            confirmLabel: "Delete",
                            isDangerous: true,
                          })
                        ) {
                          await deleteMarketPost(post.id);
                          setPosts((current) =>
                            current.filter((item) => item.id !== post.id),
                          );
                        }
                      }}
                      className="rounded-full border border-[#c62828] px-3 py-2 text-xs font-black text-[#c62828]"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <button
                    aria-label="Report listing"
                    className="shrink-0 text-xs font-black"
                    onClick={async () => {
                      try {
                        await reportMarketPost(post.id);
                        toast.success("Report sent");
                      } catch (error) {
                        showError(error, "Could not report listing.");
                      }
                    }}
                  >
                    Report
                  </button>
                )}
              </div>
              <PostContentLink
                content={post.content}
                href={`/posts/market/${post.id}`}
                className="px-4 pb-3 text-[15px] leading-6"
              />
              <div className="mx-4 mb-3 flex flex-wrap gap-2">
                <Badge>
                  <b>
                    {post.currency === "GBP"
                      ? `£${post.price.toLocaleString()}`
                      : `${post.price.toLocaleString()} ${post.currency}`}
                  </b>
                </Badge>
                <Badge>
                  <Package size={13} /> {post.quantity}
                </Badge>
                <Badge>
                  <MapPin size={13} /> {post.city}
                </Badge>
              </div>
              {post.media?.length ? (
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
                        className="max-h-[32rem] w-full bg-black object-contain"
                      />
                    ) : (
                      <PostImage
                        key={item.id}
                        src={item.url}
                        className="h-full max-h-[32rem] w-full object-cover"
                      />
                    ),
                  )}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center border-t border-black/10 dark:border-night-border p-2">
                <button
                  onClick={async () => {
                    const result = await toggleMarketLike(post.id);
                    setPosts((current) =>
                      current.map((item) =>
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
                  onClick={() => router.push(`/posts/market/${post.id}`)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-black"
                >
                  <MessageCircle size={18} />
                  {post.commentCount}
                </button>
                {!post.ownedByViewer && (
                  <button
                    aria-label={
                      post.campedByViewer
                        ? "Following seller. Unfollow"
                        : "Follow seller"
                    }
                    onClick={async () => {
                      try {
                        const result = await toggleSocialCamp(
                          post.ownerPublicId,
                        );
                        setPosts((current) =>
                          current.map((item) =>
                            item.ownerPublicId === post.ownerPublicId
                              ? { ...item, campedByViewer: result.camped }
                              : item,
                          ),
                        );
                      } catch (error) {
                        showError(error, "Could not update follow.");
                      }
                    }}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-3 font-black ${post.campedByViewer ? "text-[#c62828]" : ""}`}
                  >
                    {post.campedByViewer ? (
                      <>
                        <UserCheck size={34} />
                      </>
                    ) : (
                      "+ Follow"
                    )}
                  </button>
                )}
                {!post.ownedByViewer && post.allowCalls === true && (
                  <button
                    aria-label="Call seller"
                    onClick={() => void callUser(post.ownerPublicId, "audio")}
                    className="flex flex-1 justify-center py-3"
                  >
                    <Phone size={19} />
                  </button>
                )}
                {!post.ownedByViewer && post.allowVideoCalls === true && (
                  <button
                    aria-label="Video call seller"
                    onClick={() => void callUser(post.ownerPublicId, "video")}
                    className="flex flex-1 justify-center py-3"
                  >
                    <Video size={19} />
                  </button>
                )}
                {!post.ownedByViewer && (
                  <button
                    onClick={() => void openChat(post)}
                    className="rounded-full bg-black px-2 lg:px-2 py-2  text-white text-xs"
                  >
                    Market Chat
                  </button>
                )}
              </div>
            </article>
          ))}
          <div ref={loadMoreRef} className="h-1" />
          {loadingMore && (
            <div className="py-3 text-center text-xs font-bold">Loading…</div>
          )}
        </div>
      </main>
      {isComposerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New listing"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
        >
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-[28px] bg-[#f7f7f8] pt-5 dark:bg-night-surface sm:rounded-[28px]">
            <div className="flex items-center justify-between px-5 pb-4">
              <div>
                <h2 className="text-xl font-black">New listing</h2>
                <p className="mt-1 text-xs text-black/50 dark:text-night-muted">
                  Add the details buyers need
                </p>
              </div>
              <button
                type="button"
                aria-label="Close new listing"
                disabled={busy}
                onClick={() => setIsComposerOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl disabled:opacity-40 dark:bg-night-raised"
              >
                ×
              </button>
            </div>
            <div
              data-admin-part="trading.sell"
              className="overflow-y-auto px-5 pb-5"
            >
              <Composer
                fields={fields}
                mediaFiles={mediaFiles}
                busy={busy}
                onChange={setFields}
                onFiles={setMediaFiles}
                onPublish={() => void publish()}
              />
            </div>
          </div>
        </div>
      )}
      <EditModal
        post={editingPost}
        onClose={() => setEditingPost(undefined)}
        onSave={async (postId, next) => {
          const updated = await updateMarketPost(postId, next);
          setPosts((current) =>
            current.map((item) => (item.id === postId ? updated : item)),
          );
          setEditingPost(undefined);
        }}
      />
    </div>
  );
}

function Composer({
  fields,
  mediaFiles,
  busy,
  onChange,
  onFiles,
  onPublish,
}: {
  fields: MarketPostFields;
  mediaFiles: File[];
  busy: boolean;
  onChange: (fields: MarketPostFields) => void;
  onFiles: (files: File[]) => void;
  onPublish: () => void;
}) {
  return (
    <section className="space-y-2 rounded-2xl border border-black/10 dark:border-night-border bg-white dark:bg-night-surface p-4">
      <textarea
        value={fields.content}
        onChange={(event) =>
          onChange({ ...fields, content: event.target.value })
        }
        placeholder="What are you selling?"
        maxLength={4000}
        className="min-h-24 w-full resize-none rounded-xl border border-black/15 dark:border-night-border p-3 outline-none"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <NumberInput
          value={fields.price || ""}
          placeholder="Price £"
          onChange={(price) => onChange({ ...fields, price })}
        />
        <NumberInput
          value={fields.quantity}
          placeholder="Quantity"
          onChange={(quantity) =>
            onChange({ ...fields, quantity: Math.floor(quantity) })
          }
        />
        <input
          value={fields.city}
          onChange={(event) =>
            onChange({ ...fields, city: event.target.value })
          }
          placeholder="City"
          maxLength={100}
          className="col-span-2 min-w-0 rounded-xl border border-black/15 dark:border-night-border px-3 py-2 sm:col-span-1"
        />
      </div>
      {mediaFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {mediaFiles.map((file, index) => (
            <FilePreview
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() =>
                onFiles(
                  mediaFiles.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            />
          ))}
        </div>
      )}
      <CallOptions fields={fields} onChange={onChange} />
      <div className="flex justify-between">
        <label className="cursor-pointer rounded-xl border border-black/15 dark:border-night-border px-4 py-3 text-xs font-black">
          📎 {mediaFiles.length ? `${mediaFiles.length} selected` : "Media"}
          <input
            className="hidden"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              if (
                files.some((file) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) ||
                files.length > 2
              )
                return toast.error(
                  "Choose up to two images, max 5 MB each.",
                );
              onFiles(files);
            }}
          />
        </label>
        <button
          disabled={busy}
          onClick={onPublish}
          className="rounded-xl bg-black px-6 py-3 font-black text-white disabled:opacity-40"
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </section>
  );
}

function EditModal({
  post,
  onClose,
  onSave,
}: {
  post?: MarketPost;
  onClose: () => void;
  onSave: (postId: string, fields: MarketPostFields) => Promise<void>;
}) {
  const [fields, setFields] = useState(EMPTY_FIELDS);
  useEffect(() => {
    if (post)
      setFields({
        content: post.content,
        price: post.price,
        currency: post.currency,
        quantity: post.quantity,
        city: post.city,
        allowCalls: post.allowCalls === true,
        allowVideoCalls: post.allowVideoCalls === true,
      });
  }, [post]);
  if (!post) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-5">
      <div className="w-full max-w-lg space-y-3 rounded-[24px] bg-white dark:bg-night-surface p-5">
        <div className="flex justify-between">
          <h2 className="text-lg font-black">Edit listing</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <textarea
          value={fields.content}
          onChange={(event) =>
            setFields({ ...fields, content: event.target.value })
          }
          className="min-h-28 w-full rounded-xl border border-black/15 dark:border-night-border p-3"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <NumberInput
            value={fields.price}
            placeholder={
              fields.currency === "GBP" ? "Price £" : `Price ${fields.currency}`
            }
            onChange={(price) =>
              setFields({ ...fields, price, currency: "GBP" })
            }
          />
          <NumberInput
            value={fields.quantity}
            placeholder="Quantity"
            onChange={(quantity) =>
              setFields({ ...fields, quantity: Math.floor(quantity) })
            }
          />
          <input
            value={fields.city}
            onChange={(event) =>
              setFields({ ...fields, city: event.target.value })
            }
            className="col-span-2 min-w-0 rounded-xl border border-black/15 dark:border-night-border px-3 py-2 sm:col-span-1"
          />
        </div>
        {post.currency !== "GBP" && (
          <p className="text-xs text-black/60 dark:text-night-muted">
            This listing is {post.currency}. Enter a new price to switch to £.
          </p>
        )}
        <CallOptions fields={fields} onChange={setFields} />
        <button
          onClick={() => {
            if (validFields(fields)) void onSave(post.id, fields);
          }}
          className="w-full rounded-xl bg-black p-3 font-black text-white"
        >
          Save
        </button>
      </div>
    </div>
  );
}
function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/5 dark:bg-white/10">
      {file.type.startsWith("video/") ? (
        <video src={url} className="h-full w-full object-cover" />
      ) : (
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
      <button
        onClick={onRemove}
        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-xs text-white"
      >
        ×
      </button>
    </div>
  );
}
function NumberInput({
  value,
  placeholder,
  onChange,
}: {
  value: number | string;
  placeholder: string;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min="0"
      step="any"
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      placeholder={placeholder}
      className="min-w-0 rounded-xl border border-black/15 dark:border-night-border px-3 py-2"
    />
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-xs text-white">
      {children}
    </span>
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
  toast.error(error instanceof Error ? error.message : fallback);
}

function CallOptions({
  fields,
  onChange,
}: {
  fields: MarketPostFields;
  onChange: (fields: MarketPostFields) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={fields.allowCalls}
          onChange={(event) =>
            onChange({ ...fields, allowCalls: event.target.checked })
          }
        />{" "}
        Allow voice calls
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={fields.allowVideoCalls}
          onChange={(event) =>
            onChange({ ...fields, allowVideoCalls: event.target.checked })
          }
        />{" "}
        Allow video calls
      </label>
    </div>
  );
}
