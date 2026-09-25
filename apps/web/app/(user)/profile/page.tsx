"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { deleteAccount, logout } from "@/app/api/auth";
import { sessionStorage } from "@/app/api/session-storage";
import {
  getSocialProfile,
  updateSocialProfile,
  uploadAvatarMedia,
  type SocialProfile,
} from "@/app/api/social";
import { useConfirmModal } from "@/context/ConfirmModalContext";
import { useRouter } from "next/navigation";

type ProfileFields = {
  displayName: string;
  showDisplayName: boolean;
  country: string;
  age: string;
  sex: "male" | "female" | "";
  hobby: string;
  bio: string;
};

const EMPTY_FIELDS: ProfileFields = { age: "", bio: "", country: "", displayName: "", hobby: "", sex: "", showDisplayName: false };

function toFields(profile: SocialProfile | null): ProfileFields {
  if (!profile) return EMPTY_FIELDS;
  return {
    age: profile.age ? String(profile.age) : "",
    bio: profile.bio ?? "",
    country: profile.country ?? "",
    displayName: profile.displayName ?? "",
    showDisplayName: profile.showDisplayName ?? false,
    hobby: profile.hobby ?? "",
    sex: profile.sex ?? "",
  };
}

const cardClass = "rounded-[18px] border border-white/60 bg-[#D0D0D0] p-4";
const labelClass = "mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/45";
const fieldClass =
  "h-11 w-full rounded-[12px] border border-black/10 bg-white px-3 text-[13px] font-bold text-[#111] outline-none focus:border-[#9A9A9A]";

