import { memo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { FeatureScreen } from '@/components/layout/feature-screen';

type IdentityScreenContentProps = Readonly<{
  onCopyPublicId: () => void;
  onSignOut: () => void;
  publicId: string;
}>;

function IdentityScreenContentComponent({
  onCopyPublicId,
  onSignOut,
  publicId,
}: IdentityScreenContentProps) {
  return (
    <FeatureScreen title="ID & Profile">
      <ScrollView className="flex-1" contentContainerClassName="p-3">
        <View className="mb-3 rounded-[22px] border border-white/60 bg-[#D0D0D0] p-4">
          <Text className="mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/45">
            Your Public ID
          </Text>
          <Text selectable className="mb-3 font-mono text-[13px] font-black leading-[19px] text-g000st-red">
            {publicId}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="h-11 items-center justify-center rounded-field border border-g000st-black bg-[#D0D0D0] active:opacity-70"
            onPress={onCopyPublicId}
          >
            <Text className="text-[13px] font-black text-g000st-black">Copy Public ID</Text>
          </Pressable>
        </View>

        <View className="mb-3 rounded-[18px] border border-white/60 bg-[#D0D0D0] p-4">
          <Text className="text-sm font-black text-g000st-black">Recovery ID</Text>
          <Text className="mt-1 text-xs font-semibold leading-[17px] text-black/50">
            It remains private and is never shown on your public profile.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          className="h-11 items-center justify-center rounded-full border border-black/15 bg-white active:opacity-70"
          onPress={onSignOut}
        >
          <Text className="text-sm font-bold text-g000st-red">Sign out from this device</Text>
        </Pressable>
      </ScrollView>
    </FeatureScreen>
  );
}

export const IdentityScreenContent = memo(IdentityScreenContentComponent);
