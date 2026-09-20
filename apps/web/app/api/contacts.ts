import axios from "./axios";

export type Contact = {
  addedAtMs: number;
  avatarUrl?: string;
  displayName?: string;
  online: boolean;
  publicId: string;
};

export async function listContacts(): Promise<Contact[]> {
  const { data } = await axios.get<{ items: Contact[] }>("/contacts");
  return data.items;
}

export async function addContact(publicId: string): Promise<void> {
  await axios.post("/contacts", { publicId });
}

export async function removeContact(publicId: string): Promise<void> {
  await axios.delete(`/contacts/${publicId}`);
}
