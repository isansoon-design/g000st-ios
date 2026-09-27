"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { deleteAccount, logout } from "@/app/api/auth";
import { sessionStorage } from "@/app/api/session-storage";
import {
  getSocialProfile,
  updateSocialProfile,
  uploadAvatarMedia,
  uploadCoverMedia,
  type SocialProfile,
} from "@/app/api/social";
import { useConfirmModal } from "@/context/ConfirmModalContext";
import { ThemeToggle, useTheme } from "@/context/ThemeContext";
import { BeaconSwitcher } from '@/features/profile/beacon-switcher';

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

const cardClass = "rounded-[18px] border border-white/60 dark:border-white/20 bg-[#D0D0D0] dark:bg-night-header p-4";
const labelClass = "mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/45 dark:text-night-muted";
const fieldClass =
  "h-11 w-full rounded-[12px] border border-black/10 dark:border-night-border bg-white dark:bg-night-surface px-3 text-[13px] font-bold text-[#111] dark:text-night-text outline-none focus:border-[#9A9A9A]";

export default function ProfilePage() {
  const { mode } = useTheme();
  const { confirm } = useConfirmModal();
  const accountPublicId = sessionStorage.get()?.user.publicId ?? '';
  const publicId = sessionStorage.getActingPublicId() ?? accountPublicId;
  const isPage = !!publicId && publicId !== accountPublicId;
  const recoveryId = sessionStorage.getRecoveryId(accountPublicId);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [fields, setFields] = useState<ProfileFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!publicId) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getSocialProfile(publicId);
        if (cancelled) return;
        setProfile(loaded);
        if (!isPage) sessionStorage.updateSavedProfile(loaded);
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
  }, [publicId, isPage]);

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
      if (!isPage) sessionStorage.updateSavedProfile(saved);
      toast.success("Profile photo updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onCoverChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || !file.size || file.size > 3 * 1024 * 1024) {
      toast.error("Choose a JPEG, PNG, WebP, or GIF image up to 3 MB.");
      return;
    }
    setUploadingCover(true);
    try {
      const coverMedia = await uploadCoverMedia(file);
      const updated = await updateSocialProfile({ coverMedia });
      const saved = await getSocialProfile(publicId);
      if (!saved.coverUrl || saved.updatedAtMs < updated.updatedAtMs) {
        throw new Error("Could not confirm your cover photo. Please try again.");
      }
      setProfile(saved);
      toast.success("Cover photo updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your cover photo.");
    } finally {
      setUploadingCover(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      if (isPage && !fields.displayName.trim()) throw new Error('A page must have a name.');
      const age = fields.age.trim() ? Number(fields.age.trim()) : undefined;
      const saved = await updateSocialProfile({
        ...(!isPage && age ? { age } : {}),
        bio: fields.bio.trim() || undefined,
        ...(!isPage && fields.country.trim() ? { country: fields.country.trim() } : {}),
        displayName: fields.displayName.trim() || undefined,
        showDisplayName: isPage ? true : fields.showDisplayName,
        ...(!isPage && fields.hobby.trim() ? { hobby: fields.hobby.trim() } : {}),
        ...(!isPage && fields.sex ? { sex: fields.sex } : {}),
      });
      setProfile(saved);
      if (!isPage) sessionStorage.updateSavedProfile(saved);
      setFields(toFields(saved));
      toast.success("Profile saved!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    const canRestore = !!sessionStorage.getRecoveryId(accountPublicId);
    const confirmed = await confirm({
      cancelLabel: "Cancel",
      confirmLabel: "Sign out",
      isDangerous: true,
      message: canRestore
        ? "This account will stay in your saved accounts so you can sign in again on this browser."
        : "Your Recovery ID is unavailable in this browser. Save it before signing out or you may lose access.",
      title: "Sign out from this device?",
    });
    if (!confirmed) return;

    try {
      logout();
      if (profile && !isPage) sessionStorage.updateSavedProfile(profile);
      window.location.replace("/login");
    } catch {
      toast.error("Could not sign out. Your account is still signed in.");
    }
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
      try {
        sessionStorage.removeSavedAccount(accountPublicId);
      } finally {
        logout(true);
        window.location.replace("/login");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete your account.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#D8DCE3] dark:bg-night-canvas">
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "linear-gradient(180deg,var(--tone-bg-fafafa) 0%,var(--app-canvas) 45%,var(--tone-bg-b0b0b0) 100%)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,.9),0 6px 16px rgba(0,0,0,.12)",
          borderBottom: "1px solid rgba(0,0,0,.12)",
        }}
      >
        <span style={{ fontWeight: 900, fontSize: 16 }}>ID &amp; Profile</span>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", color: "var(--app-faint-text)" }}>PROFILE</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="mx-auto mb-4 flex w-full max-w-5xl items-center justify-between rounded-[18px] border border-white/75 bg-white/50 px-4 py-2 dark:border-white/20 dark:bg-night-surface">
          <div>
            <p className="text-sm font-black">Appearance</p>
            <p className="text-xs font-semibold text-black/55 dark:text-night-muted">{mode === "dark" ? "Dark mode" : "Light mode"}</p>
          </div>
          <ThemeToggle />
        </div>
        <div className="mx-auto grid w-full max-w-5xl items-start gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <aside className="min-w-0 lg:sticky lg:top-0">
            <BeaconSwitcher />
          </aside>
          <div className="flex min-w-0 w-full flex-col items-center rounded-[24px] border border-white/75 dark:border-white/20 bg-white/35 dark:bg-night-surface p-3 shadow-[0_10px_30px_rgba(24,30,44,.08)] sm:p-5">
          {loading ? (
            <div className="py-20 text-sm font-bold text-black/40 dark:text-night-muted">Loading…</div>
          ) : (
            <>
              {isPage && <p className="mb-3 text-center text-xs font-bold text-black/55 dark:text-night-muted">You are interacting as this page. Its owner is not shown publicly.</p>}
              <button
                aria-label={profile?.coverUrl ? "Change cover photo" : "Add cover photo"}
                className="relative mb-4 h-44 w-full overflow-hidden rounded-[22px] bg-[#171d29] text-left transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828] disabled:opacity-60"
                disabled={uploadingCover || uploadingPhoto}
                onClick={() => coverInputRef.current?.click()}
                title="Choose an image up to 3 MB for your public profile banner"
                type="button"
              >
                {profile?.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <>
                    <span className="absolute -right-10 -top-20 h-56 w-56 rounded-full border-[28px] border-white/10 dark:border-white/20" />
                    <span className="absolute bottom-5 left-20 h-28 w-28 rounded-full border-[18px] border-[#C62828]/50" />
                  </>
                )}
                <span className="absolute inset-0 bg-black/35" />
                <span className="relative flex h-full flex-col justify-between p-4">
                  <span className="self-start rounded-full border border-white/35 dark:border-white/20 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">Profile cover</span>
                  <span className="flex items-end justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-black text-white">{profile?.coverUrl ? "Your cover photo" : "Make your profile yours"}</span>
                      <span className="mt-1 block text-[11px] font-semibold text-white/80">Wide images look best · up to 3 MB</span>
                    </span>
                    <span className="flex min-h-10 min-w-24 items-center justify-center rounded-full bg-white dark:bg-night-surface px-3 py-2 text-[11px] font-black text-[#17191d] dark:text-night-text">
                      {uploadingCover ? "Uploading…" : profile?.coverUrl ? "Change cover" : "Add cover"}
                    </span>
                  </span>
                </span>
              </button>
              <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploadingCover || uploadingPhoto} onChange={(event) => { void onCoverChange(event); }} />
              {/* Photo */}
              <button
                aria-label="Change profile photo"
                disabled={uploadingPhoto || uploadingCover}
                onClick={() => photoInputRef.current?.click()}
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#C8C8C8] dark:bg-night-raised shadow-md transition hover:opacity-80 disabled:opacity-60"
              >
                {uploadingPhoto ? (
                  <span className="text-xs font-bold text-black/40 dark:text-night-muted">…</span>
                ) : profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl opacity-40">◎</span>
                )}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" disabled={uploadingPhoto || uploadingCover} onChange={onPhotoChange} />
              <button disabled={uploadingPhoto || uploadingCover} onClick={() => photoInputRef.current?.click()} className="mb-4 mt-2 text-xs font-black text-[#C62828] disabled:opacity-60">
                {profile?.avatarUrl ? "Change photo" : "Add photo"}
              </button>
              <Link href={`/users/${publicId}`} className="mb-4 rounded-full bg-[#17191d] px-5 py-2.5 text-xs font-black text-white transition hover:bg-[#c62828]">View public profile</Link>

              {/* Name visibility */}
              <div className="mb-4 w-full rounded-[18px] border border-white/60 dark:border-white/20 bg-[#D0D0D0] dark:bg-night-header p-3">
                <div className="flex items-center gap-3">
                  <input
                    className="h-12 min-w-0 flex-1 rounded-[12px] border border-black/10 dark:border-night-border bg-white dark:bg-night-surface px-3 text-[15px] font-black text-[#111] dark:text-night-text outline-none placeholder:text-black/35 focus:border-[#9A9A9A]"
                    maxLength={60}
                    onChange={(event) => setField("displayName", event.target.value)}
                    placeholder="Add your name"
                    value={fields.displayName}
                  />
                  <div className="flex shrink-0 flex-col items-center">
                    <span className="mb-1 text-[10px] font-black text-black/55 dark:text-night-muted">Show name</span>
                    <button
                      aria-checked={isPage || fields.showDisplayName}
                      aria-label="Show my name"
                      className={`relative h-7 w-12 rounded-full transition-colors ${isPage || fields.showDisplayName ? "bg-[#C62828]" : "bg-[#9A9A9A] dark:bg-night-control"}`}
                      disabled={isPage}
                      onClick={() => setField("showDisplayName", !fields.showDisplayName)}
                      role="switch"
                      type="button"
                    >
                      <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white dark:bg-night-surface shadow transition-transform ${isPage || fields.showDisplayName ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-[16px] text-black/45 dark:text-night-muted">
                  {isPage ? 'Page posts and comments always show the page name.' : `Show your name to other users, or turn this off to use your 8-character alias (${publicId.slice(0, 8)}).`}
                </p>
              </div>

              {/* Public ID */}
              <div className={`mb-3 w-full ${cardClass}`}>
                <div className={labelClass}>Your Public ID</div>
                <div className="mb-3 break-all font-mono text-[13px] font-black leading-[19px] text-[#C62828]">
                  {publicId}
                </div>
                <div className="flex h-11 w-full overflow-hidden rounded-[12px] border border-[#111] dark:border-night-border bg-white dark:bg-night-surface">
                  <button onClick={copyId} className="flex-1 border-r border-[#111] dark:border-night-border text-[13px] font-black text-[#111] dark:text-night-text hover:bg-black/5">
                    Copy
                  </button>
                  <button onClick={shareId} className="flex-1 text-[13px] font-black text-[#111] dark:text-night-text hover:bg-black/5">
                    Share
                  </button>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-[16px] text-black/45 dark:text-night-muted">
                  Safe to share. People use it to find and message you.
                </p>
              </div>



              {/* Optional profile */}
              <div className={`mb-3 w-full ${cardClass}`}>
                <div className={labelClass}>{isPage ? 'Page description' : 'Optional profile'}</div>

                {!isPage && <>

                <div className="mb-1 mt-2 text-[11px] font-bold text-black/45 dark:text-night-muted">Country</div>
                <input
                  className={`mb-3 ${fieldClass}`}
                  onChange={(event) => setField("country", event.target.value)}
                  placeholder="Country"
                  value={fields.country}
                />

                <div className="mb-1 text-[11px] font-bold text-black/45 dark:text-night-muted">Age</div>
                <input
                  className={`mb-3 ${fieldClass}`}
                  inputMode="numeric"
                  maxLength={3}
                  onChange={(event) => setField("age", event.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Age"
                  value={fields.age}
                />

                <div className="mb-1 text-[11px] font-bold text-black/45 dark:text-night-muted">Sex</div>
                <div className="mb-3 flex gap-2">
                  {(["male", "female"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setField("sex", fields.sex === option ? "" : option)}
                      className={`h-11 flex-1 rounded-[12px] border text-[13px] font-black ${fields.sex === option ? "border-[#111] dark:border-night-border bg-[#111] text-white" : "border-black/15 dark:border-night-border bg-white dark:bg-night-surface text-[#111] dark:text-night-text"
                        }`}
                    >
                      {option === "male" ? "Male" : "Female"}
                    </button>
                  ))}
                </div>

                <div className="mb-1 text-[11px] font-bold text-black/45 dark:text-night-muted">Hobby</div>
                <input
                  className={`mb-3 ${fieldClass}`}
                  onChange={(event) => setField("hobby", event.target.value)}
                  placeholder="e.g. hiking, football…"
                  value={fields.hobby}
                />

                </>}
                <div className="mb-1 text-[11px] font-bold text-black/45 dark:text-night-muted">{isPage ? 'Short description' : 'Bio'}</div>
                <textarea
                  className="h-24 w-full resize-none rounded-[12px] border border-black/10 dark:border-night-border bg-white dark:bg-night-surface p-3 text-[13px] font-bold text-[#111] dark:text-night-text outline-none focus:border-[#9A9A9A]"
                  onChange={(event) => setField("bio", event.target.value)}
                  placeholder="A short bio (optional)"
                  value={fields.bio}
                />

                {!isPage && <p className="mt-2 text-[11px] font-semibold text-black/40 dark:text-night-muted">
                  Nothing here is required. Fill in only what you want.
                </p>}
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
              {!isPage && <div className="mb-3 w-full overflow-hidden rounded-[22px] border border-[#C62828]/35 bg-[#191919] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#FFB9B9]">Private key</div>
                    <h2 className="mt-1 text-[19px] font-black text-white">My ID</h2>
                  </div>
                  <span className="rounded-full border border-[#FFB9B9]/40 bg-[#C62828]/20 dark:bg-night-softred px-3 py-1 text-[10px] font-black uppercase text-[#FFB9B9]">
                    Recovery ID
                  </span>
                </div>
                {recoveryId ? (
                  <>
                    <div className="break-all rounded-[14px] border border-white/15 dark:border-white/20 bg-white/10 p-3 font-mono text-[13px] font-bold leading-[21px] text-white" dir="ltr">
                      {recoveryId}
                    </div>
                    <button
                      aria-label="Copy private Recovery ID"
                      className="mt-3 h-11 w-full rounded-[12px] bg-white dark:bg-night-surface text-[13px] font-black text-[#191919] dark:text-night-text transition hover:bg-[#FFE9E9]"
                      onClick={copyRecoveryId}
                      type="button"
                    >
                      Copy my ID
                    </button>
                  </>
                ) : (
                  <p className="rounded-[14px] border border-white/15 dark:border-white/20 bg-white/10 p-3 text-[13px] font-bold leading-[19px] text-white/75">
                    Your Recovery ID is not saved on this device yet. It will appear here after your next sign in.
                  </p>
                )}
                <p className="mt-3 rounded-[12px] border border-[#FFB9B9]/25 bg-[#C62828]/15 dark:bg-night-softred p-3 text-[12px] font-bold leading-[18px] text-[#FFE0E0]">
                  Keep this key secret. Never share it with anyone. You need it to sign in again.
                </p>
              </div>}

              {/* Sign out */}
              {!isPage && <button
                onClick={() => void signOut()}
                className="mb-6 h-11 w-full rounded-full border border-black/15 dark:border-night-border bg-white dark:bg-night-surface text-sm font-bold text-[#C62828] transition hover:bg-black/5"
              >
                Sign out from this device
              </button>}

              {/* Account deletion */}
              {!isPage && <button
                disabled={deleting}
                onClick={() => void removeAccount()}
                className="mb-10 h-11 w-full rounded-full border border-[#C62828] bg-transparent text-sm font-black text-[#C62828] transition hover:bg-[#C62828]/5 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </button>}
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
