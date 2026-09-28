"use client";

import { ArrowLeft, Copy, MessageCircle, Phone, Video, ShoppingBag, Sparkles, UserCheck, UserPlus, Pencil } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { listMarketPosts, type MarketPost } from "@/app/api/market";
import { listBeaconPages, type BeaconPage } from "@/app/api/auth";
import { getSocialProfile, listSocialPosts, toggleSocialCamp, updateSocialProfile, uploadAvatarMedia, uploadCoverMedia, type SocialPost, type SocialProfile } from "@/app/api/social";
import { sessionStorage } from "@/app/api/session-storage";
import { startChatConversation } from "@/features/chat/api";
import { useCalling } from "@/features/calling/use-calling";

type Tab = "social" | "market";
type ProfileDraft = {
  displayName: string; bio: string; showDisplayName: boolean; country: string; age: string; sex: '' | 'male' | 'female'; hobby: string;
  whatsappNumber: string; landlineNumber: string; contactEmail: string; facebookUrl: string; instagramUrl: string; tiktokUrl: string; linkedinUrl: string;
};

function profileDraft(profile: SocialProfile): ProfileDraft {
  return { displayName: profile.displayName ?? '', bio: profile.bio ?? '', showDisplayName: profile.showDisplayName,
    country: profile.country ?? '', age: profile.age ? String(profile.age) : '', sex: profile.sex ?? '', hobby: profile.hobby ?? '',
    whatsappNumber: profile.whatsappNumber ?? '', landlineNumber: profile.landlineNumber ?? '', contactEmail: profile.contactEmail ?? '',
    facebookUrl: profile.facebookUrl ?? '', instagramUrl: profile.instagramUrl ?? '', tiktokUrl: profile.tiktokUrl ?? '', linkedinUrl: profile.linkedinUrl ?? '' };
}

