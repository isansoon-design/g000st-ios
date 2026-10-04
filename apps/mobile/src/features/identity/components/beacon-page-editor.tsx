import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { createBeaconPage } from "@/api/auth";
import {
  getSocialProfile,
  updateSocialProfile,
  uploadAvatarMedia,
  uploadCoverMedia,
} from "@/api/social";
import type { SocialProfile } from "@/domain/social/types";
import { BeaconPagePreview } from "@/features/identity/components/beacon-page-preview";
import { useAppTheme } from "@/theme/app-theme";

type Field =
  | "displayName"
  | "bio"
  | "city"
  | "postCode"
  | "street1"
  | "street2"
  | "hobby"
  | "whatsappNumber"
  | "landlineNumber"
  | "contactEmail"
  | "facebookUrl"
  | "instagramUrl"
  | "tiktokUrl"
  | "linkedinUrl";
type Draft = Record<Field, string>;
type FieldMeta = {
  key: Field;
  label: string;
  placeholder: string;
  returnKeyType: "next" | "done";
};
const fields: readonly FieldMeta[] = [
  {
    key: "displayName",
    label: "Page name *",
    placeholder: "e.g. Coffee With Moudy",
    returnKeyType: "next",
  },
  {
    key: "bio",
    label: "Bio",
    placeholder: "Tell the world what your page is about…",
    returnKeyType: "next",
  },
  {
    key: "city",
    label: "City (optional)",
    placeholder: "Your city",
    returnKeyType: "next",
  },
  {
    key: "postCode",
    label: "Post code number (optional)",
    placeholder: "Your postal code",
    returnKeyType: "next",
  },
  {
    key: "street1",
    label: "Street (line 1) (optional)",
    placeholder: "Street address",
    returnKeyType: "next",
  },
  {
    key: "street2",
    label: "Street (line 2) (optional)",
    placeholder: "Apartment, suite or additional address",
    returnKeyType: "next",
  },
  {
    key: "hobby",
    label: "Hobby",
    placeholder: "e.g. Photography, Cooking…",
    returnKeyType: "next",
  },
  {
    key: "whatsappNumber",
    label: "WhatsApp number",
    placeholder: "+966 5X XXX XXXX",
    returnKeyType: "next",
  },
  {
    key: "landlineNumber",
    label: "Landline",
    placeholder: "+966 1X XXX XXXX",
    returnKeyType: "next",
  },
  {
    key: "contactEmail",
    label: "Email",
    placeholder: "hello@example.com",
    returnKeyType: "next",
  },
  {
    key: "facebookUrl",
    label: "Facebook URL",
    placeholder: "https://facebook.com/yourpage",
    returnKeyType: "next",
  },
  {
    key: "instagramUrl",
    label: "Instagram URL",
    placeholder: "https://instagram.com/yourhandle",
    returnKeyType: "next",
  },
  {
    key: "tiktokUrl",
    label: "TikTok URL",
    placeholder: "https://tiktok.com/@yourhandle",
    returnKeyType: "next",
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn URL",
    placeholder: "https://linkedin.com/in/yourprofile",
    returnKeyType: "done",
  },
];
const emptyDraft = (): Draft =>
  Object.fromEntries(fields.map((f) => [f.key, ""])) as Draft;
const fromProfile = (profile: SocialProfile): Draft =>
  Object.fromEntries(fields.map((f) => [f.key, profile[f.key] ?? ""])) as Draft;
const maxLengths: Record<Field, number> = {
  displayName: 60,
  bio: 500,
  city: 100,
  postCode: 32,
  street1: 200,
  street2: 200,
  hobby: 100,
  whatsappNumber: 32,
  landlineNumber: 32,
  contactEmail: 254,
  facebookUrl: 300,
  instagramUrl: 300,
  tiktokUrl: 300,
  linkedinUrl: 300,
};
const allowedImages = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const inputClass =
  "rounded-xl border border-black/15 bg-white px-3 py-3 text-sm text-[#17191d] dark:border-night-border dark:bg-night-raised dark:text-night-text";

type Props = Readonly<{
  publicId?: string;
  visible: boolean;
  onClose: () => void;
  onCreated: (publicId: string) => void;
  onSaved?: (profile: SocialProfile) => void;
}>;

