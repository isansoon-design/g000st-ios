import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import Toast from 'react-native-toast-message';

import { startChatConversation } from '@/api/chat';
import { addContact, listContacts, removeContact } from '@/api/contacts';
import type { Contact } from '@/domain/contacts/types';
import { G000ST_ID_LENGTH } from '@/domain/identity/constants';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCalling } from '@/features/calling/hooks/use-calling';
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
  const { callUser } = useCalling();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ContactsTab>('all');
  const [query, setQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    try {
      setContacts(await listContacts());
    } catch (error) {
      if (!options?.silent) {
        Toast.show({ text1: 'Contacts', text2: errorMessage(error), type: 'error' });
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  // Presence is heartbeat-based, not push-based, so the "online" dot only reflects
  // whatever the server returned at fetch time. Refetch periodically while the app
  // is foregrounded so it doesn't go stale for the whole time the screen is open.
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 20_000;
    const refresh = () => void load({ silent: true });

    if (AppState.currentState === 'active') {
      refreshTimerRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refresh();
        if (!refreshTimerRef.current) {
          refreshTimerRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);
        }
      } else if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    });

    return () => {
      subscription.remove();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    };
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

  const callAudio = useCallback(
    (contact: Contact) => void callUser(contact.publicId, contact.displayName, 'audio'),
    [callUser],
  );
  const callVideo = useCallback(
    (contact: Contact) => void callUser(contact.publicId, contact.displayName, 'video'),
    [callUser],
  );

  return {
    addError,
    addValue,
    callAudio,
    callVideo,
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
