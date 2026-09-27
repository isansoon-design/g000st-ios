import { Image } from 'expo-image';
import { memo } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { FeatureScreen } from '@/components/layout/feature-screen';
import type { Contact } from '@/domain/contacts/types';
import type { ContactsTab } from '@/features/contacts/hooks/use-contacts-screen';
import { useAppTheme } from '@/theme/app-theme';

type ContactsScreenContentProps = Readonly<{
  addError: string | null;
  addValue: string;
  contacts: readonly Contact[];
  editingContact: Contact | null;
  isAddOpen: boolean;
  isAdding: boolean;
  loading: boolean;
  onChangeAddValue: (value: string) => void;
  onChangeQuery: (value: string) => void;
  onChangeTab: (tab: ContactsTab) => void;
  onCloseAdd: () => void;
  onOpenAdd: () => void;
  onOpenChat: (publicId: string) => void;
  onCallAudio: (contact: Contact) => void;
  onCallVideo: (contact: Contact) => void;
  onEditNickname: (contact: Contact) => void;
  onCloseNickname: () => void;
  onChangeNickname: (value: string) => void;
  onSaveNickname: () => void;
  onRemove: (contact: Contact) => void;
  onSubmitAdd: () => void;
  query: string;
  nickname: string;
  tab: ContactsTab;
}>;

