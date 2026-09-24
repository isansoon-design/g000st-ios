import { ApiError } from '../http/api-error.js';

export const PROHIBITED_MARKET_KEYWORDS = [
  // Weapons & violence
  'firearm', 'gun', 'pistol', 'rifle', 'ammunition', 'ammo', 'explosive', 'bomb', 'grenade',
  'tactical weapon', 'switchblade', 'brass knuckles',
  // Drugs & pharmaceuticals
  'drugs', 'narcotics', 'cocaine', 'heroin', 'weed', 'cannabis', 'marijuana', 'pills',
  'prescription', 'steroids', 'xanax', 'valium', 'pharma', 'opioid',
  // Counterfeit & fraud
  'replica', 'fake', 'bootleg', 'knockoff', 'dupe', 'cloned', 'cracked account',
  'hacked account', 'ssn', 'social security', 'passport for sale', 'fake id',
  // Adult & explicit
  'porn', 'adult content', 'escort', 'hookup', 'sex', 'webcam model', 'strip', 'nudes',
  'erotic', 'dating service',
  // Hazardous & restricted
  'toxic', 'chemical', 'acid', 'radioactive', 'flammable', 'fireworks', 'gunpowder',
  // Financial & gambling
  'gambling', 'casino', 'lottery', 'betting', 'crypto giveaway', 'get rich quick',
  'easy money', 'loan shark', 'credit card dump',
] as const;

function normalizeForFilter(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const normalizedKeywords = PROHIBITED_MARKET_KEYWORDS
  .map((keyword) => ({ keyword, normalized: normalizeForFilter(keyword) }))
  .sort((left, right) => right.normalized.length - left.normalized.length);

export function findProhibitedMarketKeyword(value: string): string | undefined {
  const normalized = ` ${normalizeForFilter(value)} `;
  return normalizedKeywords.find(({ normalized: keyword }) =>
    normalized.includes(` ${keyword} `),
  )?.keyword;
}

export function assertMarketContentAllowed(...values: readonly string[]): void {
  if (values.some((value) => findProhibitedMarketKeyword(value))) {
    throw new ApiError(
      422,
      'PROHIBITED_MARKET_CONTENT',
      'This listing contains content that is not allowed in Market.',
    );
  }
}
