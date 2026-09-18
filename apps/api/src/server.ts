import 'dotenv/config';

import { AuthService } from './auth/auth-service.js';
import { FirestoreAuthStore } from './auth/firestore-auth-store.js';
import { createApp } from './app.js';
import { ChatExpirationWorker } from './chat/chat-expiration-worker.js';
import { ChatService } from './chat/chat-service.js';
import { FirestoreChatStore } from './chat/firestore-chat-store.js';
import { readEnvironment } from './config/env.js';
import { createFirestore } from './firebase/create-firestore.js';
import { ExpoPushGateway } from './notifications/expo-push-gateway.js';
import { FirestoreNotificationStore } from './notifications/firestore-notification-store.js';
import { NotificationService } from './notifications/notification-service.js';

async function main(): Promise<void> {
  const environment = readEnvironment();
  const firestore = await createFirestore(environment.firebaseServiceAccountPath);
  const store = new FirestoreAuthStore(firestore, environment.collectionPrefix);
  const authService = new AuthService(store, environment.recoveryPepper);
  const chatStore = new FirestoreChatStore(firestore, environment.collectionPrefix);
  const notificationStore = new FirestoreNotificationStore(
    firestore,
    environment.collectionPrefix,
  );
  const notificationService = new NotificationService(
    notificationStore,
    new ExpoPushGateway(notificationStore, environment.expoPushAccessToken),
  );
  const chatService = new ChatService(chatStore, store, Date.now, notificationService);
  const expirationWorker = new ChatExpirationWorker(chatStore);
  const app = createApp({
    allowedOrigins: environment.allowedOrigins,
    authService,
    chatService,
    notificationService,
  });
  const server = app.listen(environment.port, environment.host, () => {
    expirationWorker.start();
    console.log(`g000st API listening on ${environment.host}:${environment.port}`);
  });

  const close = () => {
    expirationWorker.stop();
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