export default function ProfilePage() {
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const publicId = sessionStorage.get()?.user.publicId ?? "";
  const recoveryId = sessionStorage.getRecoveryId(publicId);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [fields, setFields] = useState<ProfileFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!publicId) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getSocialProfile(publicId);
        if (cancelled) return;
        setProfile(loaded);
        setFields(toFields(loaded));
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicId]);

  const setField = useCallback(<K extends keyof ProfileFields>(key: K, value: ProfileFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
  }, []);

  const copyId = () => {
    navigator.clipboard
      ?.writeText(publicId)
      .then(() => toast.success("Public ID copied."))
      .catch(() => toast.error("Could not copy ID."));
  };

  const copyRecoveryId = () => {
    if (!recoveryId) return;
    if (!navigator.clipboard) return toast.error("Clipboard is unavailable.");
    navigator.clipboard.writeText(recoveryId)
      .then(() => toast.success("Recovery ID copied. Keep it private."))
      .catch(() => toast.error("Could not copy your Recovery ID."));
  };

  const shareId = () => {
    if (navigator.share) navigator.share({ title: "My g000st Public ID", text: publicId }).catch(() => { });
    else copyId();
  };

  const onPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file.");
    if (file.size > 3 * 1024 * 1024) return toast.error("Photo must be 3 MB or smaller.");
    setUploadingPhoto(true);
    try {
      const media = await uploadAvatarMedia(file);
      const saved = await updateSocialProfile({ avatarMedia: media });
      setProfile(saved);
      toast.success("Profile photo updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const age = fields.age.trim() ? Number(fields.age.trim()) : undefined;
      const saved = await updateSocialProfile({
        age,
        bio: fields.bio.trim() || undefined,
        country: fields.country.trim() || undefined,
        displayName: fields.displayName.trim() || undefined,
        showDisplayName: fields.showDisplayName,
        hobby: fields.hobby.trim() || undefined,
        sex: fields.sex || undefined,
      });
      setProfile(saved);
      setFields(toFields(saved));
      toast.success("Profile saved!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    const confirmed = await confirm({
      cancelLabel: "Cancel",
      confirmLabel: "Sign out",
      isDangerous: true,
      message: "You will need your Recovery ID to sign back in on this device.",
      title: "Sign out from this device?",
    });
    if (!confirmed) return;
    logout();
    router.push("/login");
  };

  const removeAccount = async () => {
    const confirmed = await confirm({
      cancelLabel: "Cancel",
      confirmLabel: "Delete account",
      isDangerous: true,
      message:
        "This permanently deletes your account and Recovery ID. Your existing posts and messages may remain, but your name and profile photo will be replaced with Deleted account. This cannot be undone.",
      title: "Delete your account?",
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteAccount();
      logout();
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete your account.");
      setDeleting(false);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#D8DCE3", overflow: "hidden" }}>
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "linear-gradient(180deg,#fafafa 0%,#d8d8d8 45%,#b0b0b0 100%)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,.9),0 6px 16px rgba(0,0,0,.12)",
          borderBottom: "1px solid rgba(0,0,0,.12)",
        }}
      >
        <span style={{ fontWeight: 900, fontSize: 16 }}>ID &amp; Profile</span>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", color: "rgba(0,0,0,.35)" }}>OPTIONAL</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="mx-auto flex max-w-md flex-col items-center">
          {loading ? (
            <div className="py-20 text-sm font-bold text-black/40">Loading…</div>
          ) : (
            <>
              {/* Photo */}
              <button
                aria-label="Change profile photo"
                onClick={() => photoInputRef.current?.click()}
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#C8C8C8] shadow-md transition hover:opacity-80"
              >
                {uploadingPhoto ? (
                  <span className="text-xs font-bold text-black/40">…</span>
                ) : profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl opacity-40">◎</span>
                )}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
              <button onClick={() => photoInputRef.current?.click()} className="mb-4 mt-2 text-xs font-black text-[#C62828]">
                {profile?.avatarUrl ? "Change photo" : "Add photo"}
              </button>

              {/* Name visibility */}
              <div className="mb-4 w-full rounded-[18px] border border-white/60 bg-[#D0D0D0] p-3">
                <div className="flex items-center gap-3">
                  <input
                    className="h-12 min-w-0 flex-1 rounded-[12px] border border-black/10 bg-white px-3 text-[15px] font-black text-[#111] outline-none placeholder:text-black/35 focus:border-[#9A9A9A]"
                    maxLength={60}
                    onChange={(event) => setField("displayName", event.target.value)}
                    placeholder="Add your name"
                    value={fields.displayName}
                  />
                  <div className="flex shrink-0 flex-col items-center">
                    <span className="mb-1 text-[10px] font-black text-black/55">Show name</span>
                    <button
                      aria-checked={fields.showDisplayName}
                      aria-label="Show my name"
                      className={`relative h-7 w-12 rounded-full transition-colors ${fields.showDisplayName ? "bg-[#C62828]" : "bg-[#9A9A9A]"}`}
                      onClick={() => setField("showDisplayName", !fields.showDisplayName)}
                      role="switch"
                      type="button"
                    >
                      <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${fields.showDisplayName ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-[16px] text-black/45">
                  Show your name to other users, or turn this off to use your 8-character alias ({publicId.slice(-8)}).
                </p>
              </div>

              {/* Public ID */}
              <div className={`mb-3 w-full ${cardClass}`}>
                <div className={labelClass}>Your Public ID</div>
                <div className="mb-3 break-all font-mono text-[13px] font-black leading-[19px] text-[#C62828]">
                  {publicId}
                </div>
                <div className="flex h-11 w-full overflow-hidden rounded-[12px] border border-[#111] bg-white">
                  <button onClick={copyId} className="flex-1 border-r border-[#111] text-[13px] font-black text-[#111] hover:bg-black/5">
                    Copy
                  </button>
                  <button onClick={shareId} className="flex-1 text-[13px] font-black text-[#111] hover:bg-black/5">
                    Share
                  </button>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-[16px] text-black/45">
                  Safe to share. People use it to find and message you.
                </p>
              </div>



              {/* Optional profile */}
              <div className={`mb-3 w-full ${cardClass}`}>
                <div className={labelClass}>Optional profile</div>

                <div className="mb-1 mt-2 text-[11px] font-bold text-black/45">Country</div>
                <input
                  className={`mb-3 ${fieldClass}`}
                  onChange={(event) => setField("country", event.target.value)}
                  placeholder="Country"
                  value={fields.country}
                />

                <div className="mb-1 text-[11px] font-bold text-black/45">Age</div>
                <input
                  className={`mb-3 ${fieldClass}`}
                  inputMode="numeric"
                  maxLength={3}
                  onChange={(event) => setField("age", event.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Age"
                  value={fields.age}
                />

                <div className="mb-1 text-[11px] font-bold text-black/45">Sex</div>
                <div className="mb-3 flex gap-2">
                  {(["male", "female"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setField("sex", fields.sex === option ? "" : option)}
                      className={`h-11 flex-1 rounded-[12px] border text-[13px] font-black ${fields.sex === option ? "border-[#111] bg-[#111] text-white" : "border-black/15 bg-white text-[#111]"
                        }`}
                    >
                      {option === "male" ? "Male" : "Female"}
                    </button>
                  ))}
                </div>

                <div className="mb-1 text-[11px] font-bold text-black/45">Hobby</div>
                <input
                  className={`mb-3 ${fieldClass}`}
                  onChange={(event) => setField("hobby", event.target.value)}
                  placeholder="e.g. hiking, football…"
                  value={fields.hobby}
                />

                <div className="mb-1 text-[11px] font-bold text-black/45">Bio</div>
                <textarea
                  className="h-24 w-full resize-none rounded-[12px] border border-black/10 bg-white p-3 text-[13px] font-bold text-[#111] outline-none focus:border-[#9A9A9A]"
                  onChange={(event) => setField("bio", event.target.value)}
                  placeholder="A short bio (optional)"
                  value={fields.bio}
                />

                <p className="mt-2 text-[11px] font-semibold text-black/40">
                  Nothing here is required. Fill in only what you want.
                </p>
              </div>

              {/* Save */}
              <button
                disabled={saving}
                onClick={() => void saveProfile()}
                className="mb-3 h-12 w-full rounded-[14px] bg-[#C62828] text-sm font-black text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save profile"}
              </button>

              {/* Recovery ID */}
              <div className="mb-3 w-full overflow-hidden rounded-[22px] border border-[#C62828]/35 bg-[#191919] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#FFB9B9]">Private key</div>
                    <h2 className="mt-1 text-[19px] font-black text-white">My ID</h2>
                  </div>
                  <span className="rounded-full border border-[#FFB9B9]/40 bg-[#C62828]/20 px-3 py-1 text-[10px] font-black uppercase text-[#FFB9B9]">
                    Recovery ID
                  </span>
                </div>
                {recoveryId ? (
                  <>
                    <div className="break-all rounded-[14px] border border-white/15 bg-white/10 p-3 font-mono text-[13px] font-bold leading-[21px] text-white" dir="ltr">
                      {recoveryId}
                    </div>
                    <button
                      aria-label="Copy private Recovery ID"
                      className="mt-3 h-11 w-full rounded-[12px] bg-white text-[13px] font-black text-[#191919] transition hover:bg-[#FFE9E9]"
                      onClick={copyRecoveryId}
                      type="button"
                    >
                      Copy my ID
                    </button>
                  </>
                ) : (
                  <p className="rounded-[14px] border border-white/15 bg-white/10 p-3 text-[13px] font-bold leading-[19px] text-white/75">
                    Your Recovery ID is not saved on this device yet. It will appear here after your next sign in.
                  </p>
                )}
                <p className="mt-3 rounded-[12px] border border-[#FFB9B9]/25 bg-[#C62828]/15 p-3 text-[12px] font-bold leading-[18px] text-[#FFE0E0]">
                  Keep this key secret. Never share it with anyone. You need it to sign in again.
                </p>
              </div>

              {/* Sign out */}
              <button
                onClick={() => void signOut()}
                className="mb-6 h-11 w-full rounded-full border border-black/15 bg-white text-sm font-bold text-[#C62828] transition hover:bg-black/5"
              >
                Sign out from this device
              </button>

              {/* Account deletion */}
              <button
                disabled={deleting}
                onClick={() => void removeAccount()}
                className="mb-10 h-11 w-full rounded-full border border-[#C62828] bg-transparent text-sm font-black text-[#C62828] transition hover:bg-[#C62828]/5 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
