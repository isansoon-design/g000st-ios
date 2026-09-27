"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

type PostImageProps = {
  src: string;
  className?: string;
};

export function PostImage({ src, className = "" }: PostImageProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Enlarge image"
        className="block w-full cursor-zoom-in overflow-hidden bg-black/5 text-left"
        onClick={() => setOpen(true)}
      >
        <img src={src} alt="" className={className} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged image"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-10"
          onClick={() => setOpen(false)}
        >
          <img
            src={src}
            alt="Enlarged post image"
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            autoFocus
            aria-label="Close image"
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            onClick={() => setOpen(false)}
          >
            <X size={24} />
          </button>
        </div>
      )}
    </>
  );
}
