import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import Toast from "react-native-toast-message";

import { deleteAccount } from "@/api/auth";
import {
  getSocialProfile,
  updateSocialProfile,
  uploadAvatarMedia,
  uploadCoverMedia,
} from "@/api/social";
import type { SocialProfile } from "@/domain/social/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useConfirmModal } from "@/providers/confirm-modal-provider";
import { copyText } from "@/services/device/clipboard";
import { recoveryIdStorage } from "@/services/session/recovery-id-storage";
import { savedAccounts } from "@/services/session/saved-accounts";

export type IdentityProfileFields = Readonly<{
  displayName: string;
  showDisplayName: boolean;
  country: string;
  age: string;
  sex: "male" | "female" | "";
  hobby: string;
  bio: string;
  whatsappNumber: string;
  landlineNumber: string;
  contactEmail: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  linkedinUrl: string;
}>;

const EMPTY_FIELDS: IdentityProfileFields = {
  age: "",
  bio: "",
  country: "",
  displayName: "",
  showDisplayName: false,
  hobby: "",
  whatsappNumber: "",
  landlineNumber: "",
  contactEmail: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  linkedinUrl: "",
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
    whatsappNumber: profile.whatsappNumber ?? "",
    landlineNumber: profile.landlineNumber ?? "",
    contactEmail: profile.contactEmail ?? "",
    facebookUrl: profile.facebookUrl ?? "",
    instagramUrl: profile.instagramUrl ?? "",
    tiktokUrl: profile.tiktokUrl ?? "",
    linkedinUrl: profile.linkedinUrl ?? "",
    sex: profile.sex ?? "",
  };
}

