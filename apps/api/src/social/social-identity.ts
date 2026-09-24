export const SOCIAL_ALIAS_LENGTH = 8;

export function socialAlias(publicId: string): string {
  return publicId.slice(-SOCIAL_ALIAS_LENGTH);
}

export function publicDisplayName(
  publicId: string,
  profile: Readonly<{ displayName?: string; showDisplayName?: boolean }> | undefined,
): string {
  const displayName = profile?.displayName?.trim();
  return profile?.showDisplayName === true && displayName ? displayName : socialAlias(publicId);
}
