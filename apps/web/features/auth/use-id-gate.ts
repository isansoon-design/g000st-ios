"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";

import { toApiError } from "@/app/api/api-error";
import { registerAccount, restoreAccount } from "@/app/api/auth";
import { sessionStorage } from "@/app/api/session-storage";
import {
    parseAuthenticationResult,
    parseRegisterAccountResult,
} from "@/features/auth/parse-auth-result";
import {
    firstValidationMessage,
    normalizeId,
    validateRecoveryId,
    type IdGateErrors,
} from "@/features/auth/validation";

export type BusyAction = "create" | "restore" | null;
export type RegistrationModalStage = "closed" | "confirm" | "credentials";

async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard) throw new Error("Clipboard is unavailable.");
  await navigator.clipboard.writeText(value);
}

export function useIdGate() {
  const router = useRouter();
  const [recoveryId, setRecoveryId] = useState("");
  const [errors, setErrors] = useState<IdGateErrors>({});
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [registrationModalStage, setRegistrationModalStage] =
    useState<RegistrationModalStage>("closed");
  const [createdRecoveryId, setCreatedRecoveryId] = useState<string | null>(
    null,
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
      const response = await registerAccount({});
      const result = parseRegisterAccountResult(response.data);
      setCreatedRecoveryId(result.recoveryId);
      setRegistrationModalStage("credentials");
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const submitRestore = useCallback(
    async (optionalId?: string | React.FormEvent) => {
      const idToUse = typeof optionalId === "string" ? optionalId : recoveryId;
      const validationErrors = validateRecoveryId(idToUse);
      setErrors(validationErrors);

      const firstError = firstValidationMessage(validationErrors, ["recoveryId"]);
      if (firstError) {
        toast.error(firstError);
        return;
      }

      setBusyAction("restore");
      try {
        const response = await restoreAccount({
          recoveryId: normalizeId(idToUse),
        });
        const result = parseAuthenticationResult(response.data);
        sessionStorage.save({ tokens: result.session, user: result.user });
        try {
          sessionStorage.saveRecoveryId(result.user.publicId, normalizeId(idToUse));
        } catch (error) {
          sessionStorage.clear();
          throw error;
        }
        router.replace("/social");
      } catch (error) {
        toast.error(toApiError(error).message);
      } finally {
        setBusyAction(null);
      }
    },
    [recoveryId, router],
  );

  const copyCreatedRecoveryId = useCallback(async () => {
    if (!createdRecoveryId) return;

    try {
      await copyText(createdRecoveryId);
      setRecoveryId(createdRecoveryId);
      setCreatedRecoveryId(null);
      setRegistrationModalStage("closed");
      toast.success("ID copied and filled automatically.");
    } catch (error) {
      toast.error(toApiError(error).message);
    }
  }, [createdRecoveryId]);

  const loginWithNewId = useCallback(async () => {
    if (!createdRecoveryId) return;

    try {
      await copyText(createdRecoveryId);
      setRecoveryId(createdRecoveryId);
      const idToLogin = createdRecoveryId;
      setCreatedRecoveryId(null);
      setRegistrationModalStage("closed");
      await submitRestore(idToLogin);
    } catch (error) {
      toast.error(toApiError(error).message);
    }
  }, [createdRecoveryId, submitRestore]);

  return {
    busyAction,
    cancelRegistration,
    changeRecoveryId,
    confirmRegistration,
    copyCreatedRecoveryId,
    createdRecoveryId,
    errors,
    loginWithNewId,
    recoveryId,
    registrationModalStage,
    requestRegistration,
    submitRestore,
  };
}
