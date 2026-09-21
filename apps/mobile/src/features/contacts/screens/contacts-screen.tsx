import { ContactsScreenContent } from '@/features/contacts/components/contacts-screen-content';
import { useContactsScreen } from '@/features/contacts/hooks/use-contacts-screen';

export function ContactsScreen() {
  const contacts = useContactsScreen();

  return (
    <ContactsScreenContent
      addError={contacts.addError}
      addValue={contacts.addValue}
      contacts={contacts.contacts}
      isAddOpen={contacts.isAddOpen}
      isAdding={contacts.isAdding}
      loading={contacts.loading}
      onChangeAddValue={contacts.setAddValue}
      onChangeQuery={contacts.setQuery}
      onChangeTab={contacts.setTab}
      onCallAudio={contacts.callAudio}
      onCallVideo={contacts.callVideo}
      onCloseAdd={contacts.closeAdd}
      onOpenAdd={contacts.openAdd}
      onOpenChat={contacts.openChat}
      onRemove={contacts.requestRemove}
      onSubmitAdd={contacts.submitAdd}
      query={contacts.query}
      tab={contacts.tab}
    />
  );
}
