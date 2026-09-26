import { ToastBanner } from '@/components/feedback/toast-banner';
import { IdGateForm } from '@/features/auth/components/id-gate-form';
import { RegistrationModal } from '@/features/auth/components/registration-modal';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useIdGate } from '@/features/auth/hooks/use-id-gate';
import { memo, useEffect, useState } from 'react';
import { savedAccounts, type SavedAccount } from '@/services/session/saved-accounts';
import Toast from 'react-native-toast-message';
import { Alert, View } from 'react-native';

function IdGateScreenComponent() {
  const { completeAuthentication } = useAuth();
  const idGate = useIdGate({ onAuthenticated: completeAuthentication });
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void savedAccounts.list().then((items) => { if (active) setAccounts(items); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function selectAccount(publicId: string) {
    setSelectedId(publicId);
    try {
      const secret = await savedAccounts.getSecret(publicId);
      if (!secret) {
        Toast.show({ type: 'error', text1: 'Saved ID unavailable', text2: 'Remove this account or enter its Recovery ID.' });
        return;
      }
      await idGate.submitRestore(secret);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open saved account' });
    } finally {
      setSelectedId(null);
    }
  }

  function removeAccount(publicId: string) {
    Alert.alert('Remove saved account?', 'Its Recovery ID will be erased from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        void savedAccounts.remove(publicId).then(() =>
          setAccounts((current) => current.filter((account) => account.publicId !== publicId))
        ).catch(() => Toast.show({ type: 'error', text1: 'Could not remove account' }));
      } },
    ]);
  }

  return (
    <View className="flex-1 bg-g000st-metal">
      <IdGateForm
        accounts={accounts}
        busyAction={idGate.busyAction}
        selectedId={selectedId}
        onSelectAccount={(publicId) => void selectAccount(publicId)}
        onRemoveAccount={removeAccount}
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
