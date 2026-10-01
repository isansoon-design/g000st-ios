import { useRef } from "react";
import { Pressable } from "react-native";
import Toast from "react-native-toast-message";

import { copyText } from "@/services/device/clipboard";

import { LinkifiedText } from "@/components/text/linkified-text";

type Props = {
  content: string;
  onOpen?: () => void;
  className?: string;
  numberOfLines?: number;
};

export function PostContentText({
  content,
  onOpen,
  className,
  numberOfLines,
}: Props) {
  const longPressed = useRef(false);
  return (
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
        content={content}
        numberOfLines={numberOfLines}
        className={
          className ??
          "text-[15px] leading-6 text-g000st-black dark:text-night-text"
        }
      />
    </Pressable>
  );
}
