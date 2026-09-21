import type { BillingSku } from './billing-types.js';

// Fresh SKU ids on purpose: the legacy client (`sms5`/`min10`/`min30`) and legacy backend
// (`sms`/`voice10`/`voice30`) disagreed with each other, so neither name is reused here.
export const BILLING_SKUS: readonly BillingSku[] = [
  { id: 'sms-5', kind: 'sms', quantity: 5, priceCents: 500, currency: 'gbp', label: '5 SMS' },
  { id: 'voice-10m', kind: 'voice_minutes', quantity: 10, priceCents: 1_000, currency: 'gbp', label: '10 minutes' },
  { id: 'voice-30m', kind: 'voice_minutes', quantity: 30, priceCents: 2_500, currency: 'gbp', label: '30 minutes' },
];

export function findBillingSku(id: string): BillingSku | undefined {
  return BILLING_SKUS.find((sku) => sku.id === id);
}
