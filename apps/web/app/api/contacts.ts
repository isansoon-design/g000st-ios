import axios from "./axios";

export type Contact = {
  addedAtMs: number;
  avatarUrl?: string;
  displayName?: string;
  nickname?: string;
  online: boolean;
  publicId: string;
};

export type PeerPreferences = { blocked: boolean; allowAudioCalls: boolean; allowVideoCalls: boolean };

export async function listContacts(): Promise<Contact[]> {
  const { data } = await axios.get<{ items: Contact[] }>("/contacts");
  return data.items;
}

export async function listContactNicknames(): Promise<{ publicId: string; nickname: string }[]> {
  const { data } = await axios.get<{ items: { publicId: string; nickname: string }[] }>("/contacts/nicknames");
  return data.items;
}

export async function followByPublicId(publicId: string): Promise<void> {
  await axios.post("/contacts", { publicId });
}

export async function unfollowContact(publicId: string): Promise<void> {
  await axios.delete(`/contacts/${publicId}`);
}

export async function updateContactNickname(publicId: string, nickname: string): Promise<void> {
  await axios.patch(`/contacts/${publicId}`, { nickname });
}

export async function getPeerPreferences(publicId: string): Promise<PeerPreferences> {
  const { data } = await axios.get<{ preferences: PeerPreferences }>(`/contacts/${publicId}/preferences`);
  return data.preferences;
}

export async function updatePeerPreferences(publicId: string, changes: Partial<PeerPreferences>): Promise<PeerPreferences> {
  const { data } = await axios.patch<{ preferences: PeerPreferences }>(`/contacts/${publicId}/preferences`, changes);
  return data.preferences;
}
