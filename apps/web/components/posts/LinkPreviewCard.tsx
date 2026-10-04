"use client";

import { useState } from "react";
import { ArrowUpRight, Globe2 } from "lucide-react";
import type { SocialLinkPreviewV1 } from "@/app/api/social";

export function LinkPreviewCard({ preview }: { preview: SocialLinkPreviewV1 }) {
  const [failedImage, setFailedImage] = useState<string>();
  const domain = new URL(preview.url).hostname.replace(/^www\./, "");
  return (
    <a href={preview.url} target="_blank" rel="noopener noreferrer" aria-label={`Read ${preview.title} on ${preview.siteName}`}
      className="group mx-4 mb-4 block overflow-hidden rounded-2xl border border-black/10 bg-black/[0.025] transition hover:border-black/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-night-border dark:bg-night-surface">
      {preview.imageUrl && failedImage !== preview.imageUrl && (
        <div className="aspect-[1.91/1] overflow-hidden bg-black/5">
          <img src={preview.imageUrl} alt={preview.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedImage(preview.imageUrl)} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
        </div>
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-3 text-xs text-black/50 dark:text-night-muted">
          <span className="flex min-w-0 items-center gap-2"><Globe2 size={14} className="shrink-0" /><span className="truncate">{preview.siteName} · {domain}</span></span>
          <ArrowUpRight size={16} className="shrink-0" />
        </div>
        <p dir="auto" className="line-clamp-2 text-base font-bold leading-snug text-g000st-black dark:text-night-text">{preview.title}</p>
        {preview.description && <p dir="auto" className="line-clamp-2 text-sm leading-5 text-black/60 dark:text-night-muted">{preview.description}</p>}
      </div>
    </a>
  );
}
