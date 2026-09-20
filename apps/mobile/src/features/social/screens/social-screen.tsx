import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { cssInterop } from 'nativewind';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
 
import { startChatConversation } from '@/api/chat';
import { createSocialComment, createSocialPost, deleteSocialPost, getSocialProfile, listSocialAlerts, listSocialComments, listSocialPosts, markSocialAlertsRead, reportSocialPost, toggleSocialCamp, toggleSocialLike, updateSocialProfile, uploadSocialMedia } from '@/api/social';
import { FeatureScreen } from '@/components/layout/feature-screen';
import type { SocialAlert, SocialComment, SocialPost, SocialProfile, SocialVisibility } from '@/domain/social/types';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useConfirmModal } from '@/providers/confirm-modal-provider';

type ViewName = 'home' | 'mine' | 'alerts';
cssInterop(VideoView, { className: 'style' });

export function SocialScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [view, setView] = useState<ViewName>('home');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [alerts, setAlerts] = useState<SocialAlert[]>([]);
  const [comments, setComments] = useState<Record<string, SocialComment[]>>({});
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<SocialVisibility>('anonymous');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<readonly ImagePicker.ImagePickerAsset[]>([]);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const userPublicId = user?.publicId;

  const load = useCallback(async () => {
    try {
      if (view === 'alerts') { setAlerts(await listSocialAlerts()); await markSocialAlertsRead(); }
      else {
        const page = await listSocialPosts(view === 'mine' ? userPublicId : undefined);
        setPosts(page.items);
        setNextCursor(page.nextCursor ?? null);
        if (view === 'mine' && userPublicId) setProfile(await getSocialProfile(userPublicId));
      }
    } catch (error) { Toast.show({ type: 'error', text1: 'Social', text2: error instanceof Error ? error.message : 'Could not load Social.' }); }
    finally { setLoading(false); }
  }, [userPublicId, view]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current || view === 'alerts') return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await listSocialPosts(view === 'mine' ? userPublicId : undefined, nextCursor);
      setPosts((current) => {
        const known = new Set(current.map((post) => post.id));
        return [...current, ...page.items.filter((post) => !known.has(post.id))];
      });
      setNextCursor(page.nextCursor ?? null);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Social', text2: error instanceof Error ? error.message : 'Could not load more posts.' });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor, userPublicId, view]);

  const onPickLibraryAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'Media', text2: 'Photo library permission is required.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true, mediaTypes: ['images', 'videos'], quality: 0.9, selectionLimit: 2
    });
    if (result.canceled) return;
    const videos = result.assets.filter((item) => item.type === 'video');
    if (result.assets.some((item) => !item.fileSize || !item.mimeType || item.fileSize > 5 * 1024 * 1024))
      return Toast.show({ type: 'error', text1: 'Media', text2: 'Each file must be 5 MB or smaller.' });
    if ((videos.length && result.assets.length !== 1) || videos.length > 1 || (!videos.length && result.assets.length > 2))
      return Toast.show({ type: 'error', text1: 'Media', text2: 'Choose up to two images or one video.' });
    setSelectedMedia(result.assets);
  };

  const onCaptureAttachment = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'Media', text2: 'Camera permission is required.' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'], quality: 0.9,
    });
    if (result.canceled) return;
    if (result.assets.some((item) => !item.fileSize || !item.mimeType || item.fileSize > 5 * 1024 * 1024))
      return Toast.show({ type: 'error', text1: 'Media', text2: 'Each file must be 5 MB or smaller.' });
    setSelectedMedia((prev) => {
      const next = [...prev, ...result.assets];
      const nextVideos = next.filter((item) => item.type === 'video');
      if ((nextVideos.length && next.length !== 1) || nextVideos.length > 1 || (!nextVideos.length && next.length > 2)) {
         return result.assets;
      }
      return next;
    });
  };

  async function publish() {
    const content = draft.trim(); if (!content || posting) return;
    setPosting(true);
    try { const clientPostId = randomUUID(); const media = selectedMedia.length ? await Promise.all(selectedMedia.map((item) => uploadSocialMedia({ byteSize: item.fileSize!, clientPostId, contentType: item.mimeType!, fileName: item.fileName || 'social-media', uri: item.uri }))) : undefined; const post = await createSocialPost(clientPostId, content, visibility, media); setPosts((items) => [post, ...items]); setDraft(''); setSelectedMedia([]); }
    catch (error) { Toast.show({ type: 'error', text1: 'Could not post', text2: error instanceof Error ? error.message : 'Try again.' }); }
    finally { setPosting(false); }
  }

  async function openChat(publicId?: string) {
    if (!publicId) return Toast.show({ type: 'info', text1: 'Anonymous post', text2: 'This author chose not to show their identity.' });
    try { const conversation = await startChatConversation(publicId); router.navigate({ pathname: '/(app)/(tabs)/chat', params: { conversationId: conversation.id } }); }
    catch (error) { Toast.show({ type: 'error', text1: 'Chat', text2: error instanceof Error ? error.message : 'Could not open chat.' }); }
  }

  return (
    <FeatureScreen
      rightAction={
        <Pressable
          accessibilityLabel="Start a new private chat"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70"
        // onPress={chat.openNewChat}
        >
          <Text className="text-2xl font-black text-g000st-black">+</Text>
        </Pressable>
      }
      title={
        <View className="h-14 flex-row items-center justify-between border-b border-black/10 bg-[#D2D2D4] px-4">
          <Text className="text-lg font-black text-[#1A1A1A]">
            g
            <Text className="text-[#C62828]">000</Text>
            st
            <Text className="text-[#C62828]">S</Text>
            ocial
          </Text>
          <Pressable onPress={() => setView('alerts')}>
            <Text className="text-xl">🔔</Text>
          </Pressable>
        </View>
      }
    >
      <View className="flex-1 bg-[#E7E7E9]">

        {view !== 'alerts' &&
          <View className="border-b border-black/10 bg-white/80 p-3">
            <TextInput multiline maxLength={4000} value={draft} onChangeText={setDraft}
              placeholder="Share without a name…"
              className="min-h-24 rounded-2xl border border-black/15 bg-white p-3 text-[15px]"
              textAlignVertical="top" />

            {selectedMedia.length > 0 && (
              <View className="mt-3 flex-row gap-3">
                {selectedMedia.map((media, index) => (
                  <View key={index} className="relative">
                    <Image source={{ uri: media.uri }} className="h-16 w-16 rounded-xl bg-black/5" contentFit="cover" />
                    {media.type === 'video' && (
                      <View className="absolute inset-0 items-center justify-center rounded-xl bg-black/20">
                        <Text className="text-xs font-black text-white">▶</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => setSelectedMedia((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-black/50"
                    >
                      <Text className="text-xs font-bold text-white">✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View className="mt-2 flex-row items-center">
              <Pressable onPress={() => setIsAttachmentMenuOpen(true)}
                className="mr-2 rounded-xl border border-black/10 px-3 py-3"
              >
                <Text className="text-xs font-black">{selectedMedia.length ? `✓ ${selectedMedia.length}` : '📎 Media'}</Text>
              </Pressable>
              <Switch
                value={visibility === 'public'}
                onValueChange={(value) => setVisibility(value ? 'public' : 'anonymous')}
              />
              <Text className="ml-2 flex-1 text-xs font-bold">Show identity</Text>
              <Pressable disabled={!draft.trim() || posting} onPress={() => void publish()} className="rounded-xl bg-[#222] px-5 py-3 disabled:opacity-40">
                <Text className="font-black text-white">{posting ? 'Posting…' : 'Post'}</Text>
              </Pressable>
            </View>
          </View>
        }
        {loading ? <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View> : view === 'alerts' ? <ScrollView className="flex-1" contentContainerClassName="gap-3 p-3"
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => void load()}
            />
          }>
          <AlertList alerts={alerts} />
        </ScrollView>
          :
          <FlatList
            data={posts}
            keyExtractor={(post) => post.id}
            className="flex-1"
            contentContainerClassName="gap-3 p-3"
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={1.5}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => void load()} />
            }
            ListHeaderComponent={view === 'mine' && profile ? <ProfileEditor profile={profile} onSave={async (value) => setProfile(await updateSocialProfile(value))} /> : null}
            ListEmptyComponent={<Text className="py-20 text-center font-bold text-black/40">No posts yet.</Text>}
            ListFooterComponent={loadingMore ? <ActivityIndicator className="py-3" /> : null}
            renderItem={({ item: post }) =>
              <PostCard
                post={post}
                comments={comments[post.id]}
                onChat={openChat}
                onDelete={async () => { await deleteSocialPost(post.id); setPosts((items) => items.filter((item) => item.id !== post.id)); }}
                onReport={() => reportSocialPost(post.id)} onLike={async () => { const result = await toggleSocialLike(post.id); setPosts((items) => items.map((item) => item.id === post.id ? { ...item, ...result, likedByViewer: result.liked } : item)); }}
                onCamp={async () => { if (!post.ownerPublicId) return; const result = await toggleSocialCamp(post.ownerPublicId); setPosts((items) => items.map((item) => item.ownerPublicId === post.ownerPublicId ? { ...item, campedByViewer: result.camped } : item)); }}
                onComments={async () => { if (comments[post.id]) { setComments((value) => { const next = { ...value }; delete next[post.id]; return next; }); } else { const loaded = await listSocialComments(post.id); setComments((value) => ({ ...value, [post.id]: loaded })); } }}
                onComment={async (content) => { const comment = await createSocialComment(post.id, content, visibility); setComments((value) => ({ ...value, [post.id]: [...(value[post.id] ?? []), comment] })); setPosts((items) => items.map((item) => item.id === post.id ? { ...item, commentCount: item.commentCount + 1 } : item)); }}
              />
            }
          />
        }
        <View className="h-14 flex-row border-t border-black/15 bg-white"><ViewButton label="Home" active={view === 'home'} onPress={() => setView('home')} /><ViewButton label="My Page" active={view === 'mine'} onPress={() => setView('mine')} /><ViewButton label="Alerts" active={view === 'alerts'} onPress={() => setView('alerts')} /></View>
      </View>

      <Modal animationType="fade" transparent visible={isAttachmentMenuOpen} onRequestClose={() => setIsAttachmentMenuOpen(false)}>
        <Pressable className="flex-1 items-center justify-end bg-black/45 p-5" onPress={() => setIsAttachmentMenuOpen(false)}>
          <View className="mb-10 w-full rounded-[24px] bg-white p-4">
            {[
              ['Photo or video library', onPickLibraryAttachment],
              ['Camera', onCaptureAttachment],
            ].map(([label, action], index, arr) => (
              <Pressable key={label as string} className={`py-4 ${index < arr.length - 1 ? 'border-b border-black/10' : ''}`} onPress={() => { setIsAttachmentMenuOpen(false); void (action as () => Promise<void>)(); }}>
                <Text className="text-center font-bold text-[#1A1A1A]">{label as string}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </FeatureScreen>
  );
}

type PostCardProps = { post: SocialPost; comments?: SocialComment[]; onChat: (id?: string) => Promise<void>; onDelete: () => Promise<void>; onReport: () => Promise<void>; onLike: () => Promise<void>; onCamp: () => Promise<void>; onComments: () => Promise<void>; onComment: (content: string) => Promise<void> };
function PostCard({ post, comments, onChat, onDelete, onReport, onLike, onCamp, onComments, onComment }: PostCardProps) {
  const [comment, setComment] = useState('');
  const { confirm } = useConfirmModal();
  return (<View className="overflow-hidden rounded-2xl border border-black/10 bg-white"><View className="flex-row items-center gap-3 p-4"><View className="h-10 w-10 items-center justify-center rounded-full bg-[#DDD]"><Text>◎</Text></View><Pressable className="flex-1" onPress={() => void onChat(post.ownerPublicId)}><Text className="font-black">{post.author.displayName}</Text><Text className="text-[10px] text-black/45">{new Date(post.createdAtMs).toLocaleString()}{post.editedAtMs ? ' · edited' : ''}</Text></Pressable><Pressable onPress={async () => { const confirmed = await confirm({ title: post.ownedByViewer ? 'Delete post?' : 'Report post?', message: post.ownedByViewer ? 'Are you sure you want to delete this post?' : 'Are you sure you want to report this post?', confirmLabel: post.ownedByViewer ? 'Delete' : 'Report', isDangerous: true }); if (confirmed) { void (post.ownedByViewer ? onDelete() : onReport()); } }}><Text className="text-xs font-black">{post.ownedByViewer ? 'Delete' : 'Report'}</Text></Pressable></View><Text className="px-4 pb-4 text-[15px] leading-6">{post.content}</Text>{post.media?.map((item) => item.kind === 'video' ? <SocialVideo key={item.id} uri={item.url} /> : <Image key={item.id} source={{ uri: item.url }} contentFit="cover" className={`w-full ${post.media?.length === 2 ? 'h-56' : 'h-80'}`} />)}<View className="flex-row border-t border-black/10 p-2"><Action label={`♥ ${post.likeCount}`} active={post.likedByViewer} onPress={onLike} /><Action label={`💬 ${post.commentCount}`} onPress={onComments} />{post.ownerPublicId && !post.ownedByViewer && <Action label={post.campedByViewer ? 'Camped' : 'Camp'} onPress={onCamp} />}</View>{comments && <View className="border-t border-black/10 bg-black/[.025] p-3">{comments.map((item) => <Text key={item.id} className="mb-2 text-sm"><Text className="font-black">{item.author.displayName} </Text>{item.content}</Text>)}
    <View className="flex-row gap-2">
      <TextInput
        value={comment}
        onChangeText={setComment}
        maxLength={1000}
        placeholder="Write a comment…"
        className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-3 py-2" />
      <Pressable
        onPress={() => { const value = comment.trim(); if (value) void onComment(value).then(() => setComment('')); }}
        className="rounded-xl bg-[#222] px-4 py-2">
        <Text className="text-white">➤</Text>
      </Pressable>
    </View>
  </View>
  }
  </View>
  );
}
function SocialVideo({ uri }: { uri: string }) { const player = useVideoPlayer(uri); return <VideoView className="h-80 w-full bg-black" contentFit="contain" fullscreenOptions={{ enable: true }} nativeControls player={player} />; }
function ProfileEditor({ profile, onSave }: { profile: SocialProfile; onSave: (profile: Partial<SocialProfile>) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [country, setCountry] = useState(profile.country ?? '');
  const [hobby, setHobby] = useState(profile.hobby ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  if (!editing) return (
    <Pressable
      onPress={() => setEditing(true)}
      className="rounded-2xl bg-white p-4"
    >
      <Text className="text-base font-black">{profile.displayName || 'My social profile'}</Text>
      <Text className="mt-1 text-xs text-black/45">{profile.country || profile.hobby || 'Tap to complete your optional profile'}</Text>
    </Pressable>
  );
  return (
    <View className="gap-2 rounded-2xl bg-white p-4">
      <Text className="text-base font-black">Edit social profile</Text>
      <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Display name" className="rounded-xl border border-black/15 px-3 py-2" />
      <TextInput value={country} onChangeText={setCountry} placeholder="Country" className="rounded-xl border border-black/15 px-3 py-2" />
      <TextInput value={hobby} onChangeText={setHobby} placeholder="Hobby" className="rounded-xl border border-black/15 px-3 py-2" />
      <TextInput value={bio} onChangeText={setBio} placeholder="About me" multiline className="min-h-20 rounded-xl border border-black/15 px-3 py-2" textAlignVertical="top" />
      <View className="flex-row gap-2">
        <Pressable onPress={() => setEditing(false)} className="flex-1 rounded-xl bg-[#DDD] p-3">
          <Text className="text-center font-black">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => void onSave({ displayName: displayName.trim() || undefined, country: country.trim() || undefined, hobby: hobby.trim() || undefined, bio: bio.trim() || undefined }).then(() => setEditing(false))}
          className="flex-1 rounded-xl bg-[#222] p-3">
          <Text className="text-center font-black text-white">Save</Text>
        </Pressable>
      </View>
    </View>);
}
function AlertList({ alerts }: { alerts: SocialAlert[] }) {
  if (!alerts.length)
    return (
      <Text className="py-20 text-center font-bold text-black/40">No alerts yet.</Text>
    );
  return (
    <>
      {alerts.map((item) => (
        <View key={item.id} className="rounded-2xl bg-white p-4">
          <Text>
            <Text className="font-black">{item.actor.displayName} </Text>
            {item.kind === 'like'
              ? 'liked your post.'
              : item.kind === 'comment'
                ? 'commented on your post.'
                : 'camped your profile.'}
          </Text>
          <Text className="mt-1 text-[10px] text-black/40">
            {new Date(item.createdAtMs).toLocaleString()}
          </Text>
        </View>
      ))}
    </>
  );
}
function Action({ label, active, onPress }: { label: string; active?: boolean; onPress: () => Promise<void> }) {
  return (
    <Pressable
      onPress={() => void onPress()}
      className="flex-1 items-center rounded-xl py-2">
      <Text className={`text-sm font-black ${active ? 'text-[#C62828]' : 'text-black/60'}`}>{label}</Text>
    </Pressable>
  );
}
function ViewButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const scale = useSharedValue(active ? 1.08 : 1);
  const translateY = useSharedValue(active ? -2 : 0);

  useEffect(() => {
    scale.value = withSpring(active ? 1.08 : 1, { damping: 14, stiffness: 180 });
    translateY.value = withSpring(active ? -2 : 0, { damping: 14, stiffness: 180 });
  }, [active, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Pressable onPress={onPress} className="flex-1 items-center justify-center">
      <Animated.View style={animatedStyle} className="items-center justify-center">
        {active && <View className="mb-1 h-[3px] w-8 rounded-full bg-[#C62828]" />}
        <Text className={`text-xs font-black ${active ? 'text-black' : 'text-black/40'}`}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

