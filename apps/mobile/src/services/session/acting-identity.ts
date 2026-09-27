let actingPublicId: string | null = null;

export function getActingPublicId(): string | null {
  return actingPublicId;
}

export function setActingPublicId(publicId: string | null): void {
  actingPublicId = publicId;
}
