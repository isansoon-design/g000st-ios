import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { cssInterop } from 'nativewind';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { startChatConversation } from '@/api/chat';
import { createMarketComment, createMarketPost, deleteMarketComment, deleteMarketPost, listMarketComments, listMarketPosts, toggleMarketLike, updateMarketPost, uploadMarketMedia } from '@/api/market';
import { FeatureScreen } from '@/components/layout/feature-screen';
import type { MarketComment, MarketPost, MarketPostFields } from '@/domain/market/types';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCalling } from '@/features/calling/hooks/use-calling';
import { useConfirmModal } from '@/providers/confirm-modal-provider';

cssInterop(VideoView, { className: 'style' });
cssInterop(Image, { className: 'style' });
type ViewName = 'home' | 'mine';
const EMPTY_FIELDS: MarketPostFields = { content: '', price: 0, currency: 'GBP', quantity: 1, city: '', allowCalls: true, allowVideoCalls: false };

export function MarketScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { callUser } = useCalling();
  const [view, setView] = useState<ViewName>('home');
  const [posts, setPosts] = useState<MarketPost[]>([]);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [selectedMedia, setSelectedMedia] = useState<readonly ImagePicker.ImagePickerAsset[]>([]);
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [commentsPost, setCommentsPost] = useState<MarketPost>();
  const [editingPost, setEditingPost] = useState<MarketPost>();
  const loadingMoreRef = useRef(false);
  const userPublicId = user?.publicId;

  const load = useCallback(async () => {
    setLoading(true);
    try { const page = await listMarketPosts(view === 'mine' ? userPublicId : undefined); setPosts(page.items); setNextCursor(page.nextCursor); }
    catch (error) { showError(error, 'Could not load Market.'); }
    finally { setLoading(false); }
  }, [userPublicId, view]);
  useFocusEffect(useCallback(() => {
    void load();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void load(); });
    return () => subscription.remove();
  }, [load]));

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true; setLoadingMore(true);
    try { const page = await listMarketPosts(view === 'mine' ? userPublicId : undefined, nextCursor); setPosts((current) => [...current, ...page.items.filter((item) => !current.some((known) => known.id === item.id))]); setNextCursor(page.nextCursor); }
    catch (error) { showError(error, 'Could not load more listings.'); }
    finally { loadingMoreRef.current = false; setLoadingMore(false); }
  }, [nextCursor, userPublicId, view]);

  async function pickMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 2, quality: 0.85 });
    if (result.canceled) return;
    const videos = result.assets.filter((asset) => asset.type === 'video');
    if ((videos.length && result.assets.length !== 1) || result.assets.some((asset) => !asset.fileSize || !asset.mimeType || asset.fileSize > 5 * 1024 * 1024)) return Toast.show({ type: 'error', text1: 'Market', text2: 'Choose up to two images or one video, max 5 MB each.' });
    setSelectedMedia(result.assets);
  }

  async function publish() {
    if (!validFields(fields) || posting) return Toast.show({ type: 'error', text1: 'Market', text2: 'Add description, price, quantity, and city.' });
    setPosting(true);
    try {
      const clientPostId = randomUUID();
      const media = selectedMedia.length ? await Promise.all(selectedMedia.map((asset) => uploadMarketMedia({ byteSize: asset.fileSize!, clientPostId, contentType: asset.mimeType!, fileName: asset.fileName ?? `${randomUUID()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`, uri: asset.uri }))) : undefined;
      const post = await createMarketPost(clientPostId, fields, media);
      setPosts((current) => [post, ...current]); setFields(EMPTY_FIELDS); setSelectedMedia([]);
      Toast.show({ type: 'success', text1: 'Listing published' });
    } catch (error) { showError(error, 'Could not publish listing.'); }
    finally { setPosting(false); }
  }

  async function openChat(post: MarketPost) {
    try { const conversation = await startChatConversation(post.ownerPublicId); router.push({ pathname: '/(app)/(tabs)/chat', params: { conversationId: conversation.id, notificationRequestId: randomUUID() } }); }
    catch (error) { showError(error, 'Could not open chat.'); }
  }

  return <FeatureScreen title="Market">
    <View className="flex-1 bg-[#E7E7E9]">
      {!loading && <FlatList data={posts} keyExtractor={(item) => item.id} contentContainerClassName="gap-3 p-3" onEndReached={() => void loadMore()} onEndReachedThreshold={1.2} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />} ListHeaderComponent={<MarketComposer fields={fields} media={selectedMedia} posting={posting} onChange={setFields} onMedia={() => void pickMedia()} onRemoveMedia={(index) => setSelectedMedia((current) => current.filter((_, itemIndex) => itemIndex !== index))} onPublish={() => void publish()} />} ListEmptyComponent={<Text className="py-16 text-center font-bold text-black/40">No listings yet.</Text>} ListFooterComponent={loadingMore ? <ActivityIndicator className="py-3" /> : null} renderItem={({ item }) => <MarketCard post={item} onLike={async () => { const result = await toggleMarketLike(item.id); setPosts((current) => current.map((post) => post.id === item.id ? { ...post, likeCount: result.likeCount, likedByViewer: result.liked } : post)); }} onComments={() => setCommentsPost(item)} onChat={() => openChat(item)} onCall={() => callUser(item.ownerPublicId, item.author.displayName, 'audio')} onVideoCall={() => callUser(item.ownerPublicId, item.author.displayName, 'video')} onEdit={() => setEditingPost(item)} onDelete={async () => { await deleteMarketPost(item.id); setPosts((current) => current.filter((post) => post.id !== item.id)); }} />} />}
      {loading && <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>}
      <View className="h-14 flex-row border-t border-black/15 bg-white"><ViewButton label="Market" active={view === 'home'} onPress={() => setView('home')} /><ViewButton label="My Listings" active={view === 'mine'} onPress={() => setView('mine')} /></View>
    </View>
    {commentsPost && <CommentsModal post={commentsPost} onClose={() => setCommentsPost(undefined)} onCountChange={(postId, delta) => setPosts((current) => current.map((post) => post.id === postId ? { ...post, commentCount: Math.max(0, post.commentCount + delta) } : post))} />}
    {editingPost && <EditMarketModal post={editingPost} onClose={() => setEditingPost(undefined)} onSave={async (postId, next) => { const updated = await updateMarketPost(postId, next); setPosts((current) => current.map((post) => post.id === postId ? updated : post)); setEditingPost(undefined); }} />}
  </FeatureScreen>;
}

