import cors from 'cors';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { z } from 'zod';

import { createAuthRouter } from './auth/auth-router.js';
import { AuthService } from './auth/auth-service.js';
import { createBillingRouter } from './billing/billing-router.js';
import { createBillingStripeWebhookRouter } from './billing/billing-stripe-webhook-router.js';
import type { BillingService } from './billing/billing-service.js';
import type { StripeCheckoutClient } from './billing/stripe-client.js';
import { createCallingRouter } from './calling/calling-router.js';
import type { CallingService } from './calling/calling-service.js';
import { createChatRouter } from './chat/chat-router.js';
import { ChatService } from './chat/chat-service.js';
import { createContactsRouter } from './contacts/contacts-router.js';
import { ContactsService } from './contacts/contacts-service.js';
import { ApiError } from './http/api-error.js';
import { createMediaRouter } from './media/media-router.js';
import { createNotificationRouter } from './notifications/notification-router.js';
import { NotificationService } from './notifications/notification-service.js';
import { createPresenceRouter } from './presence/presence-router.js';
import { PresenceService } from './presence/presence-service.js';
import { createSocialRouter } from './social/social-router.js';
import { SocialService } from './social/social-service.js';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

type CreateAppOptions = Readonly<{
  allowedOrigins: readonly string[];
  authService: AuthService;
  billing?: Readonly<{
    service: BillingService;
    stripeClient: StripeCheckoutClient;
    stripeWebhookSecret: string;
  }>;
  callingService: CallingService;
  chatService: ChatService;
  contactsService: ContactsService;
  notificationService: NotificationService;
  presenceService: PresenceService;
  socialService: SocialService;
}>;

export function createApp({
  allowedOrigins,
  authService,
  billing,
  callingService,
  chatService,
  contactsService,
  notificationService,
  presenceService,
  socialService,
}: CreateAppOptions): Express {
  const app = express();
  const allowed = new Set(allowedOrigins);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowed.has(origin)) return callback(null, true);
        return callback(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed.'));
      },
    }),
  );
  app.use(
    express.json({
      limit: '32kb',
      verify: (request, _response, buffer) => {
        (request as express.Request).rawBody = Buffer.from(buffer);
      },
    }),
  );
  if (billing) {
    app.use(
      '/api/v1/billing/webhooks/stripe',
      createBillingStripeWebhookRouter(billing.stripeClient, billing.stripeWebhookSecret, billing.service),
    );
    app.use('/api/v1/billing', createBillingRouter(authService, billing.service));
  }
  app.use('/api/v1/calling', createCallingRouter(authService, callingService));
  app.use('/api/v1/social', createSocialRouter(authService, socialService));
  app.use('/api/v1/contacts', createContactsRouter(authService, contactsService));
  app.use('/api/v1/presence', createPresenceRouter(authService, presenceService));

  app.get('/api/v1/health', (_request, response) => {
    response.status(200).json({ ok: true });
  });
  app.use('/api/v1/auth', createAuthRouter(authService));
  app.use('/api/v1/chat', createChatRouter(authService, chatService));
  app.use('/api/v1/media', createMediaRouter(authService, chatService));
  app.use(
    '/api/v1/notifications',
    createNotificationRouter(authService, notificationService),
  );

  app.use('/api/v1', (_request, response) => {
    response.status(404).json({ code: 'NOT_FOUND', message: 'API route not found.' });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.status).json({ code: error.code, message: error.message });
      return;
    }

    if (error instanceof z.ZodError) {
      response.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'The request is invalid.',
      });
      return;
    }

    // Never serialize the raw error in the response: Firebase and credential errors can
    // contain implementation details that should not be returned to clients. Still log it
    // server-side so the failure is diagnosable.
    console.error('g000st API unhandled request error', error);
    response.status(500).json({ code: 'INTERNAL_ERROR', message: 'The request failed.' });
  };

  app.use(errorHandler);
  return app;
}
