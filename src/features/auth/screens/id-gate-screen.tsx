import { memo } from 'react';
import { View } from 'react-native';

import { ToastBanner } from '@/components/feedback/toast-banner';
import { IdGateForm } from '@/features/auth/components/id-gate-form';
import { RecoveryCredentials } from '@/features/auth/components/recovery-credentials';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useIdGate } from '@/features/auth/hooks/use-id-gate';

function IdGateScreenComponent() {
  const { completeAuthentication } = useAuth();
  const idGate = useIdGate({ onAuthenticated: completeAuthentication });

  return (
    <View className="flex-1 bg-g000st-metal">
      {idGate.createdAccount ? (
        <RecoveryCredentials
          isConfirming={idGate.busyAction === 'confirm'}
          onConfirm={idGate.confirmRecoverySaved}
          onCopyPublicId={idGate.copyPublicId}
          onCopyRecoveryId={idGate.copyRecoveryId}
          publicId={idGate.createdAccount.user.publicId}
          recoveryId={idGate.createdAccount.recoveryId}
        />
      ) : (
        <IdGateForm
          busyAction={idGate.busyAction}
          errors={idGate.errors}
          onChangeRecoveryId={idGate.changeRecoveryId}
          onChangeRequestedPublicId={idGate.changeRequestedPublicId}
          onCreate={idGate.submitCreate}
          onRestore={idGate.submitRestore}
          recoveryId={idGate.recoveryId}
          requestedPublicId={idGate.requestedPublicId}
        />
      )}

      <ToastBanner message={idGate.toastMessage} />
    </View>
  );
}

export const IdGateScreen = memo(IdGateScreenComponent);