function MarketComposer({ fields, media, posting, onChange, onMedia, onRemoveMedia, onPublish }: { fields: MarketPostFields; media: readonly ImagePicker.ImagePickerAsset[]; posting: boolean; onChange: (value: MarketPostFields) => void; onMedia: () => void; onRemoveMedia: (index: number) => void; onPublish: () => void }) {
  return <View className="mb-1 gap-2 rounded-2xl border border-black/10 bg-white p-4">
    <TextInput value={fields.content} onChangeText={(content) => onChange({ ...fields, content })} placeholder="What are you selling?" multiline maxLength={4000} className="min-h-20 rounded-xl border border-black/15 px-3 py-2" textAlignVertical="top" />
    <View className="flex-row gap-2"><NumberField value={fields.price || undefined} placeholder="Price £" onChange={(price) => onChange({ ...fields, price })} /><NumberField value={fields.quantity} placeholder="Quantity" onChange={(quantity) => onChange({ ...fields, quantity: Math.floor(quantity) })} /><TextInput value={fields.city} onChangeText={(city) => onChange({ ...fields, city })} placeholder="City" maxLength={100} className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2" /></View>
    <MarketCallOptions fields={fields} onChange={onChange} />
    {media.length > 0 && <ScrollView horizontal contentContainerClassName="gap-2">{media.map((asset, index) => <View key={asset.assetId ?? asset.uri} className="relative"><Image source={{ uri: asset.uri }} className="h-20 w-20 rounded-xl" contentFit="cover" /><Pressable onPress={() => onRemoveMedia(index)} className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/70"><Text className="font-black text-white">×</Text></Pressable></View>)}</ScrollView>}
    <View className="flex-row justify-between"><Pressable onPress={onMedia} className="rounded-xl border border-black/15 px-4 py-3"><Text className="text-xs font-black">📎 {media.length ? `${media.length} selected` : 'Media'}</Text></Pressable><Pressable disabled={posting} onPress={onPublish} className="rounded-xl bg-[#222] px-6 py-3 disabled:opacity-40"><Text className="font-black text-white">{posting ? 'Posting…' : 'Post'}</Text></Pressable></View>
  </View>;
}

function MarketCard({ post, onLike, onComments, onChat, onCall, onVideoCall, onEdit, onDelete }: { post: MarketPost; onLike: () => Promise<void>; onComments: () => void; onChat: () => Promise<void>; onCall: () => Promise<void>; onVideoCall: () => Promise<void>; onEdit: () => void; onDelete: () => Promise<void> }) {
  const { confirm } = useConfirmModal();
  return <View className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-sm">
    <View className="flex-row items-center gap-3 p-4"><View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-black">{post.author.avatarUrl ? <Image source={{ uri: post.author.avatarUrl }} className="h-full w-full" contentFit="cover" /> : <Text className="text-white">👻</Text>}</View><View className="min-w-0 flex-1"><Text className="font-black">{post.author.displayName}</Text><Text className="text-[10px] text-black/45">{new Date(post.createdAtMs).toLocaleString()}{post.editedAtMs ? ' · edited' : ''}</Text></View>{post.ownedByViewer && <><Pressable onPress={onEdit} className="rounded-full border border-black px-3 py-2"><Text>✎</Text></Pressable><Pressable onPress={async () => { if (await confirm({ title: 'Delete listing?', message: 'This cannot be undone.', confirmLabel: 'Delete', isDangerous: true })) await onDelete(); }} className="rounded-full border border-black px-3 py-2"><Text>⌫</Text></Pressable></>}</View>
    <Text className="px-4 pb-3 text-[15px] leading-6">{post.content}</Text>
    <View className="mx-4 mb-3 flex-row flex-wrap gap-2"><Badge text={post.currency === 'GBP' ? `£${post.price.toLocaleString()}` : `${post.price.toLocaleString()} ${post.currency}`} /><Badge text={`Qty ${post.quantity}`} /><Badge text={`⌖ ${post.city}`} /></View>
    {post.media?.map((item) => item.kind === 'video' ? <MarketVideo key={item.id} uri={item.url} /> : <Image key={item.id} source={{ uri: item.url }} style={{ width: '100%', height: post.media?.length === 2 ? 224 : 320 }} contentFit="cover" />)}
    <View className="flex-row items-center border-t border-black/10 p-2"><Action label={`♥ ${post.likeCount}`} active={post.likedByViewer} onPress={onLike} /><Action label={`💬 ${post.commentCount}`} onPress={async () => onComments()} />{!post.ownedByViewer && post.allowCalls && <Action label="☎" onPress={onCall} />}{!post.ownedByViewer && post.allowVideoCalls && <Action label="Video" onPress={onVideoCall} />}<Pressable onPress={() => void onChat()} className="mx-1 rounded-full bg-black px-5 py-3"><Text className="font-black text-white">Chat</Text></Pressable></View>
  </View>;
}

function CommentsModal({ post, onClose, onCountChange }: { post: MarketPost; onClose: () => void; onCountChange: (postId: string, delta: number) => void }) {
  const [comments, setComments] = useState<MarketComment[]>([]); const [cursor, setCursor] = useState<string>(); const [value, setValue] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => { void Promise.resolve().then(async () => { setLoading(true); try { const page = await listMarketComments(post.id); setComments(page.items); setCursor(page.nextCursor); } catch (error) { showError(error, 'Could not load comments.'); } finally { setLoading(false); } }); }, [post.id]);
  async function send() { const content = value.trim(); if (!content) return; try { const comment = await createMarketComment(post.id, content); setComments((current) => [...current, comment]); setValue(''); onCountChange(post.id, 1); } catch (error) { showError(error, 'Could not add comment.'); } }
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50"><View className="h-[75%] pb-16 rounded-t-[28px] bg-white p-4"><View className="mb-3 flex-row items-center justify-between"><Text className="text-lg font-black">Comments</Text><Pressable onPress={onClose}><Text className="text-2xl">×</Text></Pressable></View>{loading ? <ActivityIndicator className="flex-1" /> : <FlatList data={comments} keyExtractor={(item) => item.id} contentContainerClassName="gap-3 py-2" onEndReached={async () => { if (!cursor || loading) return; setLoading(true); try { const page = await listMarketComments(post.id, cursor); setComments((current) => [...current, ...page.items]); setCursor(page.nextCursor); } finally { setLoading(false); } }} renderItem={({ item }) => <View className="flex-row gap-2 rounded-xl bg-black/[.04] p-3"><Text className="min-w-0 flex-1"><Text className="font-black">{item.author.displayName} </Text>{item.content}</Text>{item.ownedByViewer && <Pressable onPress={async () => { await deleteMarketComment(post.id, item.id); setComments((current) => current.filter((comment) => comment.id !== item.id)); onCountChange(post.id, -1); }}><Text className="text-xs font-black text-[#C62828]">Delete</Text></Pressable>}</View>} ListEmptyComponent={<Text className="py-16 text-center text-black/40">No comments yet.</Text>} />}<View className="flex-row gap-2 border-t border-black/10 pt-3  "><TextInput value={value} onChangeText={setValue} placeholder="Write a comment…" maxLength={1000} className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2" /><Pressable onPress={() => void send()} className="rounded-xl bg-black px-4 py-3"><Text className="text-white">➤</Text></Pressable></View></View></KeyboardAvoidingView></Modal>;
}

function EditMarketModal({ post, onClose, onSave }: { post: MarketPost; onClose: () => void; onSave: (id: string, fields: MarketPostFields) => Promise<void> }) { const [fields, setFields] = useState<MarketPostFields>({ content: post.content, price: post.price, currency: post.currency, quantity: post.quantity, city: post.city, allowCalls: post.allowCalls, allowVideoCalls: post.allowVideoCalls }); return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View className="flex-1 justify-center bg-black/50 p-5"><View className="gap-3 rounded-[24px] bg-white p-5"><Text className="text-lg font-black">Edit listing</Text><TextInput value={fields.content} onChangeText={(content) => setFields({ ...fields, content })} multiline className="min-h-24 rounded-xl border border-black/15 p-3" /><View className="flex-row gap-2"><NumberField value={fields.price} placeholder={fields.currency === 'GBP' ? 'Price £' : `Price ${fields.currency}`} onChange={(price) => setFields({ ...fields, price, currency: 'GBP' })} /><NumberField value={fields.quantity} placeholder="Quantity" onChange={(quantity) => setFields({ ...fields, quantity: Math.floor(quantity) })} /><TextInput value={fields.city} onChangeText={(city) => setFields({ ...fields, city })} placeholder="City" className="min-w-0 flex-1 rounded-xl border border-black/15 px-3" /></View>{post.currency !== 'GBP' && <Text className="text-xs text-black/60">This listing is {post.currency}. Enter a new price to switch to £.</Text>}<MarketCallOptions fields={fields} onChange={setFields} /><View className="flex-row gap-2"><Pressable onPress={onClose} className="flex-1 rounded-xl bg-[#DDD] p-3"><Text className="text-center font-black">Cancel</Text></Pressable><Pressable onPress={() => { if (validFields(fields)) void onSave(post.id, fields); }} className="flex-1 rounded-xl bg-black p-3"><Text className="text-center font-black text-white">Save</Text></Pressable></View></View></View></Modal>; }
function MarketCallOptions({ fields, onChange }: { fields: MarketPostFields; onChange: (fields: MarketPostFields) => void }) { return <View className="gap-1"><View className="flex-row items-center justify-between"><Text>Allow voice calls</Text><Switch value={fields.allowCalls} onValueChange={(allowCalls) => onChange({ ...fields, allowCalls })} /></View><View className="flex-row items-center justify-between"><Text>Allow video calls</Text><Switch value={fields.allowVideoCalls} onValueChange={(allowVideoCalls) => onChange({ ...fields, allowVideoCalls })} /></View></View>; }
function NumberField({ value, placeholder, onChange }: { value?: number; placeholder: string; onChange: (value: number) => void }) { return <TextInput value={value ? String(value) : ''} onChangeText={(text) => onChange(Number(text.replace(',', '.')) || 0)} keyboardType="decimal-pad" placeholder={placeholder} className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2" />; }
function Badge({ text }: { text: string }) { return <View className="rounded-full bg-black px-3 py-1.5"><Text className="text-xs font-black text-white">{text}</Text></View>; }
function Action({ label, active, onPress }: { label: string; active?: boolean; onPress: () => Promise<void> }) { return <Pressable onPress={() => void onPress()} className="flex-1 items-center rounded-xl py-3"><Text className={`font-black ${active ? 'text-[#C62828]' : 'text-black/70'}`}>{label}</Text></Pressable>; }
function ViewButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} className={`flex-1 items-center justify-center ${active ? 'border-t-2 border-[#C62828]' : ''}`}><Text className={`text-xs font-black ${active ? 'text-black' : 'text-black/45'}`}>{label}</Text></Pressable>; }
function MarketVideo({ uri }: { uri: string }) { const player = useVideoPlayer(uri); return <VideoView player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} className="h-80 w-full bg-black" />; }
function validFields(fields: MarketPostFields) { return Boolean(fields.content.trim() && fields.city.trim() && fields.price >= 0 && fields.quantity > 0); }
function showError(error: unknown, fallback: string) { Toast.show({ type: 'error', text1: 'Market', text2: error instanceof Error ? error.message : fallback }); }
