import { AppThemeSwitch } from '@/components/navigation/app-theme-switch';
import { useOpenAppSidebar } from '@/components/navigation/app-sidebar';
import { useAppTheme } from '@/theme/app-theme';
import { type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FeatureScreenProps = PropsWithChildren<
  Readonly<{
    rightAction?: ReactNode;
    title: ReactNode;
    colors?: Readonly<{ canvas: string; header: string; text: string }>;
    showThemeSwitch?: boolean;
  }>
>;

export function FeatureScreen({ children, rightAction, title, colors, showThemeSwitch = true }: FeatureScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const openSidebar = useOpenAppSidebar();
  const screenColors = colors ?? theme.colors;

  return (
    <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: screenColors.canvas }}>
      <View className="h-14 flex-row items-center justify-between border-b border-black/15 dark:border-night-border px-3 pt-1" style={{ backgroundColor: screenColors.header }}>
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
        {openSidebar && <Pressable accessibilityRole="button" accessibilityLabel="Open navigation" onPress={openSidebar} className="h-10 w-9 items-center justify-center"><Text className="text-2xl" style={{ color: screenColors.text }}>☰</Text></Pressable>}
        {typeof title === 'string' ? (
          <Text className="text-[15px] font-black" style={{ color: screenColors.text }}>{title}</Text>
        ) : (
          title
        )}
        </View>
        <View className="flex-row items-center gap-1">
          {showThemeSwitch && <AppThemeSwitch />}
          {rightAction}
        </View>
      </View>
      {children}
    </View>
  );
}
