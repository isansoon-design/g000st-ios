"use client";

import {
  Check,
  Globe2,
  IdCard,
  MessageCircle,
  ShoppingBag,
  Smartphone,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { listBeaconPages, subscribeToBeaconPageCreated, type BeaconPage } from "@/app/api/auth";
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
  const [pages, setPages] = useState<BeaconPage[]>([]);
  const pagesRevision = useRef(0);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [activePageProfile, setActivePageProfile] = useState<SocialProfile | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ownerId = sessionStorage.get()?.user.publicId;

  useEffect(() => {
    if (!ownerId) return;
    return subscribeToBeaconPageCreated((page) => {
      pagesRevision.current += 1;
      setPages((items) => [page, ...items.filter((item) => item.publicId !== page.publicId)]);
    });
  }, [ownerId]);

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
    const revision = pagesRevision.current;
    void listBeaconPages()
      .then((items) => {
        // A list requested before creation must not remove the new page.
        if (active && revision === pagesRevision.current) setPages(items);
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

  const personalName = profile?.displayName || ownerId?.slice(0, 8) || "G";
  const identities = ownerId
    ? [
        { publicId: ownerId, displayName: personalName, avatarUrl: profile?.avatarUrl },
        ...pages.map((page) => ({
          publicId: page.publicId,
          displayName: (activePageProfile?.publicId === page.publicId
            ? activePageProfile.displayName
            : page.displayName) || "Untitled beacon",
          avatarUrl: activePageProfile?.publicId === page.publicId
            ? activePageProfile.avatarUrl
            : undefined,
        })),
      ]
    : [];

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
            <ul aria-label="Your profiles and pages" className="my-5 space-y-2 rounded-2xl border border-black/10 bg-[#f5f6f8] p-2 dark:border-white/10 dark:bg-night-surface">
              {identities.map((identity) => {
                const selected = (activeId ?? ownerId) === identity.publicId;
                return (
                  <li
                    key={identity.publicId}
                    className={`flex items-center rounded-xl border-2 bg-white dark:bg-night-raised ${selected ? "border-[#C62828]" : "border-transparent"}`}
                  >
                    <Link
                      href={`/users/${identity.publicId}`}
                      onClick={onCloseMobile}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-xs font-bold"
                    >
                      <IdentityAvatar avatarUrl={identity.avatarUrl} name={identity.displayName} />
                      <span className="truncate">{identity.displayName}</span>
                    </Link>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={selected}
                      aria-label={selected ? `Interacting as ${identity.displayName}` : `Switch to ${identity.displayName}`}
                      onClick={() => switchTo(identity.publicId, identity.displayName)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center border-l border-black/10 text-lg hover:text-[#C62828] dark:border-white/15"
                    >
                      {selected ? <Check size={20} className="text-[#C62828]" aria-hidden="true" /> : "⇄"}
                    </button>
                  </li>
                );
              })}
            </ul>
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