export default function PublicUserPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const router = useRouter();
  const { callUser } = useCalling();
  const [ownedPages, setOwnedPages] = useState<BeaconPage[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<SocialProfile>();
  const [tab, setTab] = useState<Tab>("social");
  const [social, setSocial] = useState<SocialPost[]>([]);
  const [market, setMarket] = useState<MarketPost[]>([]);
  const [cursors, setCursors] = useState<{ social?: string; market?: string }>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const actingPublicId = sessionStorage.getActingPublicId();
  const ownerPublicId = sessionStorage.get()?.user.publicId;
  const own = publicId === ownerPublicId || publicId === actingPublicId || ownedPages.some((page) => page.publicId === publicId);
  useEffect(() => {
    let active = true;
    void listBeaconPages().then((pages) => {
      if (active) setOwnedPages(pages);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [ownerPublicId]);

  async function beginEdit() {
    if (!own) return;
    try {
      const editable = await getSocialProfile(publicId, publicId);
      setProfile(editable);
      setDraft(profileDraft(editable));
      setEditing(true);
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Could not open editor.'); }
  }

  async function endEdit() {
    setEditing(false);
    setDraft(null);
    try { setProfile(await getSocialProfile(publicId)); } catch { /* Keep the last visible profile. */ }
  }

  async function saveEdit() {
    if (!draft || saving) return;
    if (profile?.isPage && !draft.displayName.trim()) return toast.error('Name your page before saving.');
    setSaving(true);
    try {
      const saved = await updateSocialProfile({
        ...(draft.displayName.trim() ? { displayName: draft.displayName.trim() } : {}),
        bio: draft.bio.trim(),
        ...(draft.country.trim() ? { country: draft.country.trim() } : {}),
        ...(draft.hobby.trim() ? { hobby: draft.hobby.trim() } : {}),
        ...(profile?.isPage ? {
          whatsappNumber: draft.whatsappNumber, landlineNumber: draft.landlineNumber, contactEmail: draft.contactEmail,
          facebookUrl: draft.facebookUrl, instagramUrl: draft.instagramUrl, tiktokUrl: draft.tiktokUrl, linkedinUrl: draft.linkedinUrl,
        } : { showDisplayName: draft.showDisplayName,
          ...(draft.age ? { age: Number(draft.age) } : {}), ...(draft.sex ? { sex: draft.sex } : {}) }),
      }, publicId);
      setProfile(saved);
      setEditing(false);
      setDraft(null);
      toast.success('Profile saved.');
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Could not save profile.'); }
    finally { setSaving(false); }
  }

  function switchToThisProfile() {
    if (actingPublicId !== publicId) sessionStorage.setActingPublicId(publicId);
    toast.success(`أنت الآن تتفاعل باسم ${profile?.displayName || (profile?.isPage ? 'هذه الصفحة' : 'ملفك الشخصي')}`);
    router.push('/social');
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setProfile(undefined);
    setSocial([]);
    setMarket([]);
    setCursors({});
    setError("");
    Promise.all([getSocialProfile(publicId), listSocialPosts(undefined, publicId, true), listMarketPosts(undefined, publicId)])
      .then(([person, socialPage, marketPage]) => {
        if (!active) return;
        setProfile(person);
        setSocial(socialPage.items);
        setMarket(marketPage.items);
        setCursors({ social: socialPage.nextCursor, market: marketPage.nextCursor });
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load this profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [publicId]);

  async function loadMore() {
    const cursor = cursors[tab];
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      if (tab === "social") {
        const page = await listSocialPosts(cursor, publicId, true);
        setSocial((current) => [...current, ...page.items.filter((item) => !current.some((old) => old.id === item.id))]);
        setCursors((current) => ({ ...current, social: page.nextCursor }));
      } else {
        const page = await listMarketPosts(cursor, publicId);
        setMarket((current) => [...current, ...page.items.filter((item) => !current.some((old) => old.id === item.id))]);
        setCursors((current) => ({ ...current, market: page.nextCursor }));
      }
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Could not load more posts."); }
    finally { setLoadingMore(false); }
  }

  async function openChat() {
    try {
      const conversation = await startChatConversation(publicId);
      router.push(`/chat?conversationId=${conversation.id}`);
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Could not open chat."); }
  }

  async function toggleFollow() {
    if (!profile || own || followBusy) return;
    setFollowBusy(true);
    try {
      const { camped } = await toggleSocialCamp(publicId);
      setProfile((current) => current?.publicId === publicId ? { ...current, campedByViewer: camped } : current);
      toast.success(camped ? "Following" : "Unfollowed");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not update follow.");
    } finally {
      setFollowBusy(false);
    }
  }

  async function uploadCover(file?: File) {
    if (!file) return;
    if (!editing || !own || !file.type.startsWith("image/") || file.size > 3 * 1024 * 1024) return toast.error("Choose an image up to 3 MB.");
    setUploadingCover(true);
    try {
      const coverMedia = await uploadCoverMedia(file, publicId);
      setProfile(await updateSocialProfile({ coverMedia }, publicId));
      toast.success("Cover updated.");
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Could not update cover."); }
    finally { setUploadingCover(false); }
  }

  async function uploadAvatar(file?: File) {
    if (!file || !editing || !own) return;
    if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) return toast.error('Choose an image up to 3 MB.');
    try {
      const avatarMedia = await uploadAvatarMedia(file, publicId);
      setProfile(await updateSocialProfile({ avatarMedia }, publicId));
      toast.success('Photo updated.');
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Could not update photo.'); }
  }

  const posts = tab === "social" ? social : market;
  return <main className="h-full overflow-y-auto bg-[#e6e8eb] dark:bg-night-canvas text-[#17191d] dark:text-night-text">
    <div className="mx-auto max-w-3xl pb-12">
      <div className="relative h-56 overflow-hidden bg-[#141923] sm:h-72">
        {profile?.coverUrl && <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1f2534]/40 via-transparent to-[#c62828]/45" />
        {!profile?.coverUrl && <div className="absolute -right-12 -top-24 h-80 w-80 rounded-full border-[35px] border-white/10 dark:border-white/20" />}
        <button onClick={() => router.back()} aria-label="Go back" className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:scale-105"><ArrowLeft size={19} /></button>
        {own && editing && <label className="absolute bottom-4 right-4 cursor-pointer rounded-full bg-white/90 dark:bg-night-surface px-4 py-2 text-xs font-black shadow-lg transition hover:bg-white">{uploadingCover ? "Uploading…" : "✦ Change cover"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploadingCover} onChange={(event) => { void uploadCover(event.target.files?.[0]); event.target.value = ""; }} /></label>}
      </div>

      {loading ? <div className="space-y-4 p-5"><div className="h-28 animate-pulse rounded-3xl bg-white/70 dark:bg-night-surface" /><div className="h-48 animate-pulse rounded-3xl bg-white/70 dark:bg-night-surface" /></div> : error ? <div className="m-5 rounded-3xl bg-white dark:bg-night-surface p-8 text-center font-semibold">{error}</div> : profile && <>
        <section className="profile-reveal relative mx-3 -mt-12 rounded-[28px] border border-white/80 dark:border-white/20 bg-white/95 dark:bg-night-surface px-5 pb-6 pt-16 shadow-[0_18px_60px_rgba(24,30,44,.13)] backdrop-blur sm:mx-5 sm:px-7">
          <div className="absolute -top-12 left-6 grid h-24 w-24 place-items-center overflow-hidden rounded-[28px] border-4 border-white bg-[#dfe2e9] dark:bg-night-raised text-4xl shadow-lg sm:left-8">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : "👻"}{own && editing && <label className="absolute inset-x-0 bottom-0 cursor-pointer bg-black/70 py-1 text-center text-[10px] font-black text-white">Edit photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.target.value = ''; }} /></label>}</div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#c62828]/10 dark:bg-night-softred px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#a21e1e] dark:text-red-200"><Sparkles size={12} /> {profile.isPage ? 'BEACON PAGE' : 'G000ST PROFILE'}</span><h1 className="break-words text-2xl font-black sm:text-3xl">{profile.isPage || profile.showDisplayName ? profile.displayName || (profile.isPage ? 'Untitled beacon' : publicId.slice(0, 8)) : publicId.slice(0, 8)}</h1></div>
            {own && <button type="button" onClick={() => { if (editing) void endEdit(); else void beginEdit(); }} className="inline-flex items-center gap-2 rounded-full border border-black/15 dark:border-night-border px-4 py-2 text-xs font-black transition hover:bg-black hover:text-white"><Pencil size={14} />{editing ? 'Cancel editing' : 'Edit profile'}</button>}
          </div>
          <button onClick={async () => { try { await navigator.clipboard.writeText(publicId); toast.success("Public ID copied."); } catch { toast.error("Could not copy ID."); } }} className="mt-3 flex max-w-full items-center gap-2 rounded-xl bg-[#f0f1f4] dark:bg-night-surface px-3 py-2 text-left font-mono text-xs transition hover:bg-[#e2e5eb]" title="Copy public ID"><span className="truncate">{publicId}</span><Copy size={14} className="shrink-0" /></button>
          {profile.bio && !editing && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-black/65 dark:text-night-muted">{profile.bio}</p>}
          {own && !editing && <button type="button" onClick={switchToThisProfile} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#17191d] px-4 py-3 text-sm font-black text-white"><span aria-hidden="true" className="text-xl">⇄</span>{profile.isPage ? 'التبديل للتفاعل بإسم هذه الصفحة' : 'التبديل للتفاعل بإسم هذا الملف الشخصي'}</button>}
          {own && editing && draft && <div className="mt-5 space-y-3 border-t border-black/10 pt-5 dark:border-night-border">
            <label className="block text-xs font-black">Name<input value={draft.displayName} maxLength={60} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className="mt-1 block w-full rounded-xl border border-black/15 bg-white p-3 text-sm text-[#17191d] dark:border-night-border dark:bg-night-raised dark:text-night-text" /></label>
            <label className="block text-xs font-black">Bio<textarea value={draft.bio} maxLength={500} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} className="mt-1 block min-h-24 w-full rounded-xl border border-black/15 bg-white p-3 text-sm text-[#17191d] dark:border-night-border dark:bg-night-raised dark:text-night-text" /></label>
            {([['country', 'Country'], ['hobby', 'Hobby'], ...(!profile.isPage ? [['age', 'Age']] : []), ...(profile.isPage ? [['whatsappNumber', 'WhatsApp number'], ['landlineNumber', 'Landline'], ['contactEmail', 'Email'], ['facebookUrl', 'Facebook URL'], ['instagramUrl', 'Instagram URL'], ['tiktokUrl', 'TikTok URL'], ['linkedinUrl', 'LinkedIn URL']] : [])] as [keyof ProfileDraft, string][]).map(([field, label]) => <label key={field} className="block text-xs font-black">{label}<input value={String(draft[field])} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} className="mt-1 block w-full rounded-xl border border-black/15 bg-white p-3 text-sm text-[#17191d] dark:border-night-border dark:bg-night-raised dark:text-night-text" /></label>)}
            {!profile.isPage && <><label className="flex items-center gap-2 text-xs font-black"><input type="checkbox" checked={draft.showDisplayName} onChange={(event) => setDraft({ ...draft, showDisplayName: event.target.checked })} />Show my name</label><label className="block text-xs font-black">Sex<select value={draft.sex} onChange={(event) => setDraft({ ...draft, sex: event.target.value as ProfileDraft['sex'] })} className="mt-1 block w-full rounded-xl border border-black/15 bg-white p-3 text-sm text-[#17191d] dark:border-night-border dark:bg-night-raised dark:text-night-text"><option value="">Not set</option><option value="male">Male</option><option value="female">Female</option></select></label></>}
            <button type="button" disabled={saving} onClick={() => void saveEdit()} className="w-full rounded-2xl bg-[#c62828] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>}
          {!own && <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
            <button onClick={() => void toggleFollow()} disabled={followBusy} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-50 ${profile.campedByViewer ? "border border-[#17191d] dark:border-night-border bg-white dark:bg-night-surface text-[#17191d] dark:text-night-text" : "bg-[#17191d] text-white"}`}>
              {profile.campedByViewer ? <UserCheck size={18} /> : <UserPlus size={18} />}
              {followBusy ? "Updating…" : profile.campedByViewer ? "Unfollow" : "Follow"}
            </button>
            <button onClick={() => void openChat()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#c62828] px-6 py-3 text-sm font-black text-white shadow-lg shadow-red-900/15 transition hover:-translate-y-0.5 hover:bg-[#ae2020]"><MessageCircle size={18} /> Message</button>
            <button onClick={() => void callUser(publicId, "audio")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#17191d] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"><Phone size={18} /> Voice</button>
            <button onClick={() => void callUser(publicId, "video")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#17191d] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"><Video size={18} /> Video</button>
          </div>}
          {!editing && profile.isPage && (profile.whatsappNumber || profile.landlineNumber || profile.contactEmail || profile.facebookUrl || profile.instagramUrl || profile.tiktokUrl || profile.linkedinUrl) && <div className="mt-5 border-t border-black/10 pt-4 dark:border-night-border">
            {profile.whatsappNumber && <a href={`https://wa.me/${profile.whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="mb-3 flex items-center justify-between rounded-2xl bg-[#d8f8e6] px-5 py-3 text-[#126c3d] transition hover:bg-[#bdf0d1] dark:bg-[#173d2b] dark:text-[#8de5b3]"><span><span className="block text-sm font-black">✆ Chat on WhatsApp</span><span className="block text-[11px] font-semibold opacity-70">Open a direct conversation</span></span><span className="text-xl font-black">↗</span></a>}
            {profile.landlineNumber && <a aria-label={`Call landline ${profile.landlineNumber}`} href={`tel:${profile.landlineNumber}`} className="mb-3 flex items-center justify-between rounded-2xl border border-[#b7cbe5] bg-[#eef4fc] px-5 py-3 text-[#233e63] transition hover:border-[#7396bf] hover:bg-[#e1edfb] dark:border-[#405a7a] dark:bg-[#202e42] dark:text-[#d3e3f6]"><span><span className="block text-[10px] font-black uppercase tracking-widest text-[#587398] dark:text-[#9cb9da]">Landline · Tap to call</span><span className="mt-1 block font-mono text-base font-black" dir="ltr">{profile.landlineNumber}</span></span><span className="grid h-10 w-10 place-items-center rounded-full bg-[#2d4669] text-white dark:bg-[#6288b6]"><Phone size={19} /></span></a>}
            <div className="flex flex-wrap gap-2">{([
              ['Email', profile.contactEmail ? `mailto:${profile.contactEmail}` : undefined],
              ['Facebook', profile.facebookUrl],
              ['Instagram', profile.instagramUrl],
              ['TikTok', profile.tiktokUrl],
              ['LinkedIn', profile.linkedinUrl],
            ] as const).filter((item) => !!item[1]).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-black/10 bg-[#f0f1f4] px-4 py-2 text-xs font-black transition hover:bg-[#e0e7ef] dark:border-night-border dark:bg-night-raised">{label} ↗</a>)}</div>
          </div>}
        </section>

        <div className="mx-3 mt-5 rounded-2xl bg-white/85 dark:bg-night-surface p-1.5 shadow-sm sm:mx-5" role="tablist" aria-label="Profile posts">
          {(["social", "market"] as const).map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`w-1/2 rounded-xl px-4 py-3 text-sm font-black transition-all duration-300 ${tab === item ? "bg-[#17191d] text-white shadow-lg" : "text-black/45 dark:text-night-muted hover:text-black"}`}>{item === "social" ? "◎ Social" : "◈ Market"}</button>)}
        </div>
        <div key={tab} className="profile-reveal mx-3 mt-4 space-y-4 sm:mx-5">
          {posts.length === 0 && <div className="rounded-3xl bg-white dark:bg-night-surface p-12 text-center text-sm font-semibold text-black/45 dark:text-night-muted">{tab === "social" ? "No public social posts yet." : "No market listings yet."}</div>}
          {tab === "social" ? social.map((post) => <article key={post.id} className="overflow-hidden rounded-3xl border border-white bg-white dark:bg-night-surface shadow-[0_10px_35px_rgba(20,24,34,.06)]"><div className="flex items-center gap-3 p-4"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#202530] text-white">{post.author.avatarUrl ? <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : "👻"}</div><div><b className="text-sm">{post.author.displayName}</b><p className="text-xs text-black/40 dark:text-night-muted">{new Date(post.createdAtMs).toLocaleString()}</p></div></div><p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-6">{post.content}</p>{post.sharedPost && <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-black/10 dark:border-night-border bg-[#f7f7f8] dark:bg-night-surface text-sm"><div className="p-4"><b>{post.sharedPost.author.displayName}</b><p className="mt-1 whitespace-pre-wrap">{post.sharedPost.content}</p></div><PostMedia media={post.sharedPost.media} /></div>}<PostMedia media={post.media} /><div className="flex gap-5 px-4 py-3 text-xs font-bold text-black/40 dark:text-night-muted">♡ {post.likeCount}<span>◌ {post.commentCount}</span></div></article>) : market.map((post) => <article key={post.id} className="overflow-hidden rounded-3xl border border-white bg-white dark:bg-night-surface shadow-[0_10px_35px_rgba(20,24,34,.06)]"><div className="flex items-center gap-3 p-4"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#202530] text-white">{post.author.avatarUrl ? <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : <ShoppingBag size={18} />}</div><div><b className="text-sm">{post.author.displayName}</b><p className="text-xs text-black/40 dark:text-night-muted">{new Date(post.createdAtMs).toLocaleString()}</p></div></div><p className="whitespace-pre-wrap px-4 pb-3 text-sm leading-6">{post.content}</p><div className="flex flex-wrap gap-2 px-4 pb-4 text-xs font-black"><span className="rounded-full bg-[#c62828] px-3 py-1.5 text-white">{post.price.toLocaleString()} {post.currency}</span><span className="rounded-full bg-[#f0f1f4] dark:bg-night-surface px-3 py-1.5">{post.city}</span><span className="rounded-full bg-[#f0f1f4] dark:bg-night-surface px-3 py-1.5">Qty {post.quantity}</span></div><PostMedia media={post.media} /><div className="flex gap-5 px-4 py-3 text-xs font-bold text-black/40 dark:text-night-muted">♡ {post.likeCount}<span>◌ {post.commentCount}</span></div></article>)}
          {cursors[tab] && <button onClick={() => void loadMore()} disabled={loadingMore} className="w-full rounded-2xl bg-white dark:bg-night-surface px-5 py-4 text-sm font-black shadow-sm transition hover:bg-[#17191d] hover:text-white disabled:opacity-50">{loadingMore ? "Loading…" : "Load more"}</button>}
        </div>
      </>}
    </div>
  </main>;
}

function PostMedia({ media }: { media?: readonly { id: string; kind: "image" | "video"; url: string }[] }) {
  if (!media?.length) return null;
  return <div className={`grid gap-1 ${media.length > 1 ? "grid-cols-2" : ""}`}>{media.map((item) => item.kind === "video" ? <video key={item.id} src={item.url} controls playsInline className="max-h-[28rem] w-full bg-black object-contain" /> : <img key={item.id} src={item.url} alt="Post media" className="max-h-[28rem] w-full object-cover" />)}</div>;
}
