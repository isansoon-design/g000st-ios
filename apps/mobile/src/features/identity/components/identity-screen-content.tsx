import { Image } from 'expo-image';
import { memo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { FeatureScreen } from '@/components/layout/feature-screen';
import type { IdentityProfileFields } from '@/features/identity/hooks/use-identity-screen';

type IdentityScreenContentProps = Readonly<{
  avatarUrl?: string;
  fields: IdentityProfileFields;
  loading: boolean;
  onChangePhoto: () => void;
  onCopyPublicId: () => void;
  onSave: () => void;
  onSetField: <K extends keyof IdentityProfileFields>(key: K, value: IdentityProfileFields[K]) => void;
  onSignOut: () => void;
  publicId: string;
  saving: boolean;
  uploadingPhoto: boolean;
}>;

const CARD = 'rounded-[22px] border border-white/60 bg-[#D0D0D0] p-4';
const LABEL = 'mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/45';
const FIELD_INPUT = 'h-11 rounded-field border border-black/10 bg-white px-3 text-[13px] font-bold text-g000st-black';

function IdentityScreenContentComponent({
  avatarUrl,
  fields,
  loading,
  onChangePhoto,
  onCopyPublicId,
  onSave,
  onSetField,
  onSignOut,
  publicId,
  saving,
  uploadingPhoto,
}: IdentityScreenContentProps) {
  if (loading) {
    return (
      <FeatureScreen title="ID & Profile">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C62828" />
        </View>
      </FeatureScreen>
    );
  }

  return (
    <FeatureScreen title="ID & Profile">
      <ScrollView className="flex-1" contentContainerClassName="items-center p-4">
        {/* Photo */}
        <Pressable
          accessibilityLabel="Change profile photo"
          accessibilityRole="button"
          className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#C8C8C8] active:opacity-80"
          onPress={onChangePhoto}
        >
          {uploadingPhoto ? (
            <ActivityIndicator color="#C62828" />
          ) : avatarUrl ? (
            <Image contentFit="cover" source={{ uri: avatarUrl }} style={{ height: '100%', width: '100%' }} />
          ) : (
            <Text className="text-3xl">◎</Text>
          )}
        </Pressable>
        <Pressable accessibilityRole="button" className="mt-2 mb-4" onPress={onChangePhoto}>
          <Text className="text-xs font-black text-g000st-red">
            {avatarUrl ? 'Change photo' : 'Add photo'}
          </Text>
        </Pressable>

        {/* Name */}
        <TextInput
          className="mb-4 w-full text-center text-lg font-black text-g000st-black"
          maxLength={60}
          onChangeText={(value) => onSetField('displayName', value)}
          placeholder="Add your name"
          placeholderTextColor="rgba(0,0,0,0.35)"
          value={fields.displayName}
        />

        {/* Public ID */}
        <View className={`mb-3 w-full ${CARD}`}>
          <Text className={LABEL}>Your Public ID</Text>
          <Text selectable className="mb-3 font-mono text-[13px] font-black leading-[19px] text-g000st-red">
            {publicId}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="h-11 items-center justify-center rounded-field border border-g000st-black bg-white active:opacity-70"
            onPress={onCopyPublicId}
          >
            <Text className="text-[13px] font-black text-g000st-black">Copy Public ID</Text>
          </Pressable>
          <Text className="mt-2 text-[11px] font-semibold leading-[16px] text-black/45">
            Safe to share. People use it to find and message you.
          </Text>
        </View>

        {/* Recovery ID */}
        <View className={`mb-3 w-full ${CARD}`}>
          <Text className={LABEL}>Recovery ID</Text>
          <Text className="text-[13px] font-bold leading-[18px] text-black/60">
            Shown only once, when your account was created. It is your login credential — we never
            store or display it again. If you lost it, this device stays signed in, but you cannot
            sign in again elsewhere without it.
          </Text>
        </View>

        {/* Optional profile */}
        <View className={`mb-3 w-full ${CARD}`}>
          <Text className={LABEL}>Optional profile</Text>

          <Text className="mb-1 mt-2 text-[11px] font-bold text-black/45">Country</Text>
          <TextInput
            className={`mb-3 ${FIELD_INPUT}`}
            onChangeText={(value) => onSetField('country', value)}
            placeholder="Country"
            value={fields.country}
          />

          <Text className="mb-1 text-[11px] font-bold text-black/45">Age</Text>
          <TextInput
            className={`mb-3 ${FIELD_INPUT}`}
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={(value) => onSetField('age', value.replace(/[^0-9]/g, ''))}
            placeholder="Age"
            value={fields.age}
          />

          <Text className="mb-1 text-[11px] font-bold text-black/45">Sex</Text>
          <View className="mb-3 flex-row gap-2">
            {(['male', 'female'] as const).map((option) => (
              <Pressable
                accessibilityRole="button"
                className={`h-11 flex-1 items-center justify-center rounded-field border ${
                  fields.sex === option ? 'border-g000st-black bg-g000st-black' : 'border-black/15 bg-white'
                }`}
                key={option}
                onPress={() => onSetField('sex', fields.sex === option ? '' : option)}
              >
                <Text className={`text-[13px] font-black ${fields.sex === option ? 'text-white' : 'text-g000st-black'}`}>
                  {option === 'male' ? 'Male' : 'Female'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-1 text-[11px] font-bold text-black/45">Hobby</Text>
          <TextInput
            className={`mb-3 ${FIELD_INPUT}`}
            onChangeText={(value) => onSetField('hobby', value)}
            placeholder="e.g. hiking, football…"
            value={fields.hobby}
          />

          <Text className="mb-1 text-[11px] font-bold text-black/45">Bio</Text>
          <TextInput
            className="h-24 rounded-field border border-black/10 bg-white px-3 py-2 text-[13px] font-bold text-g000st-black"
            multiline
            onChangeText={(value) => onSetField('bio', value)}
            placeholder="A short bio (optional)"
            textAlignVertical="top"
            value={fields.bio}
          />

          <Text className="mt-2 text-[11px] font-semibold text-black/40">
            Nothing here is required. Fill in only what you want.
          </Text>
        </View>

        {/* Save */}
        <Pressable
          accessibilityRole="button"
          className="mb-3 h-12 w-full items-center justify-center rounded-field bg-g000st-red active:opacity-80 disabled:opacity-60"
          disabled={saving}
          onPress={onSave}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-sm font-black text-white">Save profile</Text>}
        </Pressable>

        {/* Sign out */}
        <Pressable
          accessibilityRole="button"
          className="mb-6 h-11 w-full items-center justify-center rounded-full border border-black/15 bg-white active:opacity-70"
          onPress={onSignOut}
        >
          <Text className="text-sm font-bold text-g000st-red">Sign out from this device</Text>
        </Pressable>
      </ScrollView>
    </FeatureScreen>
  );
}

export const IdentityScreenContent = memo(IdentityScreenContentComponent);
