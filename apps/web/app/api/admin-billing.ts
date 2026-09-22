import axios from "./axios";
import type { Balance, LedgerEvent } from "@/features/mobile/types";

export async function getAdminBalance(publicId: string): Promise<Balance> {
  const { data } = await axios.get<{ balance: Balance }>(`/billing/admin/users/${publicId}`);
  return data.balance;
}

export async function getAdminLedger(
  publicId: string,
  cursor?: string,
): Promise<{ items: LedgerEvent[]; nextCursor?: string }> {
  const { data } = await axios.get<{ items: LedgerEvent[]; nextCursor?: string }>(
    `/billing/admin/users/${publicId}/ledger`,
    { params: { cursor, limit: 20 } },
  );
  return data;
}

export async function adjustAdminBalance(
  publicId: string,
  voiceSecondsDelta: number,
  smsDelta: number,
  reason: string,
): Promise<Balance> {
  const { data } = await axios.post<{ balance: Balance }>(`/billing/admin/users/${publicId}/adjust`, {
    voiceSecondsDelta,
    smsDelta,
    reason,
  });
  return data.balance;
}