export function useIdentityScreen() {
  const { activePublicId, signOut, user } = useAuth();
  const accountPublicId = user?.publicId;
  const profilePublicId = activePublicId ?? accountPublicId;
  const isPage = !!profilePublicId && profilePublicId !== accountPublicId;
  const { confirm } = useConfirmModal();
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [fields, setFields] = useState<IdentityProfileFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const photoChangeInProgress = useRef(false);
  const photoChangeVersion = useRef(0);
  const lastProfileRefreshMs = useRef(0);
  const profileRefreshInFlight = useRef(false);
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
    if (!profilePublicId) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getSocialProfile(profilePublicId);
        if (cancelled) return;
        setProfile(loaded);
        lastProfileRefreshMs.current = Date.now();
        if (!isPage) void savedAccounts.updateProfile(loaded);
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
  }, [profilePublicId, isPage]);

  const refreshProfilePhoto = useCallback(async () => {
    if (!profilePublicId || photoChangeInProgress.current || !lastProfileRefreshMs.current || profileRefreshInFlight.current) return;
    profileRefreshInFlight.current = true;
    const version = photoChangeVersion.current;
    try {
      const loaded = await getSocialProfile(profilePublicId);
      if (photoChangeInProgress.current || version !== photoChangeVersion.current) return;
      setProfile(loaded);
      lastProfileRefreshMs.current = Date.now();
      if (!isPage) void savedAccounts.updateProfile(loaded);
    } catch {
      // Keep the current profile visible; the next focus can retry the refresh.
    } finally {
      profileRefreshInFlight.current = false;
    }
  }, [profilePublicId, isPage]);

  useFocusEffect(useCallback(() => {
    void refreshProfilePhoto();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshProfilePhoto();
    });
    return () => subscription.remove();
  }, [refreshProfilePhoto]));

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
    if (!profilePublicId) return;
    await copyText(profilePublicId);
    Toast.show({
      text1: "Copied",
      text2: "Public ID copied.",
      type: "success",
    });
  }, [profilePublicId]);

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
    if (!profilePublicId || photoChangeInProgress.current) return;
    photoChangeInProgress.current = true;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Toast.show({ text1: "Photo", text2: "Photo library permission is required.", type: "error" });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      photoChangeVersion.current += 1;
      setUploadingPhoto(true);
      const asset = result.assets[0];
      // The picker size may differ from the final file size used by the signed PUT.
      const byteSize = new File(asset.uri).size ?? undefined;
      if (!byteSize || !asset.mimeType || byteSize > 3 * 1024 * 1024) {
        Toast.show({ text1: "Photo", text2: "Photo must be 3 MB or smaller.", type: "error" });
        return;
      }
      const media = await uploadAvatarMedia({
        byteSize,
        contentType: asset.mimeType,
        fileName: asset.fileName || "avatar",
        uri: asset.uri,
      });
      const updated = await updateSocialProfile({ avatarMedia: media });
      // Use a fresh read so success also confirms the photo survives a new session.
      const saved = await getSocialProfile(profilePublicId);
      if (!saved.avatarUrl || saved.updatedAtMs < updated.updatedAtMs) {
        throw new Error("Could not confirm your profile photo. Please try again.");
      }
      setProfile(saved);
      lastProfileRefreshMs.current = Date.now();
      if (!isPage) void savedAccounts.updateProfile(saved);
      Toast.show({
        text1: "Photo",
        text2: "Profile photo updated.",
        type: "success",
      });
    } catch (error) {
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
      photoChangeInProgress.current = false;
    }
  }, [profilePublicId, isPage]);

  const changeCover = useCallback(async () => {
    if (!profilePublicId || photoChangeInProgress.current) return;
    photoChangeInProgress.current = true;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Toast.show({ text1: "Cover", text2: "Photo library permission is required.", type: "error" });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      photoChangeVersion.current += 1;
      setUploadingCover(true);
      const asset = result.assets[0];
      const byteSize = new File(asset.uri).size ?? 0;
      if (!byteSize || byteSize > 3 * 1024 * 1024 || !asset.mimeType || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(asset.mimeType)) {
        Toast.show({ text1: "Cover", text2: "Choose a JPEG, PNG, WebP, or GIF image up to 3 MB.", type: "error" });
        return;
      }
      const media = await uploadCoverMedia({
        byteSize,
        contentType: asset.mimeType,
        fileName: asset.fileName || "cover",
        uri: asset.uri,
      });
      const updated = await updateSocialProfile({ coverMedia: media });
      const saved = await getSocialProfile(profilePublicId);
      if (!saved.coverUrl || saved.updatedAtMs < updated.updatedAtMs) {
        throw new Error("Could not confirm your cover photo. Please try again.");
      }
      setProfile(saved);
      lastProfileRefreshMs.current = Date.now();
      Toast.show({ text1: "Cover", text2: "Cover photo updated.", type: "success" });
    } catch (error) {
      Toast.show({
        text1: "Cover",
        text2: error instanceof Error ? error.message : "Could not update your cover photo.",
        type: "error",
      });
    } finally {
      setUploadingCover(false);
      photoChangeInProgress.current = false;
    }
  }, [profilePublicId]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const age = fields.age.trim() ? Number(fields.age.trim()) : undefined;
      const saved = await updateSocialProfile({
        ...(!isPage && age ? { age } : {}),
        bio: fields.bio.trim(),
        ...(!isPage && fields.country.trim() ? { country: fields.country.trim() } : {}),
        displayName: fields.displayName.trim() || undefined,
        showDisplayName: isPage ? true : fields.showDisplayName,
        ...(isPage ? { whatsappNumber: fields.whatsappNumber, landlineNumber: fields.landlineNumber, contactEmail: fields.contactEmail, facebookUrl: fields.facebookUrl, instagramUrl: fields.instagramUrl, tiktokUrl: fields.tiktokUrl, linkedinUrl: fields.linkedinUrl } : {}),
        ...(!isPage && fields.hobby.trim() ? { hobby: fields.hobby.trim() } : {}),
        ...(!isPage && fields.sex ? { sex: fields.sex } : {}),
      });
      setProfile(saved);
      if (!isPage) void savedAccounts.updateProfile(saved);
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
  }, [fields, isPage]);

  const requestSignOut = useCallback(async () => {
    let canRestore = false;
    try { canRestore = !!accountPublicId && !!(await recoveryIdStorage.get(accountPublicId)); } catch { /* Show the recovery warning. */ }
    const confirmed = await confirm({
      cancelLabel: "Cancel",
      confirmLabel: "Sign out",
      isDangerous: true,
      message: canRestore
        ? "This account will stay in your saved accounts so you can sign in again on this device."
        : "Your Recovery ID is unavailable on this device. Save it before signing out or you may lose access.",
      title: "Sign out from this device?",
    });
    if (!confirmed) return;

    try {
      if (accountPublicId) {
        const secret = await recoveryIdStorage.get(accountPublicId);
        if (secret) await savedAccounts.save(accountPublicId, secret);
      }
      if (profile && !isPage) await savedAccounts.updateProfile(profile);
      await signOut();
    } catch {
      Toast.show({ type: "error", text1: "Could not sign out", text2: "Your account is still signed in." });
    }
  }, [confirm, profile, signOut, accountPublicId, isPage]);

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
      try {
        if (accountPublicId) await savedAccounts.remove(accountPublicId);
      } finally {
        await signOut(true);
      }
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
  }, [confirm, signOut, accountPublicId]);

  return {
    avatarUrl: profile?.avatarUrl,
    coverUrl: profile?.coverUrl,
    isPage,
    changeCover,
    changePhoto,
    copyPublicId,
    copyRecoveryId,
    deleting,
    fields,
    loading,
    publicId: profilePublicId ?? "",
    recoveryId,
    requestSignOut,
    requestDeleteAccount,
    save,
    saving,
    setField,
    uploadingPhoto,
    uploadingCover,
  };
}
