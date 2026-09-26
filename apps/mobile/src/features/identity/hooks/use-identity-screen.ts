import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import Toast from "react-native-toast-message";

import { deleteAccount } from "@/api/auth";
import {
  getSocialProfile,
  updateSocialProfile,
  uploadAvatarMedia,
} from "@/api/social";
import type { SocialProfile } from "@/domain/social/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useConfirmModal } from "@/providers/confirm-modal-provider";
import { copyText } from "@/services/device/clipboard";
import { recoveryIdStorage } from "@/services/session/recovery-id-storage";

export type IdentityProfileFields = Readonly<{
  displayName: string;
  showDisplayName: boolean;
  country: string;
  age: string;
  sex: "male" | "female" | "";
  hobby: string;
  bio: string;
}>;

const EMPTY_FIELDS: IdentityProfileFields = {
  age: "",
  bio: "",
  country: "",
  displayName: "",
  showDisplayName: false,
  hobby: "",
  sex: "",
};

function toFields(profile: SocialProfile | null): IdentityProfileFields {
  if (!profile) return EMPTY_FIELDS;
  return {
    age: profile.age ? String(profile.age) : "",
    bio: profile.bio ?? "",
    country: profile.country ?? "",
    displayName: profile.displayName ?? "",
    showDisplayName: profile.showDisplayName,
    hobby: profile.hobby ?? "",
    sex: profile.sex ?? "",
  };
}

