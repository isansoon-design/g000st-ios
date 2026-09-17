import 'dotenv/config';

import { AuthService } from './auth/auth-service.js';
import { FirestoreAuthStore } from './auth/firestore-auth-store.js';
import { createApp } from './app.js';
import { ChatService } from './chat/chat-service.js';
import { FirestoreChatStore } from './chat/firestore-chat-store.js';
import { readEnvironment } from './config/env.js';
import { createFirestore } from './firebase/create-firestore.js';

async function main(): Promise<void> {
  const environment = readEnvironment();
  const firestore = await createFirestore(environment.firebaseServiceAccountPath);
  const store = new FirestoreAuthStore(firestore, environment.collectionPrefix);
  const authService = new AuthService(store, environment.recoveryPepper);
  const chatService = new ChatService(
    new FirestoreChatStore(firestore, environment.collectionPrefix),
    store,
  );
  const app = createApp({ allowedOrigins: environment.allowedOrigins, authService, chatService });
  const server = app.listen(environment.port, environment.host, () => {
    console.log(`g000st API listening on ${environment.host}:${environment.port}`);
  });

  const close = () => {
    server.close((error) => {
      if (error) {
        console.error('g000st API shutdown failed');
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

void main().catch(() => {
  console.error('g000st API failed to start');
  process.exitCode = 1;
});
