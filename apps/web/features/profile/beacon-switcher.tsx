"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { listBeaconPages, type BeaconPage } from "@/app/api/auth";
import { sessionStorage } from "@/app/api/session-storage";

export function BeaconSwitcher() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const ownerId = sessionStorage.get()?.user.publicId;
  const activeId = sessionStorage.getActingPublicId();
  const personalSelected = !!ownerId && activeId === ownerId;
  const [pages, setPages] = useState<BeaconPage[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    let mounted = true;
    void listBeaconPages()
      .then((items) => {
        if (!mounted) return;
        setPages(items);
        if (
          activeId &&
          activeId !== ownerId &&
          !items.some((page) => page.publicId === activeId) &&
          ownerId
        ) {
          sessionStorage.setActingPublicId(ownerId);
          window.location.reload();
        }
      })
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : "Could not load pages.",
        ),
      );
    return () => {
      mounted = false;
    };
  }, [activeId, ownerId]);

  if (!mounted) return null;
  return (
    <section className="mb-4 w-full rounded-[18px] border border-white/60 dark:border-white/20 bg-[#D0D0D0] dark:bg-night-header p-4">
      <div className="mb-2 text-[10px] font-black uppercase tracking-[1px] text-black/45 dark:text-night-muted">
        Your profiles
      </div>
      {ownerId && (
        <div
          className={`mb-2 flex w-full items-stretch rounded-xl ${personalSelected ? "bg-[#17191d] text-white" : "bg-white dark:bg-night-surface text-[#17191d] dark:text-night-text"}`}
        >
          <button
            type="button"
            onClick={() => router.push(`/users/${ownerId}`)}
            className="min-w-0 flex-1 rounded-l-xl px-4 py-3 text-left hover:opacity-75"
          >
            <span className="block font-black">My personal profile</span>
            <span className="block text-xs opacity-60">
              {ownerId.slice(0, 8)} · View profile
            </span>
          </button>
        </div>
      )}
      {pages.map((page) => {
        const selected = activeId === page.publicId;
        return (
          <div
            key={page.publicId}
            className={`mb-2 flex w-full items-stretch rounded-xl ${selected ? "bg-[#17191d] text-white" : "bg-white dark:bg-night-surface text-[#17191d] dark:text-night-text"}`}
          >
            <button
              type="button"
              onClick={() => router.push(`/users/${page.publicId}`)}
              className="min-w-0 flex-1 rounded-l-xl px-4 py-3 text-left hover:opacity-75"
            >
              <span className="block break-words font-black">
                {page.displayName || "Untitled beacon"}
              </span>
              <span className="block text-xs opacity-60">
                {page.publicId.slice(0, 8)} · View page
              </span>
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => router.push('/beacons/new')}
        className="mt-1 w-full rounded-xl bg-[#C62828] px-4 py-3 text-sm font-black text-white"
      >
        BUILD YOUR BEACON
      </button>
    </section>
  );
}
