import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { startChatConversation } from "@/api/chat";
import { listBeaconPages, type BeaconPage } from "@/api/auth";
import { listMarketPosts } from "@/api/market";
import {
  getSocialProfile,
  listSocialPosts,
  toggleSocialCamp,
  updateSocialProfile,
  uploadAvatarMedia,
  uploadCoverMedia,
} from "@/api/social";
import type { MarketPost } from "@/domain/market/types";
import type { SocialPost, SocialProfile } from "@/domain/social/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCalling } from "@/features/calling/hooks/use-calling";
import { chatConversationHref } from "@/features/chat/navigation";
import { ProfilePostComposer } from "@/features/social/components/profile-post-composer";
import { AppThemeSwitch } from "@/components/navigation/app-theme-switch";

type Tab = "social" | "market";
type ProfileDraft = {
  displayName: string; bio: string; showDisplayName: boolean; country: string; age: string; sex: '' | 'male' | 'female'; hobby: string;
  whatsappNumber: string; landlineNumber: string; contactEmail: string; facebookUrl: string; instagramUrl: string; tiktokUrl: string; linkedinUrl: string;
};

function profileDraft(profile: SocialProfile): ProfileDraft {
  return { displayName: profile.displayName ?? '', bio: profile.bio ?? '', showDisplayName: profile.showDisplayName,
    country: profile.country ?? '', age: profile.age ? String(profile.age) : '', sex: profile.sex ?? '', hobby: profile.hobby ?? '',
    whatsappNumber: profile.whatsappNumber ?? '', landlineNumber: profile.landlineNumber ?? '', contactEmail: profile.contactEmail ?? '',
    facebookUrl: profile.facebookUrl ?? '', instagramUrl: profile.instagramUrl ?? '', tiktokUrl: profile.tiktokUrl ?? '', linkedinUrl: profile.linkedinUrl ?? '' };
}

