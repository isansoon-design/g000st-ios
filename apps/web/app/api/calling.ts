import axios from "./axios";
import type { CallHistoryEntry, TurnCredential } from "@/features/calling/types";

export async function issueTurnCredential(): Promise<TurnCredential> {
  const { data } = await axios.post<{ credential: TurnCredential }>("/calling/turn-credential");
  return data.credential;
}

export async function listCallHistory(cursor?: string): Promise<{ items: CallHistoryEntry[]; nextCursor?: string }> {
  const { data } = await axios.get<{ items: CallHistoryEntry[]; nextCursor?: string }>("/calling/history", {
    params: { cursor, limit: 30 },
  });
  return data;
}
