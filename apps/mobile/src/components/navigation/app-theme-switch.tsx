import { Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useAppTheme } from '@/theme/app-theme';

export function AppThemeSwitch() {
  const { isDark, setMode } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel="Dark mode"
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      hitSlop={6}
      onPress={() => setMode(isDark ? 'light' : 'dark')}
      style={{ alignItems: 'center', justifyContent: 'center', height: 44, width: 68 }}
    >
      <View
        style={{
          backgroundColor: isDark ? '#29282E' : '#ECEBED',
          borderColor: isDark ? '#B5B2B9' : '#AAA7AD',
          borderRadius: 17,
          borderWidth: 1,
          height: 34,
          justifyContent: 'center',
          width: 64,
        }}
      >
        <View
          style={{
            backgroundColor: isDark ? '#111111' : '#FFFFFF',
            borderRadius: 14,
            elevation: 2,
            height: 28,
            left: isDark ? 33 : 2,
            position: 'absolute',
            shadowColor: '#000000',
            shadowOpacity: 0.18,
            shadowRadius: 2,
            top: 2,
            width: 28,
          }}
        />
        <View pointerEvents="none" style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-around' }}>
          <Svg width={20} height={20} viewBox="0 0 20 20" accessibilityElementsHidden>
            <Circle cx={10} cy={10} r={3.4} fill="none" stroke={isDark ? '#A6A2AC' : '#C78014'} strokeWidth={1.8} />
            <Path d="M10 1.5v2 M10 16.5v2 M1.5 10h2 M16.5 10h2 M4 4l1.5 1.5 M14.5 14.5L16 16 M16 4l-1.5 1.5 M5.5 14.5L4 16" fill="none" stroke={isDark ? '#A6A2AC' : '#C78014'} strokeLinecap="round" strokeWidth={1.5} />
          </Svg>
          <Svg width={20} height={20} viewBox="0 0 20 20" accessibilityElementsHidden>
            <Path d="M16.6 12.8A7.3 7.3 0 0 1 7.2 3.4 7.4 7.4 0 1 0 16.6 12.8Z" fill={isDark ? '#F4F2F5' : '#77727D'} />
          </Svg>
        </View>
      </View>
    </Pressable>
  );
}
