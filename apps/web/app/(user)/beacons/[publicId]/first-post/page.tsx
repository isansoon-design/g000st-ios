"use client";

import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSocialProfile, type SocialProfile } from "@/app/api/social";
import { ProfilePostComposer } from "@/features/profile/profile-post-composer";

export default function FirstBeaconPostPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<SocialProfile>();
  const [profileError, setProfileError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void getSocialProfile(publicId)
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch((reason) => {
        if (active)
          setProfileError(
            reason instanceof Error
              ? reason.message
              : "Could not load your beacon.",
          );
      });
    return () => {
      active = false;
    };
  }, [publicId, loadAttempt]);

  return (
    <main className="h-full overflow-y-auto bg-[#e6e8eb] px-4 py-8 text-[#17191d] dark:bg-[#29282d] dark:text-night-text sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/users/${publicId}`}
          className="inline-flex items-center gap-2 text-xs font-black text-black/50 hover:text-[#C62828] dark:text-night-muted"
        >
          <ArrowLeft size={16} /> View beacon
        </Link>
        <div className="mt-6 overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_18px_55px_rgba(24,30,44,.1)] dark:border-white/10 dark:bg-night-surface">
          <div className="bg-[#171d29] px-6 py-10 text-white sm:px-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em]">
              <Sparkles size={13} /> Your beacon is live
            </span>
            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Share your first post
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
              Give people a reason to visit{" "}
              {profile?.displayName || "your beacon"}. You can post to your page
              or share it on g000st Social.
            </p>
          </div>
          <div className="p-4 sm:p-7">
            {profileError ? (
              <div
                role="alert"
                className="rounded-2xl bg-red-50 p-5 text-sm text-[#a21e1e] dark:bg-night-softred dark:text-red-200"
              >
                {profileError}
                <button
                  type="button"
                  onClick={() => {
                    setProfileError("");
                    setLoadAttempt((attempt) => attempt + 1);
                  }}
                  className="ml-3 font-black underline"
                >
                  Retry
                </button>
              </div>
            ) : profile ? (
              <ProfilePostComposer
                publicId={publicId}
                isPage
                pageNamed={!!profile.displayName?.trim()}
                onPublished={() => router.replace(`/users/${publicId}`)}
              />
            ) : (
              <p className="rounded-2xl bg-white p-5 text-sm dark:bg-night-raised">
                Loading your beacon…
              </p>
            )}
            <Link
              href={`/users/${publicId}`}
              className="mt-5 inline-flex items-center gap-2 text-xs font-black text-black/50 hover:text-[#C62828] dark:text-night-muted"
            >
              Go to your page <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
