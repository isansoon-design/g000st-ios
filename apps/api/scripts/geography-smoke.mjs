import 'dotenv/config';
import assert from 'node:assert/strict';
import { createFirestore } from '../dist/firebase/create-firestore.js';
import { AdminDeskService } from '../dist/admin/admin-desk.js';
import { AdminAnalyticsService } from '../dist/admin/admin-analytics.js';

const origin = process.env.SMOKE_API_BASE_URL ?? 'https://staging.g000st.com/api/v1';
const expectedCountry = process.env.SMOKE_GEO_COUNTRY;
assert.ok(expectedCountry, 'Set SMOKE_GEO_COUNTRY from the local MMDB lookup for the test client IP');
const prefix = process.env.AUTH_COLLECTION_PREFIX;
assert.ok(prefix);
const db = await createFirestore(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
let publicId;
try {
  const response = await fetch(`${origin}/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 201, 'Test account registration');
  const account = await response.json();
  publicId = account.user.publicId;
  const heartbeat = await fetch(`${origin}/presence/heartbeat`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${account.session.accessToken}`,
      'x-geo-country': 'AQ', 'x-geo-city': 'Forged City',
      'x-forwarded-for': '1.1.1.1', 'x-real-ip': '1.1.1.1',
    },
  });
  assert.equal(heartbeat.status, 204, 'Authenticated heartbeat');
  const location = (await db.collection(`${prefix}_presence`).doc(publicId).get()).data();
  assert.equal(location.country, expectedCountry, 'Country comes from the TCP peer, ignoring forged headers');
  assert.notEqual(location.city, 'Forged City');
  assert.ok(location.geoRecordedAtMs > Date.now() - 60_000);
  assert.equal(location.ip, undefined);
  const users = await new AdminDeskService(db, prefix).listSearchedUsers(1, publicId);
  assert.equal(users.users[0].geography.country, expectedCountry);
  assert.equal(users.users[0].geography.city, location.city);
  const analytics = await new AdminAnalyticsService(db, prefix).get();
  assert.ok(analytics.geography.coveredUsers >= 1);
  assert.ok(analytics.geography.countries.some((country) => country.name === expectedCountry));
  const denied = await fetch(`${origin}/admin/users`, {
    headers: { authorization: `Bearer ${account.session.accessToken}` },
  });
  assert.equal(denied.status, 403, 'Locations remain admin-only');
  console.log('Geography smoke passed: trusted country/city, dashboard summaries, forged-header rejection, admin-only access.');
} finally {
  if (publicId) {
    const batch = db.batch();
    for (const name of ['recovery_credentials', 'access_sessions', 'refresh_sessions', 'session_families']) {
      const rows = await db.collection(`${prefix}_${name}`).where('publicId', '==', publicId).get();
      for (const row of rows.docs) batch.delete(row.ref);
    }
    batch.delete(db.collection(`${prefix}_presence`).doc(publicId));
    batch.delete(db.collection(`${prefix}_users`).doc(publicId));
    await batch.commit();
    console.log('Temporary geography test account removed.');
  }
  await db.terminate();
}
