import { useCallback, useEffect, useRef, useState } from 'react';

import { toApiError } from '@/api/api-error';
import type { AuthenticationResult, RegisterAccountResult } from '@/domain/auth/types';
import {
  createAccount,
  recoverAccount,
} from '@/features/auth/api/auth-use-cases';
import {
  firstValidationMessage,
  normalizeId,
  type IdGateErrors,
  validateRecoveryId,
  validateRequestedPublicId,
} from '@/features/auth/validation/id-validation';
import { copyText } from '@/services/device/clipboard';

type BusyAction = 'create' | 'restore' | 'confirm' | null;

type UseIdGateOptions = Readonly<{
  onAuthenticated: (result: AuthenticationResult) => Promise<void>;
}>;

export function useIdGate({ onAuthenticated }: UseIdGateOptions) {
  const [requestedPublicId, setRequestedPublicId] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [errors, setErrors] = useState<IdGateErrors>({});
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [createdAccount, setCreatedAccount] = useState<RegisterAccountResult | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3_000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const changeRequestedPublicId = useCallback((value: string) => {
    setRequestedPublicId(value);
    setErrors((current) => ({ ...current, requestedPublicId: undefined }));
  }, []);

  const changeRecoveryId = useCallback((value: string) => {
    setRecoveryId(value);
    setErrors((current) => ({ ...current, recoveryId: undefined }));
  }, []);

  const submitCreate = useCallback(async () => {
    const validationErrors = validateRequestedPublicId(requestedPublicId);
    setErrors(validationErrors);

    const firstError = firstValidationMessage(validationErrors, ['requestedPublicId']);
    if (firstError) {
      showToast(firstError);
      return;
    }

    setBusyAction('create');
    try {
      const normalized = normalizeId(requestedPublicId);
      const result = await createAccount({
        ...(normalized ? { requestedPublicId: normalized } : {}),
      });
      setCreatedAccount(result);
    } catch (error) {
      showToast(toApiError(error).message);
    } finally {
      setBusyAction(null);
    }
  }, [requestedPublicId, showToast]);

  const submitRestore = useCallback(async () => {
    const validationErrors = validateRecoveryId(recoveryId);
    setErrors(validationErrors);

    const firstError = firstValidationMessage(validationErrors, ['recoveryId']);
    if (firstError) {
      showToast(firstError);
      return;
    }

    setBusyAction('restore');
    try {
      const result = await recoverAccount({ recoveryId: normalizeId(recoveryId) });
      await onAuthenticated(result);
    } catch (error) {
      showToast(toApiError(error).message);
    } finally {
      setBusyAction(null);
    }
  }, [onAuthenticated, recoveryId, showToast]);

  const confirmRecoverySaved = useCallback(async () => {
    if (!createdAccount) return;

    setBusyAction('confirm');
    try {
      await onAuthenticated({ session: createdAccount.session, user: createdAccount.user });
    } catch (error) {
      showToast(toApiError(error).message);
    } finally {
      setBusyAction(null);
    }
  }, [createdAccount, onAuthenticated, showToast]);

  const copyRecoveryId = useCallback(async () => {
    if (!createdAccount) return;
    await copyText(createdAccount.recoveryId);
    showToast('Recovery ID copied. Keep it private.');
  }, [createdAccount, showToast]);

  const copyPublicId = useCallback(async () => {
    if (!createdAccount) return;
    await copyText(createdAccount.user.publicId);
    showToast('Public ID copied.');
  }, [createdAccount, showToast]);

  return {
    busyAction,
    changeRecoveryId,
    changeRequestedPublicId,
    confirmRecoverySaved,
    copyPublicId,
    copyRecoveryId,
    createdAccount,
    errors,
    recoveryId,
    requestedPublicId,
    submitCreate,
    submitRestore,
    toastMessage,
  };
}
