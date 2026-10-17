"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import {
  isValidPickedImage,
  MAX_POST_IMAGES,
  type PostMediaDraft,
} from "@/lib/post-media-edit";

export function EditPostMedia({
  draft,
  disabled,
  onChange,
}: {
  draft: PostMediaDraft;
  disabled?: boolean;
  onChange: (draft: PostMediaDraft) => void;
}) {
  const count = draft.kept.length + draft.added.length;
  const remaining = MAX_POST_IMAGES - count;
  return (
    <div className="space-y-2">
      <p className="text-xs font-black uppercase tracking-wider text-black/55 dark:text-night-muted">
        Photos · {count}/{MAX_POST_IMAGES}
      </p>
      {count > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {draft.kept.map((item) => (
            <Thumb
              key={item.id}
              src={item.url}
              label="Remove photo"
              disabled={disabled}
              onRemove={() => onChange({ ...draft, kept: draft.kept.filter((kept) => kept.id !== item.id) })}
            />
          ))}
          {draft.added.map((file, index) => (
            <NewThumb
              key={`${file.name}-${index}`}
              file={file}
              disabled={disabled}
              onRemove={() => onChange({ ...draft, added: draft.added.filter((added) => added !== file) })}
            />
          ))}
        </div>
      )}
      {remaining > 0 && (
        <label
          className={`block cursor-pointer rounded-xl border border-dashed border-black/20 dark:border-night-border px-4 py-3 text-center text-sm font-black ${disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          ＋ Add photo
          <input
            className="hidden"
            type="file"
            multiple={remaining > 1}
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={disabled}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              if (files.length === 0) return;
              if (files.length > remaining || !files.every(isValidPickedImage)) {
                toast.error(`Choose up to ${remaining} image${remaining === 1 ? "" : "s"}, max 5 MB each.`);
                return;
              }
              onChange({ ...draft, added: [...draft.added, ...files] });
            }}
          />
        </label>
      )}
    </div>
  );
}

function NewThumb({ file, disabled, onRemove }: { file: File; disabled?: boolean; onRemove: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return <Thumb src={url} label="Remove new photo" disabled={disabled} onRemove={onRemove} />;
}

function Thumb({ src, label, disabled, onRemove }: { src: string; label: string; disabled?: boolean; onRemove: () => void }) {
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/5 dark:bg-white/10">
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onRemove}
        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-xs text-white"
      >
        ×
      </button>
    </div>
  );
}
