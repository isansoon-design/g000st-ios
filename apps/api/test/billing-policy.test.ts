import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  billableSecondsForCall,
  hasSufficientSms,
  hasSufficientVoiceSeconds,
} from '../src/billing/billing-policy.js';

describe('Billing policy', () => {
  describe('billableSecondsForCall', () => {
    const cases: readonly (readonly [label: string, durationMs: number, expectedSeconds: number])[] = [
      ['zero duration still bills a one-minute floor', 0, 60],
      ['one second rounds up to the one-minute floor', 1_000, 60],
      ['fifty-nine seconds rounds up to one minute', 59_000, 60],
      ['exactly sixty seconds bills exactly one minute', 60_000, 60],
      ['sixty-one seconds rounds up to two minutes', 61_000, 120],
    ];

    for (const [label, durationMs, expectedSeconds] of cases) {
      it(label, () => {
        const answeredAtMs = 1_789_000_000_000;
        assert.equal(billableSecondsForCall(answeredAtMs, answeredAtMs + durationMs), expectedSeconds);
      });
    }
  });

  describe('hasSufficientVoiceSeconds', () => {
    it('allows exactly the remaining balance and rejects one second more', () => {
      const balance = { voiceSecondsRemaining: 60, smsRemaining: 0, updatedAtMs: 0 };
      assert.equal(hasSufficientVoiceSeconds(balance, 60), true);
      assert.equal(hasSufficientVoiceSeconds(balance, 61), false);
    });
  });

  describe('hasSufficientSms', () => {
    it('allows exactly the remaining balance and rejects one more', () => {
      const balance = { voiceSecondsRemaining: 0, smsRemaining: 5, updatedAtMs: 0 };
      assert.equal(hasSufficientSms(balance, 5), true);
      assert.equal(hasSufficientSms(balance, 6), false);
    });
  });
});
