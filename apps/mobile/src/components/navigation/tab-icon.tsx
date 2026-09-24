import { memo } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'chat' | 'contacts' | 'identity' | 'market' | 'mobile' | 'social';

type TabIconProps = Readonly<{
  color: ColorValue;
  name: TabIconName;
}>;

function TabIconComponent({ color, name }: TabIconProps) {
  if (name === 'chat') {
    return (
      <Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
        <Path
          d="M7.5 5.5h16a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-6.2L9.5 27v-5.5a4 4 0 0 1-3.5-4v-8a4 4 0 0 1 1.5-4Z"
          fill="#F5F5F5"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={14} r={1.4} fill={color} />
        <Circle cx={17} cy={14} r={1.4} fill={color} />
        <Circle cx={22} cy={14} r={1.4} fill={color} />
      </Svg>
    );
  }

  if (name === 'contacts') {
    return (
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Circle cx={14} cy={9} r={4.5} stroke={color} strokeWidth={2} />
        <Path d="M5.5 24c.7-5.2 3.6-8 8.5-8s7.8 2.8 8.5 8" stroke={color} strokeWidth={2} />
      </Svg>
    );
  }

  if (name === 'identity') {
    return (
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Rect x={3} y={5} width={22} height={18} rx={4} stroke={color} strokeWidth={2} />
        <Circle cx={10} cy={13} r={3} stroke={color} strokeWidth={1.8} />
        <Path
          d="M6.5 19c.5-2.1 1.7-3.2 3.5-3.2s3 1.1 3.5 3.2M16 11h5M16 15h5"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (name === 'social') {
    return (
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Circle cx={14} cy={14} r={10.5} stroke={color} strokeWidth={2} />
        <Circle cx={14} cy={14} r={4} stroke={color} strokeWidth={2} />
        <Path d="M14 3.5v6M14 18.5v6M3.5 14h6M18.5 14h6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'market') {
    return (
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Path d="M5 10h18l-1 14H6L5 10Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        <Path d="M9 11V8a5 5 0 0 1 10 0v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Rect x={7} y={2.5} width={14} height={23} rx={3} stroke={color} strokeWidth={2} />
      <Path d="M11 5.5h6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={14} cy={22} r={1} fill={color} />
    </Svg>
  );
}

export const TabIcon = memo(TabIconComponent);
