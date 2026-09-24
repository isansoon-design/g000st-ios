import 'dotenv/config';

import { AuthService } from './auth/auth-service.js';
import { FirestoreAuthStore } from './auth/firestore-auth-store.js';
import { createApp } from './app.js';
import { BillingService } from './billing/billing-service.js';
import { FirestoreBillingStore } from './billing/firestore-billing-store.js';
import { StripeCheckoutClient } from './billing/stripe-client.js';
import { ApnsVoipClient } from './calling/apns-voip-client.js';
import { CallingRelay } from './calling/calling-relay.js';
import { CallingService } from './calling/calling-service.js';
import { FcmVoipClient } from './calling/fcm-voip-client.js';
import { FirestoreCallingStore } from './calling/firestore-calling-store.js';
import { HmacTurnCredentialProvider } from './calling/turn-credential-provider.js';
import { ChatExpirationWorker } from './chat/chat-expiration-worker.js';
import { ChatService } from './chat/chat-service.js';
import { FirestoreChatStore } from './chat/firestore-chat-store.js';
import { readEnvironment } from './config/env.js';
import { ContactsService } from './contacts/contacts-service.js';
import { FirestoreContactsStore } from './contacts/firestore-contacts-store.js';
import { createFirestore } from './firebase/create-firestore.js';
import { ExpoPushGateway } from './notifications/expo-push-gateway.js';
import { FirestoreNotificationStore } from './notifications/firestore-notification-store.js';
import { NotificationService } from './notifications/notification-service.js';
import { MediaService } from './media/media-service.js';
import { FirestoreMarketStore } from './market/firestore-market-store.js';
import { MarketService } from './market/market-service.js';
import { FirestorePresenceStore } from './presence/firestore-presence-store.js';
import { PresenceService } from './presence/presence-service.js';
import { FirestoreSocialStore } from './social/firestore-social-store.js';
import { SocialService } from './social/social-service.js';
import { FirestoreTelephonyStore } from './telephony/firestore-telephony-store.js';
import { TelephonyService } from './telephony/telephony-service.js';
import { TelnyxClient } from './telephony/telnyx-client.js';

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
  const mediaService = environment.media ? new MediaService(environment.media) : undefined;
  const socialService = new SocialService(
    new FirestoreSocialStore(firestore, environment.collectionPrefix, mediaService),
    store,
    Date.now,
    mediaService,
  );
  const marketService = new MarketService(
    new FirestoreMarketStore(firestore, environment.collectionPrefix, mediaService),
    Date.now,
    mediaService,
  );
  const chatService = new ChatService(
    chatStore,
    store,
    Date.now,
    notificationService,
    mediaService,
    socialService,
  );
  const presenceService = new PresenceService(
    new FirestorePresenceStore(firestore, environment.collectionPrefix),
  );
  const contactsService = new ContactsService(
    new FirestoreContactsStore(firestore, environment.collectionPrefix),
    store,
    socialService,
    presenceService,
  );
  const expirationWorker = new ChatExpirationWorker(chatStore, Date.now, mediaService);
  function buildBilling(config: NonNullable<typeof environment.billing>) {
    const stripeClient = new StripeCheckoutClient(config.stripeSecretKey);
    return {
      service: new BillingService(
        new FirestoreBillingStore(firestore, environment.collectionPrefix),
        stripeClient,
        config.checkoutUrls,
      ),
      stripeClient,
      stripeWebhookSecret: config.stripeWebhookSecret,
    };
  }

  const billing = environment.billing ? buildBilling(environment.billing) : undefined;
  function buildTelephony(config: NonNullable<typeof environment.telephony>) {
    if (!billing) {
      throw new Error('Telephony configuration requires the billing module to also be configured.');
    }

    return {
      service: new TelephonyService(
        new FirestoreTelephonyStore(firestore, environment.collectionPrefix),
        new TelnyxClient(config.telnyxApiKey, config.telnyxConnectionId, config.telnyxSharedNumberE164),
        billing.service,
        environment.recoveryPepper,
      ),
      telnyxPublicKey: config.telnyxPublicKey,
    };
  }

  const telephony = environment.telephony ? buildTelephony(environment.telephony) : undefined;
  const turnCredentialProvider = environment.turn
    ? new HmacTurnCredentialProvider(environment.turn.urls, environment.turn.sharedSecret)
    : undefined;
  const callingService = new CallingService(
    new FirestoreCallingStore(firestore, environment.collectionPrefix),
    turnCredentialProvider,
    notificationService,
    {
      ...(environment.apnsVoip ? { apns: new ApnsVoipClient(environment.apnsVoip) } : {}),
      fcm: new FcmVoipClient(),
    },
  );
  const callingRelay = new CallingRelay(authService, callingService);
  const app = createApp({
    allowedOrigins: environment.allowedOrigins,
    authService,
    billing,
    callingService,
    chatService,
    contactsService,
    marketService,
    notificationService,
    presenceService,
    socialService,
    telephony,
  });
  const server = app.listen(environment.port, environment.host, () => {
    expirationWorker.start();
    console.log(`g000st API listening on ${environment.host}:${environment.port}`);
  });
  server.on('upgrade', (request, socket, head) => {
    void callingRelay.handleUpgrade(request, socket, head);
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
