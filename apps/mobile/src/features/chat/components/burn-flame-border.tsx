import { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const INSET = 12;
const FLAME_POSITIONS = [0.17, 0.37, 0.61, 0.83] as const;

type BurnFlameBorderProps = Readonly<{
  width: number;
  height: number;
  burning: boolean;
}>;

function BurnFlameBorderComponent({ width, height, burning }: BurnFlameBorderProps) {
  const rise = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    rise.value = withRepeat(
      withTiming(1, { duration: burning ? 500 : 950, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    );
    drift.value = withRepeat(
      withTiming(1, { duration: burning ? 720 : 1250, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    );
    return () => {
      cancelAnimation(rise);
      cancelAnimation(drift);
    };
  }, [burning, rise, drift]);

  const rimStyle = useAnimatedStyle(() => ({
    opacity: (burning ? 0.7 : 0.48) + rise.value * 0.28,
  }));
  const risingFlamesStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + rise.value * 0.45,
    transform: [{ translateY: -4 * rise.value }],
  }));
  const driftingFlamesStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + drift.value * 0.45,
    transform: [{ translateY: 3 * drift.value }],
  }));

  const svgWidth = width + INSET * 2;
  const svgHeight = height + INSET * 2;
  const frameStyle = {
    position: 'absolute' as const,
    left: -INSET,
    top: -INSET,
    width: svgWidth,
    height: svgHeight,
  };

  return (
    <>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={frameStyle}>
        <Svg width={svgWidth} height={svgHeight}>
          <Rect x={INSET} y={INSET} width={width} height={height} rx={18} fill="none" stroke="#AA1F07" strokeWidth={11} opacity={burning ? 0.34 : 0.2} />
          <Rect x={INSET} y={INSET} width={width} height={height} rx={18} fill="none" stroke="#F0440C" strokeWidth={6} opacity={burning ? 0.63 : 0.42} />
        </Svg>
      </View>

      <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[frameStyle, rimStyle]}>
        <Svg width={svgWidth} height={svgHeight}>
          <Rect x={INSET} y={INSET} width={width} height={height} rx={18} fill="none" stroke="#FF8B26" strokeWidth={3} />
          <Rect x={INSET} y={INSET} width={width} height={height} rx={18} fill="none" stroke="#FFE19A" strokeWidth={1} opacity={0.88} />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[frameStyle, risingFlamesStyle]}>
        <Svg width={svgWidth} height={svgHeight}>
          {FLAME_POSITIONS.map((position, index) => {
            const x = INSET + width * position;
            const top = INSET;
            const tip = index % 2 === 0 ? 8 : 6;
            return (
              <Path
                key={`top-${index}`}
                d={`M ${x - 7} ${top + 2} C ${x - 4} ${top - 2}, ${x - 2} ${top - 4}, ${x} ${top - tip} C ${x + 2} ${top - 3}, ${x + 5} ${top - 1}, ${x + 7} ${top + 2} Z`}
                fill="#FF5A12"
              />
            );
          })}
          {[0.32, 0.72].map((position, index) => {
            const y = INSET + height * position;
            const left = INSET;
            const tip = index === 0 ? 8 : 6;
            return (
              <Path
                key={`left-${index}`}
                d={`M ${left + 2} ${y - 7} C ${left - 2} ${y - 3}, ${left - 4} ${y - 2}, ${left - tip} ${y} C ${left - 3} ${y + 2}, ${left - 1} ${y + 5}, ${left + 2} ${y + 7} Z`}
                fill="#FF5110"
              />
            );
          })}
          <Circle cx={INSET + width * 0.28} cy={INSET - 6} r={1.2} fill="#FFB94C" />
          <Circle cx={INSET - 8} cy={INSET + height * 0.55} r={1} fill="#FF8B26" />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[frameStyle, driftingFlamesStyle]}>
        <Svg width={svgWidth} height={svgHeight}>
          {FLAME_POSITIONS.map((position, index) => {
            const x = INSET + width * position;
            const bottom = INSET + height;
            const tip = index % 2 === 0 ? 7 : 9;
            return (
              <Path
                key={`bottom-${index}`}
                d={`M ${x - 7} ${bottom - 2} C ${x - 3} ${bottom + 2}, ${x - 2} ${bottom + 4}, ${x} ${bottom + tip} C ${x + 2} ${bottom + 3}, ${x + 5} ${bottom + 1}, ${x + 7} ${bottom - 2} Z`}
                fill="#FF6716"
              />
            );
          })}
          {[0.28, 0.68].map((position, index) => {
            const y = INSET + height * position;
            const right = INSET + width;
            const tip = index === 0 ? 7 : 9;
            return (
              <Path
                key={`right-${index}`}
                d={`M ${right - 2} ${y - 7} C ${right + 2} ${y - 3}, ${right + 4} ${y - 2}, ${right + tip} ${y} C ${right + 3} ${y + 2}, ${right + 1} ${y + 5}, ${right - 2} ${y + 7} Z`}
                fill="#FF5A12"
              />
            );
          })}
          <Circle cx={INSET + width * 0.75} cy={INSET + height + 7} r={1} fill="#FF7A20" />
        </Svg>
      </Animated.View>
    </>
  );
}

export const BurnFlameBorder = memo(BurnFlameBorderComponent);
