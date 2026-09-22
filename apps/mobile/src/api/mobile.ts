import { z } from 'zod';

import axiosInstance from '@/api/axios';
import { parseApiPayload } from '@/api/parse-api-payload';
import {
  balanceSchema,
  billingSkuSchema,
  checkoutSessionSchema,
  externalCallPageSchema,
  ledgerPageSchema,
  outboundSmsSchema,
  outboundSmsPageSchema,
  webrtcCredentialSchema,
} from '@/domain/mobile/types';

const skusResponseSchema = z.object({ skus: z.array(billingSkuSchema) });
const balanceResponseSchema = z.object({ balance: balanceSchema });
const credentialResponseSchema = z.object({ credential: webrtcCredentialSchema });
const smsResponseSchema = z.object({ message: outboundSmsSchema });

export async function listBillingSkus() {
  const response = await axiosInstance.get('/billing/skus');
  return parseApiPayload(skusResponseSchema, response.data).skus;
}

export async function createCheckoutSession(skuId: string) {
  const response = await axiosInstance.post('/billing/checkout-sessions', { skuId, returnTo: 'mobile' });
  return parseApiPayload(checkoutSessionSchema, response.data);
}

export async function getBalance() {
  const response = await axiosInstance.get('/billing/balance');
  return parseApiPayload(balanceResponseSchema, response.data).balance;
}

export async function listLedger(cursor?: string) {
  const response = await axiosInstance.get('/billing/ledger', { params: { cursor, limit: 20 } });
  return parseApiPayload(ledgerPageSchema, response.data);
}

export async function issueWebrtcCredential() {
  const response = await axiosInstance.post('/telephony/webrtc-credential');
  return parseApiPayload(credentialResponseSchema, response.data).credential;
}

/** Balance pre-check only — does not place the call. The client places it directly via the Telnyx SDK. */
export async function authorizeExternalCall(toE164: string): Promise<void> {
  await axiosInstance.post('/telephony/calls', { toE164 });
}

export async function listExternalCalls(cursor?: string) {
  const response = await axiosInstance.get('/telephony/calls', { params: { cursor, limit: 20 } });
  return parseApiPayload(externalCallPageSchema, response.data);
}

export async function sendSms(toE164: string, body: string) {
  const response = await axiosInstance.post('/telephony/sms', { toE164, body });
  return parseApiPayload(smsResponseSchema, response.data).message;
}

export async function listSms(cursor?: string) {
  const response = await axiosInstance.get('/telephony/sms', { params: { cursor, limit: 20 } });
  return parseApiPayload(outboundSmsPageSchema, response.data);
}
