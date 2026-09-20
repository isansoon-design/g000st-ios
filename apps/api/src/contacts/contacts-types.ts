export type Contact = Readonly<{
  contactPublicId: string;
  addedAtMs: number;
}>;

export type ContactView = Readonly<{
  publicId: string;
  displayName?: string;
  avatarUrl?: string;
  online: boolean;
  addedAtMs: number;
}>;
