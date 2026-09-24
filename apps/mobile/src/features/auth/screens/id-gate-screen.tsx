import { memo } from 'react';
import { View } from 'react-native';
import { ToastBanner } from '@/components/feedback/toast-banner';
import { IdGateForm } from '@/features/auth/components/id-gate-form';
import { RegistrationModal } from '@/features/auth/components/registration-modal';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useIdGate } from '@/features/auth/hooks/use-id-gate';

function IdGateScreenComponent() {
  const { completeAuthentication } = useAuth();
  const idGate = useIdGate({ onAuthenticated: completeAuthentication });

  return (
    <View className="flex-1 bg-g000st-metal">
      <IdGateForm
        busyAction={idGate.busyAction}
        errors={idGate.errors}
        onChangeRecoveryId={idGate.changeRecoveryId}
        onLogin={idGate.submitRestore}
        onRegister={idGate.requestRegistration}
        recoveryId={idGate.recoveryId}
      />

      <RegistrationModal
        createdRecoveryId={idGate.createdRecoveryId}
        isCreating={idGate.busyAction === 'create'}
        onCancel={idGate.cancelRegistration}
        onConfirm={idGate.confirmRegistration}
        onCopy={idGate.copyCreatedRecoveryId}
        onLoginWithId={idGate.loginWithNewId}
        stage={idGate.registrationModalStage}
      />

      <ToastBanner message={idGate.toastMessage} />
    </View>
  );
}

export const IdGateScreen = memo(IdGateScreenComponent);
