import { z } from 'zod';

// API v1: omission preserves an address field; an empty string clears it.
export const pageAddressSchema = z.object({
  city: z.string().trim().max(100).optional(),
  postCode: z.string().trim().max(32).optional(),
  street1: z.string().trim().max(200).optional(),
  street2: z.string().trim().max(200).optional(),
});
