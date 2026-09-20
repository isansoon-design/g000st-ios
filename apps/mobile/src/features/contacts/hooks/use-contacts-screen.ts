import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';

import { startChatConversation } from '@/api/chat';
import { addContact, listContacts, removeContact } from '@/api/contacts';
import type { Contact } from '@/domain/contacts/types';
import { G000ST_ID_LENGTH } from '@/domain/identity/constants';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useConfirmModal } from '@/providers/confirm-modal-provider';

export type ContactsTab = 'all' | 'online';

function normalizeId(value: string): string {
  return value.replace(/\s+/g, '');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function useContactsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ContactsTab>('all');
  const [query, setQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setContacts(await listContacts());
    } catch (error) {
      Toast.show({ text1: 'Contacts', text2: errorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const visibleContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (tab === 'online' && !contact.online) return false;
      if (!normalizedQuery) return true;
      return (
        contact.displayName?.toLowerCase().includes(normalizedQuery) ||
        contact.publicId.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [contacts, query, tab]);

  const openAdd = useCallback(() => {
    setAddValue('');
    setAddError(null);
    setIsAddOpen(true);
  }, []);

  const closeAdd = useCallback(() => {
    if (isAdding) return;
    setIsAddOpen(false);
  }, [isAdding]);

  const submitAdd = useCallback(async () => {
    const publicId = normalizeId(addValue);
    if (publicId.length !== G000ST_ID_LENGTH || !/^[A-Za-z0-9]+$/.test(publicId)) {
      setAddError(`Public ID must be exactly ${G000ST_ID_LENGTH} letters or numbers.`);
      return;
    }
    if (publicId === user?.publicId) {
      setAddError('You cannot add yourself.');
      return;
    }
    if (contacts.some((contact) => contact.publicId === publicId)) {
      setAddError('This contact is already in your list.');
      return;
    }

    setIsAdding(true);
    try {
      await addContact(publicId);
      setIsAddOpen(false);
      await load();
      Toast.show({ text1: 'Contacts', text2: 'Contact added.', type: 'success' });
    } catch (error) {
      setAddError(errorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }, [addValue, contacts, load, user?.publicId]);

  const requestRemove = useCallback(
    async (contact: Contact) => {
      const confirmed = await confirm({
        cancelLabel: 'Cancel',
        confirmLabel: 'Remove',
        isDangerous: true,
        message: `Remove ${contact.displayName || 'this contact'} from your contacts?`,
        title: 'Remove contact?',
      });
      if (!confirmed) return;

      try {
        await removeContact(contact.publicId);
        setContacts((current) => current.filter((item) => item.publicId !== contact.publicId));
      } catch (error) {
        Toast.show({ text1: 'Contacts', text2: errorMessage(error), type: 'error' });
      }
    },
    [confirm],
  );

  const openChat = useCallback(
    async (publicId: string) => {
      try {
        const conversation = await startChatConversation(publicId);
        router.navigate({
          params: { conversationId: conversation.id },
          pathname: '/(app)/(tabs)/chat',
        });
      } catch (error) {
        Toast.show({ text1: 'Contacts', text2: errorMessage(error), type: 'error' });
      }
    },
    [router],
  );

  return {
    addError,
    addValue,
    closeAdd,
    contacts: visibleContacts,
    isAddOpen,
    isAdding,
    loading,
    openAdd,
    openChat,
    query,
    requestRemove,
    setAddValue,
    setQuery,
    setTab,
    submitAdd,
    tab,
  };
}