export function BeaconPageEditor({
  publicId,
  visible,
  onClose,
  onCreated,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset>();
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset>();
  const [profile, setProfile] = useState<SocialProfile>();
  const [loading, setLoading] = useState(!!publicId);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string>();
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (!publicId) return;
    let active = true;
    void getSocialProfile(publicId, publicId)
      .then((value) => {
        if (active) {
          setProfile(value);
          setDraft(fromProfile(value));
        }
      })
      .catch((error) => {
        if (active)
          Toast.show({
            type: "error",
            text1: "Could not open page editor",
            text2: error instanceof Error ? error.message : "Try again.",
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [publicId, visible]);

  async function chooseImage(kind: "avatar" | "cover") {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        return Toast.show({
          type: "error",
          text1: "Allow photo access to select an image.",
        });
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (result.canceled) return;
      const item = result.assets[0];
      if (
        !item?.fileSize ||
        !item.mimeType ||
        !allowedImages.has(item.mimeType) ||
        item.fileSize > 3 * 1024 * 1024
      ) {
        return Toast.show({
          type: "error",
          text1: "Choose a JPG, PNG, GIF or WebP image up to 3 MB.",
        });
      }
      if (kind === "avatar") setAvatar(item);
      else setCover(item);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not select image",
        text2: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  async function save() {
    if (saving || loading) return;
    const displayName = draft.displayName.trim();
    if (!displayName)
      return Toast.show({ type: "error", text1: "Page name is required." });
    setSaving(true);
    try {
      let id = publicId ?? createdId;
      if (!id) {
        const page = await createBeaconPage({
          displayName,
          bio: draft.bio.trim(),
        });
        id = page.publicId;
        setCreatedId(id);
      }
      const imageInput = (item: ImagePicker.ImagePickerAsset) => ({
        byteSize: item.fileSize!,
        contentType: item.mimeType!,
        fileName: item.fileName ?? "page-image.jpg",
        uri: item.uri,
      });
      const [avatarMedia, coverMedia] = await Promise.all([
        avatar
          ? uploadAvatarMedia(imageInput(avatar), id)
          : Promise.resolve(undefined),
        cover
          ? uploadCoverMedia(imageInput(cover), id)
          : Promise.resolve(undefined),
      ]);
      const saved = await updateSocialProfile(
        {
          displayName,
          bio: draft.bio.trim(),
          city: draft.city.trim(),
          postCode: draft.postCode.trim(),
          street1: draft.street1.trim(),
          street2: draft.street2.trim(),
          ...(draft.hobby.trim() ? { hobby: draft.hobby.trim() } : {}),
          whatsappNumber: draft.whatsappNumber.trim(),
          landlineNumber: draft.landlineNumber.trim(),
          contactEmail: draft.contactEmail.trim(),
          facebookUrl: draft.facebookUrl.trim(),
          instagramUrl: draft.instagramUrl.trim(),
          tiktokUrl: draft.tiktokUrl.trim(),
          linkedinUrl: draft.linkedinUrl.trim(),
          ...(avatarMedia ? { avatarMedia } : {}),
          ...(coverMedia ? { coverMedia } : {}),
        },
        id,
      );
      if (publicId) {
        onSaved?.(saved);
        onClose();
        Toast.show({ type: "success", text1: "Page saved." });
      } else {
        onClose();
        onCreated(id);
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not save page",
        text2: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={saving ? undefined : onClose}
      statusBarTranslucent
    >
      <View className="flex-1 flex-row bg-black/50">
        <View
          className="w-[88%] max-w-[400px]"
          style={{
            backgroundColor: colors.canvas,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="p-4 pb-10"
          >
            <View className="mb-4 flex-row items-center justify-between">
              <Text
                className="text-xl font-black"
                style={{ color: colors.text }}
              >
                {publicId ? "Edit beacon" : "Build your beacon"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close page editor"
                disabled={saving}
                onPress={onClose}
                className="h-10 w-10 items-center justify-center"
              >
                <Text className="text-2xl" style={{ color: colors.text }}>
                  ×
                </Text>
              </Pressable>
            </View>
            {loading ? (
              <ActivityIndicator color="#C62828" />
            ) : (
              <View className="gap-3">
                <Text className="text-xs" style={{ color: colors.text }}>
                  Only the page name is required.
                </Text>
                <BeaconPagePreview
                  compact
                  coverUrl={cover?.uri ?? profile?.coverUrl}
                  avatarUrl={avatar?.uri ?? profile?.avatarUrl}
                  displayName={draft.displayName}
                  bio={draft.bio}
                  address={draft}
                  onChangeCover={() => void chooseImage("cover")}
                  onChangeAvatar={() => void chooseImage("avatar")}
                />
                {fields.map((f, idx) => (
                  <View key={f.key} className="gap-1">
                    <Text
                      className="text-xs font-black"
                      style={{ color: colors.text }}
                    >
                      {f.label}
                    </Text>
                    <TextInput
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      accessibilityLabel={f.label}
                      placeholder={f.placeholder}
                      placeholderTextColor="#9ca3af"
                      value={draft[f.key]}
                      onChangeText={(value) =>
                        setDraft((current) => ({ ...current, [f.key]: value }))
                      }
                      maxLength={maxLengths[f.key]}
                      multiline={f.key === "bio"}
                      keyboardType={
                        f.key === "contactEmail"
                          ? "email-address"
                          : f.key === "whatsappNumber" ||
                            f.key === "landlineNumber"
                            ? "phone-pad"
                            : "default"
                      }
                      autoCapitalize={
                        f.key === "contactEmail" || f.key.endsWith("Url")
                          ? "none"
                          : "sentences"
                      }
                      returnKeyType={f.returnKeyType}
                      onSubmitEditing={() => {
                        if (f.returnKeyType === "next") {
                          inputRefs.current[idx + 1]?.focus();
                        }
                      }}
                      blurOnSubmit={f.returnKeyType === "done"}
                      className={`${inputClass} ${f.key === "bio" ? "min-h-24" : ""}`}
                    />
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  disabled={saving || !draft.displayName.trim()}
                  onPress={() => void save()}
                  className="mt-2 rounded-xl bg-g000st-red px-4 py-4 disabled:opacity-40"
                >
                  <Text className="text-center font-black text-white">
                    {saving
                      ? "Saving…"
                      : publicId
                        ? "Save changes"
                        : "Publish beacon & share your first post"}
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close page editor"
          disabled={saving}
          onPress={onClose}
          className="flex-1"
        />
      </View>
    </Modal>
  );
}
