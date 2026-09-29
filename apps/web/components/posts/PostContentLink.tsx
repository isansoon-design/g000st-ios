"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

type Props = {
  content: string;
  href?: string;
  className?: string;
};

export function PostContentLink({ content, href, className = "" }: Props) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function stopTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(content);
        } catch {
          copyWithSelection(content);
        }
      } else {
        copyWithSelection(content);
      }
      toast.success("Post text copied");
    } catch {
      toast.error("Could not copy post text");
    }
  }

  return (
    <button
      type="button"
      className={`block w-full whitespace-pre-wrap text-left ${href ? "cursor-pointer" : "cursor-text"} ${className}`}
      aria-label={content}
      title={href ? "Open post · long press to copy" : "Long press to copy"}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        longPressed.current = false;
        stopTimer();
        timer.current = setTimeout(() => {
          longPressed.current = true;
          void copy();
        }, 500);
      }}
      onPointerUp={stopTimer}
      onPointerCancel={stopTimer}
      onPointerLeave={stopTimer}
      onContextMenu={(event) => {
        event.preventDefault();
        stopTimer();
        if (!longPressed.current) {
          longPressed.current = true;
          void copy();
        }
      }}
      onKeyDown={() => { longPressed.current = false; }}
      onClick={(event) => {
        if (longPressed.current) {
          event.preventDefault();
          return;
        }
        if (href) router.push(href);
      }}
    >
      {content}
    </button>
  );
}

function copyWithSelection(content: string) {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const field = document.createElement("textarea");
  field.value = content;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  previous?.focus();
  if (!copied) throw new Error("Copy failed");
}
