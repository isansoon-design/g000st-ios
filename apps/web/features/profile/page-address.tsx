type PageAddressFields = Readonly<{
  city?: string;
  postCode?: string;
  street1?: string;
  street2?: string;
}>;

export function PageAddress({ profile }: { profile: PageAddressFields }) {
  const lines = [profile.city, profile.postCode, profile.street1, profile.street2]
    .map((value) => value?.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  return (
    <div aria-label="Page address" className="mt-4 space-y-1 text-sm text-black/65 dark:text-night-muted">
      {lines.map((line, index) => <p key={index} className="break-words">{line}</p>)}
    </div>
  );
}