export default function UserProfileScreen() {
  const { publicId } = useLocalSearchParams<{ publicId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePublicId, setActivePublicId, user } = useAuth();
  const { callUser } = useCalling();
  const ownerPublicId = user?.publicId;
  const [ownedPages, setOwnedPages] = useState<BeaconPage[]>([]);
  const own = publicId === ownerPublicId || publicId === activePublicId || ownedPages.some((page) => page.publicId === publicId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<SocialProfile>();
  const [social, setSocial] = useState<SocialPost[]>([]);
  const [market, setMarket] = useState<MarketPost[]>([]);
  const [tab, setTab] = useState<Tab>("social");
  const [cursors, setCursors] = useState<{ social?: string; market?: string }>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ownerPublicId) return;
    let active = true;
    void listBeaconPages().then((pages) => {
      if (active) setOwnedPages(pages);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [ownerPublicId]);

  async function beginEdit() {
    if (!publicId || !own) return;
    try {
      const editable = await getSocialProfile(publicId, publicId);
      setProfile(editable);
      setDraft(profileDraft(editable));
      setEditing(true);
    } catch (reason) { Toast.show({ type: 'error', text1: 'Could not open editor', text2: reason instanceof Error ? reason.message : 'Try again.' }); }
  }

  async function endEdit() {
    setEditing(false);
    setDraft(null);
    if (publicId) try { setProfile(await getSocialProfile(publicId)); } catch { /* Keep the last visible profile. */ }
  }

  async function saveEdit() {
    if (!publicId || !draft || saving) return;
    if (profile?.isPage && !draft.displayName.trim()) return Toast.show({ type: 'error', text1: 'Name your page before saving.' });
    setSaving(true);
    try {
      const saved = await updateSocialProfile({
        ...(draft.displayName.trim() ? { displayName: draft.displayName.trim() } : {}),
        bio: draft.bio.trim(),
        ...(draft.country.trim() ? { country: draft.country.trim() } : {}),
        ...(draft.hobby.trim() ? { hobby: draft.hobby.trim() } : {}),
        ...(profile?.isPage ? {
          whatsappNumber: draft.whatsappNumber, landlineNumber: draft.landlineNumber, contactEmail: draft.contactEmail,
          facebookUrl: draft.facebookUrl, instagramUrl: draft.instagramUrl, tiktokUrl: draft.tiktokUrl, linkedinUrl: draft.linkedinUrl,
        } : { showDisplayName: draft.showDisplayName,
          ...(draft.age ? { age: Number(draft.age) } : {}), ...(draft.sex ? { sex: draft.sex } : {}) }),
      }, publicId);
      setProfile(saved);
      setEditing(false);
      setDraft(null);
      Toast.show({ type: 'success', text1: 'Profile saved.' });
    } catch (reason) { Toast.show({ type: 'error', text1: 'Could not save profile', text2: reason instanceof Error ? reason.message : 'Try again.' }); }
    finally { setSaving(false); }
  }

  function switchToThisProfile() {
    if (!publicId) return;
    if (activePublicId !== publicId) setActivePublicId(publicId);
    Toast.show({ type: 'success', text1: 'أنت الآن تتفاعل باسم', text2: profile?.displayName || (profile?.isPage ? 'هذه الصفحة' : 'ملفك الشخصي') });
    router.replace('/(app)/(tabs)/social');
  }

  useEffect(() => {
    if (!publicId) return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoading(true);
        setProfile(undefined);
        setSocial([]);
        setMarket([]);
        setCursors({});
        setError("");
        return Promise.all([
          getSocialProfile(publicId),
          listSocialPosts(publicId, undefined, true),
          listMarketPosts(publicId),
        ]);
      })
      .then((result) => {
        if (!active || !result) return;
        const [person, socialPage, marketPage] = result;
        setProfile(person);
        setSocial(socialPage.items);
        setMarket(marketPage.items);
        setCursors({
          social: socialPage.nextCursor,
          market: marketPage.nextCursor,
        });
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load profile.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [publicId]);

  const loadMore = useCallback(async () => {
    if (!publicId || !cursors[tab] || loadingMore) return;
    setLoadingMore(true);
    try {
      if (tab === "social") {
        const page = await listSocialPosts(publicId, cursors.social, true);
        setSocial((current) => [
          ...current,
          ...page.items.filter(
            (item) => !current.some((old) => old.id === item.id),
          ),
        ]);
        setCursors((current) => ({ ...current, social: page.nextCursor }));
      } else {
        const page = await listMarketPosts(publicId, cursors.market);
        setMarket((current) => [
          ...current,
          ...page.items.filter(
            (item) => !current.some((old) => old.id === item.id),
          ),
        ]);
        setCursors((current) => ({ ...current, market: page.nextCursor }));
      }
    } catch (reason) {
      Toast.show({
        type: "error",
        text1: "Profile",
        text2:
          reason instanceof Error
            ? reason.message
            : "Could not load more posts.",
      });
    } finally {
      setLoadingMore(false);
    }
  }, [cursors, loadingMore, publicId, tab]);

  async function openChat() {
    if (!publicId) return;
    try {
      const conversation = await startChatConversation(publicId);
      router.push(chatConversationHref(conversation.id), { withAnchor: true });
    } catch (reason) {
      Toast.show({
        type: "error",
        text1: "Chat",
        text2:
          reason instanceof Error ? reason.message : "Could not open chat.",
      });
    }
  }

  async function toggleFollow() {
    if (!publicId || !profile || own || followBusy) return;
    setFollowBusy(true);
    try {
      const { camped } = await toggleSocialCamp(publicId);
      setProfile((current) => current?.publicId === publicId ? { ...current, campedByViewer: camped } : current);
      Toast.show({ type: "success", text1: camped ? "Following" : "Unfollowed" });
    } catch (reason) {
      Toast.show({ type: "error", text1: "Follow", text2: reason instanceof Error ? reason.message : "Could not update follow." });
    } finally {
      setFollowBusy(false);
    }
  }

  async function changeCover() {
    if (!publicId || !own || !editing) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Toast.show({
        type: "error",
        text1: "Allow photo access to choose a cover.",
      });
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled) return;
    const selected = result.assets[0];
    if (
      !selected?.fileSize ||
      !selected.mimeType ||
      selected.fileSize > 3 * 1024 * 1024
    )
      return Toast.show({
        type: "error",
        text1: "Choose an image up to 3 MB.",
      });
    setUploading(true);
    try {
      const coverMedia = await uploadCoverMedia({
        byteSize: selected.fileSize,
        contentType: selected.mimeType,
        fileName: selected.fileName ?? "cover.jpg",
        uri: selected.uri,
      }, publicId);
      setProfile(await updateSocialProfile({ coverMedia }, publicId));
      Toast.show({ type: "success", text1: "Cover updated." });
    } catch (reason) {
      Toast.show({
        type: "error",
        text1: "Cover",
        text2:
          reason instanceof Error ? reason.message : "Could not update cover.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function changeAvatar() {
    if (!publicId || !own || !editing) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Toast.show({ type: 'error', text1: 'Allow photo access to choose a photo.' });
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled) return;
    const selected = result.assets[0];
    if (!selected?.fileSize || !selected.mimeType || selected.fileSize > 3 * 1024 * 1024) return Toast.show({ type: 'error', text1: 'Choose an image up to 3 MB.' });
    setUploading(true);
    try {
      const avatarMedia = await uploadAvatarMedia({ byteSize: selected.fileSize, contentType: selected.mimeType, fileName: selected.fileName ?? 'photo.jpg', uri: selected.uri }, publicId);
      setProfile(await updateSocialProfile({ avatarMedia }, publicId));
      Toast.show({ type: 'success', text1: 'Photo updated.' });
    } catch (reason) { Toast.show({ type: 'error', text1: 'Photo', text2: reason instanceof Error ? reason.message : 'Could not update photo.' }); }
    finally { setUploading(false); }
  }

  return (
    <View className="flex-1 bg-[#e6e8eb] dark:bg-night-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <View className="h-56 overflow-hidden bg-[#171d29]">
          {profile?.coverUrl ? (
            <Image
              source={{ uri: profile.coverUrl }}
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <View className="absolute -right-20 -top-20 h-80 w-80 rounded-full border-[36px] border-white/10 dark:border-white/20" />
          )}
          <View className="absolute inset-0 bg-black/20" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="absolute left-4 top-4 h-10 w-10 items-center justify-center rounded-full bg-black/50"
          >
            <Text className="text-xl font-bold text-white">‹</Text>
          </Pressable>
          <View className="absolute right-4 top-4 rounded-full bg-white/80 dark:bg-night-surface"><AppThemeSwitch /></View>
          {own && editing && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void changeCover()}
              disabled={uploading}
              className="absolute bottom-4 right-4 rounded-full bg-white dark:bg-night-surface px-4 py-2"
            >
              <Text className="text-xs font-black">
                {uploading ? "Uploading…" : "✦ Change cover"}
              </Text>
            </Pressable>
          )}
        </View>
        {loading ? (
          <ActivityIndicator className="mt-12" color="#c62828" />
        ) : error ? (
          <Text className="m-5 rounded-3xl bg-white dark:bg-night-surface p-8 text-center text-black/60 dark:text-night-muted">
            {error}
          </Text>
        ) : (
          profile && (
            <>
              <Animated.View
                entering={FadeInDown.duration(450).springify()}
                className="mx-3 -mt-10 rounded-[28px] border border-white bg-white dark:bg-night-surface px-5 pb-5 pt-14 shadow-lg"
              >
                <View className="absolute -top-11 left-5 h-24 w-24 overflow-hidden rounded-[28px] border-4 border-white bg-[#dfe2e9] dark:bg-night-raised">
                  {profile.avatarUrl ? (
                    <Image
                      source={{ uri: profile.avatarUrl }}
                      contentFit="cover"
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : (
                    <Text className="pt-5 text-center text-4xl">👻</Text>
                  )}
                </View>
                <Text className="self-start rounded-full bg-[#c62828]/10 dark:bg-night-softred px-3 py-1 text-[10px] font-black tracking-widest text-[#a21e1e] dark:text-red-200">
                  {profile.isPage ? '✦ BEACON PAGE' : '✦ G000ST PROFILE'}
                </Text>
                <Text className="mt-2 text-2xl font-black text-[#17191d] dark:text-night-text">
                  {profile.isPage || profile.showDisplayName ? profile.displayName || (profile.isPage ? 'Untitled beacon' : publicId?.slice(0, 8)) : publicId?.slice(0, 8)}
                </Text>
                {own && editing && <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={() => void changeAvatar()} disabled={uploading} className="mt-2 self-start rounded-full bg-[#f0f1f4] px-3 py-2 dark:bg-night-raised"><Text className="text-xs font-black text-[#17191d] dark:text-night-text">Change photo</Text></Pressable>}
                <Pressable
                  onPress={() => {
                    if (publicId)
                      void Clipboard.setStringAsync(publicId).then(() =>
                        Toast.show({
                          type: "success",
                          text1: "Public ID copied.",
                        }),
                      );
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Copy public ID"
                  className="mt-3 flex-row items-center self-start rounded-xl bg-[#f0f1f4] dark:bg-night-surface px-3 py-2"
                >
                  <Text
                    numberOfLines={1}
                    className="max-w-[250px] text-xs text-[#333] dark:text-night-text"
                  >
                    {publicId}
                  </Text>
                  <Text className="ml-2 text-sm">▢</Text>
                </Pressable>
                {!!profile.bio && !editing && (
                  <Text className="mt-4 leading-6 text-black/60 dark:text-night-muted">
                    {profile.bio}
                  </Text>
                )}
                {own && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => { if (editing) void endEdit(); else void beginEdit(); }}
                    className="mt-4 self-start rounded-full border border-black/15 dark:border-night-border px-4 py-2"
                  >
                    <Text className="text-xs font-black text-[#17191d] dark:text-night-text">{editing ? '✎ Cancel editing' : '✎ Edit profile'}</Text>
                  </Pressable>
                )}
                {own && !editing && <Pressable accessibilityRole="button" onPress={switchToThisProfile} className="mt-4 flex-row items-center justify-center rounded-2xl bg-[#17191d] px-4 py-3"><Text className="mr-2 text-xl font-black text-white">⇄</Text><Text className="text-sm font-black text-white">{profile.isPage ? 'التبديل للتفاعل بإسم هذه الصفحة' : 'التبديل للتفاعل بإسم هذا الملف الشخصي'}</Text></Pressable>}
                {own && editing && draft && <View className="mt-5 gap-3 border-t border-black/10 pt-5 dark:border-night-border">
                  <Text className="text-xs font-black text-[#17191d] dark:text-night-text">Name</Text>
                  <TextInput accessibilityLabel="Name" value={draft.displayName} maxLength={60} onChangeText={(value) => setDraft({ ...draft, displayName: value })} className="rounded-xl border border-black/15 bg-white px-3 py-3 text-sm text-[#17191d] dark:border-night-border dark:bg-night-raised dark:text-night-text" />
                  <Text className="text-xs font-black text-[#17191d] dark:text-night-text">Bio</Text>
                  <TextInput accessibilityLabel="Bio" value={draft.bio} maxLength={500} multiline onChangeText={(value) => setDraft({ ...draft, bio: value })} className="min-h-24 rounded-xl border border-black/15 bg-white px-3 py-3 text-sm text-[#17191d] dark:border-night-border dark:bg-night-raised dark:text-night-text" />
                  {([['country', 'Country'], ['hobby', 'Hobby'], ...(!profile.isPage ? [['age', 'Age']] : []), ...(profile.isPage ? [['whatsappNumber', 'WhatsApp number'], ['landlineNumber', 'Landline'], ['contactEmail', 'Email'], ['facebookUrl', 'Facebook URL'], ['instagramUrl', 'Instagram URL'], ['tiktokUrl', 'TikTok URL'], ['linkedinUrl', 'LinkedIn URL']] : [])] as [keyof ProfileDraft, string][]).map(([field, label]) => <View key={field} className="gap-1"><Text className="text-xs font-black text-[#17191d] dark:text-night-text">{label}</Text><TextInput accessibilityLabel={label} value={String(draft[field])} onChangeText={(value) => setDraft({ ...draft, [field]: value })} keyboardType={field === 'age' ? 'number-pad' : field === 'contactEmail' ? 'email-address' : 'default'} autoCapitalize={field === 'contactEmail' || field.endsWith('Url') ? 'none' : 'sentences'} className="rounded-xl border border-black/15 bg-white px-3 py-3 text-sm text-[#17191d] dark:border-night-border dark:bg-night-raised dark:text-night-text" /></View>)}
                  {!profile.isPage && <><View className="flex-row items-center justify-between"><Text className="text-xs font-black text-[#17191d] dark:text-night-text">Show my name</Text><Switch value={draft.showDisplayName} onValueChange={(value) => setDraft({ ...draft, showDisplayName: value })} /></View><View className="flex-row gap-2"><Pressable accessibilityRole="button" onPress={() => setDraft({ ...draft, sex: '' })} className="rounded-xl bg-[#f0f1f4] px-3 py-2"><Text>Not set {draft.sex === '' ? '✓' : ''}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setDraft({ ...draft, sex: 'male' })} className="rounded-xl bg-[#f0f1f4] px-3 py-2"><Text>Male {draft.sex === 'male' ? '✓' : ''}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setDraft({ ...draft, sex: 'female' })} className="rounded-xl bg-[#f0f1f4] px-3 py-2"><Text>Female {draft.sex === 'female' ? '✓' : ''}</Text></Pressable></View></>}
                  <Pressable accessibilityRole="button" disabled={saving} onPress={() => void saveEdit()} className="rounded-2xl bg-g000st-red px-4 py-3 disabled:opacity-50"><Text className="text-center text-sm font-black text-white">{saving ? 'Saving…' : 'Save changes'}</Text></Pressable>
                </View>}
                {!own && (
                  <View className="mt-5 gap-2">
                    <View className="flex-row gap-2">
                      <Action label={followBusy ? "Updating…" : profile.campedByViewer ? "✓ Unfollow" : "➕ Follow"} disabled={followBusy} onPress={() => void toggleFollow()} />
                      <Action label="✉ Chat" primary onPress={() => void openChat()} />
                    </View>
                    <View className="flex-row gap-2">
                      <Action label="📞 Voice" onPress={() => { if (publicId) void callUser(publicId, profile.displayName, "audio"); }} />
                      <Action label="🎥 Video" onPress={() => { if (publicId) void callUser(publicId, profile.displayName, "video"); }} />
                    </View>
                  </View>
                )}
                {!editing && profile.isPage && (profile.whatsappNumber || profile.landlineNumber || profile.contactEmail || profile.facebookUrl || profile.instagramUrl || profile.tiktokUrl || profile.linkedinUrl) && <View className="mt-5 border-t border-black/10 pt-4 dark:border-night-border">
                  {profile.whatsappNumber && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://wa.me/${profile.whatsappNumber!.replace(/\D/g, '')}`)} className="mb-3 flex-row items-center justify-between rounded-2xl bg-[#d8f8e6] px-4 py-3 dark:bg-[#173d2b]"><View><Text className="text-sm font-black text-[#126c3d] dark:text-[#8de5b3]">✆  Chat on WhatsApp</Text><Text className="mt-0.5 text-[11px] text-[#126c3d]/70 dark:text-[#8de5b3]">Open a direct conversation</Text></View><Text className="text-xl font-black text-[#126c3d] dark:text-[#8de5b3]">↗</Text></Pressable>}
                  {profile.landlineNumber && <Pressable accessibilityRole="link" accessibilityLabel={`Call landline ${profile.landlineNumber}`} onPress={() => void Linking.openURL(`tel:${profile.landlineNumber}`)} className="mb-3 flex-row items-center justify-between rounded-2xl border border-[#b7cbe5] bg-[#eef4fc] px-4 py-3 dark:border-[#405a7a] dark:bg-[#202e42]"><View className="min-w-0 flex-1"><Text className="text-[10px] font-black uppercase tracking-[1px] text-[#587398] dark:text-[#9cb9da]">☎ LANDLINE · TAP TO CALL</Text><Text selectable className="mt-1 text-base font-black text-[#233e63] dark:text-[#d3e3f6]">{profile.landlineNumber}</Text></View><View className="ml-3 h-10 w-10 items-center justify-center rounded-full bg-[#2d4669] dark:bg-[#6288b6]"><Text className="text-lg font-black text-white">☎</Text></View></Pressable>}
                  <View className="flex-row flex-wrap gap-2">
                    {([
                      ['Email', profile.contactEmail ? `mailto:${profile.contactEmail}` : undefined],
                      ['Facebook', profile.facebookUrl],
                      ['Instagram', profile.instagramUrl],
                      ['TikTok', profile.tiktokUrl],
                      ['LinkedIn', profile.linkedinUrl],
                    ] as const).filter((item) => !!item[1]).map(([label, url]) => <Pressable key={label} accessibilityRole="link" onPress={() => { if (url) void Linking.openURL(url); }} className="rounded-full border border-black/10 bg-[#f0f1f4] px-4 py-2 dark:border-night-border dark:bg-night-raised"><Text className="text-xs font-black text-[#17191d] dark:text-night-text">{label} ↗</Text></Pressable>)}
                  </View>
                </View>}
              </Animated.View>

              <View className="mx-3 mt-5 flex-row rounded-2xl bg-white dark:bg-night-surface p-1.5">
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === "social" }}
                  onPress={() => setTab("social")}
                  className={`flex-1 rounded-xl py-3 ${tab === "social" ? "bg-[#17191d]" : ""}`}
                >
                  <Text
                    className={`text-center text-sm font-black ${tab === "social" ? "text-white" : "text-black/45 dark:text-night-muted"}`}
                  >
                    ◎ Social
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === "market" }}
                  onPress={() => setTab("market")}
                  className={`flex-1 rounded-xl py-3 ${tab === "market" ? "bg-[#17191d]" : ""}`}
                >
                  <Text
                    className={`text-center text-sm font-black ${tab === "market" ? "text-white" : "text-black/45 dark:text-night-muted"}`}
                  >
                    ◈ Market
                  </Text>
                </Pressable>
              </View>
              <View className="mx-3 mt-4 gap-3">
                {tab === "social" && own && publicId && <ProfilePostComposer key={publicId} publicId={publicId} isPage={profile.isPage} pageNamed={!!profile.displayName?.trim()} onPublished={(post) => setSocial((items) => [post, ...items])} />}
                {(tab === "social" ? social : market).length === 0 && (
                  <Text className="rounded-3xl bg-white dark:bg-night-surface p-12 text-center text-sm text-black/45 dark:text-night-muted">
                    {tab === "social"
                      ? "No public social posts yet."
                      : "No market listings yet."}
                  </Text>
                )}
                {tab === "social"
                  ? social.map((post, index) => (
                    <Animated.View
                      entering={FadeInDown.delay(
                        Math.min(index * 45, 250),
                      ).duration(350)}
                      key={post.id}
                    >
                      <SocialCard post={post} />
                    </Animated.View>
                  ))
                  : market.map((post, index) => (
                    <Animated.View
                      entering={FadeInDown.delay(
                        Math.min(index * 45, 250),
                      ).duration(350)}
                      key={post.id}
                    >
                      <MarketCard post={post} />
                    </Animated.View>
                  ))}
                {!!cursors[tab] && (
                  <Pressable
                    onPress={() => void loadMore()}
                    disabled={loadingMore}
                    className="rounded-2xl bg-white dark:bg-night-surface p-4"
                  >
                    <Text className="text-center text-sm font-black">
                      {loadingMore ? "Loading…" : "Load more"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          )
        )}
      </ScrollView>
    </View>
  );
}

function Action({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`flex-1 rounded-2xl py-3 ${primary ? "bg-[#c62828]" : "bg-[#17191d]"} ${disabled ? "opacity-50" : ""}`}
    >
      <Text className="text-center text-xs font-black text-white">{label}</Text>
    </Pressable>
  );
}

