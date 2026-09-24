export const SOCIAL_ALIAS_LENGTH = 8;
export const DELETED_ACCOUNT_DISPLAY_NAME = 'Deleted account';

export function socialAlias(publicId: string): string {
  return publicId.slice(-SOCIAL_ALIAS_LENGTH);
}

export function publicDisplayName(
  publicId: string,
  profile: Readonly<{
    deletedAtMs?: number;
    displayName?: string;
    showDisplayName?: boolean;
  }> | undefined,
): string {
  if (profile?.deletedAtMs !== undefined) return DELETED_ACCOUNT_DISPLAY_NAME;
  const displayName = profile?.displayName?.trim();
  return profile?.showDisplayName === true && displayName ? displayName : socialAlias(publicId);
}
