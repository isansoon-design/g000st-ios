"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { followByPublicId, listContacts, unfollowContact, updateContactNickname, type Contact } from "@/app/api/contacts";
import { sessionStorage } from "@/app/api/session-storage";
import { useConfirmModal } from "@/context/ConfirmModalContext";
import { UserHeaderPortal } from "@/components/navigation/header-portal";
import { startChatConversation } from "@/features/chat/api";
import { useCalling } from "@/features/calling/use-calling";

const PUBLIC_ID_LENGTH = 50;

type Tab = "all" | "online";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function ContactsPage() {
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const { callUser } = useCalling();
  const myId = sessionStorage.getActingPublicId();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [nickname, setNickname] = useState("");

  const load = useCallback(async (options?: { silent?: boolean }) => {
    try {
      setContacts(await listContacts());
    } catch (error) {
      if (!options?.silent) toast.error(errorMessage(error));
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Presence is heartbeat-based, not push-based, so the "online" dot only reflects
  // whatever the server returned at fetch time. Refetch periodically while the tab
  // is visible so it doesn't go stale for the whole time the screen stays open.
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 20_000;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(() => void load({ silent: true }), REFRESH_INTERVAL_MS);
    };
    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  const visibleContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (tab === "online" && !contact.online) return false;
      if (!normalizedQuery) return true;
      return (
        contact.displayName?.toLowerCase().includes(normalizedQuery) ||
        contact.nickname?.toLowerCase().includes(normalizedQuery) ||
        contact.publicId.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [contacts, query, tab]);

  const submitAdd = async () => {
    const publicId = addValue.replace(/\s+/g, "");
    if (publicId.length !== PUBLIC_ID_LENGTH || !/^[A-Za-z0-9]+$/.test(publicId)) {
      setAddError(`Public ID must be exactly ${PUBLIC_ID_LENGTH} letters or numbers.`);
      return;
    }
    if (publicId === myId) {
      setAddError("You cannot add yourself.");
      return;
    }
    if (contacts.some((contact) => contact.publicId === publicId)) {
      setAddError("This contact is already in your list.");
      return;
    }

    setIsAdding(true);
    try {
      await followByPublicId(publicId);
      setIsAddOpen(false);
      setAddValue("");
      await load();
      toast.success("Following.");
    } catch (error) {
      setAddError(errorMessage(error));
    } finally {
      setIsAdding(false);
    }
  };

  const onRemove = async (contact: Contact) => {
    const confirmed = await confirm({
      title: "Unfollow?",
      message: `Unfollow ${contact.displayName || "this friend"}? They will leave your Friends list.`,
      confirmLabel: "Unfollow",
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      await unfollowContact(contact.publicId);
      setContacts((current) => current.filter((item) => item.publicId !== contact.publicId));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const onOpenChat = async (publicId: string) => {
    try {
      const conversation = await startChatConversation(publicId);
      router.push(`/chat?conversationId=${conversation.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const btnSmStyle: React.CSSProperties = {
    height: 32,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--tone-bg-d8dce3)", overflow: "hidden" }}>
      <UserHeaderPortal>
        <h1 className="mr-auto text-sm font-black lg:text-base">Friends</h1>
        <button style={{ ...btnSmStyle, background: "linear-gradient(180deg,var(--tone-bg-b8b8b8),var(--app-control))", color: "var(--tone-fg-ffffff)", border: "1px solid var(--app-control)" }}
          onClick={() => { setAddValue(""); setAddError(null); setIsAddOpen(true); }}>+ Follow</button>
      </UserHeaderPortal>

      <div data-admin-part="network.search" style={{ padding: "10px 14px 0" }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or g000st..."
          style={{
            width: "100%", height: 40, borderRadius: 20, border: "1px solid var(--app-faint-border)",
            background: "var(--app-surface)", padding: "0 14px", fontSize: 13, outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {(["all", "online"] as const).map((option) => (
            <button
              key={option}
              onClick={() => { setTab(option); if (option === "online") void load({ silent: true }); }}
              style={{
                height: 28, padding: "0 12px", borderRadius: 14, fontSize: 11, fontWeight: 800,
                border: tab === option ? "1px solid var(--app-control)" : "1px solid var(--app-faint-border)",
                background: tab === option ? "var(--app-control)" : "var(--app-translucent-surface)",
                color: tab === option ? "var(--tone-fg-ffffff)" : "var(--app-subtle-text)",
                cursor: "pointer",
              }}
            >
              {option === "all" ? "All" : "Online"}
            </button>
          ))}
        </div>
      </div>

      <div data-admin-part="network.list" style={{ flex: 1, overflowY: "auto", padding: "10px 10px 20px" }}>
        {loading ? (
          <p style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--app-faint-text)", marginTop: 40 }}>
            Loading…
          </p>
        ) : visibleContacts.length === 0 ? (
          <p style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--app-faint-text)", marginTop: 40 }}>
            {tab === "online" ? "No friends online right now." : "No friends yet. Follow someone from Social or Market."}
          </p>
        ) : (
          visibleContacts.map((contact) => (
            <div
              key={contact.publicId}
              onClick={() => void onOpenChat(contact.publicId)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: 12, marginBottom: 8,
                borderRadius: 16, border: "1px solid var(--app-faint-border)", background: "var(--app-surface)", cursor: "pointer",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                background: "var(--tone-bg-dddddd)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {contact.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={contact.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ opacity: 0.4 }}>◎</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {contact.online ? (
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", flexShrink: 0 }} />
                  ) : null}
                  <span style={{ fontWeight: 900, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {contact.nickname || contact.displayName || contact.publicId.slice(0, 8)}
                  </span>
                </div>
                <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, color: "var(--app-faint-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {contact.publicId}
                </div>
              </div>
              <button aria-label="Edit friend name" onClick={(event) => { event.stopPropagation(); setEditingContact(contact); setNickname(contact.nickname ?? ""); }} style={{ width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer" }}>✎</button>
              <button
                aria-label="Call"
                onClick={(event) => { event.stopPropagation(); void callUser(contact.publicId, "audio"); }}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent", fontSize: 15, cursor: "pointer" }}
              >
                📞
              </button>
              <button
                aria-label="Video call"
                onClick={(event) => { event.stopPropagation(); void callUser(contact.publicId, "video"); }}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent", fontSize: 15, cursor: "pointer" }}
              >
                🎥
              </button>
              <button
                aria-label="Unfollow friend"
                onClick={(event) => { event.stopPropagation(); void onRemove(contact); }}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent", color: "var(--app-faint-text)", fontSize: 18, fontWeight: 900, cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {editingContact ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5"><div className="w-full max-w-[400px] space-y-3 rounded-2xl bg-white dark:bg-night-surface p-5"><h2 className="text-lg font-black">Friend's name</h2><input value={nickname} maxLength={80} onChange={(event) => setNickname(event.target.value)} placeholder="Name shown only to you" className="w-full rounded-xl border border-black/15 dark:border-night-border p-3" /><div className="flex gap-2"><button onClick={() => setEditingContact(null)} className="flex-1 rounded-xl bg-[#ddd] dark:bg-night-raised p-3 font-bold">Cancel</button><button onClick={async () => { try { const next = nickname.trim(); await updateContactNickname(editingContact.publicId, next); setContacts((current) => current.map((item) => item.publicId === editingContact.publicId ? { ...item, nickname: next || undefined } : item)); setEditingContact(null); } catch (error) { toast.error(errorMessage(error)); } }} className="flex-1 rounded-xl bg-black p-3 font-bold text-white">Save</button></div></div></div> : null}
      {isAddOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div style={{ width: "100%", maxWidth: 400, borderRadius: 22, border: "1px solid rgba(255,255,255,.7)", background: "var(--tone-bg-f2f2f2)", padding: 20 }}>
            <p style={{ textAlign: "center", fontSize: 18, fontWeight: 900 }}>Follow someone</p>
            <p style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--app-faint-text)", margin: "8px 0 16px" }}>
              Paste their Public ID to follow them. They will appear in your Friends list.
            </p>
            <input
              value={addValue}
              onChange={(event) => setAddValue(event.target.value)}
              placeholder="Public ID"
              style={{
                width: "100%", height: 48, borderRadius: 14, border: "2px solid var(--app-faint-border)",
                background: "var(--app-surface)", padding: "0 12px", fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 12, fontWeight: 800, outline: "none", boxSizing: "border-box",
              }}
            />
            {addError ? (
              <p style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "var(--tone-fg-c62828)" }}>{addError}</p>
            ) : null}
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button
                disabled={isAdding}
                onClick={() => setIsAddOpen(false)}
                style={{ flex: 1, height: 48, borderRadius: 14, border: "2px solid var(--app-text)", background: "transparent", fontWeight: 900, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                disabled={isAdding}
                onClick={() => void submitAdd()}
                style={{ flex: 1, height: 48, borderRadius: 14, border: "none", background: "#C62828", color: "var(--tone-fg-ffffff)", fontWeight: 900, cursor: "pointer" }}
              >
                {isAdding ? "Following…" : "Follow"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
