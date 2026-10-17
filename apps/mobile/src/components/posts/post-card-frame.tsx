import type { ReactNode } from "react";
import { View } from "react-native";

const OFFSET_X = 5;
const OFFSET_Y = 6;

type PostCardFrameProps = {
  isPage?: boolean;
  children: ReactNode;
};

/**
 * Hard offset shadow matching the web post card: red for pages, black for
 * regular users. Drawn as an underlay because RN shadowColor is soft on iOS
 * and ignored on Android.
 */
export function PostCardFrame({ isPage, children }: PostCardFrameProps) {
  return (
    <View style={{ marginRight: OFFSET_X, marginBottom: OFFSET_Y }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: OFFSET_Y,
          left: OFFSET_X,
          right: -OFFSET_X,
          bottom: -OFFSET_Y,
          borderRadius: 16,
          backgroundColor: isPage ? "#c62828" : "#111111",
        }}
      />
      <View className="overflow-hidden rounded-2xl border-2 border-black dark:border-night-border bg-white dark:bg-night-surface">
        {children}
      </View>
    </View>
  );
}
