export const sectionDetails: Readonly<Record<string, { title: string; description: string; period: string }>> = {
  social: { title: 'Social posts', description: 'Posts created in Social, including hidden and deleted records.', period: 'created' },
  market: { title: 'Market listings', description: 'Listings created in Market, including hidden and deleted records.', period: 'created' },
  chat: { title: 'Chat conversations', description: 'Conversation records created in Chat.', period: 'started' },
  calling: { title: 'In-app calls', description: 'Call records created by the in-app calling feature.', period: 'started' },
  sms: { title: 'SMS messages', description: 'SMS records created by the telephony feature.', period: 'created' },
  profiles: { title: 'Social profiles', description: 'Profile records. Today and month count profiles updated during each period.', period: 'updated' },
  'social-reports': { title: 'Social reports', description: 'Reports submitted about Social content.', period: 'submitted' },
  'market-reports': { title: 'Market reports', description: 'Reports submitted about Market listings.', period: 'submitted' },
  support: { title: 'Support messages', description: 'Messages received through Contact us.', period: 'received' },
  contacts: { title: 'Contacts', description: 'Current follow relationships between accounts.', period: 'created' },
  'external-calls': { title: 'External calls', description: 'Calls recorded by the telephony feature.', period: 'started' },
  billing: { title: 'Billing entries', description: 'Billing ledger entries, not payments or revenue.', period: 'recorded' },
};
