import type { ImagePickerAsset } from "expo-image-picker";

export const MAX_POST_IMAGES = 2;
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;

export type ExistingPostMedia = Readonly<{ id: string; url: string; contentType: string }>;
export type LocalPostMedia = Readonly<{ byteSize: number; contentType: string; fileName: string; uri: string }>;
/** Sent with an edit: which saved images stay, and which freshly picked ones get uploaded. */
export type PostMediaEdit = Readonly<{ keep: readonly string[]; add: readonly LocalPostMedia[] }>;
export type PostMediaDraft = Readonly<{ kept: readonly ExistingPostMedia[]; added: readonly ImagePickerAsset[] }>;

export function initialMediaDraft(media?: readonly ExistingPostMedia[]): PostMediaDraft {
  return { kept: media ?? [], added: [] };
}

export function isValidPickedImage(asset: ImagePickerAsset): boolean {
  return !!asset.fileSize && asset.fileSize <= MAX_POST_IMAGE_BYTES && !!asset.mimeType?.startsWith("image/");
}

/** Returns undefined when the draft matches the saved post, so the request leaves media alone. */
export function mediaDraftEdit(draft: PostMediaDraft, original?: readonly ExistingPostMedia[]): PostMediaEdit | undefined {
  if (draft.added.length === 0 && draft.kept.length === (original?.length ?? 0)) return undefined;
  return {
    keep: draft.kept.map((item) => item.id),
    add: draft.added.map((asset, index) => ({
      byteSize: asset.fileSize!,
      contentType: asset.mimeType!,
      fileName: asset.fileName || `photo-${index + 1}`,
      uri: asset.uri,
    })),
  };
}
