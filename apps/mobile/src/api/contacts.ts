import axiosInstance from '@/api/axios';
import { parseApiPayload } from '@/api/parse-api-payload';
import { contactListSchema } from '@/domain/contacts/types';

export async function listContacts() {
  const response = await axiosInstance.get('/contacts');
  return parseApiPayload(contactListSchema, response.data).items;
}

export async function addContact(publicId: string) {
  await axiosInstance.post('/contacts', { publicId });
}

export async function removeContact(publicId: string) {
  await axiosInstance.delete(`/contacts/${publicId}`);
}

export async function updateContactNickname(publicId: string, nickname: string) {
  await axiosInstance.patch(`/contacts/${publicId}`, { nickname });
}
