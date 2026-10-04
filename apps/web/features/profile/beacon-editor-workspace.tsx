"use client";

import { PageAddress } from "@/features/profile/page-address";

import { LinkifiedText } from "@/components/text/LinkifiedText";

import {
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Monitor,
  PanelLeftOpen,
  Save,
  Smartphone,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { createBeaconPage } from "@/app/api/auth";
import {
  getSocialProfile,
  listSocialPosts,
  updateSocialProfile,
  uploadAvatarMedia,
  uploadCoverMedia,
  type SocialPost,
  type SocialProfile,
} from "@/app/api/social";

type Field =
  | "displayName"
  | "bio"
  | "city"
  | "postCode"
  | "street1"
  | "street2"
  | "hobby"
  | "whatsappNumber"
  | "landlineNumber"
  | "contactEmail"
  | "facebookUrl"
  | "instagramUrl"
  | "tiktokUrl"
  | "linkedinUrl";
type Draft = Record<Field, string>;
type FieldMeta = Readonly<{
  key: Field;
  label: string;
  placeholder: string;
  maxLength: number;
  type?: string;
}>;
const fields: readonly FieldMeta[] = [
  {
    key: "displayName",
    label: "Page name",
    placeholder: "Give your beacon a name",
    maxLength: 60,
  },
  {
    key: "bio",
    label: "Bio",
    placeholder: "What is your beacon about?",
    maxLength: 500,
  },
  {
    key: "city",
    label: "City (optional)",
    placeholder: "Your city",
    maxLength: 100,
  },
  {
    key: "postCode",
    label: "Post code number (optional)",
    placeholder: "Your postal code",
    maxLength: 32,
  },
  {
    key: "street1",
    label: "Street (line 1) (optional)",
    placeholder: "Street address",
    maxLength: 200,
  },
  {
    key: "street2",
    label: "Street (line 2) (optional)",
    placeholder: "Apartment, suite or additional address",
    maxLength: 200,
  },
  {
    key: "hobby",
    label: "Hobby",
    placeholder: "What do you love doing?",
    maxLength: 100,
  },
  {
    key: "whatsappNumber",
    label: "WhatsApp number",
    placeholder: "+1 555 000 0000",
    maxLength: 32,
    type: "tel",
  },
  {
    key: "landlineNumber",
    label: "Landline",
    placeholder: "Your contact number",
    maxLength: 32,
    type: "tel",
  },
  {
    key: "contactEmail",
    label: "Email",
    placeholder: "hello@example.com",
    maxLength: 254,
    type: "email",
  },
  {
    key: "facebookUrl",
    label: "Facebook URL",
    placeholder: "https://facebook.com/yourpage",
    maxLength: 300,
    type: "url",
  },
  {
    key: "instagramUrl",
    label: "Instagram URL",
    placeholder: "https://instagram.com/yourpage",
    maxLength: 300,
    type: "url",
  },
  {
    key: "tiktokUrl",
    label: "TikTok URL",
    placeholder: "https://tiktok.com/@yourpage",
    maxLength: 300,
    type: "url",
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn URL",
    placeholder: "https://linkedin.com/in/yourpage",
    maxLength: 300,
    type: "url",
  },
];
const emptyDraft = (): Draft =>
  Object.fromEntries(fields.map(({ key }) => [key, ""])) as Draft;
const fromProfile = (profile: SocialProfile): Draft =>
  Object.fromEntries(
    fields.map(({ key }) => [key, profile[key] ?? ""]),
  ) as Draft;
const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function BeaconEditorWorkspace({
  publicId,
}: Readonly<{ publicId?: string }>) {
  const router = useRouter();
  const coverInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const openDetailsButton = useRef<HTMLButtonElement>(null);
  const closeDetailsButton = useRef<HTMLButtonElement>(null);
  const detailsPanel = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [profile, setProfile] = useState<SocialProfile>();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [coverFile, setCoverFile] = useState<File>();
  const [avatarFile, setAvatarFile] = useState<File>();
  const [coverPreview, setCoverPreview] = useState<string>();
  const [avatarPreview, setAvatarPreview] = useState<string>();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [smallScreen, setSmallScreen] = useState(false);
  const [loading, setLoading] = useState(!!publicId);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string>();
  const [error, setError] = useState("");

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setSmallScreen(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (smallScreen && detailsOpen) closeDetailsButton.current?.focus();
  }, [smallScreen, detailsOpen]);
  useEffect(() => {
    if (!smallScreen || !detailsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        setDetailsOpen(false);
        requestAnimationFrame(() => openDetailsButton.current?.focus());
      }
      if (event.key === "Tab" && detailsPanel.current) {
        const focusable = [...detailsPanel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]',
        )].filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [smallScreen, detailsOpen, saving]);

  const closeDetails = () => {
    if (saving) return;
    setDetailsOpen(false);
    requestAnimationFrame(() => openDetailsButton.current?.focus());
  };

  useEffect(() => {
    if (!publicId) return;
    let active = true;
    void getSocialProfile(publicId, publicId)
      .then((person) => {
        if (active) {
          setProfile(person);
          setDraft(fromProfile(person));
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load this beacon.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void listSocialPosts(undefined, publicId, true)
      .then((page) => {
        if (active) setPosts(page.items.slice(0, 2));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [publicId]);
  useEffect(
    () => () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    },
    [coverPreview],
  );
  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  function selectImage(kind: "cover" | "avatar", file?: File) {
    if (!file) return;
    if (!imageTypes.has(file.type) || file.size > 3 * 1024 * 1024)
      return toast.error("Choose a JPG, PNG, GIF or WebP image up to 3 MB.");
    const url = URL.createObjectURL(file);
    if (kind === "cover") {
      setCoverFile(file);
      setCoverPreview(url);
    } else {
      setAvatarFile(file);
      setAvatarPreview(url);
    }
  }

  async function save() {
    if (loading || saving) return;
    const displayName = draft.displayName.trim();
    if (!displayName)
      return toast.error("Enter a page name to publish your beacon.");
    setSaving(true);
    try {
      let id = publicId ?? createdId;
      if (!id) {
        const page = await createBeaconPage({
          displayName,
          bio: draft.bio.trim(),
        });
        id = page.publicId;
        setCreatedId(id);
      }
      const [avatarMedia, coverMedia] = await Promise.all([
        avatarFile
          ? uploadAvatarMedia(avatarFile, id)
          : Promise.resolve(undefined),
        coverFile
          ? uploadCoverMedia(coverFile, id)
          : Promise.resolve(undefined),
      ]);
      await updateSocialProfile(
        {
          displayName,
          bio: draft.bio.trim(),
          city: draft.city.trim(),
          postCode: draft.postCode.trim(),
          street1: draft.street1.trim(),
          street2: draft.street2.trim(),
          ...(draft.hobby.trim() ? { hobby: draft.hobby.trim() } : {}),
          whatsappNumber: draft.whatsappNumber.trim(),
          landlineNumber: draft.landlineNumber.trim(),
          contactEmail: draft.contactEmail.trim(),
          facebookUrl: draft.facebookUrl.trim(),
          instagramUrl: draft.instagramUrl.trim(),
          tiktokUrl: draft.tiktokUrl.trim(),
          linkedinUrl: draft.linkedinUrl.trim(),
          ...(avatarMedia ? { avatarMedia } : {}),
          ...(coverMedia ? { coverMedia } : {}),
        },
        id,
      );
      toast.success(publicId ? "Beacon saved." : "Your beacon is live.");
      router.replace(publicId ? `/users/${id}` : `/beacons/${id}/first-post`);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Could not save this beacon.",
      );
    } finally {
      setSaving(false);
    }
  }

  const coverUrl = coverPreview ?? profile?.coverUrl;
  const avatarUrl = avatarPreview ?? profile?.avatarUrl;
  const showName = draft.displayName.trim() || "Your beacon name";
  const cancelHref = publicId ? `/users/${publicId}` : "/profile";
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm text-[#17191d] outline-none transition focus:border-[#C62828] focus:ring-2 focus:ring-[#C62828]/15 dark:border-night-border dark:bg-night-raised dark:text-white";

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#e7e9ed] text-[#17191d] dark:bg-[#29282d] dark:text-night-text lg:flex-row">
      <button
        type="button"
        aria-label="Close page editor"
        disabled={saving}
        onClick={closeDetails}
        className={`absolute inset-0 z-10 bg-black/50 transition-[opacity,visibility] duration-300 lg:hidden ${detailsOpen ? "visible opacity-100" : "pointer-events-none invisible opacity-0"}`}
      />
      <section
        aria-label="Beacon preview"
        inert={smallScreen && detailsOpen}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-7 lg:px-10 lg:py-8"
      >
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.24em] text-[#C62828]">
                Beacon studio
              </p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">
                {publicId ? "Shape your page" : "Your page starts here"}
              </h1>
            </div>
            <button
              ref={openDetailsButton}
              type="button"
              aria-controls="beacon-page-details"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#C62828] px-4 py-2.5 text-xs font-black text-white lg:hidden"
            >
              <PanelLeftOpen size={16} /> {publicId ? "Edit details" : "Page details"}
            </button>
            <div
              className="inline-flex rounded-xl border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-night-surface"
              aria-label="Preview size"
            >
              <button
                type="button"
                aria-pressed={device === "desktop"}
                onClick={() => setDevice("desktop")}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${device === "desktop" ? "bg-[#202530] text-white" : "text-black/50 dark:text-night-muted"}`}
              >
                <Monitor size={16} /> Desktop
              </button>
              <button
                type="button"
                aria-pressed={device === "mobile"}
                onClick={() => setDevice("mobile")}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${device === "mobile" ? "bg-[#202530] text-white" : "text-black/50 dark:text-night-muted"}`}
              >
                <Smartphone size={16} /> Mobile
              </button>
            </div>
          </div>
          <div
            className={`mx-auto overflow-hidden rounded-[26px] border border-black/10 bg-[#f7f8fa] shadow-[0_22px_65px_rgba(24,30,44,.15)] transition-[max-width] duration-300 dark:border-white/10 dark:bg-night-canvas ${device === "mobile" ? "max-w-[420px]" : "max-w-[1060px]"}`}
          >
            <div className="relative h-44 overflow-hidden bg-[#171d29] sm:h-60 xl:h-64">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="Beacon cover preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="absolute -right-14 -top-24 h-96 w-96 rounded-full border-[45px] border-white/10" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#141923]/30 to-[#C62828]/20" />
              <button
                type="button"
                onClick={() => coverInput.current?.click()}
                className="absolute bottom-4 right-4 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-black shadow-lg hover:bg-white dark:bg-night-surface"
              >
                <Camera size={15} /> {coverUrl ? "Change cover" : "Add cover"}
              </button>
            </div>
            <div className="relative border-b border-black/10 bg-white px-5 pb-4 pt-16 dark:border-white/10 dark:bg-night-surface sm:px-7">
              <button
                type="button"
                aria-label="Choose page photo"
                onClick={() => avatarInput.current?.click()}
                className="absolute -top-12 left-6 grid h-24 w-24 place-items-center overflow-hidden rounded-[26px] border-4 border-white bg-[#dfe2e9] text-4xl shadow-lg dark:border-night-surface dark:bg-night-raised sm:left-8"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Beacon photo preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  "👻"
                )}
                <span className="absolute bottom-0 right-0 rounded-tl-xl bg-[#C62828] p-1.5 text-white">
                  <Camera size={14} />
                </span>
              </button>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#C62828]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-[#a21e1e] dark:bg-night-softred dark:text-red-200">
                <Sparkles size={12} /> Beacon page
              </span>
              <h2
                className={`mt-2 break-words text-2xl font-black sm:text-3xl ${draft.displayName.trim() ? "" : "text-black/35 dark:text-white/35"}`}
              >
                {showName}
              </h2>
              {draft.bio.trim() && (
                <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-black/60 dark:text-night-muted">
                  {draft.bio.trim()}
                </p>
              )}
            </div>
            <div className="flex gap-6 overflow-x-auto border-b border-black/10 bg-white px-5 text-xs font-black text-black/50 dark:border-white/10 dark:bg-night-surface dark:text-night-muted sm:px-7">
              <span className="border-b-2 border-[#C62828] py-4 text-[#C62828]">
                Posts
              </span>
              <span className="py-4">About</span>
              <span className="py-4">Photos</span>
            </div>
            <div
              className={`grid gap-4 p-4 sm:p-5 ${device === "desktop" ? "md:grid-cols-[minmax(0,1fr)_270px]" : ""}`}
            >
              <section aria-label="Page posts" className="min-w-0 space-y-3">
                <h3 className="rounded-2xl bg-white px-5 py-4 text-sm font-black shadow-sm dark:bg-night-surface">
                  Posts
                </h3>
                {posts.length ? (
                  posts.map((post) => (
                    <article
                      key={post.id}
                      className="rounded-2xl bg-white p-5 shadow-sm dark:bg-night-surface"
                    >
                      <p className="text-xs font-black">{showName}</p>
                      <p className="mt-1 text-[11px] text-black/40 dark:text-night-muted">
                        {new Date(post.createdAtMs).toLocaleDateString()}
                      </p>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
                        <LinkifiedText content={post.content} />
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 px-5 py-10 text-center dark:border-white/15 dark:bg-night-surface/70">
                    <Sparkles
                      className="mx-auto mb-3 text-[#C62828]"
                      size={25}
                    />
                    <p className="text-sm font-black">
                      Your first post belongs here
                    </p>
                    <p className="mt-1 text-xs text-black/45 dark:text-night-muted">
                      Publish your beacon, then share something with your
                      audience.
                    </p>
                  </div>
                )}
              </section>
              <section
                aria-label="Page introduction"
                className="h-fit rounded-2xl bg-white p-5 shadow-sm dark:bg-night-surface"
              >
                <h3 className="text-sm font-black">About this beacon</h3>
                <div className="mt-4 space-y-3 text-xs text-black/60 dark:text-night-muted">
                  <p className="flex items-center gap-2">
                    <UsersRound size={15} /> Your space on g000st
                  </p>
                  <PageAddress profile={draft} />
                  {draft.hobby.trim() && <p>✦ {draft.hobby.trim()}</p>}
                  {draft.contactEmail.trim() && (
                    <p className="break-all">✉ {draft.contactEmail.trim()}</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
      <aside
        ref={detailsPanel}
        id="beacon-page-details"
        aria-label={publicId ? "Edit beacon" : "Create beacon"}
        role={smallScreen && detailsOpen ? "dialog" : undefined}
        aria-modal={smallScreen && detailsOpen ? true : undefined}
        className={`absolute inset-y-0 left-0 z-20 flex w-[88%] max-w-[400px] flex-col overflow-hidden border-r border-black/10 bg-[#f7f8fa] shadow-2xl transition-[transform,visibility] duration-300 ease-out dark:border-white/10 dark:bg-night-header lg:relative lg:inset-auto lg:w-[370px] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:visible lg:border-r-0 lg:border-l lg:shadow-none xl:w-[400px] ${detailsOpen ? "visible translate-x-0" : "pointer-events-none invisible -translate-x-full lg:pointer-events-auto"}`}
      >
        <div className="flex items-start gap-3 border-b border-black/10 px-5 py-5 dark:border-white/10">
          <button
            type="button"
            aria-label="Leave editor"
            onClick={() => router.push(cancelHref)}
            className="mt-0.5 hidden rounded-full p-2 text-black/50 transition hover:bg-black/5 dark:text-night-muted dark:hover:bg-white/10 lg:inline-flex"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="hidden text-[10px] font-black uppercase tracking-[.22em] text-[#C62828] lg:block">
              {publicId ? "Edit your beacon" : "Create a beacon"}
            </p>
            <h2 className="mt-1 text-xl font-black">
              <span className="lg:hidden">{publicId ? "Edit beacon" : "Build your beacon"}</span>
              <span className="hidden lg:inline">{publicId ? "Page details" : "Tell your story"}</span>
            </h2>
            <p className="mt-1 text-xs leading-5 text-black/50 dark:text-night-muted">
              Only the page name is required.<span className="hidden lg:inline"> Your preview updates as you type.</span>
            </p>
          </div>
          <button
            ref={closeDetailsButton}
            type="button"
            aria-label="Close page editor"
            disabled={saving}
            onClick={closeDetails}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-black/60 hover:bg-black/5 disabled:opacity-40 dark:text-night-muted dark:hover:bg-white/10 lg:hidden"
          >
            <X size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {loading && <p className="text-sm">Loading your beacon…</p>}
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm font-bold text-[#a21e1e] dark:bg-night-softred dark:text-red-200"
            >
              {error}
            </p>
          )}
          {!loading && !error && (
            <>
              <section className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-[.16em] text-black/45 dark:text-night-muted">
                  Page appearance
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => coverInput.current?.click()}
                    className="flex min-h-20 flex-col items-start justify-center gap-2 rounded-xl border border-black/10 bg-white p-3 text-left text-xs font-bold hover:border-[#C62828] dark:border-night-border dark:bg-night-surface"
                  >
                    <ImagePlus size={19} className="text-[#C62828]" />{" "}
                    {coverFile || profile?.coverUrl
                      ? "Change cover"
                      : "Add cover"}
                  </button>
                  <button
                    type="button"
                    onClick={() => avatarInput.current?.click()}
                    className="flex min-h-20 flex-col items-start justify-center gap-2 rounded-xl border border-black/10 bg-white p-3 text-left text-xs font-bold hover:border-[#C62828] dark:border-night-border dark:bg-night-surface"
                  >
                    <Camera size={19} className="text-[#C62828]" />{" "}
                    {avatarFile || profile?.avatarUrl
                      ? "Change photo"
                      : "Add photo"}
                  </button>
                </div>
                <p className="text-[11px] text-black/40 dark:text-night-muted">
                  JPG, PNG, GIF or WebP · up to 3 MB each
                </p>
              </section>
              <section className="space-y-4 border-t border-black/10 pt-5 dark:border-white/10">
                <h3 className="text-xs font-black uppercase tracking-[.16em] text-black/45 dark:text-night-muted">
                  Identity
                </h3>
                {fields
                  .slice(0, 7)
                  .map(({ key, label, placeholder, maxLength, type }) => (
                    <label key={key} className="block text-xs font-black">
                      {label}
                      {key === "displayName" && (
                        <span className="ml-1 text-[#C62828]">*</span>
                      )}
                      {key === "bio" ? (
                        <textarea
                          value={draft[key]}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              [key]: event.target.value,
                            }))
                          }
                          placeholder={placeholder}
                          maxLength={maxLength}
                          rows={3}
                          className={inputClass}
                        />
                      ) : (
                        <input
                          type={type ?? "text"}
                          value={draft[key]}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              [key]: event.target.value,
                            }))
                          }
                          placeholder={placeholder}
                          maxLength={maxLength}
                          className={inputClass}
                        />
                      )}
                    </label>
                  ))}
              </section>
              <section className="space-y-4 border-t border-black/10 pt-5 dark:border-white/10">
                <h3 className="text-xs font-black uppercase tracking-[.16em] text-black/45 dark:text-night-muted">
                  Contact & social links
                </h3>
                {fields
                  .slice(7)
                  .map(({ key, label, placeholder, maxLength, type }) => (
                    <label key={key} className="block text-xs font-black">
                      {label}
                      <input
                        type={type ?? "text"}
                        value={draft[key]}
                        onChange={(event) =>
                          setDraft((value) => ({
                            ...value,
                            [key]: event.target.value,
                          }))
                        }
                        placeholder={placeholder}
                        maxLength={maxLength}
                        className={inputClass}
                      />
                    </label>
                  ))}
              </section>
            </>
          )}
        </div>
        <div className="border-t border-black/10 bg-white px-5 py-4 dark:border-white/10 dark:bg-night-surface">
          <p className="mb-3 flex items-center gap-2 text-[11px] text-black/45 dark:text-night-muted">
            <Check size={13} className="text-[#C62828]" />{" "}
            {publicId
              ? "Changes appear on your live page after saving."
              : "Your beacon is created when you publish."}
          </p>
          <button
            type="button"
            disabled={loading || saving || !!error || !draft.displayName.trim()}
            onClick={() => void save()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C62828] px-4 py-3.5 text-sm font-black text-white shadow-[0_10px_22px_rgba(198,40,40,.18)] transition hover:bg-[#ab1f1f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={17} />{" "}
            {saving
              ? "Saving…"
              : publicId
                ? "Save changes"
                : "Publish beacon & share your first post"}
          </button>
        </div>
      </aside>
      <input
        ref={coverInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          selectImage("cover", event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={avatarInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          selectImage("avatar", event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