function CardHeader({
  name,
  avatarUrl,
  createdAtMs,
}: {
  name: string;
  avatarUrl?: string;
  createdAtMs: number;
}) {
  return (
    <View className="flex-row items-center gap-3 p-4">
      <View className="h-10 w-10 overflow-hidden rounded-full bg-[#222]">
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 40, height: 40 }}
            contentFit="cover"
          />
        ) : (
          <Text className="pt-2 text-center text-white">👻</Text>
        )}
      </View>
      <View>
        <Text className="text-sm font-black">{name}</Text>
        <Text className="text-xs text-black/40 dark:text-night-muted">
          {new Date(createdAtMs).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

function SocialCard({ post }: { post: SocialPost }) {
  return (
    <View className="overflow-hidden rounded-3xl bg-white dark:bg-night-surface">
      <CardHeader
        name={post.author.displayName}
        avatarUrl={post.author.avatarUrl}
        createdAtMs={post.createdAtMs}
      />
      <Text className="px-4 pb-4 text-sm leading-6">{post.content}</Text>
      {post.sharedPost && (
        <View className="mx-4 mb-4 overflow-hidden rounded-2xl bg-[#f1f2f4] dark:bg-night-raised">
          <View className="p-4">
            <Text className="text-xs font-black">
              {post.sharedPost.author.displayName}
            </Text>
            <Text className="mt-1 text-sm">{post.sharedPost.content}</Text>
          </View>
          {post.sharedPost.media?.map((item) => (
            <CardMedia key={item.id} item={item} />
          ))}
        </View>
      )}
      {post.media?.map((item) => (
        <CardMedia key={item.id} item={item} />
      ))}
      <Text className="p-4 text-xs text-black/40 dark:text-night-muted">
        ♡ {post.likeCount} ◌ {post.commentCount}
      </Text>
    </View>
  );
}

function MarketCard({ post }: { post: MarketPost }) {
  return (
    <View className="overflow-hidden rounded-3xl bg-white dark:bg-night-surface">
      <CardHeader
        name={post.author.displayName}
        avatarUrl={post.author.avatarUrl}
        createdAtMs={post.createdAtMs}
      />
      <Text className="px-4 pb-3 text-sm leading-6">{post.content}</Text>
      <View className="flex-row flex-wrap gap-2 px-4 pb-4">
        <Text className="rounded-full bg-[#c62828] px-3 py-1.5 text-xs font-black text-white">
          {post.price.toLocaleString()} {post.currency}
        </Text>
        <Text className="rounded-full bg-[#f0f1f4] dark:bg-night-surface px-3 py-1.5 text-xs font-black">
          {post.city}
        </Text>
        <Text className="rounded-full bg-[#f0f1f4] dark:bg-night-surface px-3 py-1.5 text-xs font-black">
          Qty {post.quantity}
        </Text>
      </View>
      {post.media?.map((item) => (
        <CardMedia key={item.id} item={item} />
      ))}
      <Text className="p-4 text-xs text-black/40 dark:text-night-muted">
        ♡ {post.likeCount} ◌ {post.commentCount}
      </Text>
    </View>
  );
}

function CardMedia({
  item,
}: {
  item: { kind: "image" | "video"; url: string };
}) {
  return item.kind === "video" ? (
    <ProfileVideo url={item.url} />
  ) : (
    <Image
      source={{ uri: item.url }}
      contentFit="cover"
      style={{ width: "100%", height: 220 }}
    />
  );
}

function ProfileVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return (
    <VideoView
      player={player}
      nativeControls
      style={{ width: "100%", height: 220 }}
    />
  );
}
