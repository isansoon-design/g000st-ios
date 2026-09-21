import 'dotenv/config';

import assert from 'node:assert/strict';

import { createFirestore } from '../dist/firebase/create-firestore.js';

const publicId = process.argv[2];
const collectionPrefix = process.env.AUTH_COLLECTION_PREFIX;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

assert.ok(publicId, 'Usage: node scripts/grant-admin.mjs <publicId>');
assert.ok(collectionPrefix, 'AUTH_COLLECTION_PREFIX is required');
assert.ok(serviceAccountPath, 'FIREBASE_SERVICE_ACCOUNT_PATH is required');

async function main() {
  const firestore = await createFirestore(serviceAccountPath);
  const userRef = firestore.collection(`${collectionPrefix}_users`).doc(publicId);
  const user = await userRef.get();

  assert.ok(user.exists, `No account found for publicId ${publicId}`);

  await userRef.update({ role: 'admin' });
  console.log(`Granted admin role to ${publicId}`);
}

await main();
