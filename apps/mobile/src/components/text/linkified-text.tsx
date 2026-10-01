import { Linking, Text, type TextProps } from "react-native";
import Toast from "react-native-toast-message";

import { splitTextLinks } from "@/utils/text-links";

export function LinkifiedText({ content, ...props }: TextProps & Readonly<{ content: string }>) {
  return (
    <Text {...props}>
      {splitTextLinks(content).map((part, index) => part.href ? (
        <Text
          key={index}
          accessibilityRole="link"
          accessibilityLabel={part.text}
          style={{ color: "#3B82F6", textDecorationLine: "underline" }}
          onPress={(event) => {
            event.stopPropagation();
            void Linking.openURL(part.href!).catch(() => {
              Toast.show({ type: "error", text1: "Could not open link" });
            });
          }}
        >
          {part.text}
        </Text>
      ) : part.text)}
    </Text>
  );
}
