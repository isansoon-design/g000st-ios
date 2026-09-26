import axiosInstance from '@/api/axios';
import { parseApiPayload } from '@/api/parse-api-payload';
import { contactListSchema } from '@/domain/contacts/types';
import { z } from 'zod';

export async function listContacts() {
  const response = await axiosInstance.get('/contacts');
  return parseApiPayload(contactListSchema, response.data).items;
}

const nicknameListSchema = z.object({ items: z.array(z.object({ publicId: z.string(), nickname: z.string() })) });
const peerPreferencesSchema = z.object({ blocked: z.boolean(), allowAudioCalls: z.boolean(), allowVideoCalls: z.boolean() });
export type PeerPreferences = z.infer<typeof peerPreferencesSchema>;

export async function listContactNicknames() {
  const response = await axiosInstance.get('/contacts/nicknames');
  return parseApiPayload(nicknameListSchema, response.data).items;
}

export async function followByPublicId(publicId: string) {
  await axiosInstance.post('/contacts', { publicId });
}

export async function unfollowContact(publicId: string) {
  await axiosInstance.delete(`/contacts/${publicId}`);
}

export async function updateContactNickname(publicId: string, nickname: string) {
  await axiosInstance.patch(`/contacts/${publicId}`, { nickname });
}

export async function getPeerPreferences(publicId: string): Promise<PeerPreferences> {
  const response = await axiosInstance.get(`/contacts/${publicId}/preferences`);
  return parseApiPayload(z.object({ preferences: peerPreferencesSchema }), response.data).preferences;
}

export async function updatePeerPreferences(publicId: string, changes: Partial<PeerPreferences>): Promise<PeerPreferences> {
  const response = await axiosInstance.patch(`/contacts/${publicId}/preferences`, changes);
  return parseApiPayload(z.object({ preferences: peerPreferencesSchema }), response.data).preferences;
}
