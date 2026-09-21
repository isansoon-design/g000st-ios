import { z } from 'zod';

import axiosInstance from '@/api/axios';
import { parseApiPayload } from '@/api/parse-api-payload';
import { callHistoryPageSchema, turnCredentialSchema } from '@/domain/calling/types';

const turnCredentialResponseSchema = z.object({ credential: turnCredentialSchema });

export async function issueTurnCredential() {
  const response = await axiosInstance.post('/calling/turn-credential');
  return parseApiPayload(turnCredentialResponseSchema, response.data).credential;
}

export async function listCallHistory(cursor?: string) {
  const response = await axiosInstance.get('/calling/history', { params: { cursor, limit: 30 } });
  return parseApiPayload(callHistoryPageSchema, response.data);
}

export async function registerVoipToken(
  deviceId: string,
  tokenType: 'APNS_VOIP' | 'FCM',
  token: string,
): Promise<void> {
  await axiosInstance.post('/calling/voip-token', { deviceId, tokenType, token });
}

export async function unregisterVoipToken(deviceId: string): Promise<void> {
  await axiosInstance.delete(`/calling/voip-token/${deviceId}`);
}
