"use client";

import { splitTextLinks } from "@/lib/text-links";

export function LinkifiedText({ content }: Readonly<{ content: string }>) {
  return splitTextLinks(content).map((part, index) => part.href ? (
    <a
      key={index}
      href={part.href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-words text-[#2563EB] underline dark:text-[#60A5FA]"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      {part.text}
    </a>
  ) : part.text);
}
