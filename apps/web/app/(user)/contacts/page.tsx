"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { addContact, listContacts, removeContact, type Contact } from "@/app/api/contacts";
import { sessionStorage } from "@/app/api/session-storage";
import { useConfirmModal } from "@/context/ConfirmModalContext";
import { startChatConversation } from "@/features/chat/api";

const PUBLIC_ID_LENGTH = 50;

type Tab = "all" | "online";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function ContactsPage() {
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const myId = sessionStorage.get()?.user.publicId;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setContacts(await listContacts());
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (tab === "online" && !contact.online) return false;
      if (!normalizedQuery) return true;
      return (
        contact.displayName?.toLowerCase().includes(normalizedQuery) ||
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
      await addContact(publicId);
      setIsAddOpen(false);
      setAddValue("");
      await load();
      toast.success("Contact added.");
    } catch (error) {
      setAddError(errorMessage(error));
    } finally {
      setIsAdding(false);
    }
  };

  const onRemove = async (contact: Contact) => {
    const confirmed = await confirm({
      title: "Remove contact?",
      message: `Remove ${contact.displayName || "this contact"} from your contacts?`,
      confirmLabel: "Remove",
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      await removeContact(contact.publicId);
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
    border: "1px solid #C0C0C0",
    background: "#fff",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#D8DCE3", overflow: "hidden" }}>
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        background: "linear-gradient(180deg,#fafafa 0%,#d8d8d8 45%,#b0b0b0 100%)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,.9),0 6px 16px rgba(0,0,0,.12)",
        borderBottom: "1px solid rgba(0,0,0,.12)",
      }}>
        <span style={{ fontWeight: 900, fontSize: 16 }}>Contacts</span>
        <button style={{ ...btnSmStyle, background: "linear-gradient(180deg,#B8B8B8,#9A9A9A)", color: "#fff", border: "1px solid #9A9A9A" }}
          onClick={() => { setAddValue(""); setAddError(null); setIsAddOpen(true); }}>+ Add</button>
      </div>

      <div style={{ padding: "10px 14px 0" }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or g000st..."
          style={{
            width: "100%", height: 40, borderRadius: 20, border: "1px solid rgba(0,0,0,.15)",
            background: "#fff", padding: "0 14px", fontSize: 13, outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {(["all", "online"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setTab(option)}
              style={{
                height: 28, padding: "0 12px", borderRadius: 14, fontSize: 11, fontWeight: 800,
                border: tab === option ? "1px solid #9A9A9A" : "1px solid rgba(0,0,0,.1)",
                background: tab === option ? "#9A9A9A" : "rgba(255,255,255,.8)",
                color: tab === option ? "#fff" : "rgba(0,0,0,.6)",
                cursor: "pointer",
              }}
            >
              {option === "all" ? "All" : "Online"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 20px" }}>
        {loading ? (
          <p style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,.45)", marginTop: 40 }}>
            Loading…
          </p>
        ) : visibleContacts.length === 0 ? (
          <p style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,.45)", marginTop: 40 }}>
            {tab === "online" ? "No contacts online right now." : "No contacts yet. Add someone by their Public ID."}
          </p>
        ) : (
          visibleContacts.map((contact) => (
            <div
              key={contact.publicId}
              onClick={() => void onOpenChat(contact.publicId)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: 12, marginBottom: 8,
                borderRadius: 16, border: "1px solid rgba(0,0,0,.08)", background: "#fff", cursor: "pointer",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                background: "#DDD", display: "flex", alignItems: "center", justifyContent: "center",
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
                    {contact.displayName || contact.publicId.slice(0, 12)}
                  </span>
                </div>
                <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, color: "rgba(0,0,0,.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {contact.publicId}
                </div>
              </div>
              <button
                aria-label="Remove contact"
                onClick={(event) => { event.stopPropagation(); void onRemove(contact); }}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent", color: "rgba(0,0,0,.3)", fontSize: 18, fontWeight: 900, cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {isAddOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div style={{ width: "100%", maxWidth: 400, borderRadius: 22, border: "1px solid rgba(255,255,255,.7)", background: "#F2F2F2", padding: 20 }}>
            <p style={{ textAlign: "center", fontSize: 18, fontWeight: 900 }}>Add contact</p>
            <p style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,.5)", margin: "8px 0 16px" }}>
              Paste their Public ID to add them to your contacts.
            </p>
            <input
              value={addValue}
              onChange={(event) => setAddValue(event.target.value)}
              placeholder="Public ID"
              style={{
                width: "100%", height: 48, borderRadius: 14, border: "2px solid rgba(0,0,0,.1)",
                background: "#fff", padding: "0 12px", fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 12, fontWeight: 800, outline: "none", boxSizing: "border-box",
              }}
            />
            {addError ? (
              <p style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "#C62828" }}>{addError}</p>
            ) : null}
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button
                disabled={isAdding}
                onClick={() => setIsAddOpen(false)}
                style={{ flex: 1, height: 48, borderRadius: 14, border: "2px solid #111", background: "transparent", fontWeight: 900, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                disabled={isAdding}
                onClick={() => void submitAdd()}
                style={{ flex: 1, height: 48, borderRadius: 14, border: "none", background: "#C62828", color: "#fff", fontWeight: 900, cursor: "pointer" }}
              >
                {isAdding ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
