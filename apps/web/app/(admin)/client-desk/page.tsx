"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
  deleteAdminMessage,
  deleteAdminPost,
  getAdminAnalytics,
  getAdminDesk,
  getAdminPostsPage,
  getAdminUsersPage,
  issueAccount,
  replyToSupport,
  sendAdminMessage,
  setAdminFlag,
  setAdminLabel,
  setAdminPostContent,
  setAdminPostVisible,
  setAdminUserName,
  setAdminUserStatus,
  type AdminAnalyticsV1,
  type AdminDeskV1,
  type AdminPostV1,
  type AdminUserV1,
} from "@/app/api/admin-desk";
import { logout } from "@/app/api/auth";

const pages = [
  ["site", "Whole website"],
  ["login", "Login / paste ID"],
  ["mypage", "My Page"],
  ["centre", "g000st centre"],
  ["network", "Network"],
  ["whisper", "Whisper"],
  ["trading", "g000st trading"],
  ["mobile", "g000st mobile"],
] as const;
const parts = [
  ["mypage.cover", "My Page · cover photo"],
  ["mypage.avatar", "My Page · avatar"],
  ["mypage.id", "My Page · ID box"],
  ["mypage.profile", "My Page · profile fields"],
  ["mypage.showname", "My Page · show my name"],
  ["centre.composer", "Centre · composer"],
  ["centre.feed", "Centre · feed"],
  ["centre.whisper", "Centre · whisper button"],
  ["network.search", "Network · FIND"],
  ["network.list", "Network · ghost list"],
  ["whisper.chat", "Whisper · chat"],
  ["whisper.call", "Whisper · call"],
  ["trading.list", "Trading · listings"],
  ["trading.sell", "Trading · sell form"],
  ["mobile.dial", "Mobile · keypad"],
  ["mobile.sms", "Mobile · SMS"],
  ["mobile.buy", "Mobile · buy plans"],
] as const;

const card =
  "rounded-[20px] border-2 border-black bg-white p-4 text-black shadow-[4px_4px_0_#000]";
const pill =
  "rounded-full border-2 border-black px-3 py-2 text-[11px] font-black";
const input =
  "w-full rounded-xl border-2 border-black bg-gray-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400";
const firstOrder = [
  "stats",
  "code",
  "pages",
  "parts",
  "inbox",
  "send",
  "users",
  "posts",
  "listings",
] as const;
type SectionKey = (typeof firstOrder)[number];

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Operation failed. Try again.";
}

function shortId(value: string) {
  return value.length > 18 ? `${value.slice(0, 6)}…${value.slice(-10)}` : value;
}

type CursorPage<T> = { items: readonly T[]; nextCursor?: string };
function useDeskPage<T>(
  fetchPage: (cursor?: string) => Promise<CursorPage<T>>,
  resetKey: string,
  revision: number,
) {
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const [items, setItems] = useState<readonly T[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setCursor(undefined);
    setHistory([]);
  }, [resetKey]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);
    setNextCursor(undefined);
    void fetchPage(cursor)
      .then((page) => {
        if (!cancelled) {
          setItems(page.items);
          setNextCursor(page.nextCursor);
          setError("");
        }
      })
      .catch((failure) => {
        if (!cancelled) setError(errorText(failure));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, cursor, revision]);
  return {
    items,
    loading,
    error,
    page: history.length + 1,
    hasPrevious: history.length > 0,
    hasNext: !!nextCursor,
    previous: () => {
      const previous = history.at(-1);
      setHistory((current) => current.slice(0, -1));
      setCursor(previous);
    },
    next: () => {
      if (nextCursor) {
        setHistory((current) => [...current, cursor]);
        setCursor(nextCursor);
      }
    },
  };
}

function PageControls({
  page,
  hasPrevious,
  hasNext,
  loading,
  previous,
  next,
}: {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  loading: boolean;
  previous: () => void;
  next: () => void;
}) {
  return (
    <nav
      aria-label="Table pages"
      className="mt-3 flex items-center justify-end gap-2 text-xs font-bold"
    >
      <button
        type="button"
        className={pill}
        disabled={!hasPrevious || loading}
        onClick={previous}
      >
        PREVIOUS
      </button>
      <span>Page {page}</span>
      <button
        type="button"
        className={pill}
        disabled={!hasNext || loading}
        onClick={next}
      >
        NEXT
      </button>
    </nav>
  );
}

