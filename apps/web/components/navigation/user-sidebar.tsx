"use client";

import {
  Check,
  ChevronDown,
  Globe2,
  IdCard,
  MessageCircle,
  ShoppingBag,
  Smartphone,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

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

type Props = {
  desktopOpen: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  pathname: string;
};

function IdentityAvatar({ avatarUrl, name }: Readonly<{ avatarUrl?: string; name: string }>) {
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt=""
      className="h-9 w-9 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#9A9A9A] font-black text-white">
      {name[0]}
    </span>
  );
}

export function UserSidebar({
  desktopOpen,
  mobileOpen,
  onCloseMobile,
  pathname,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pages, setPages] = useState<BeaconPage[]>([]);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [activePageProfile, setActivePageProfile] = useState<SocialProfile | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ownerId = sessionStorage.get()?.user.publicId;

  useEffect(() => {
    setActiveId(sessionStorage.getActingPublicId());
  }, [pathname]);

  useEffect(() => {
    if ((!desktopOpen && !mobileOpen) || !ownerId) return;
    let active = true;
    void getSocialProfile(ownerId)
      .then((person) => {
        if (active) setProfile(person);
      })
      .catch(() => undefined);
    void listBeaconPages()
      .then((items) => {
        if (active) setPages(items);
      })
      .catch((error) => {
        if (active)
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not load your pages.",
          );
      });
    return () => {
      active = false;
    };
  }, [desktopOpen, mobileOpen, ownerId]);

  useEffect(() => {
    if ((!desktopOpen && !mobileOpen) || !activeId || activeId === ownerId) return;
    let active = true;
    void getSocialProfile(activeId)
      .then((pageProfile) => {
        if (active) setActivePageProfile(pageProfile);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [activeId, desktopOpen, mobileOpen, ownerId]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const switchTo = (id: string, name: string) => {
    if (activeId !== id) sessionStorage.setActingPublicId(id);
    setActiveId(id);
    onCloseMobile();
    toast.success(`You are now interacting as ${name}`);
    router.push("/social");
    router.refresh();
  };

  const create = () => {
    onCloseMobile();
    router.push("/beacons/new");
  };

  const actingAsPage = !!ownerId && !!activeId && activeId !== ownerId;
  const activePage = pages.find((page) => page.publicId === activeId);
  const pageProfile = activePageProfile?.publicId === activeId ? activePageProfile : null;
  const personalName = profile?.displayName || ownerId?.slice(0, 8) || "G";
  const activeName = actingAsPage
    ? pageProfile?.displayName || activePage?.displayName || "Untitled beacon"
    : personalName;
  const activeAvatarUrl = actingAsPage ? pageProfile?.avatarUrl : profile?.avatarUrl;

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onCloseMobile}
        data-open={mobileOpen}
        className="user-sidebar-backdrop absolute inset-x-0 bottom-0 top-14 z-40 bg-black/40 lg:hidden"
      />
      <aside
        id="user-navigation"
        aria-label="Main navigation"
        data-mobile-open={mobileOpen}
        data-desktop-open={desktopOpen}
        className="user-sidebar absolute bottom-0 left-0 top-14 z-50 flex w-[min(85vw,280px)] shrink-0 flex-col overflow-hidden border-r border-black/10 bg-white/95 text-[#444b56] shadow-xl dark:border-white/10 dark:bg-night-header dark:text-night-text lg:relative lg:inset-auto lg:z-auto lg:shadow-none"
      >
        <div className="flex min-h-0 w-[min(85vw,280px)] flex-1 flex-col overflow-y-auto px-3 py-5 lg:w-56">
          {/* <div className="flex items-center justify-between px-3 pb-3">
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-black/35 dark:text-night-muted">
              {" "}
            </p>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={onCloseMobile}
              className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10 lg:hidden"
            >
              <X size={19} />
            </button>
          </div> */}
          <button
            type="button"
            onClick={create}
            className=" w-full rounded-xl bg-[#C62828] px-3 py-2 text-xs font-black text-white "
          >
            BUILD YOUR BEACON
          </button>
          {ownerId && (
            <div className="my-5 rounded-2xl border border-black/10 bg-[#f5f6f8] p-2 dark:border-white/10 dark:bg-night-surface">
              <div className="flex items-center">
                <Link
                  href={`/users/${actingAsPage ? activeId : ownerId}`}
                  onClick={onCloseMobile}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <IdentityAvatar avatarUrl={activeAvatarUrl} name={activeName} />
                  <span className="truncate text-xs font-black">
                    {activeName}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label="Show profiles"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <ChevronDown
                    size={18}
                    className={
                      expanded
                        ? "rotate-180 transition-transform"
                        : "transition-transform"
                    }
                  />
                </button>
              </div>
              {expanded && (
                <div className="mt-2 space-y-1 border-t border-black/10 pt-2 dark:border-white/10">
                  {actingAsPage && (
                    <div className="flex items-center rounded-xl bg-white dark:bg-night-raised">
                      <Link
                        href={`/users/${ownerId}`}
                        onClick={onCloseMobile}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-xs font-bold"
                      >
                        <IdentityAvatar avatarUrl={profile?.avatarUrl} name={personalName} />
                        <span className="truncate">{personalName}</span>
                      </Link>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={false}
                        aria-label={`Switch to ${personalName}`}
                        onClick={() => switchTo(ownerId, personalName)}
                        className="flex h-9 w-10 shrink-0 items-center justify-center border-l border-black/10 text-lg hover:text-[#C62828] dark:border-white/15"
                      >
                        ⇄
                      </button>
                    </div>
                  )}
                  {pages.filter((page) => page.publicId !== activeId).map((page) => (
                    <div
                      key={page.publicId}
                      className="flex items-center rounded-xl bg-white dark:bg-night-raised"
                    >
                      <Link
                        href={`/users/${page.publicId}`}
                        onClick={onCloseMobile}
                        className="min-w-0 flex-1 truncate px-3 py-2 text-xs font-bold"
                      >
                        {page.displayName || "Untitled beacon"}
                      </Link>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activeId === page.publicId}
                        aria-label={`Switch to ${page.displayName || "page"}`}
                        onClick={() =>
                          switchTo(
                            page.publicId,
                            page.displayName || "Untitled page",
                          )
                        }
                        className="flex h-9 w-10 shrink-0 items-center justify-center border-l border-black/10 text-lg hover:text-[#C62828] dark:border-white/15"
                      >
                        ⇄{activeId === page.publicId && <Check size={12} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between px-3 pb-3">
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-black/35 dark:text-night-muted">
              Navigation
            </p>
            {/* <button type="button" aria-label="Close navigation" onClick={onCloseMobile} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10 lg:hidden"><X size={19} /></button> */}
          </div>
          <nav aria-label="Pages" className="space-y-1.5">
            {links.map(({ href, label, Icon }) => {
              const active =
                pathname === href ||
                pathname.startsWith(href + "/") ||
                (href === "/social" && pathname.startsWith("/posts/social/")) ||
                (href === "/market" && pathname.startsWith("/posts/market/")) ||
                (href === "/profile" &&
                  (pathname.startsWith("/users/") ||
                    pathname.startsWith("/beacons/")));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={onCloseMobile}
                  className={`flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-extrabold transition-colors ${active ? "bg-[#C62828] text-white shadow-[0_8px_20px_rgba(198,40,40,.2)]" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
                >
                  <Icon size={20} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <p className="mt-auto border-t border-black/10 px-3 pt-5 text-xs leading-5 text-black/45 dark:border-white/10 dark:text-night-muted">
            Make a place for your ideas, then share them with your people.
          </p>
        </div>
      </aside>
    </>
  );
}
