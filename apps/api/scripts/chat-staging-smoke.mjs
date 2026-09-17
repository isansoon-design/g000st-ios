import 'dotenv/config';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

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
      accept: 'application/json',
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const text = await response.text();
  return { body: text ? JSON.parse(text) : null, status: response.status };
}

async function cleanSmokeData(publicIds, conversationId) {
  const firestore = await createFirestore(serviceAccountPath);
  const authCollections = [
    'recovery_credentials',
    'access_sessions',
    'refresh_sessions',
    'session_families',
  ];

  try {
    if (conversationId) {
      await firestore.recursiveDelete(
        firestore.collection(`${collectionPrefix}_chat_conversations`).doc(conversationId),
      );
      await Promise.all(
        publicIds.map((publicId) =>
          firestore
            .collection(`${collectionPrefix}_chat_members`)
            .doc(publicId)
            .collection('conversations')
            .doc(conversationId)
            .delete(),
        ),
      );
    }

    for (const publicId of publicIds) {
      const snapshots = await Promise.all(
        authCollections.map((name) =>
          firestore.collection(`${collectionPrefix}_${name}`).where('publicId', '==', publicId).get(),
        ),
      );
      const batch = firestore.batch();
      batch.delete(firestore.collection(`${collectionPrefix}_users`).doc(publicId));
      for (const snapshot of snapshots) {
        for (const document of snapshot.docs) batch.delete(document.ref);
      }
      await batch.commit();
    }
  } finally {
    await firestore.terminate();
  }
}

const publicIds = [];
let conversationId;

try {
  const first = await request('/auth/register', { body: '{}', method: 'POST' });
  const second = await request('/auth/register', { body: '{}', method: 'POST' });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  publicIds.push(first.body.user.publicId, second.body.user.publicId);

  const firstAuth = { authorization: `Bearer ${first.body.session.accessToken}` };
  const secondAuth = { authorization: `Bearer ${second.body.session.accessToken}` };
  const started = await request('/chat/conversations', {
    body: JSON.stringify({ participantPublicId: second.body.user.publicId }),
    headers: firstAuth,
    method: 'POST',
  });
  assert.equal(started.status, 200);
  conversationId = started.body.conversation.id;

  const repeated = await request('/chat/conversations', {
    body: JSON.stringify({ participantPublicId: first.body.user.publicId }),
    headers: secondAuth,
    method: 'POST',
  });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.conversation.id, conversationId);

  const content = `staging-smoke-${randomUUID()}`;
  const sent = await request(`/chat/conversations/${conversationId}/messages`, {
    body: JSON.stringify({ clientMessageId: randomUUID(), content }),
    headers: firstAuth,
    method: 'POST',
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.message.content, content);

  const received = await request(`/chat/conversations/${conversationId}/messages`, {
    headers: secondAuth,
  });
  assert.equal(received.status, 200);
  assert.equal(received.body.messages.length, 1);
  assert.equal(received.body.messages[0].content, content);

  const conversations = await request('/chat/conversations', { headers: secondAuth });
  assert.equal(conversations.status, 200);
  assert.equal(conversations.body.conversations[0].unreadCount, 1);

  const markedRead = await request(`/chat/conversations/${conversationId}/read`, {
    body: '{}',
    headers: secondAuth,
    method: 'POST',
  });
  assert.equal(markedRead.status, 204);

  const afterRead = await request('/chat/conversations', { headers: secondAuth });
  assert.equal(afterRead.status, 200);
  assert.equal(afterRead.body.conversations[0].unreadCount, 0);

  console.log('staging-chat-smoke-ok');
} finally {
  if (publicIds.length > 0) {
    await cleanSmokeData(publicIds, conversationId);
    console.log('staging-chat-smoke-data-cleaned');
  }
}
