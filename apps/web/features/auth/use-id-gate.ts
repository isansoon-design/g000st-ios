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
import type { AuthenticationResult, RegisterAccountResult } from "@/features/auth/types";
import {
  firstValidationMessage,
  normalizeId,
  type IdGateErrors,
  validateRecoveryId,
  validateRequestedPublicId,
} from "@/features/auth/validation";

export type BusyAction = "create" | "restore" | "confirm" | null;

async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard) throw new Error("Clipboard is unavailable.");
  await navigator.clipboard.writeText(value);
}

export function useIdGate() {
  const router = useRouter();
  const [requestedPublicId, setRequestedPublicId] = useState("");
  const [recoveryId, setRecoveryId] = useState("");
  const [errors, setErrors] = useState<IdGateErrors>({});
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [createdAccount, setCreatedAccount] = useState<RegisterAccountResult | null>(null);

  const changeRequestedPublicId = useCallback((value: string) => {
    setRequestedPublicId(value);
    setErrors((current) => ({ ...current, requestedPublicId: undefined }));
  }, []);

  const changeRecoveryId = useCallback((value: string) => {
    setRecoveryId(value);
    setErrors((current) => ({ ...current, recoveryId: undefined }));
  }, []);

  const completeAuthentication = useCallback(
    (result: AuthenticationResult) => {
      sessionStorage.save({ tokens: result.session, user: result.user });
      router.replace("/chat");
    },
    [router],
  );

  const submitCreate = useCallback(async () => {
    const validationErrors = validateRequestedPublicId(requestedPublicId);
    setErrors(validationErrors);

    const firstError = firstValidationMessage(validationErrors, ["requestedPublicId"]);
    if (firstError) {
      toast.error(firstError);
      return;
    }

    setBusyAction("create");
    try {
      const normalized = normalizeId(requestedPublicId);
      const response = await registerAccount({
        ...(normalized ? { requestedPublicId: normalized } : {}),
      });
      setCreatedAccount(parseRegisterAccountResult(response.data));
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setBusyAction(null);
    }
  }, [requestedPublicId]);

  const submitRestore = useCallback(async () => {
    const validationErrors = validateRecoveryId(recoveryId);
    setErrors(validationErrors);

    const firstError = firstValidationMessage(validationErrors, ["recoveryId"]);
    if (firstError) {
      toast.error(firstError);
      return;
    }

    setBusyAction("restore");
    try {
      const response = await restoreAccount({ recoveryId: normalizeId(recoveryId) });
      completeAuthentication(parseAuthenticationResult(response.data));
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setBusyAction(null);
    }
  }, [completeAuthentication, recoveryId]);

  const confirmRecoverySaved = useCallback(() => {
    if (!createdAccount) return;

    setBusyAction("confirm");
    completeAuthentication({ session: createdAccount.session, user: createdAccount.user });
  }, [completeAuthentication, createdAccount]);

  const copyPublicId = useCallback(async () => {
    if (!createdAccount) return;

    try {
      await copyText(createdAccount.user.publicId);
      toast.success("Public ID copied.");
    } catch (error) {
      toast.error(toApiError(error).message);
    }
  }, [createdAccount]);

  const copyRecoveryId = useCallback(async () => {
    if (!createdAccount) return;

    try {
      await copyText(createdAccount.recoveryId);
      toast.success("Recovery ID copied. Keep it private.");
    } catch (error) {
      toast.error(toApiError(error).message);
    }
  }, [createdAccount]);

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
  };
}
