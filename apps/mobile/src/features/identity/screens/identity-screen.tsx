import { View } from 'react-native';
import { ToastBanner } from '@/components/feedback/toast-banner';
import { IdentityScreenContent } from '@/features/identity/components/identity-screen-content';
import { useIdentityScreen } from '@/features/identity/hooks/use-identity-screen';

export function IdentityScreen() {
  const identity = useIdentityScreen();

  return (
    <View className="flex-1">
      <IdentityScreenContent
        onCopyPublicId={identity.copyPublicId}
        onSignOut={identity.signOut}
        publicId={identity.publicId}
      />
      <ToastBanner message={identity.toastMessage} />
    </View>
  );
}
