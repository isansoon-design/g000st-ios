"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, ChevronDown, Globe2, IdCard, Menu, MessageCircle, ShoppingBag, Smartphone, UsersRound, X } from "lucide-react";

import { listBeaconPages, type BeaconPage } from "@/app/api/auth";
import { sessionStorage } from "@/app/api/session-storage";
import { getSocialProfile, type SocialProfile } from "@/app/api/social";

const links = [
  { label: "Social", href: "/social", Icon: Globe2 },
  { label: "Chat", href: "/chat", Icon: MessageCircle },
  { label: "Friends", href: "/contacts", Icon: UsersRound },
  { label: "Profile", href: "/profile", Icon: IdCard },
  { label: "Trading", href: "/market", Icon: ShoppingBag },
  { label: "Mobile", href: "/mobile", Icon: Smartphone },
] as const;

export function UserSidebar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pages, setPages] = useState<BeaconPage[]>([]);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const ownerId = sessionStorage.get()?.user.publicId;
  const activeId = sessionStorage.getActingPublicId();

  useEffect(() => {
    if (!open || !ownerId) return;
    let active = true;
    void getSocialProfile(ownerId).then((person) => { if (active) setProfile(person); }).catch(() => undefined);
    void listBeaconPages().then((items) => { if (active) setPages(items); }).catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Could not load your pages."); });
    return () => { active = false; };
  }, [open, ownerId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const switchTo = (id: string, name: string) => {
    if (activeId !== id) sessionStorage.setActingPublicId(id);
    setOpen(false);
    toast.success(`You are now interacting as ${name}`);
    router.push("/social");
    router.refresh();
  };
  const create = () => { setOpen(false); router.push('/beacons/new'); };

  return <>
    <button type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)} className="mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-[#111] hover:bg-black/10 dark:text-white dark:hover:bg-white/10"><Menu size={21} /></button>
    {open && <div className="absolute inset-0 z-50 flex bg-black/50" role="presentation">
      <aside aria-label="Main navigation" className="flex h-full w-[min(85vw,340px)] flex-col bg-[#D8DCE3] shadow-xl dark:bg-night-canvas">
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
          <span className="text-lg font-black">g<span className="text-[#C62828]">000</span>st</span>
          <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-black/10 dark:hover:bg-white/10"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {ownerId && <div className="mb-4 flex items-center rounded-2xl bg-white p-2 dark:bg-night-surface">
            <Link href={`/users/${ownerId}`} onClick={() => setOpen(false)} className="flex min-w-0 flex-1 items-center gap-3">
              {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9A9A9A] font-black text-white">{(profile?.displayName || "G")[0]}</span>}
              <span className="truncate font-black">{profile?.displayName || ownerId.slice(0, 8)}</span>
            </Link>
            <button type="button" aria-label="Show my pages" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><ChevronDown size={20} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} /></button>
          </div>}
          {expanded && <div className="mb-5 space-y-2">
            {pages.map((page) => <div key={page.publicId} className="flex items-center rounded-xl bg-white dark:bg-night-surface">
              <Link href={`/users/${page.publicId}`} onClick={() => setOpen(false)} className="min-w-0 flex-1 truncate px-4 py-3 font-bold">{page.displayName || "Untitled beacon"}</Link>
              <button type="button" role="switch" aria-checked={activeId === page.publicId} aria-label={`Switch to ${page.displayName || "page"}`} onClick={() => switchTo(page.publicId, page.displayName || "Untitled page")} className="flex h-12 w-14 shrink-0 items-center justify-center border-l border-black/10 text-xl hover:text-[#C62828] dark:border-white/15">⇄{activeId === page.publicId && <Check size={12} />}</button>
            </div>)}
            <button type="button" onClick={create} className="w-full rounded-xl bg-[#C62828] px-4 py-3 text-sm font-black text-white">BUILD YOUR BEACON</button>
          </div>}
          <nav aria-label="Pages" className="space-y-2.5">{links.map(({ label, href, Icon }) => <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className="flex h-[68px] items-center gap-4 rounded-[14px] bg-white px-4 text-[18px] font-extrabold text-[#242526] transition-colors hover:bg-[#e8eaed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828] dark:bg-[#3A3B3C] dark:text-white dark:hover:bg-[#4E4F50]"
          ><Icon size={28} strokeWidth={2} aria-hidden="true" /><span>{label}</span></Link>)}</nav>
        </div>
      </aside>
      <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="flex-1" />
    </div>}
  </>;
}
