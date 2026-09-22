import axios from "./axios";
import type {
  Balance,
  BillingSku,
  ExternalCall,
  LedgerEvent,
  OutboundSms,
  WebrtcCredential,
} from "@/features/mobile/types";

export async function listBillingSkus(): Promise<BillingSku[]> {
  const { data } = await axios.get<{ skus: BillingSku[] }>("/billing/skus");
  return data.skus;
}

export async function createCheckoutSession(skuId: string): Promise<{ checkoutUrl: string; checkoutSessionId: string }> {
  const { data } = await axios.post<{ checkoutUrl: string; checkoutSessionId: string }>("/billing/checkout-sessions", {
    skuId,
    returnTo: "web",
  });
  return data;
}

export async function getBalance(): Promise<Balance> {
  const { data } = await axios.get<{ balance: Balance }>("/billing/balance");
  return data.balance;
}

export async function listLedger(cursor?: string): Promise<{ items: LedgerEvent[]; nextCursor?: string }> {
  const { data } = await axios.get<{ items: LedgerEvent[]; nextCursor?: string }>("/billing/ledger", {
    params: { cursor, limit: 20 },
  });
  return data;
}

export async function issueWebrtcCredential(): Promise<WebrtcCredential> {
  const { data } = await axios.post<{ credential: WebrtcCredential }>("/telephony/webrtc-credential");
  return data.credential;
}

/**
 * Pre-flight balance check only — this never places the call itself. Call this immediately
 * before placing the call via the Telnyx WebRTC SDK (see features/mobile/telnyx-call.ts).
 */
export async function authorizeExternalCall(toE164: string): Promise<void> {
  await axios.post("/telephony/calls", { toE164 });
}

export async function listExternalCalls(cursor?: string): Promise<{ items: ExternalCall[]; nextCursor?: string }> {
  const { data } = await axios.get<{ items: ExternalCall[]; nextCursor?: string }>("/telephony/calls", {
    params: { cursor, limit: 20 },
  });
  return data;
}

export async function sendSms(toE164: string, body: string): Promise<OutboundSms> {
  const { data } = await axios.post<{ message: OutboundSms }>("/telephony/sms", { toE164, body });
  return data.message;
}

export async function listSms(cursor?: string): Promise<{ items: OutboundSms[]; nextCursor?: string }> {
  const { data } = await axios.get<{ items: OutboundSms[]; nextCursor?: string }>("/telephony/sms", {
    params: { cursor, limit: 20 },
  });
  return data;
}
