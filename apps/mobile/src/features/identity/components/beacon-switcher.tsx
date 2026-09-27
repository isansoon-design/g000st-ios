import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { createBeaconPage, listBeaconPages, type BeaconPage } from '@/api/auth';
import { useAuth } from '@/features/auth/hooks/use-auth';

export function BeaconSwitcher() {
  const router = useRouter();
  const { activePublicId, setActivePublicId, user } = useAuth();
  const personalSelected = !!user && (activePublicId ?? user.publicId) === user.publicId;
  const [pages, setPages] = useState<BeaconPage[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    void listBeaconPages().then((items) => { if (mounted) setPages(items); }).catch((error) => {
      Toast.show({ type: 'error', text1: 'Pages', text2: error instanceof Error ? error.message : 'Could not load pages.' });
    });
    return () => { mounted = false; };
  }, [user?.publicId]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const page = await createBeaconPage();
      setPages((items) => [...items, page]);
      setActivePublicId(page.publicId);
      router.replace('/(app)/(tabs)/identity');
      Toast.show({ type: 'success', text1: 'Beacon created', text2: 'Add its name, photos and contact details.' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Could not create page', text2: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setCreating(false);
    }
  };

  return <View className="mb-4 w-full rounded-[22px] border border-white/60 dark:border-white/20 bg-[#D0D0D0] dark:bg-night-header p-4">
    <Text className="mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/45 dark:text-night-muted">Interact as</Text>
    {user && <Pressable accessibilityRole="button" accessibilityState={{ selected: personalSelected }} onPress={() => setActivePublicId(user.publicId)} className={`mb-2 flex-row items-center justify-between rounded-xl px-4 py-3 ${personalSelected ? 'bg-[#17191d]' : 'bg-white dark:bg-night-surface'}`}>
      <View className="min-w-0 flex-1 pr-2"><Text className={`font-black ${personalSelected ? 'text-white' : 'text-[#17191d] dark:text-night-text'}`}>My personal profile</Text><Text className={`text-xs ${personalSelected ? 'text-white/65' : 'text-black/50 dark:text-night-muted'}`}>{user.publicId.slice(0, 8)}</Text></View>
      {personalSelected && <Text className="text-xs font-bold text-white">✓ Active now</Text>}
    </Pressable>}
    {pages.map((page) => {
      const selected = activePublicId === page.publicId;
      return <Pressable key={page.publicId} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setActivePublicId(page.publicId)} className={`mb-2 flex-row items-center justify-between rounded-xl px-4 py-3 ${selected ? 'bg-[#17191d]' : 'bg-white dark:bg-night-surface'}`}>
        <View className="min-w-0 flex-1 pr-2"><Text className={`font-black ${selected ? 'text-white' : 'text-[#17191d] dark:text-night-text'}`}>{page.displayName || 'Untitled beacon'}</Text><Text className={`text-xs ${selected ? 'text-white/65' : 'text-black/50 dark:text-night-muted'}`}>{page.publicId.slice(0, 8)}</Text></View>
        {selected && <Text className="text-xs font-bold text-white">✓ Active now</Text>}
      </Pressable>;
    })}
    <Pressable accessibilityRole="button" disabled={creating} onPress={() => void create()} className="mt-1 rounded-xl bg-g000st-red px-4 py-3 disabled:opacity-60">{creating ? <ActivityIndicator color="white" /> : <Text className="text-center text-sm font-black text-white">BUILD YOUR BEACON</Text>}</Pressable>
  </View>;
}