export function useIdentityScreen() {
  const { signOut, user } = useAuth();
  const { confirm } = useConfirmModal();
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [fields, setFields] = useState<IdentityProfileFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [storedRecoveryId, setStoredRecoveryId] = useState<{ publicId: string; value: string | null } | null>(null);
  const recoveryId = storedRecoveryId && storedRecoveryId.publicId === user?.publicId ? storedRecoveryId.value : null;

  useEffect(() => {
    let active = true;
    if (user?.publicId) {
      const publicId = user.publicId;
      void recoveryIdStorage.get(publicId).then((stored) => {
        if (active) setStoredRecoveryId({ publicId, value: stored });
      }).catch(() => {
        if (active) setStoredRecoveryId({ publicId, value: null });
      });
    }
    return () => { active = false; };
  }, [user?.publicId]);

  useEffect(() => {
    if (!user?.publicId) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getSocialProfile(user.publicId);
        if (cancelled) return;
        setProfile(loaded);
        setFields(toFields(loaded));
      } catch (error) {
        if (!cancelled) {
          Toast.show({
            text1: "Profile",
            text2:
              error instanceof Error
                ? error.message
                : "Could not load your profile.",
            type: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.publicId]);

  const setField = useCallback(
    <K extends keyof IdentityProfileFields>(
      key: K,
      value: IdentityProfileFields[K],
    ) => {
      setFields((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const copyPublicId = useCallback(async () => {
    if (!user?.publicId) return;
    await copyText(user.publicId);
    Toast.show({
      text1: "Copied",
      text2: "Public ID copied.",
      type: "success",
    });
  }, [user]);

  const copyRecoveryId = useCallback(async () => {
    if (!recoveryId) return;
    try {
      await copyText(recoveryId);
      Toast.show({ text1: "Copied", text2: "Recovery ID copied. Keep it private.", type: "success" });
    } catch {
      Toast.show({ text1: "Copy failed", text2: "Could not copy your Recovery ID.", type: "error" });
    }
  }, [recoveryId]);

  const changePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        text1: "Photo",
        text2: "Photo library permission is required.",
        type: "error",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    // asset.fileSize (from the picker) can differ from the bytes actually on disk once
    // the OS finishes writing the picked/compressed file, which breaks the presigned PUT's
    // signature (it requires an exact Content-Length). Read the real size right before upload.
    const byteSize = new File(asset.uri).size ?? undefined;
    if (!byteSize || !asset.mimeType || byteSize > 3 * 1024 * 1024) {
      Toast.show({
        text1: "Photo",
        text2: "Photo must be 3 MB or smaller.",
        type: "error",
      });
      return;
    }
    setUploadingPhoto(true);
    try {
      const media = await uploadAvatarMedia({
        byteSize,
        contentType: asset.mimeType,
        fileName: asset.fileName || "avatar",
        uri: asset.uri,
      });
      const saved = await updateSocialProfile({ avatarMedia: media });
      setProfile(saved);
      Toast.show({
        text1: "Photo",
        text2: "Profile photo updated.",
        type: "success",
      });
    } catch (error: any) {
      console.log(error);
      Toast.show({
        text1: "Photo",
        text2:
          error instanceof Error
            ? error.message
            : "Could not update your photo.",
        type: "error",
      });
    } finally {
      setUploadingPhoto(false);
    }
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const age = fields.age.trim() ? Number(fields.age.trim()) : undefined;
      const saved = await updateSocialProfile({
        age,
        bio: fields.bio.trim() || undefined,
        country: fields.country.trim() || undefined,
        displayName: fields.displayName.trim() || undefined,
        showDisplayName: fields.showDisplayName,
        hobby: fields.hobby.trim() || undefined,
        sex: fields.sex || undefined,
      });
      setProfile(saved);
      setFields(toFields(saved));
      Toast.show({
        text1: "Profile",
        text2: "Profile saved.",
        type: "success",
      });
    } catch (error) {
      Toast.show({
        text1: "Profile",
        text2:
          error instanceof Error
            ? error.message
            : "Could not save your profile.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [fields]);

  const requestSignOut = useCallback(async () => {
    const confirmed = await confirm({
      cancelLabel: "Cancel",
      confirmLabel: "Sign out",
      isDangerous: true,
      message: "You will need your Recovery ID to sign back in on this device.",
      title: "Sign out from this device?",
    });
    if (!confirmed) return;

    let idToCopy: string | null = null;
    try {
      if (user?.publicId) idToCopy = await recoveryIdStorage.get(user.publicId);
    } catch {
      // The final prompt still lets the user decide whether to sign out.
    }
    const saveId = await confirm({
      cancelLabel: "Cancel",
      confirmLabel: "Copy",
      message: idToCopy
        ? "Save your Recovery ID to log in again. Copy it now, or choose Cancel to sign out without copying."
        : "Your Recovery ID is not saved on this device. You may not be able to sign back in after signing out.",
      title: "Save your ID to log in again?",
    });
    if (saveId) {
      if (!idToCopy) {
        Toast.show({ text1: "Copy failed", text2: "Recovery ID unavailable. You are still signed in.", type: "error" });
        return;
      }
      try {
        await copyText(idToCopy);
      } catch {
        Toast.show({ text1: "Copy failed", text2: "Could not copy your Recovery ID. You are still signed in.", type: "error" });
        return;
      }
    }
    await signOut();
  }, [confirm, signOut, user?.publicId]);

  const requestDeleteAccount = useCallback(async () => {
    const confirmed = await confirm({
      cancelLabel: "Cancel",
      confirmLabel: "Delete account",
      isDangerous: true,
      message:
        "This permanently deletes your account and Recovery ID. Your existing posts and messages may remain, but your name and profile photo will be replaced with Deleted account. This cannot be undone.",
      title: "Delete your account?",
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteAccount();
      await signOut();
    } catch (error) {
      Toast.show({
        text1: "Delete account",
        text2:
          error instanceof Error
            ? error.message
            : "Could not delete your account.",
        type: "error",
      });
      setDeleting(false);
    }
  }, [confirm, signOut]);

  return {
    avatarUrl: profile?.avatarUrl,
    changePhoto,
    copyPublicId,
    copyRecoveryId,
    deleting,
    fields,
    loading,
    publicId: user?.publicId ?? "",
    recoveryId,
    requestSignOut,
    requestDeleteAccount,
    save,
    saving,
    setField,
    uploadingPhoto,
  };
}
