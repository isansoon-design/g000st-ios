import { useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import Toast from "react-native-toast-message";

import { copyText } from "@/services/device/clipboard";

import { LinkifiedText } from "@/components/text/linkified-text";

import type { SocialLinkPreviewV1 } from "@/domain/social/types";
import { LinkPreviewCard } from "./link-preview-card";

type Props = {
  linkPreview?: SocialLinkPreviewV1;
  content: string;
  onOpen?: () => void;
  className?: string;
  numberOfLines?: number;
};

export function PostContentText({
  content,
  linkPreview,
  onOpen,
  className,
  numberOfLines,
}: Props) {
  const longPressed = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const caption = linkPreview && content.endsWith(linkPreview.url) ? content.slice(0, -linkPreview.url.length).trimEnd() : content;
  const canExpand = !!linkPreview && caption.length > 320;
  const visibleText = canExpand && !expanded ? `${caption.slice(0, 320).trimEnd()}…` : caption;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={content}
        accessibilityHint={
          onOpen
            ? "Tap to open the post. Long press to copy its text."
            : "Long press to copy the post text."
        }
        delayLongPress={450}
        onPressIn={() => {
          longPressed.current = false;
        }}
        onLongPress={() => {
          longPressed.current = true;
          void copyText(content)
            .then(() => {
              Toast.show({ type: "success", text1: "Post text copied" });
            })
            .catch(() => {
              Toast.show({ type: "error", text1: "Could not copy post text" });
            });
        }}
        onPress={
          onOpen
            ? () => {
              if (!longPressed.current) onOpen();
            }
            : undefined
        }
      >
        <LinkifiedText
          content={visibleText}
          numberOfLines={numberOfLines}
          className={
            className ??
            "text-[15px] leading-6 text-g000st-black dark:text-night-text"
          }
        />
      </Pressable>
      {canExpand && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} className="mx-4 mb-3"><Text className="text-sm font-semibold text-black/60 dark:text-night-muted">{expanded ? "Show less" : "Read more"}</Text></Pressable>}
      {linkPreview && <LinkPreviewCard preview={linkPreview} />}
    </>
  );
}
