export const MAX_POST_IMAGES = 2;
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;

export type ExistingPostMedia = { id: string; url: string };
export type PostMediaDraft = { kept: ExistingPostMedia[]; added: File[] };
/** Sent with an edit: which saved images stay, and which freshly picked files get uploaded. */
export type PostMediaEdit = { keep: string[]; add: File[] };

export function initialMediaDraft(media?: ExistingPostMedia[]): PostMediaDraft {
  return { kept: media ?? [], added: [] };
}

export function isValidPickedImage(file: File) {
  return file.type.startsWith("image/") && file.size <= MAX_POST_IMAGE_BYTES;
}

/** Returns undefined when the draft matches the saved post, so the request leaves media alone. */
export function mediaDraftEdit(draft: PostMediaDraft, original?: ExistingPostMedia[]): PostMediaEdit | undefined {
  if (draft.added.length === 0 && draft.kept.length === (original?.length ?? 0)) return undefined;
  return { keep: draft.kept.map((item) => item.id), add: draft.added };
}
