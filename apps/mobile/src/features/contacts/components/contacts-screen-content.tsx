import { Image } from 'expo-image';
import { memo } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { FeatureScreen } from '@/components/layout/feature-screen';
import type { Contact } from '@/domain/contacts/types';
import type { ContactsTab } from '@/features/contacts/hooks/use-contacts-screen';

type ContactsScreenContentProps = Readonly<{
  addError: string | null;
  addValue: string;
  contacts: readonly Contact[];
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
  onRemove: (contact: Contact) => void;
  onSubmitAdd: () => void;
  query: string;
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
      className={`h-7 justify-center rounded-full px-3 ${
        active ? 'bg-g000st-silver' : 'border border-black/10 bg-white/80'
      }`}
      onPress={onPress}
    >
      <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-black/60'}`}>
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
}: Readonly<{
  contact: Contact;
  onOpenChat: (publicId: string) => void;
  onCallAudio: (contact: Contact) => void;
  onCallVideo: (contact: Contact) => void;
  onRemove: (contact: Contact) => void;
}>) {
  return (
    <Pressable
      className="mx-3 mb-2 flex-row items-center gap-3 rounded-2xl border border-black/10 bg-white p-3"
      onPress={() => onOpenChat(contact.publicId)}
    >
      <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#DDD]">
        {contact.avatarUrl ? (
          <Image contentFit="cover" source={{ uri: contact.avatarUrl }} style={{ height: '100%', width: '100%' }} />
        ) : (
          <Text>◎</Text>
        )}
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {contact.online ? <View className="h-2 w-2 rounded-full bg-[#4CAF50]" /> : null}
          <Text className="font-black text-g000st-black" numberOfLines={1}>
            {contact.displayName || contact.publicId.slice(0, 12)}
          </Text>
        </View>
        <Text className="font-mono text-[10px] text-black/40" numberOfLines={1}>
          {contact.publicId}
        </Text>
      </View>
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
        accessibilityLabel="Remove contact"
        accessibilityRole="button"
        className="h-8 w-8 items-center justify-center rounded-full"
        onPress={() => onRemove(contact)}
      >
        <Text className="text-lg font-black text-black/30">×</Text>
      </Pressable>
    </Pressable>
  );
}

function ContactsScreenContentComponent({
  addError,
  addValue,
  contacts,
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
  onRemove,
  onSubmitAdd,
  query,
  tab,
}: ContactsScreenContentProps) {
  return (
    <FeatureScreen
      title="Contacts"
      rightAction={
        <Pressable
          accessibilityRole="button"
          className="h-8 justify-center rounded-full bg-g000st-silver px-3.5"
          onPress={onOpenAdd}
        >
          <Text className="text-xs font-extrabold text-white">+ Add</Text>
        </Pressable>
      }
    >
      <View className="mx-3 my-3 h-[42px] flex-row items-center rounded-full border border-black/15 bg-white px-3.5">
        <Text className="mr-2 text-base text-black/40">⌕</Text>
        <TextInput
          className="flex-1 text-sm text-g000st-black"
          onChangeText={onChangeQuery}
          placeholder="Search name or g000st..."
          placeholderTextColor="#777777"
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
          <Text className="text-center text-[13px] font-semibold text-black/45">
            {tab === 'online' ? 'No contacts online right now.' : 'No contacts yet. Add someone by their Public ID.'}
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
              onOpenChat={onOpenChat}
              onRemove={onRemove}
            />
          )}
        />
      )}

      <Modal animationType="fade" onRequestClose={onCloseAdd} transparent visible={isAddOpen}>
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full max-w-[400px] rounded-[22px] border border-white/70 bg-[#F2F2F2] p-5">
            <Text className="text-center text-lg font-black text-g000st-black">Add contact</Text>
            <Text className="mb-4 mt-2 text-center text-xs font-semibold leading-5 text-g000st-muted">
              Paste their Public ID to add them to your contacts.
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              className="h-12 rounded-field border-2 border-black/10 bg-white px-3 font-mono text-xs font-black text-g000st-black"
              onChangeText={onChangeAddValue}
              placeholder="Public ID"
              placeholderTextColor="#999999"
              value={addValue}
            />
            {addError ? (
              <Text className="mt-2 text-xs font-bold text-g000st-red">{addError}</Text>
            ) : null}
            <View className="mt-4 flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                className="h-12 flex-1 items-center justify-center rounded-field border-2 border-g000st-black active:opacity-70 disabled:opacity-60"
                disabled={isAdding}
                onPress={onCloseAdd}
              >
                <Text className="font-black text-g000st-black">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="h-12 flex-1 items-center justify-center rounded-field bg-g000st-red active:opacity-80 disabled:opacity-60"
                disabled={isAdding}
                onPress={onSubmitAdd}
              >
                {isAdding ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-black text-white">Add</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </FeatureScreen>
  );
}

export const ContactsScreenContent = memo(ContactsScreenContentComponent);
