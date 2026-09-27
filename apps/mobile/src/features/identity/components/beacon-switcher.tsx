import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { createBeaconPage, listBeaconPages, type BeaconPage } from '@/api/auth';
import { updateSocialProfile, uploadAvatarMedia, uploadCoverMedia } from '@/api/social';
import { useAuth } from '@/features/auth/hooks/use-auth';

type ChosenImage = ImagePicker.ImagePickerAsset | null;

async function chooseImage(): Promise<ChosenImage> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library permission is required.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  const image = result.canceled ? null : result.assets[0] ?? null;
  if (image) {
    const byteSize = new File(image.uri).size ?? 0;
    if (!byteSize || byteSize > 3 * 1024 * 1024 || !image.mimeType || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.mimeType)) {
      throw new Error('Choose a JPEG, PNG, WebP, or GIF image up to 3 MB.');
    }
  }
  return image;
}

async function uploadImage(image: ImagePicker.ImagePickerAsset, kind: 'avatar' | 'cover') {
  const byteSize = new File(image.uri).size ?? 0;
  if (!byteSize || byteSize > 3 * 1024 * 1024 || !image.mimeType) throw new Error('Images must be 3 MB or smaller.');
  const input = { byteSize, contentType: image.mimeType, fileName: image.fileName || kind, uri: image.uri };
  return kind === 'avatar' ? uploadAvatarMedia(input) : uploadCoverMedia(input);
}

export function BeaconSwitcher() {
  const { activePublicId, setActivePublicId, user } = useAuth();
  const personalSelected = !!user && (activePublicId ?? user.publicId) === user.publicId;
  const [pages, setPages] = useState<BeaconPage[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<ChosenImage>(null);
  const [cover, setCover] = useState<ChosenImage>(null);

  useEffect(() => {
    let mounted = true;
    void listBeaconPages().then((items) => { if (mounted) setPages(items); }).catch((error) => {
      Toast.show({ type: 'error', text1: 'Pages', text2: error instanceof Error ? error.message : 'Could not load pages.' });
    });
    return () => { mounted = false; };
  }, [user?.publicId]);

  const pick = async (kind: 'avatar' | 'cover') => {
    try {
      const image = await chooseImage();
      if (image) (kind === 'avatar' ? setAvatar : setCover)(image);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Image', text2: error instanceof Error ? error.message : 'Could not choose image.' });
    }
  };

  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const page = await createBeaconPage(name.trim(), bio.trim());
      setPages((items) => [...items, page]);
      setActivePublicId(page.publicId);
      try {
        const [avatarMedia, coverMedia] = await Promise.all([
          avatar ? uploadImage(avatar, 'avatar') : undefined,
          cover ? uploadImage(cover, 'cover') : undefined,
        ]);
        if (avatarMedia || coverMedia) await updateSocialProfile({ ...(avatarMedia ? { avatarMedia } : {}), ...(coverMedia ? { coverMedia } : {}) });
      } catch {
        Toast.show({ type: 'error', text1: 'Page created', text2: 'Add its images from the page profile.' });
      }
      setCreating(false);
      setName('');
      setBio('');
      setAvatar(null);
      setCover(null);
      Toast.show({ type: 'success', text1: 'Beacon ready', text2: `You are now using ${page.displayName}.` });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Could not create page', text2: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setSaving(false);
    }
  };

  return <View className="mb-4 w-full rounded-[22px] border border-white/60 dark:border-white/20 bg-[#D0D0D0] dark:bg-night-header p-4">
    <Text className="mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/45 dark:text-night-muted">Interact as</Text>
    {user && <Pressable accessibilityRole="button" accessibilityState={{ selected: personalSelected }} onPress={() => setActivePublicId(user.publicId)} className={`mb-2 flex-row items-center justify-between rounded-xl px-4 py-3 ${personalSelected ? 'bg-[#17191d]' : 'bg-white dark:bg-night-surface'}`}>
      <View className="min-w-0 flex-1 pr-2">
        <Text className={`font-black ${personalSelected ? 'text-white' : 'text-[#17191d] dark:text-night-text'}`}>My personal profile</Text>
        <Text className={`text-xs ${personalSelected ? 'text-white/65' : 'text-black/50 dark:text-night-muted'}`}>{user.publicId.slice(0, 8)}</Text>
      </View>
      {personalSelected && <View className="flex-row items-center gap-1"><Text className="text-lg font-black text-white">✓</Text><Text className="text-xs font-bold text-white">Active now</Text></View>}
    </Pressable>}
    {pages.map((page) => {
      const selected = activePublicId === page.publicId;
      return <Pressable key={page.publicId} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setActivePublicId(page.publicId)} className={`mb-2 flex-row items-center justify-between rounded-xl px-4 py-3 ${selected ? 'bg-[#17191d]' : 'bg-white dark:bg-night-surface'}`}>
        <View className="min-w-0 flex-1 pr-2">
          <Text className={`font-black ${selected ? 'text-white' : 'text-[#17191d] dark:text-night-text'}`}>{page.displayName}</Text>
          <Text className={`text-xs ${selected ? 'text-white/65' : 'text-black/50 dark:text-night-muted'}`}>{page.publicId.slice(0, 8)}</Text>
        </View>
        {selected && <View className="flex-row items-center gap-1"><Text className="text-lg font-black text-white">✓</Text><Text className="text-xs font-bold text-white">Active now</Text></View>}
      </Pressable>;
    })}
    {!creating ? <Pressable accessibilityRole="button" onPress={() => setCreating(true)} className="mt-1 rounded-xl bg-g000st-red px-4 py-3"><Text className="text-center text-sm font-black text-white">BUILD YOUR BEACON</Text></Pressable> : <View className="mt-2 gap-2">
      <Text className="text-sm font-black text-[#17191d] dark:text-night-text">BUILD YOUR BEACON</Text>
      <TextInput accessibilityLabel="Page name" placeholder="Page name" maxLength={60} value={name} onChangeText={setName} className="rounded-xl bg-white dark:bg-night-surface px-3 py-3 text-[#17191d] dark:text-night-text" />
      <TextInput accessibilityLabel="Page description" placeholder="Short description" maxLength={500} multiline value={bio} onChangeText={setBio} className="min-h-20 rounded-xl bg-white dark:bg-night-surface px-3 py-3 text-[#17191d] dark:text-night-text" />
      <View className="flex-row gap-2">
        <Pressable accessibilityRole="button" onPress={() => void pick('avatar')} className="flex-1 rounded-xl bg-white dark:bg-night-surface p-3"><Text className="text-center text-xs font-black">{avatar ? '✓ Photo' : 'Add photo'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void pick('cover')} className="flex-1 rounded-xl bg-white dark:bg-night-surface p-3"><Text className="text-center text-xs font-black">{cover ? '✓ Cover' : 'Add cover'}</Text></Pressable>
      </View>
      {(avatar || cover) && <View className="flex-row gap-2">{avatar && <Image source={{ uri: avatar.uri }} style={{ width: 56, height: 56, borderRadius: 12 }} />}{cover && <Image source={{ uri: cover.uri }} style={{ width: 100, height: 56, borderRadius: 12 }} />}</View>}
      <Pressable accessibilityRole="button" disabled={saving || !name.trim()} onPress={() => void create()} className="rounded-xl bg-g000st-red p-3 disabled:opacity-50">{saving ? <ActivityIndicator color="white" /> : <Text className="text-center font-black text-white">Create page</Text>}</Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => setCreating(false)}><Text className="text-center text-xs font-bold text-black/50 dark:text-night-muted">Cancel</Text></Pressable>
    </View>}
  </View>;
}
