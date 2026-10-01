import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Switch, Text, View } from 'react-native';
import axios from '@/api/axios';
import { getNotificationPreferences, markNotificationsRead, saveNotificationPreferences, type NotificationCategory, type NotificationItemV1, type NotificationScope } from '@/api/notification-center';
import { FeatureScreen } from '@/components/layout/feature-screen';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useNotifications } from '@/features/notifications/use-notifications';
import { openNotificationPath } from '@/features/notifications/notification-navigation';
import { useAppTheme } from '@/theme/app-theme';

export default function NotificationsScreen() {
  const { activePublicId, user } = useAuth();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ scope?: string }>();
  const [scope, setScope] = useState<NotificationScope>(params.scope === 'admin' && user?.role === 'admin' ? 'admin' : 'user');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const notifications = useNotifications(scope);
  const categories: { value: NotificationCategory; label: string }[] = scope === 'admin'
    ? [{ value: 'reports', label: 'Reports' }, { value: 'support', label: 'Support' }]
    : [{ value: 'social', label: 'Social activity' }, { value: 'market', label: 'Market activity' }, { value: 'messages', label: 'Private messages' }, { value: 'administration', label: 'Administration' }, { value: 'support', label: 'Support replies' }, { value: 'billing', label: 'Balance and purchases' }, { value: 'reports', label: 'Report results' }];
  const preferences = useQuery({ queryKey: ['notification-preferences', activePublicId, scope], queryFn: () => getNotificationPreferences(scope) });
  const items = [...new Map((notifications.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [item.id, item])).values()];
  const updateRead = async (ids: readonly string[]) => {
    await markNotificationsRead(ids, scope);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };
  const open = async (item: NotificationItemV1) => {
    setSaving(true); setError(false);
    try {
      if (item.readAtMs === null) await updateRead([item.id]);
      const noticeId = /^\/notifications\?noticeId=([a-f0-9-]{36})$/.exec(item.path)?.[1];
      if (noticeId) {
        const { data } = await axios.get<{ version: 1; notice: { text: string } }>(`/communication/notices/${noticeId}`);
        setNotice(data.notice.text);
      } else if (scope === 'admin') setNotice('Review this case in the web admin dashboard.');
      else if (item.path.startsWith('/notifications')) setNotice(item.body);
      else openNotificationPath(item.path);
    } catch { setError(true); }
    finally { setSaving(false); }
  };
  return <FeatureScreen title="Notifications" rightAction={<Pressable accessibilityLabel="Go back" onPress={() => router.back()} className="p-2"><Text style={{ color: colors.text }}>Back</Text></Pressable>}>
    <FlatList data={items} keyExtractor={(item) => item.id} refreshing={notifications.isRefetching} onRefresh={() => void notifications.refetch()} contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={<View className="mb-3 gap-3">
        {user?.role === 'admin' && <View className="flex-row gap-3">{(['user', 'admin'] as const).map((value) => <Pressable key={value} onPress={() => { setScope(value); setNotice(null); }} className="rounded-lg border border-black/15 px-4 py-2"><Text style={{ color: colors.text, fontWeight: scope === value ? '800' : '400' }}>{value === 'admin' ? 'Admin' : 'My notifications'}</Text></Pressable>)}</View>}
        {preferences.data && <View className="flex-row items-center justify-between"><Text style={{ color: colors.text }}>Push notifications</Text><Switch accessibilityLabel="Push notifications" value={preferences.data.pushEnabled} disabled={saving} onValueChange={async (pushEnabled) => { setSaving(true); try { await saveNotificationPreferences({ ...preferences.data!, pushEnabled }, scope); await preferences.refetch(); } catch { setError(true); } finally { setSaving(false); } }} /></View>}
        {preferences.data && categories.map(({ value, label }) => <View key={value} className="flex-row items-center justify-between"><Text style={{ color: colors.text }}>{label}</Text><Switch accessibilityLabel={label} value={!preferences.data!.mutedCategories.includes(value)} disabled={saving || !preferences.data!.pushEnabled} onValueChange={async (enabled) => {
          const next = { ...preferences.data!, mutedCategories: enabled ? preferences.data!.mutedCategories.filter((category) => category !== value) : [...preferences.data!.mutedCategories, value] };
          setSaving(true); try { await saveNotificationPreferences(next, scope); await preferences.refetch(); } catch { setError(true); } finally { setSaving(false); }
        }} /></View>)}
        {(error || notifications.isError || preferences.isError) && <Pressable onPress={() => { setError(false); void notifications.refetch(); void preferences.refetch(); }}><Text accessibilityRole="alert" style={{ color: colors.text }}>Could not update notifications. Tap to retry.</Text></Pressable>}
        {notice && <Pressable onPress={() => setNotice(null)} className="rounded-xl border border-black/15 p-4"><Text style={{ color: colors.text }}>{notice}</Text><Text className="mt-2 text-xs" style={{ color: colors.muted }}>Tap to close</Text></Pressable>}
        {items.some((item) => item.readAtMs === null) && <Pressable disabled={saving} onPress={async () => { setSaving(true); try { await updateRead(items.filter((item) => item.readAtMs === null).slice(0, 100).map((item) => item.id)); } catch { setError(true); } finally { setSaving(false); } }}><Text className="text-sm font-bold" style={{ color: colors.text }}>Mark displayed notifications as read</Text></Pressable>}
      </View>}
      ListEmptyComponent={notifications.isPending ? <ActivityIndicator color={colors.text} /> : !notifications.isError ? <Text className="p-6 text-center" style={{ color: colors.muted }}>You’re all caught up.</Text> : null}
      renderItem={({ item }) => <Pressable disabled={saving} onPress={() => void open(item)} accessibilityLabel={`${item.readAtMs === null ? 'Unread. ' : ''}${item.title}. ${item.body}`} className="mb-2 rounded-xl border p-4" style={{ backgroundColor: colors.card, borderColor: item.readAtMs === null ? colors.accent : colors.border }}><Text className="font-bold" style={{ color: colors.text }}>{item.title}</Text><Text className="mt-1 text-sm" style={{ color: colors.text }}>{item.body}</Text><Text className="mt-2 text-xs" style={{ color: colors.muted }}>{new Date(item.createdAtMs).toLocaleString()}</Text></Pressable>}
      ListFooterComponent={notifications.hasNextPage ? <Pressable disabled={notifications.isFetchingNextPage} onPress={() => void notifications.fetchNextPage()} className="p-4"><Text className="text-center" style={{ color: colors.text }}>{notifications.isFetchingNextPage ? 'Loading…' : 'Load more'}</Text></Pressable> : null}
    />
  </FeatureScreen>;
}
