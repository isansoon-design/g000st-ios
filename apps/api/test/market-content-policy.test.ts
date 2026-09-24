import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertMarketContentAllowed, findProhibitedMarketKeyword, PROHIBITED_MARKET_KEYWORDS } from '../src/market/market-content-policy.js';

describe('Market prohibited-content policy', () => {
  it('blocks every configured keyword and phrase', () => {
    for (const keyword of PROHIBITED_MARKET_KEYWORDS) {
      assert.equal(findProhibitedMarketKeyword(`Selling ${keyword} today`), keyword);
    }
  });

  it('is case-insensitive and treats punctuation as phrase separators', () => {
    assert.equal(findProhibitedMarketKeyword('Premium FAKE-ID available'), 'fake id');
    assert.equal(findProhibitedMarketKeyword('CREDIT/CARD/DUMP'), 'credit card dump');
  });

  it('normalizes compatible unicode characters', () => {
    assert.equal(findProhibitedMarketKeyword('ＦＩＲＥＡＲＭ'), 'firearm');
  });

  it('does not match prohibited fragments inside innocent words', () => {
    for (const content of ['striped shirt', 'Essex furniture', 'placid blue painting', 'classical duperior']) {
      assert.equal(findProhibitedMarketKeyword(content), undefined);
      assert.doesNotThrow(() => assertMarketContentAllowed(content));
    }
  });

  it('returns a stable API error without revealing the matched term', () => {
    assert.throws(
      () => assertMarketContentAllowed('A hacked account for sale'),
      (error: unknown) => error instanceof Error
        && 'code' in error
        && error.code === 'PROHIBITED_MARKET_CONTENT'
        && !error.message.includes('hacked account'),
    );
  });
});
