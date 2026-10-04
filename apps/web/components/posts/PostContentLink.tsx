"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

import { LinkifiedText } from "@/components/text/LinkifiedText";

import type { SocialLinkPreviewV1 } from "@/app/api/social";
import { LinkPreviewCard } from "./LinkPreviewCard";

type Props = {
  linkPreview?: SocialLinkPreviewV1;
  content: string;
  href?: string;
  className?: string;
};

export function PostContentLink({ content, href, linkPreview, className = "" }: Props) {
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
    <>
    <div
      role={href ? "button" : undefined}
      tabIndex={href ? 0 : undefined}
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
      onKeyDown={(event) => {
        longPressed.current = false;
        if (href && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          router.push(href);
        }
      }}
      onClick={(event) => {
        if (longPressed.current) {
          event.preventDefault();
          return;
        }
        if (href) router.push(href);
      }}
    >
      <LinkifiedText content={linkPreview && content.endsWith(linkPreview.url) ? content.slice(0, -linkPreview.url.length).trimEnd() : content} />
    </div>
    {linkPreview && <LinkPreviewCard preview={linkPreview} />}
    </>
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
