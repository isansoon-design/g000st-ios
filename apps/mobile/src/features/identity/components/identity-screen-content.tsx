import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import { memo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { FeatureScreen } from "@/components/layout/feature-screen";
import { AppThemeSwitch } from "@/components/navigation/app-theme-switch";
import { useTabBarScroll } from "@/components/navigation/tab-bar-scroll";
import { BeaconSwitcher } from "@/features/identity/components/beacon-switcher";
import type { IdentityProfileFields } from "@/features/identity/hooks/use-identity-screen";
import { avatarImageSource } from "@/services/media/avatar-image-source";
import { useAppTheme } from "@/theme/app-theme";

type IdentityScreenContentProps = Readonly<{
  avatarUrl?: string;
  coverUrl?: string;
  isPage: boolean;
  deleting: boolean;
  fields: IdentityProfileFields;
  loading: boolean;
  onChangeCover: () => void;
  onChangePhoto: () => void;
  onCopyPublicId: () => void;
  onCopyRecoveryId: () => void;
  onDeleteAccount: () => void;
  onSave: () => void;
  onSetField: <K extends keyof IdentityProfileFields>(
    key: K,
    value: IdentityProfileFields[K],
  ) => void;
  onSignOut: () => void;
  publicId: string;
  recoveryId: string | null;
  saving: boolean;
  uploadingCover: boolean;
  uploadingPhoto: boolean;
}>;

const CARD =
  "rounded-[22px] border border-white/60 dark:border-white/20 bg-[#D0D0D0] dark:bg-night-header p-4";
const LABEL =
  "mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/45 dark:text-night-muted";
const FIELD_INPUT =
  "h-12 pb-2 rounded-field border border-black/10 dark:border-night-border bg-white dark:bg-night-surface px-3 text-[13px] font-bold text-g000st-black dark:text-night-text";

function AppearanceCard() {
  const { isDark } = useAppTheme();
  return (
    <View className="mb-4 w-full flex-row items-center justify-between rounded-[18px] border border-white/60 bg-[#D0D0D0] px-4 py-2 dark:border-white/20 dark:bg-night-header">
      <View>
        <Text className="text-sm font-black text-g000st-black dark:text-night-text">
          Appearance
        </Text>
        <Text className="text-xs font-semibold text-g000st-muted dark:text-night-muted">
          {isDark ? "Dark mode" : "Light mode"}
        </Text>
      </View>
      <AppThemeSwitch />
    </View>
  );
}

function IdentityAvatarImage({ avatarUrl }: { avatarUrl: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Image
        contentFit="cover"
        onDisplay={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        source={avatarImageSource(avatarUrl)}
        style={{ height: 92, width: 92 }}
      />
      {loading ? (
        <View className="absolute inset-0 items-center justify-center bg-[#C8C8C8] dark:bg-night-raised">
          <ActivityIndicator color="#C62828" />
        </View>
      ) : failed ? (
        <Text className="absolute text-xs font-black text-g000st-red">
          Photo error
        </Text>
      ) : null}
    </>
  );
}

function IdentityScreenContentComponent({
  avatarUrl,
  coverUrl,
  isPage,
  deleting,
  fields,
  loading,
  onChangeCover,
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
  uploadingCover,
  uploadingPhoto,
}: IdentityScreenContentProps) {
  const router = useRouter();
  const tabScroll = useTabBarScroll();
  const { isDark } = useAppTheme();
  if (loading) {
    return (
      <FeatureScreen
        title={
          <View className="h-14 flex-row items-center justify-between border-b border-black/10 dark:border-night-border  px-4">
            <Text className="text-lg font-black text-[#1A1A1A] dark:text-night-text">
              g<Text className="text-[#C62828]">000</Text>
              st
              <Text className="text-[#C62828]">P</Text>
              rofile
            </Text>
          </View>
        }
      >
        <View className="px-4 pt-4">
          <AppearanceCard />
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C62828" />
        </View>
      </FeatureScreen>
    );
  }

  return (
    <FeatureScreen
      title={
        <View className="h-14 flex-row items-center justify-between border-b border-black/10 dark:border-night-border  px-4">
          <Text className="text-lg font-black text-[#1A1A1A] dark:text-night-text">
            g<Text className="text-[#C62828]">000</Text>
            st
            <Text className="text-[#C62828]">P</Text>
            rofile
          </Text>
        </View>
      }
    >
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="items-center p-4"
        onScroll={tabScroll?.onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        {/* <AppearanceCard /> */}
        <BeaconSwitcher />
        {isPage && (
          <View className="mb-3 w-full">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-g000st-red">
              BEACON STUDIO
            </Text>
            <Text className="mt-1 text-xl font-black text-[#17191d] dark:text-night-text">
              Design your page
            </Text>
            <Text className="mt-1 text-xs text-black/55 dark:text-night-muted">
              Tap the cover or photo to choose an image. Your account stays
              private.
            </Text>
          </View>
        )}
        <Pressable
          accessibilityHint="Choose an image up to 3 MB for your public profile banner"
          accessibilityLabel={
            coverUrl ? "Change cover photo" : "Add cover photo"
          }
          accessibilityRole="button"
          className={`w-full overflow-hidden bg-[#171d29] active:opacity-85 disabled:opacity-60 ${isPage ? "h-52 rounded-t-[22px]" : "mb-4 h-44 rounded-[22px]"}`}
          disabled={uploadingCover || uploadingPhoto}
          onPress={onChangeCover}
        >
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              contentFit="cover"
              style={{ width: "100%", height: "100%", position: "absolute" }}
            />
          ) : (
            <>
              <View className="absolute -right-10 -top-20 h-56 w-56 rounded-full border-[28px] border-white/10 dark:border-white/20" />
              <View className="absolute bottom-5 left-20 h-28 w-28 rounded-full border-[18px] border-g000st-red/50" />
            </>
          )}
          <View className="absolute inset-0 bg-black/35" />
          <View className="flex-1 justify-between p-4">
            <Text className="self-start rounded-full border border-white/35 dark:border-white/20 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[1px] text-white">
              {isPage ? "BEACON COVER" : "Profile cover"}
            </Text>
            <View className="flex-row items-end justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-lg font-black text-white">
                  {coverUrl
                    ? "Your cover photo"
                    : isPage
                      ? "Your story starts here"
                      : "Make your profile yours"}
                </Text>
                <Text className="mt-1 text-[11px] font-semibold text-white/80">
                  Wide images look best · up to 3 MB
                </Text>
              </View>
              <View className="min-h-10 min-w-24 items-center justify-center rounded-full bg-white dark:bg-night-surface px-3 py-2">
                {uploadingCover ? (
                  <ActivityIndicator color="#C62828" size="small" />
                ) : (
                  <Text className="text-[11px] font-black text-[#17191d] dark:text-night-text">
                    {coverUrl ? "Change cover" : "Add cover"}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </Pressable>
        {/* Photo */}
        <Pressable
          accessibilityLabel="Change profile photo"
          accessibilityRole="button"
          className={`h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#C8C8C8] dark:bg-night-raised active:opacity-80 ${isPage ? "-mt-10 self-start ml-5" : ""}`}
          disabled={uploadingPhoto || uploadingCover}
          onPress={onChangePhoto}
        >
          {uploadingPhoto ? (
            <ActivityIndicator color="#C62828" />
          ) : avatarUrl ? (
            <IdentityAvatarImage avatarUrl={avatarUrl} key={avatarUrl} />
          ) : (
            <Text className="text-3xl">◎</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className={`mt-2 mb-4 ${isPage ? "self-start ml-5" : ""}`}
          disabled={uploadingPhoto || uploadingCover}
          onPress={onChangePhoto}
        >
          <Text className="text-xs font-black text-g000st-red">
            {uploadingPhoto
              ? "Uploading photo…"
              : avatarUrl
                ? "Change pssshoto"
                : "Add photo"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/users/${publicId}` as Href)}
          className="mb-4 rounded-full bg-[#17191d] px-5 py-3"
        >
          <Text className="text-xs font-black text-white">
            View public profile
          </Text>
        </Pressable>

        {/* Name visibility */}
        <View className="mb-4 w-full rounded-[18px] border border-white/60 dark:border-white/20 bg-[#D0D0D0] dark:bg-night-header p-3">
          <View className="flex-row items-center gap-3">
            <TextInput
              className="h-12 min-w-0 flex-1 rounded-field border border-black/10 dark:border-night-border bg-white dark:bg-night-surface px-3 text-[15px] font-black text-g000st-black dark:text-night-text"
              maxLength={60}
              onChangeText={(value) => onSetField("displayName", value)}
              placeholder={isPage ? "Page name" : "Add your name"}
              placeholderTextColor={isDark ? "#C4C3C6" : "rgba(0,0,0,0.35)"}
              value={fields.displayName}
            />
            <View className="items-center">
              <Text className="mb-1 text-[10px] font-black text-black/55 dark:text-night-muted">
                Show name
              </Text>
              <Switch
                accessibilityLabel="Show my name"
                accessibilityRole="switch"
                disabled={isPage}
                onValueChange={(value) => onSetField("showDisplayName", value)}
                thumbColor="#FFFFFF"
                trackColor={{ false: "#9A9A9A", true: "#C62828" }}
                value={isPage || fields.showDisplayName}
              />
            </View>
          </View>
          <Text className="mt-2 text-[11px] font-semibold leading-[16px] text-black/45 dark:text-night-muted">
            {isPage
              ? "Page posts and comments always show the page name."
              : `Show your name to other users, or turn this off to use your 8-character alias (${publicId.slice(0, 8)}).`}
          </Text>
        </View>

        {/* Public ID */}
        <View className={`mb-3 w-full ${CARD}`}>
          <Text className={LABEL}>
            {isPage ? "Page Public ID" : "Your Public ID"}
          </Text>
          <Text
            selectable
            className="mb-3 font-mono text-[13px] font-black leading-[19px] text-g000st-red"
          >
            {publicId}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="h-11 items-center justify-center rounded-field border border-g000st-black dark:border-night-border bg-white dark:bg-night-surface active:opacity-70"
            onPress={onCopyPublicId}
          >
            <Text className="text-[13px] font-black text-g000st-black dark:text-night-text">
              Copy Public ID
            </Text>
          </Pressable>
          <Text className="mt-2 text-[11px] font-semibold leading-[16px] text-black/45 dark:text-night-muted">
            Share your ID and start chatting.
          </Text>
        </View>

        {/* Optional profile */}
        <View className={`mb-3 w-full ${CARD}`}>
          <Text className={LABEL}>
            {isPage ? "Page description" : "Optional profile"}
          </Text>

          {!isPage && (
            <>
              <Text className="mb-1 mt-2 text-[11px] font-bold text-black/45 dark:text-night-muted">
                Country
              </Text>
              <TextInput
                className={`mb-3   ${FIELD_INPUT}`}
                onChangeText={(value) => onSetField("country", value)}
                placeholder="Country"
                value={fields.country}
              />

              <Text className="mb-1 text-[11px] font-bold text-black/45 dark:text-night-muted">
                Age
              </Text>
              <TextInput
                className={`mb-3 ${FIELD_INPUT}`}
                keyboardType="number-pad"
                maxLength={3}
                onChangeText={(value) =>
                  onSetField("age", value.replace(/[^0-9]/g, ""))
                }
                placeholder="Age"
                value={fields.age}
              />

              <Text className="mb-1 text-[11px] font-bold text-black/45 dark:text-night-muted">
                Sex
              </Text>
              <View className="mb-3 flex-row gap-2">
                {(["male", "female"] as const).map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    className={`h-11 flex-1 items-center justify-center rounded-field border ${fields.sex === option
                      ? "border-g000st-black dark:border-night-border bg-g000st-black"
                      : "border-black/15 dark:border-night-border bg-white dark:bg-night-surface"
                      }`}
                    key={option}
                    onPress={() =>
                      onSetField("sex", fields.sex === option ? "" : option)
                    }
                  >
                    <Text
                      className={`text-[13px] font-black ${fields.sex === option ? "text-white" : "text-g000st-black dark:text-night-text"}`}
                    >
                      {option === "male" ? "Male" : "Female"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="mb-1 text-[11px] font-bold text-black/45 dark:text-night-muted">
                Hobby
              </Text>
              <TextInput
                className={`mb-3 ${FIELD_INPUT}`}
                onChangeText={(value) => onSetField("hobby", value)}
                placeholder="e.g. hiking, football…"
                value={fields.hobby}
              />
            </>
          )}
          <Text className="mb-1 text-[11px] font-bold text-black/45 dark:text-night-muted">
            {isPage ? "Short description" : "Bio"}
          </Text>
          <TextInput
            className="h-24 rounded-field border border-black/10 dark:border-night-border bg-white dark:bg-night-surface px-3 py-2 text-[13px] font-bold text-g000st-black dark:text-night-text"
            multiline
            onChangeText={(value) => onSetField("bio", value)}
            placeholder="A short bio (optional)"
            textAlignVertical="top"
            value={fields.bio}
          />

          {!isPage && (
            <Text className="mt-2 text-[11px] font-semibold text-black/40 dark:text-night-muted">
              Nothing here is required. Fill in only what you want.
            </Text>
          )}
        </View>

        {isPage && (
          <View className="mb-3 w-full rounded-[22px] border border-white/70 bg-white p-4 dark:border-white/20 dark:bg-night-header">
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-g000st-red">
              CONTACT & SOCIAL
            </Text>
            <Text className="mt-1 mb-4 text-lg font-black text-[#17191d] dark:text-night-text">
              Help people find you
            </Text>
            <Text className="mb-1 text-xs font-black text-[#127446] dark:text-[#56d69a]">
              ✆ WhatsApp
            </Text>
            <TextInput
              accessibilityLabel="WhatsApp number"
              className={`mb-2 ${FIELD_INPUT}`}
              keyboardType="phone-pad"
              onChangeText={(value) => onSetField("whatsappNumber", value)}
              placeholder="+... or 00..."
              value={fields.whatsappNumber}
            />
            <Text className="mb-4 text-[11px] text-black/45 dark:text-night-muted">
              Include your country code. Visitors will open a direct chat.
            </Text>
            <Text className="mb-1 text-xs font-black text-[#2d4669] dark:text-[#a9c7ed]">
              ☎ Landline
            </Text>
            <TextInput
              accessibilityLabel="Landline number"
              className={`mb-2 ${FIELD_INPUT}`}
              keyboardType="phone-pad"
              onChangeText={(value) => onSetField("landlineNumber", value)}
              placeholder="+1 11 234 5678 or local number"
              value={fields.landlineNumber}
            />
            <Text className="mb-4 text-[11px] text-black/45 dark:text-night-muted">
              Visitors can tap the number to open their phone dialer.
            </Text>
            {(
              [
                ["contactEmail", "Email", "name@example.com"],
                [
                  "facebookUrl",
                  "Facebook",
                  "https://www.facebook.com/yourpage",
                ],
                [
                  "instagramUrl",
                  "Instagram",
                  "https://www.instagram.com/yourpage",
                ],
                ["tiktokUrl", "TikTok", "https://www.tiktok.com/@yourpage"],
                [
                  "linkedinUrl",
                  "LinkedIn",
                  "https://www.linkedin.com/company/yourpage",
                ],
              ] as const
            ).map(([key, label, placeholder]) => (
              <View className="mb-3" key={key}>
                <Text className="mb-1 text-xs font-black text-[#17191d] dark:text-night-text">
                  {label}
                </Text>
                <TextInput
                  accessibilityLabel={label}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className={FIELD_INPUT}
                  keyboardType={
                    key === "contactEmail" ? "email-address" : "url"
                  }
                  onChangeText={(value) => onSetField(key, value)}
                  placeholder={placeholder}
                  value={fields[key]}
                />
              </View>
            ))}
            <Text className="text-[11px] text-black/45 dark:text-night-muted">
              Paste a full HTTPS link for each social profile.
            </Text>
          </View>
        )}

        {/* Save */}
        <Pressable
          accessibilityRole="button"
          className="mb-3 h-12 w-full items-center justify-center rounded-field bg-g000st-red active:opacity-80 disabled:opacity-60"
          disabled={saving}
          onPress={onSave}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-sm font-black text-white">
              {isPage ? "Save page" : "Save profile"}
            </Text>
          )}
        </Pressable>

        {/* Recovery ID */}
        {!isPage && (
          <View className="my-3 w-full overflow-hidden rounded-[22px] border border-[#C62828]/35 bg-[#191919] p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-[#FFB9B9]">
                  PRIVATE KEY
                </Text>
                <Text className="mt-1 text-[19px] font-black text-white">
                  My ID
                </Text>
              </View>
              <View className="rounded-full border border-[#FFB9B9]/40 bg-[#C62828]/20 dark:bg-night-softred px-3 py-1">
                <Text className="text-[10px] font-black uppercase text-[#FFB9B9]">
                  Recovery ID
                </Text>
              </View>
            </View>
            {recoveryId ? (
              <>
                <Text
                  selectable
                  className="rounded-[14px] border border-white/15 dark:border-white/20 bg-white/10 p-3 font-mono text-[13px] font-bold leading-[21px] text-white"
                >
                  {recoveryId}
                </Text>
                <Pressable
                  accessibilityLabel="Copy private Recovery ID"
                  accessibilityRole="button"
                  className="mt-3 h-11 items-center justify-center rounded-[12px] bg-white dark:bg-night-surface active:opacity-75"
                  onPress={onCopyRecoveryId}
                >
                  <Text className="text-[13px] font-black text-[#191919] dark:text-night-text">
                    Copy my ID
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text className="rounded-[14px] border border-white/15 dark:border-white/20 bg-white/10 p-3 text-[13px] font-bold leading-[19px] text-white/75">
                Your Recovery ID is not saved on this device yet. It will appear
                here after your next sign in.
              </Text>
            )}
            <View className="mt-3 rounded-[12px] border border-[#FFB9B9]/25 bg-[#C62828]/15 dark:bg-night-softred p-3">
              <Text className="text-[12px] font-bold leading-[18px] text-[#FFE0E0]">
                Keep this key secret. Never share it with anyone. You need it to
                sign in again.
              </Text>
            </View>
          </View>
        )}
        {/* Sign out */}
        {!isPage && (
          <Pressable
            accessibilityRole="button"
            className="mb-6 h-11 w-full items-center justify-center rounded-full border border-black/15 dark:border-night-border bg-white dark:bg-night-surface active:opacity-70"
            onPress={onSignOut}
          >
            <Text className="text-sm font-bold text-g000st-red">
              Sign out from this device
            </Text>
          </Pressable>
        )}

        {/* Account deletion */}
        {!isPage && (
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
              <Text className="text-sm font-black text-g000st-red">
                Delete my account
              </Text>
            )}
          </Pressable>
        )}
      </KeyboardAwareScrollView>
    </FeatureScreen>
  );
}

export const IdentityScreenContent = memo(IdentityScreenContentComponent);
