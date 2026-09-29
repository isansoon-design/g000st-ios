import { createContext, use, useRef, type PropsWithChildren } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

type TabBarScrollContextValue = {
  offset: SharedValue<number>;
  setBarHeight: (height: number) => void;
  setVisible: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};
const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(
  null,
);

export function TabBarScrollProvider({ children }: PropsWithChildren) {
  const offset = useSharedValue(0);
  const barHeight = useRef(90);
  const lastY = useRef(0);
  const desiredOffset = useRef(0);
  const setBarHeight = (height: number) => {
    if (height <= 0) return;
    const nextHeight = Math.ceil(height) + 2;
    if (nextHeight === barHeight.current) return;
    const wasHidden = desiredOffset.current >= barHeight.current;
    barHeight.current = nextHeight;
    if (wasHidden) {
      desiredOffset.current = barHeight.current;
      offset.value = withTiming(barHeight.current, { duration: 120 });
    }
  };
  const setVisible = () => {
    lastY.current = 0;
    desiredOffset.current = 0;
    offset.value = withTiming(0, { duration: 220 });
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = y - lastY.current;
    lastY.current = y;
    if (y <= 0) {
      desiredOffset.current = 0;
      offset.value = withTiming(0, { duration: 180 });
    } else if (Math.abs(delta) > 0.5) {
      desiredOffset.current = Math.max(
        0,
        Math.min(barHeight.current, desiredOffset.current + delta),
      );
      offset.value = withTiming(desiredOffset.current, { duration: 120 });
    }
  };
  return (
    <TabBarScrollContext value={{ offset, setBarHeight, setVisible, onScroll }}>
      {children}
    </TabBarScrollContext>
  );
}

export function useTabBarScroll() {
  return use(TabBarScrollContext);
}
