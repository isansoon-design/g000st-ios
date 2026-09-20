import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';

import { TabIcon, type TabIconName } from '@/components/navigation/tab-icon';

const ACTIVE_COLOR = '#9A9A9A';
const INACTIVE_COLOR = 'rgba(0,0,0,0.45)';
const INDICATOR_WIDTH = 42;

/** حساب الأنيميشن لكل تاب منفرد */
function AnimatedTab({
  focused,
  label,
  icon,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(focused ? 1.08 : 1);
  const translateY = useSharedValue(focused ? -2 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.08 : 1, { damping: 14, stiffness: 180 });
    translateY.value = withSpring(focused ? -2 : 0, { damping: 14, stiffness: 180 });
  }, [focused, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
      hitSlop={8}
    >
      <Animated.View style={[styles.tabInner, animatedStyle]}>
        {icon}
        <Text numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** شريط التابات المخصص مع أنيميشن المؤشر والضغط */
export default function AnimatedTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(Dimensions.get('window').width);
  const indicatorX = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);
  const indicatorReady = useRef(false);
  const screenWidth = Dimensions.get('window').width;

  const slotCount = state.routes.length;

  /** مركز أي خانة بناءً على فهرسها ضمن الشريط */
  const slotCenterX = (index: number) => (barWidth / slotCount) * (index + 0.5);

  useEffect(() => {
    const activeIndex = state.index;
    const center = slotCenterX(activeIndex);

    indicatorX.value = indicatorReady.current
      ? withSpring(center, { damping: 16, stiffness: 160 })
      : center;
    indicatorOpacity.value = withTiming(1, { duration: 200 });
    indicatorReady.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, barWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [{ translateX: indicatorX.value - INDICATOR_WIDTH / 2 }],
  }));

  return (
    <View
      style={[styles.container, { paddingBottom: insets.bottom }]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {/* المؤشر المتحرك في أعلى الشريط */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />

      <View style={styles.row}>
        {state.routes.map((route: any, index: any) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label =
            typeof options.title === 'string'
              ? options.title
              : route.name.toUpperCase();

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <AnimatedTab
              key={route.key}
              focused={focused}
              label={label}
              onPress={onPress}
              onLongPress={onLongPress}
              icon={
                <TabIcon
                  color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
                  name={route.name as TabIconName}
                />
              }
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopColor: '#BBBBBB',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.35,
    color: ACTIVE_COLOR,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: INDICATOR_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACTIVE_COLOR,
    zIndex: 5,
  },
});

