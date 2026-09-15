import { memo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FeatureScreen } from '@/components/layout/feature-screen';

function ContactsScreenContentComponent() {
  return (
    <FeatureScreen
      title="Contacts"
      rightAction={
        <View className="flex-row gap-2">
          <Pressable className="h-8 justify-center rounded-full border-[1.5px] border-g000st-silver bg-white px-3">
            <Text className="text-xs font-extrabold text-g000st-silver">My QR</Text>
          </Pressable>
          <Pressable className="h-8 justify-center rounded-full bg-g000st-silver px-3.5">
            <Text className="text-xs font-extrabold text-white">+ Add</Text>
          </Pressable>
        </View>
      }
    >
      <View className="mx-3 my-3 h-[42px] flex-row items-center rounded-full border border-black/15 bg-white px-3.5">
        <Text className="mr-2 text-base text-black/40">⌕</Text>
        <TextInput
          className="flex-1 text-sm text-g000st-black"
          placeholder="Search name or g000st..."
          placeholderTextColor="#777777"
        />
      </View>
      <View className="flex-row gap-2 px-3 pb-2">
        <View className="h-7 justify-center rounded-full bg-g000st-silver px-3">
          <Text className="text-[11px] font-bold text-white">All</Text>
        </View>
        <View className="h-7 justify-center rounded-full border border-black/10 bg-white/80 px-3">
          <Text className="text-[11px] font-bold text-black/60">Online</Text>
        </View>
        <View className="h-7 justify-center rounded-full border border-black/10 bg-white/80 px-3">
          <Text className="text-[11px] font-bold text-black/60">Favorites</Text>
        </View>
      </View>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-[13px] font-semibold text-black/45">
          No contacts yet.
        </Text>
      </View>
    </FeatureScreen>
  );
}

export const ContactsScreenContent = memo(ContactsScreenContentComponent);
