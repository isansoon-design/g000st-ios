import { Image } from 'expo-image';
import { memo } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { FeatureScreen } from '@/components/layout/feature-screen';
import type { IdentityProfileFields } from '@/features/identity/hooks/use-identity-screen';

type IdentityScreenContentProps = Readonly<{
  avatarUrl?: string;
  deleting: boolean;
  fields: IdentityProfileFields;
  loading: boolean;
  onChangePhoto: () => void;
  onCopyPublicId: () => void;
  onCopyRecoveryId: () => void;
  onDeleteAccount: () => void;
  onSave: () => void;
  onSetField: <K extends keyof IdentityProfileFields>(key: K, value: IdentityProfileFields[K]) => void;
  onSignOut: () => void;
  publicId: string;
  recoveryId: string | null;
  saving: boolean;
  uploadingPhoto: boolean;
}>;

const CARD = 'rounded-[22px] border border-white/60 bg-[#D0D0D0] p-4';
const LABEL = 'mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/45';
const FIELD_INPUT = 'h-12 pb-2 rounded-field border border-black/10 bg-white px-3 text-[13px] font-bold text-g000st-black';

function IdentityScreenContentComponent({
  avatarUrl,
  deleting,
  fields,
  loading,
  onChangePhoto,
  onCopyPublicId,
  onCopyRecoveryId,
  onDeleteAccount,
  onSave,
  onSetField,
  onSignOut,
  publicId,
  recoveryId,
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
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="items-center p-4"
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
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

        {/* Name visibility */}
        <View className="mb-4 w-full rounded-[18px] border border-white/60 bg-[#D0D0D0] p-3">
          <View className="flex-row items-center gap-3">
            <TextInput
              className="h-12 min-w-0 flex-1 rounded-field border border-black/10 bg-white px-3 text-[15px] font-black text-g000st-black"
              maxLength={60}
              onChangeText={(value) => onSetField('displayName', value)}
              placeholder="Add your name"
              placeholderTextColor="rgba(0,0,0,0.35)"
              value={fields.displayName}
            />
            <View className="items-center">
              <Text className="mb-1 text-[10px] font-black text-black/55">Show name</Text>
              <Switch
                accessibilityLabel="Show my name"
                accessibilityRole="switch"
                onValueChange={(value) => onSetField('showDisplayName', value)}
                thumbColor="#FFFFFF"
                trackColor={{ false: '#9A9A9A', true: '#C62828' }}
                value={fields.showDisplayName}
              />
            </View>
          </View>
          <Text className="mt-2 text-[11px] font-semibold leading-[16px] text-black/45">
            Show your name to other users, or turn this off to use your 8-character alias ({publicId.slice(-8)}).
          </Text>
        </View>

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



        {/* Optional profile */}
        <View className={`mb-3 w-full ${CARD}`}>
          <Text className={LABEL}>Optional profile</Text>

          <Text className="mb-1 mt-2 text-[11px] font-bold text-black/45">Country</Text>
          <TextInput
            className={`mb-3   ${FIELD_INPUT}`}
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
                className={`h-11 flex-1 items-center justify-center rounded-field border ${fields.sex === option ? 'border-g000st-black bg-g000st-black' : 'border-black/15 bg-white'
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

        {/* Recovery ID */}
        <View className="my-3 w-full overflow-hidden rounded-[22px] border border-[#C62828]/35 bg-[#191919] p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-[#FFB9B9]">PRIVATE KEY</Text>
              <Text className="mt-1 text-[19px] font-black text-white">My ID</Text>
            </View>
            <View className="rounded-full border border-[#FFB9B9]/40 bg-[#C62828]/20 px-3 py-1">
              <Text className="text-[10px] font-black uppercase text-[#FFB9B9]">Recovery ID</Text>
            </View>
          </View>
          {recoveryId ? (
            <>
              <Text selectable className="rounded-[14px] border border-white/15 bg-white/10 p-3 font-mono text-[13px] font-bold leading-[21px] text-white">
                {recoveryId}
              </Text>
              <Pressable
                accessibilityLabel="Copy private Recovery ID"
                accessibilityRole="button"
                className="mt-3 h-11 items-center justify-center rounded-[12px] bg-white active:opacity-75"
                onPress={onCopyRecoveryId}
              >
                <Text className="text-[13px] font-black text-[#191919]">Copy my ID</Text>
              </Pressable>
            </>
          ) : (
            <Text className="rounded-[14px] border border-white/15 bg-white/10 p-3 text-[13px] font-bold leading-[19px] text-white/75">
              Your Recovery ID is not saved on this device yet. It will appear here after your next sign in.
            </Text>
          )}
          <View className="mt-3 rounded-[12px] border border-[#FFB9B9]/25 bg-[#C62828]/15 p-3">
            <Text className="text-[12px] font-bold leading-[18px] text-[#FFE0E0]">
              Keep this key secret. Never share it with anyone. You need it to sign in again.
            </Text>
          </View>
        </View>
        {/* Sign out */}
        <Pressable
          accessibilityRole="button"
          className="mb-6 h-11 w-full items-center justify-center rounded-full border border-black/15 bg-white active:opacity-70"
          onPress={onSignOut}
        >
          <Text className="text-sm font-bold text-g000st-red">Sign out from this device</Text>
        </Pressable>

        {/* Account deletion */}
        <Pressable
          accessibilityHint="Permanently deletes your account"
          accessibilityRole="button"
          className="mb-10 h-11 w-full items-center justify-center rounded-full border border-g000st-red bg-transparent active:opacity-70 disabled:opacity-60"
          disabled={deleting}
          onPress={onDeleteAccount}
        >
          {deleting ? (
            <ActivityIndicator color="#C62828" />
          ) : (
            <Text className="text-sm font-black text-g000st-red">Delete my account</Text>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
    </FeatureScreen>
  );
}

export const IdentityScreenContent = memo(IdentityScreenContentComponent);
