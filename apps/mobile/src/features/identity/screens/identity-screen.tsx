import { IdentityScreenContent } from '@/features/identity/components/identity-screen-content';
import { useIdentityScreen } from '@/features/identity/hooks/use-identity-screen';

export function IdentityScreen() {
  const identity = useIdentityScreen();

  return (
    <IdentityScreenContent
      avatarUrl={identity.avatarUrl}
      fields={identity.fields}
      loading={identity.loading}
      onChangePhoto={identity.changePhoto}
      onCopyPublicId={identity.copyPublicId}
      onSave={identity.save}
      onSetField={identity.setField}
      onSignOut={identity.requestSignOut}
      publicId={identity.publicId}
      saving={identity.saving}
      uploadingPhoto={identity.uploadingPhoto}
    />
  );
}
