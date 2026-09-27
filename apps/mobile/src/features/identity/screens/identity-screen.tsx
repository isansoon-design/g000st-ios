import { IdentityScreenContent } from '@/features/identity/components/identity-screen-content';
import { useIdentityScreen } from '@/features/identity/hooks/use-identity-screen';

export function IdentityScreen() {
  const identity = useIdentityScreen();

  return (
    <IdentityScreenContent
      avatarUrl={identity.avatarUrl}
      coverUrl={identity.coverUrl}
      isPage={identity.isPage}
      fields={identity.fields}
      deleting={identity.deleting}
      loading={identity.loading}
      onChangeCover={identity.changeCover}
      onChangePhoto={identity.changePhoto}
      onCopyPublicId={identity.copyPublicId}
      onCopyRecoveryId={identity.copyRecoveryId}
      onDeleteAccount={identity.requestDeleteAccount}
      onSave={identity.save}
      onSetField={identity.setField}
      onSignOut={identity.requestSignOut}
      publicId={identity.publicId}
      recoveryId={identity.recoveryId}
      saving={identity.saving}
      uploadingCover={identity.uploadingCover}
      uploadingPhoto={identity.uploadingPhoto}
    />
  );
}