function TabChip({
  active,
  label,
  onPress,
}: Readonly<{ active: boolean; label: string; onPress: () => void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`h-7 justify-center rounded-full px-3 ${active ? 'bg-g000st-silver dark:bg-night-control' : 'border border-black/10 dark:border-night-border bg-white/80 dark:bg-night-surface'
        }`}
      onPress={onPress}
    >
      <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-black/60 dark:text-night-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function ContactRow({
  contact,
  onOpenChat,
  onCallAudio,
  onCallVideo,
  onRemove,
  onEditNickname,
}: Readonly<{
  contact: Contact;
  onOpenChat: (publicId: string) => void;
  onCallAudio: (contact: Contact) => void;
  onCallVideo: (contact: Contact) => void;
  onRemove: (contact: Contact) => void;
  onEditNickname: (contact: Contact) => void;
}>) {
  return (
    <Pressable
      className="mx-3 mb-2 flex-row items-center gap-3 rounded-2xl border border-black/10 dark:border-night-border bg-white dark:bg-night-surface p-3"
      onPress={() => onOpenChat(contact.publicId)}
    >
      <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#DDD] dark:bg-night-raised">
        {contact.avatarUrl ? (
          <Image contentFit="cover" source={{ uri: contact.avatarUrl }} style={{ height: '100%', width: '100%' }} />
        ) : (
          <Text>◎</Text>
        )}
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {contact.online ? <View className="h-2 w-2 rounded-full bg-[#4CAF50]" /> : null}
          <Text className="font-black text-g000st-black dark:text-night-text" numberOfLines={1}>
            {contact.nickname || contact.displayName || contact.publicId.slice(0, 8)}
          </Text>
        </View>
        <Text className="font-mono text-[10px] text-black/40 dark:text-night-muted" numberOfLines={1}>
          {contact.publicId}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Edit friend's name"
        accessibilityRole="button"
        className="h-8 w-8 items-center justify-center rounded-full"
        onPress={() => onEditNickname(contact)}
      ><Text className="text-base">✎</Text></Pressable>
      <Pressable
        accessibilityLabel="Call"
        accessibilityRole="button"
        className="h-8 w-8 items-center justify-center rounded-full active:bg-black/5"
        onPress={() => onCallAudio(contact)}
      >
        <Text className="text-base">📞</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Video call"
        accessibilityRole="button"
        className="h-8 w-8 items-center justify-center rounded-full active:bg-black/5"
        onPress={() => onCallVideo(contact)}
      >
        <Text className="text-base">🎥</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Unfollow friend"
        accessibilityRole="button"
        className="h-8 w-8 items-center justify-center rounded-full"
        onPress={() => onRemove(contact)}
      >
        <Text className="text-lg font-black text-black/30 dark:text-night-muted">×</Text>
      </Pressable>
    </Pressable>
  );
}

function ContactsScreenContentComponent({
  addError,
  addValue,
  contacts,
  editingContact,
  isAddOpen,
  isAdding,
  loading,
  onChangeAddValue,
  onChangeQuery,
  onChangeTab,
  onCloseAdd,
  onOpenAdd,
  onOpenChat,
  onCallAudio,
  onCallVideo,
  onEditNickname,
  onCloseNickname,
  onChangeNickname,
  onSaveNickname,
  onRemove,
  onSubmitAdd,
  query,
  nickname,
  tab,
}: ContactsScreenContentProps) {
  const { isDark } = useAppTheme();
  return (
    <FeatureScreen
      title={
        <View className="h-14 flex-row items-center justify-between border-b border-black/10 dark:border-night-border  px-4">
          <Text className="text-lg font-black text-[#1A1A1A] dark:text-night-text">
            g<Text className="text-[#C62828]">000</Text>
            st
            <Text className="text-[#C62828]">F</Text>
            riends

          </Text>

        </View>
      }
      rightAction={
        <Pressable
          accessibilityRole="button"
          className="h-8 justify-center rounded-full bg-g000st-silver dark:bg-night-control px-3.5"
          onPress={onOpenAdd}
        >
          <Text className="text-xs font-extrabold text-white">+ Follow</Text>
        </Pressable>
      }
    >
      <View className="mx-3 my-3 h-[42px] flex-row items-center rounded-full border border-black/15 dark:border-night-border bg-white dark:bg-night-surface px-3.5">
        <Text className="mr-2 text-base text-black/40 dark:text-night-muted">⌕</Text>
        <TextInput
          className="flex-1 text-sm text-g000st-black dark:text-night-text"
          onChangeText={onChangeQuery}
          placeholder="Search name or g000st..."
          placeholderTextColor={isDark ? '#C4C3C6' : '#777777'}
          value={query}
        />
      </View>
      <View className="flex-row gap-2 px-3 pb-2">
        <TabChip active={tab === 'all'} label="All" onPress={() => onChangeTab('all')} />
        <TabChip active={tab === 'online'} label="Online" onPress={() => onChangeTab('online')} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#9A9A9A" />
        </View>
      ) : contacts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-[13px] font-semibold text-black/45 dark:text-night-muted">
            {tab === 'online' ? 'No friends online right now.' : 'No friends yet. Follow someone from Social or Market.'}
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingBottom: 12, paddingTop: 4 }}
          data={contacts}
          keyExtractor={(item) => item.publicId}
          renderItem={({ item }) => (
            <ContactRow
              contact={item}
              onCallAudio={onCallAudio}
              onCallVideo={onCallVideo}
              onEditNickname={onEditNickname}
              onOpenChat={onOpenChat}
              onRemove={onRemove}
            />
          )}
        />
      )}

      <Modal animationType="fade" onRequestClose={onCloseAdd} transparent visible={isAddOpen}>
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full max-w-[400px] rounded-[22px] border border-white/70 dark:border-white/20 bg-[#F2F2F2] dark:bg-night-surface p-5">
            <Text className="text-center text-lg font-black text-g000st-black dark:text-night-text">Follow someone</Text>
            <Text className="mb-4 mt-2 text-center text-xs font-semibold leading-5 text-g000st-muted dark:text-night-muted">
              Paste their Public ID to follow them. They will appear in your Friends list.
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              className="h-12 rounded-field border-2 border-black/10 dark:border-night-border bg-white dark:bg-night-surface px-3 font-mono text-xs font-black text-g000st-black dark:text-night-text"
              onChangeText={onChangeAddValue}
              placeholder="Public ID"
              placeholderTextColor={isDark ? '#C4C3C6' : '#999999'}
              value={addValue}
            />
            {addError ? (
              <Text className="mt-2 text-xs font-bold text-g000st-red">{addError}</Text>
            ) : null}
            <View className="mt-4 flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                className="h-12 flex-1 items-center justify-center rounded-field border-2 border-g000st-black dark:border-night-border active:opacity-70 disabled:opacity-60"
                disabled={isAdding}
                onPress={onCloseAdd}
              >
                <Text className="font-black text-g000st-black dark:text-night-text">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="h-12 flex-1 items-center justify-center rounded-field bg-g000st-red active:opacity-80 disabled:opacity-60"
                disabled={isAdding}
                onPress={onSubmitAdd}
              >
                {isAdding ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-black text-white">Follow</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal animationType="fade" onRequestClose={onCloseNickname} transparent visible={!!editingContact}>
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full max-w-[400px] gap-3 rounded-[22px] bg-white dark:bg-night-surface p-5">
            <Text className="text-lg font-black">Friend name</Text>
            <TextInput value={nickname} onChangeText={onChangeNickname} placeholder="Name shown only to you" maxLength={80} autoFocus className="h-12 rounded-xl border border-black/15 dark:border-night-border px-3" />
            <View className="flex-row gap-2"><Pressable onPress={onCloseNickname} className="flex-1 rounded-xl bg-[#DDD] dark:bg-night-raised p-3"><Text className="text-center font-black">Cancel</Text></Pressable><Pressable onPress={onSaveNickname} className="flex-1 rounded-xl bg-black p-3"><Text className="text-center font-black text-white">Save</Text></Pressable></View>
          </View>
        </View>
      </Modal>
    </FeatureScreen>
  );
}

export const ContactsScreenContent = memo(ContactsScreenContentComponent);
