import assert from 'node:assert/strict';
import { it } from 'node:test';

import { normalizePageSocialUrl, normalizeWhatsAppNumber } from '../src/social/page-contact-policy.js';

it('normalizes international WhatsApp numbers for direct chat links', () => {
  assert.equal(normalizeWhatsAppNumber('+963 912 345 678'), '+963912345678');
  assert.equal(normalizeWhatsAppNumber('00963-912-345-678'), '+963912345678');
  assert.equal(normalizeWhatsAppNumber('963912345678'), null);
  assert.equal(normalizeWhatsAppNumber('+0123456789'), null);
  assert.equal(normalizeWhatsAppNumber('+963912345678;evil'), null);
});

it('accepts only HTTPS links for the selected social platform', () => {
  assert.equal(normalizePageSocialUrl('https://www.instagram.com/example/', 'instagram'), 'https://www.instagram.com/example/');
  assert.equal(normalizePageSocialUrl('https://www.linkedin.com/company/example', 'linkedin'), 'https://www.linkedin.com/company/example');
  assert.equal(normalizePageSocialUrl('https://instagram.com.evil.test/example', 'instagram'), null);
  assert.equal(normalizePageSocialUrl('javascript:alert(1)', 'facebook'), null);
  assert.equal(normalizePageSocialUrl('https://tiktok.com/', 'tiktok'), null);
});
