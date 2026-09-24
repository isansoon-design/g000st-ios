import { useCallback, useEffect, useRef, useState } from "react";

import { toApiError } from "@/api/api-error";
import type { AuthenticationResult } from "@/domain/auth/types";
import {
    createAccount,
    recoverAccount,
} from "@/features/auth/api/auth-use-cases";
import {
    firstValidationMessage,
    normalizeId,
    validateRecoveryId,
    type IdGateErrors,
} from "@/features/auth/validation/id-validation";
import { copyText } from "@/services/device/clipboard";

export type BusyAction = "create" | "restore" | null;
export type RegistrationModalStage = "closed" | "confirm" | "credentials";

type UseIdGateOptions = Readonly<{
  onAuthenticated: (result: AuthenticationResult) => Promise<void>;
}>;

export function useIdGate({ onAuthenticated }: UseIdGateOptions) {
  const [recoveryId, setRecoveryId] = useState("");
  const [errors, setErrors] = useState<IdGateErrors>({});
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [registrationModalStage, setRegistrationModalStage] =
    useState<RegistrationModalStage>("closed");
  const [createdRecoveryId, setCreatedRecoveryId] = useState<string | null>(
    null,
  );
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

  const changeRecoveryId = useCallback((value: string) => {
    setRecoveryId(value);
    setErrors((current) => ({ ...current, recoveryId: undefined }));
  }, []);

  const requestRegistration = useCallback(() => {
    setRegistrationModalStage("confirm");
  }, []);

  const cancelRegistration = useCallback(() => {
    if (busyAction === "create") return;
    setRegistrationModalStage("closed");
  }, [busyAction]);

  const confirmRegistration = useCallback(async () => {
    setBusyAction("create");
    try {
      const result = await createAccount({});
      setCreatedRecoveryId(result.recoveryId);
      setRegistrationModalStage("credentials");
    } catch (error: any) {
      console.log("Error during account creation:", error); // Debugging log
      showToast(toApiError(error).message);
    } finally {
      setBusyAction(null);
    }
  }, [showToast]);

  const submitRestore = useCallback(async () => {
    const validationErrors = validateRecoveryId(recoveryId);
    setErrors(validationErrors);

    const firstError = firstValidationMessage(validationErrors, ["recoveryId"]);
    if (firstError) {
      showToast(firstError);
      return;
    }

    setBusyAction("restore");
    try {
      const result = await recoverAccount({
        recoveryId: normalizeId(recoveryId),
      });
      await onAuthenticated(result);
    } catch (error) {
      showToast(toApiError(error).message);
    } finally {
      setBusyAction(null);
    }
  }, [onAuthenticated, recoveryId, showToast]);

  const copyCreatedRecoveryId = useCallback(async () => {
    if (!createdRecoveryId) return;

    try {
      await copyText(createdRecoveryId);
      setRecoveryId(createdRecoveryId);
      setCreatedRecoveryId(null);
      setRegistrationModalStage("closed");
      showToast("ID copied and filled automatically.");
    } catch (error) {
      showToast(toApiError(error).message);
    }
  }, [createdRecoveryId, showToast]);

  return {
    busyAction,
    cancelRegistration,
    changeRecoveryId,
    confirmRegistration,
    copyCreatedRecoveryId,
    createdRecoveryId,
    errors,
    recoveryId,
    registrationModalStage,
    requestRegistration,
    submitRestore,
    toastMessage,
  };
}
