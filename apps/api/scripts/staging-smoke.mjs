import 'dotenv/config';

import assert from 'node:assert/strict';

import { createFirestore } from '../dist/firebase/create-firestore.js';

const apiBaseUrl = process.env.SMOKE_API_BASE_URL ?? 'http://127.0.0.1:3100/api/v1';
const collectionPrefix = process.env.AUTH_COLLECTION_PREFIX;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

assert.ok(collectionPrefix, 'AUTH_COLLECTION_PREFIX is required');
assert.ok(serviceAccountPath, 'FIREBASE_SERVICE_ACCOUNT_PATH is required');

async function request(path, init = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  });

  return { body: await response.json(), status: response.status };
}

async function deleteSmokeAccount(publicId) {
  const firestore = await createFirestore(serviceAccountPath);
  const collectionNames = [
    'recovery_credentials',
    'access_sessions',
    'refresh_sessions',
    'session_families',
  ];

  try {
    const snapshots = await Promise.all(
      collectionNames.map((name) =>
        firestore.collection(`${collectionPrefix}_${name}`).where('publicId', '==', publicId).get(),
      ),
    );
    const batch = firestore.batch();

    batch.delete(firestore.collection(`${collectionPrefix}_users`).doc(publicId));
    for (const snapshot of snapshots) {
      for (const document of snapshot.docs) batch.delete(document.ref);
    }

    await batch.commit();
  } finally {
    await firestore.terminate();
  }
}

let publicId;

try {
  const registration = await request('/auth/register', {
    body: '{}',
    method: 'POST',
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.user.publicId.length, 50);
  assert.equal(registration.body.recoveryId.length, 50);
  assert.notEqual(registration.body.user.publicId, registration.body.recoveryId);
  publicId = registration.body.user.publicId;

  const me = await request('/auth/me', {
    headers: { authorization: `Bearer ${registration.body.session.accessToken}` },
  });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.publicId, publicId);

  const restored = await request('/auth/sessions', {
    body: JSON.stringify({ recoveryId: registration.body.recoveryId }),
    method: 'POST',
  });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.user.publicId, publicId);

  const refreshed = await request('/auth/token/refresh', {
    body: JSON.stringify({ refreshToken: registration.body.session.refreshToken }),
    method: 'POST',
  });
  assert.equal(refreshed.status, 200);

  const replayed = await request('/auth/token/refresh', {
    body: JSON.stringify({ refreshToken: registration.body.session.refreshToken }),
    method: 'POST',
  });
  assert.equal(replayed.status, 401);

  const revoked = await request('/auth/me', {
    headers: { authorization: `Bearer ${refreshed.body.session.accessToken}` },
  });
  assert.equal(revoked.status, 401);

  const restoredAgain = await request('/auth/sessions', {
    body: JSON.stringify({ recoveryId: registration.body.recoveryId }),
    method: 'POST',
  });
  assert.equal(restoredAgain.status, 200);
  assert.equal(restoredAgain.body.user.publicId, publicId);

  console.log('staging-auth-smoke-ok');
} finally {
  if (publicId) {
    await deleteSmokeAccount(publicId);
    console.log('staging-auth-smoke-data-cleaned');
  }
}
