import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme } from '@/theme/app-theme';
import { useNotifications } from './use-notifications';
import { useAuth } from '@/features/auth/hooks/use-auth';

export function NotificationBell() {
  const { user, activePublicId } = useAuth();
  const scope = user?.role === 'admin' && activePublicId === user.publicId ? 'admin' : 'user';
  const notifications = useNotifications(scope);
  const { colors } = useAppTheme();
  const count = notifications.data?.pages[0]?.unreadCount ?? 0;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Notifications${count ? `, ${count} unread` : ''}`} onPress={() => router.push(`/(app)/notifications?scope=${scope}` as Href)} className="relative h-11 w-11 items-center justify-center">
    <Svg width={23} height={23} viewBox="0 0 24 24"><Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke={colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
    {count > 0 && <View className="absolute right-0 top-0 min-w-4 rounded-full bg-[#C62828] px-1"><Text className="text-center text-[10px] font-bold leading-4 text-white">{count > 99 ? '99+' : count}</Text></View>}
  </Pressable>;
}