export default function ClientDeskPage() {
  const [desk, setDesk] = useState<AdminDeskV1 | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<SectionKey[]>([...firstOrder]);
  const [dragged, setDragged] = useState<SectionKey | null>(null);
  const [codeNote, setCodeNote] = useState("");
  const [issued, setIssued] = useState<{
    publicId: string;
    recoveryId: string;
    noteSaved: boolean;
  } | null>(null);
  const [recipient, setRecipient] = useState("");
  const [messageText, setMessageText] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const actionBusyRef = useRef(false);

  const refresh = useCallback(async () => {
    const [nextDesk, nextAnalytics] = await Promise.allSettled([
      getAdminDesk(),
      getAdminAnalytics(),
    ]);
    if (nextDesk.status === "rejected") throw nextDesk.reason;
    setDesk(nextDesk.value);
    setAnalytics(
      nextAnalytics.status === "fulfilled" ? nextAnalytics.value : null,
    );
  }, []);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("g000st-admin-desk-order") ?? "null",
      );
      if (
        Array.isArray(saved) &&
        saved.length === firstOrder.length &&
        firstOrder.every((key) => saved.includes(key))
      )
        setOrder(saved as SectionKey[]);
    } catch {
      /* Keep the default order. */
    }
    void refresh()
      .catch((error) => toast.error(errorText(error)))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(userQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [userQuery]);
  const fetchUsers = useCallback(
    async (cursor?: string): Promise<CursorPage<AdminUserV1>> => {
      const page = await getAdminUsersPage(cursor, debouncedQuery, 20);
      return { items: page.users, nextCursor: page.nextCursor };
    },
    [debouncedQuery],
  );
  const fetchSocial = useCallback(
    (cursor?: string) => getAdminPostsPage("social", cursor),
    [],
  );
  const fetchMarket = useCallback(
    (cursor?: string) => getAdminPostsPage("market", cursor),
    [],
  );
  const usersPage = useDeskPage(fetchUsers, debouncedQuery, revision);
  const socialPage = useDeskPage(fetchSocial, "social", revision);
  const marketPage = useDeskPage(fetchMarket, "market", revision);

  async function run(action: () => Promise<unknown>, success: string) {
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    setActionBusy(true);
    try {
      await action();
      toast.success(success);
      try {
        await refresh();
        setRevision((current) => current + 1);
      } catch {
        toast.error("Saved, but the page could not refresh.");
      }
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      actionBusyRef.current = false;
      setActionBusy(false);
    }
  }

  async function toggle(
    kind: "pages" | "parts",
    key: string,
    enabled: boolean,
  ) {
    await run(() => setAdminFlag(kind, key, enabled), "Saved");
  }

  function moveOver(target: SectionKey) {
    if (!dragged || dragged === target) return;
    const next = [...order];
    next.splice(next.indexOf(dragged), 1);
    next.splice(next.indexOf(target), 0, dragged);
    setOrder(next);
    localStorage.setItem("g000st-admin-desk-order", JSON.stringify(next));
  }

  const sections: Record<SectionKey, React.ReactNode> = {
    stats: (
      <section className={card} aria-label="User overview">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-black">USER OVERVIEW</h2>
          <span className="font-mono text-[11px] text-gray-500">
            {analytics
              ? new Date(analytics.generatedAtMs).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })
              : "—"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["ONLINE NOW", analytics?.users.onlineNow],
            ["ACTIVE TODAY", analytics?.users.activeToday],
            ["ALL USERS", analytics?.users.total],
            ["BLOCKED", analytics?.users.suspended],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border-2 border-black p-3">
              <div className="font-mono text-[10px] text-gray-500">{label}</div>
              <div className="text-3xl font-black">{value ?? "—"}</div>
            </div>
          ))}
        </div>
        <Link
          href="/analytics"
          className="mt-3 inline-block text-xs font-black underline"
        >
          VIEW FULL ANALYTICS →
        </Link>
      </section>
    ),
    code: (
      <section className={card} aria-label="Create account">
        <h2 className="font-black">GENERATE CODE FROM FIREBASE</h2>
        <p className="mt-1 font-mono text-[10px] uppercase text-gray-500">
          Creates a real account and a secret Recovery ID for the user
        </p>
        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <input
            className={`${input} flex-1`}
            value={codeNote}
            onChange={(event) => setCodeNote(event.target.value)}
            placeholder="note for this user (optional)"
            maxLength={300}
          />
          <button
            disabled={actionBusy}
            className={`${pill} border-[#E53935] bg-[#E53935] text-white disabled:opacity-50`}
            onClick={() =>
              void run(async () => {
                setIssued(await issueAccount(codeNote));
                setCodeNote("");
              }, "Account created")
            }
          >
            GENERATE CODE
          </button>
        </div>
        {issued && (
          <div className="mt-3">
            <div className="font-mono text-[10px] uppercase text-gray-500">
              Secret Recovery ID · copy now
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-xl border-2 border-black bg-gray-50 px-3 py-2 text-xs">
                {issued.recoveryId}
              </code>
              <button
                className={`${pill} bg-black text-white`}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(issued.recoveryId)
                    .then(() => toast.success("Copied"))
                    .catch(() =>
                      toast.error("Could not copy. Select the code manually."),
                    )
                }
              >
                COPY
              </button>
            </div>
            <div className="mt-2 break-all font-mono text-[10px] text-gray-500">
              Public ID: {issued.publicId}
            </div>
            {!issued.noteSaved && (
              <p className="mt-2 text-xs font-bold text-red-600">
                Account created, but its note could not be saved.
              </p>
            )}
          </div>
        )}
        {!!desk?.issued.length && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer font-bold">
              Recently issued accounts
            </summary>
            <div className="mt-2 space-y-1">
              {desk.issued.map((account) => (
                <div
                  key={account.publicId}
                  className="break-all rounded-lg border p-2"
                >
                  <b>{shortId(account.publicId)}</b> ·{" "}
                  {account.note || "No note"}
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    ),
    pages: (
      <section className={card} aria-label="Pages">
        <h2 className="font-black">PAGES · ON / OFF / EDIT</h2>
        <p className="mt-1 font-mono text-[10px] uppercase text-gray-500">
          ON = available · OFF = hidden on web · EDIT = rename
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {pages.map(([key, label]) => (
            <SwitchRow
              key={key}
              label={desk?.config.labels[key] ?? label}
              code={key}
              enabled={desk?.config.pages[key] !== false}
              onChange={(enabled) => void toggle("pages", key, enabled)}
              onEdit={() => {
                const next = prompt(
                  "Edit label",
                  desk?.config.labels[key] ?? label,
                );
                if (next?.trim())
                  void run(
                    () => setAdminLabel("pages", key, next.trim()),
                    "Label saved",
                  );
              }}
            />
          ))}
        </div>
      </section>
    ),
    parts: (
      <section className={card} aria-label="Parts">
        <h2 className="font-black">PARTS · ON / OFF / EDIT</h2>
        <p className="mt-1 font-mono text-[10px] uppercase text-gray-500">
          ON = show piece · OFF = hide on web · EDIT = rename
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {parts.map(([key, label]) => (
            <SwitchRow
              key={key}
              label={desk?.config.labels[key] ?? label}
              code={key}
              enabled={desk?.config.parts[key] !== false}
              onChange={(enabled) => void toggle("parts", key, enabled)}
              onEdit={() => {
                const next = prompt(
                  "Edit label",
                  desk?.config.labels[key] ?? label,
                );
                if (next?.trim())
                  void run(
                    () => setAdminLabel("parts", key, next.trim()),
                    "Label saved",
                  );
              }}
            />
          ))}
        </div>
      </section>
    ),
    inbox: (
      <section className={card} aria-label="Inbox">
        <h2 className="font-black">INBOX · SUPPORT</h2>
        <p className="mt-1 font-mono text-[10px] uppercase text-gray-500">
          Messages from Contact us · reply privately to the same user
        </p>
        <div className="mt-3 space-y-2">
          {desk?.inbox.length ? (
            desk.inbox.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                onReply={(text) =>
                  run(() => replyToSupport(item.id, text), "Reply sent")
                }
              />
            ))
          ) : (
            <p className="text-sm text-gray-500">No contact messages yet.</p>
          )}
        </div>
      </section>
    ),
    send: (
      <section className={card} aria-label="Send to user">
        <h2 className="font-black">SEND TO USER</h2>
        <p className="mt-1 font-mono text-[10px] uppercase text-gray-500">
          Message or warning · one Public ID or all
        </p>
        <textarea
          className={`${input} mt-3`}
          rows={3}
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          placeholder="write message or warning"
          maxLength={2000}
        />
        <input
          className={`${input} mt-2`}
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          placeholder="Public ID (empty = all)"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            className={`${pill} bg-black text-white`}
            onClick={() =>
              void run(async () => {
                await sendAdminMessage(
                  recipient.trim() || "all",
                  messageText.trim(),
                  "msg",
                );
                setMessageText("");
              }, "Message sent")
            }
          >
            SEND MSG
          </button>
          <button
            className={`${pill} border-[#E53935] bg-[#E53935] text-white`}
            onClick={() =>
              void run(async () => {
                await sendAdminMessage(
                  recipient.trim() || "all",
                  messageText.trim(),
                  "warning",
                );
                setMessageText("");
              }, "Warning sent")
            }
          >
            SEND WARNING
          </button>
          <button
            className={pill}
            onClick={() =>
              void run(async () => {
                await sendAdminMessage("all", messageText.trim(), "msg");
                setMessageText("");
              }, "Message sent to all")
            }
          >
            MSG ALL
          </button>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {desk?.messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start justify-between rounded-xl border-2 border-black p-3 ${message.type === "warning" ? "bg-[#FFF3CD]" : ""}`}
            >
              <span className="break-words">
                <b>{message.type === "warning" ? "WARNING" : "MSG"}</b> ·{" "}
                {message.to === "all" ? "ALL" : shortId(message.to)} ·{" "}
                {message.text}
              </span>
              <button
                className="ml-2 font-black"
                aria-label="Delete message"
                onClick={() =>
                  void run(
                    () => deleteAdminMessage(message.id),
                    "Message deleted",
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>
    ),
    users: (
      <section className={`${card} overflow-auto`} aria-label="Users">
        <h2 className="font-black">USERS · BLOCK / EDIT / MSG / WARNING</h2>
        <input
          className={`${input} mt-3`}
          placeholder="search Public ID or name"
          value={userQuery}
          onChange={(event) => setUserQuery(event.target.value)}
        />
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-gray-500">
                <th className="p-2">ID</th>
                <th className="p-2">Name</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersPage.items.map((user) => (
                <tr
                  key={user.publicId}
                  className={`border-b ${user.status === "suspended" ? "bg-red-100" : ""}`}
                >
                  <td className="p-2 font-mono">{shortId(user.publicId)}</td>
                  <td className="p-2">{user.displayName || "ghost"}</td>
                  <td className="p-2">
                    {user.status === "suspended"
                      ? "BLOCKED"
                      : user.role === "admin"
                        ? "ADMIN"
                        : "ok"}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        className={pill}
                        disabled={user.role === "admin"}
                        onClick={() =>
                          void run(
                            () =>
                              setAdminUserStatus(
                                user.publicId,
                                user.status === "suspended"
                                  ? "active"
                                  : "suspended",
                              ),
                            "User status updated",
                          )
                        }
                      >
                        {user.status === "suspended" ? "UNBLOCK" : "BLOCK"}
                      </button>
                      <button
                        className={pill}
                        onClick={() => {
                          const name = prompt(
                            "Edit display name",
                            user.displayName,
                          );
                          if (name?.trim())
                            void run(
                              () =>
                                setAdminUserName(user.publicId, name.trim()),
                              "Name saved",
                            );
                        }}
                      >
                        EDIT
                      </button>
                      <button
                        className={pill}
                        onClick={() => {
                          setRecipient(user.publicId);
                          document
                            .querySelector('[aria-label="Send to user"]')
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        MSG
                      </button>
                      <button
                        className={pill}
                        onClick={() => {
                          setRecipient(user.publicId);
                          setMessageText("WARNING from g000st");
                          document
                            .querySelector('[aria-label="Send to user"]')
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        WARNING
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usersPage.loading ? (
            <p className="p-3 text-sm text-gray-500">Loading…</p>
          ) : (
            !usersPage.items.length && (
              <p className="p-3 text-sm text-gray-500">No users found.</p>
            )
          )}
        </div>
        {usersPage.error && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {usersPage.error}
          </p>
        )}
        <PageControls {...usersPage} />
      </section>
    ),
    posts: (
      <section className={`${card} overflow-auto`} aria-label="Social posts">
        <h2 className="font-black">POSTS · CENTRE</h2>
        <PostTable rows={socialPage.items} section="social" onAction={run} />
        {socialPage.loading && <p className="mt-2 text-xs">Loading…</p>}
        {socialPage.error && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {socialPage.error}
          </p>
        )}
        <PageControls {...socialPage} />
      </section>
    ),
    listings: (
      <section
        className={`${card} overflow-auto`}
        aria-label="Trading listings"
      >
        <h2 className="font-black">TRADING LISTINGS</h2>
        <PostTable rows={marketPage.items} section="market" onAction={run} />
        {marketPage.loading && <p className="mt-2 text-xs">Loading…</p>}
        {marketPage.error && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {marketPage.error}
          </p>
        )}
        <PageControls {...marketPage} />
      </section>
    ),
  };

  return (
    <div className="min-h-full bg-[#D8DCE3] px-4 py-6 text-black">
      <div className="mx-auto max-w-6xl space-y-4 pb-12">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              g<span className="text-red-600">000</span>st admin
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
              CLIENT DESK · PAGES · PARTS · CODES · INBOX · BLOCK
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/social"
              className={`${pill} flex items-center bg-white`}
            >
              OPEN SITE
            </Link>
            <button
              className={`${pill} bg-black text-white`}
              onClick={async () => {
                await logout();
                location.replace("/login");
              }}
            >
              LOCK
            </button>
          </div>
        </header>
        {loading && <div className={card}>Loading admin desk…</div>}
        {!loading && !desk && (
          <div className={card}>
            Could not load the admin desk.{" "}
            <button className="underline" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        )}
        {desk &&
          order.map((key) => (
            <div
              key={key}
              draggable
              onDragStart={() => setDragged(key)}
              onDragOver={(event) => {
                event.preventDefault();
                moveOver(key);
              }}
              onDragEnd={() => setDragged(null)}
              className={`cursor-grab ${dragged === key ? "opacity-50" : ""}`}
            >
              {sections[key]}
            </div>
          ))}
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  code,
  enabled,
  onChange,
  onEdit,
}: {
  label: string;
  code: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border-2 border-black px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-black">{label}</div>
        <div className="font-mono text-[10px] uppercase text-gray-500">
          {code}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          className={`${pill} ${enabled ? "bg-black text-white" : "bg-white"}`}
          aria-pressed={enabled}
          onClick={() => onChange(true)}
        >
          ON
        </button>
        <button
          className={`${pill} ${enabled ? "bg-white" : "bg-black text-white"}`}
          aria-pressed={!enabled}
          onClick={() => onChange(false)}
        >
          OFF
        </button>
        <button className={`${pill} bg-white`} onClick={onEdit}>
          EDIT
        </button>
      </div>
    </div>
  );
}

function InboxRow({
  item,
  onReply,
}: {
  item: AdminDeskV1["inbox"][number];
  onReply: (text: string) => void;
}) {
  const [reply, setReply] = useState("");
  return (
    <div className="rounded-2xl border-2 border-black p-3">
      <div className="font-mono text-[11px]">
        {shortId(item.from)} · {item.status}
      </div>
      <div className="mt-1 text-sm">{item.text}</div>
      <div className="mt-2 flex gap-2">
        <input
          className={`${input} flex-1`}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="reply private"
        />
        <button
          className={`${pill} bg-black text-white`}
          onClick={() => {
            if (reply.trim()) {
              onReply(reply.trim());
              setReply("");
            }
          }}
        >
          REPLY
        </button>
      </div>
    </div>
  );
}

function PostTable({
  rows,
  section,
  onAction,
}: {
  rows: readonly AdminPostV1[];
  section: "social" | "market";
  onAction: (action: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  return (
    <div className="mt-3 overflow-auto">
      <table className="w-full min-w-[540px] text-left text-xs">
        <thead>
          <tr className="border-b text-[10px] uppercase tracking-wider text-gray-500">
            <th className="p-2">Who</th>
            <th className="p-2">
              {section === "social" ? "Text" : "Listing · city"}
            </th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((row) => !row.deleted)
            .map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2 font-mono">{shortId(row.ownerPublicId)}</td>
                <td className="max-w-[400px] break-words p-2">
                  {row.content.slice(0, 160)}
                  {row.city ? ` · ${row.city}` : ""}
                </td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <button
                      className={pill}
                      onClick={() =>
                        void onAction(
                          () =>
                            setAdminPostVisible(section, row.id, row.hidden),
                          row.hidden ? "Shown" : "Hidden",
                        )
                      }
                    >
                      {row.hidden ? "SHOW" : "HIDE"}
                    </button>
                    {section === "social" && (
                      <button
                        className={pill}
                        onClick={() => {
                          const next = prompt("Edit post", row.content);
                          if (next?.trim())
                            void onAction(
                              () => setAdminPostContent(row.id, next.trim()),
                              "Post updated",
                            );
                        }}
                      >
                        EDIT
                      </button>
                    )}
                    <button
                      className={pill}
                      onClick={() => {
                        if (confirm("Delete this item?"))
                          void onAction(
                            () => deleteAdminPost(section, row.id),
                            "Deleted",
                          );
                      }}
                    >
                      DEL
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="p-3 text-sm text-gray-500">No items yet.</p>
      )}
    </div>
  );
}
