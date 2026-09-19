import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { G000ST_ID_LENGTH } from '../core/identity.js';
import { asyncRoute } from '../http/async-route.js';
import { ChatService } from './chat-service.js';

const exactPublicId = z.string().length(G000ST_ID_LENGTH).regex(/^[A-Za-z0-9]+$/);
const conversationId = z.string().length(64).regex(/^[a-f0-9]+$/);
const messageId = z.string().uuid();
const createConversationBody = z.object({ participantPublicId: exactPublicId }).strict();
const createMessageBody = z
  .object({
    attachments: z
      .array(
        z
          .object({
            byteSize: z.number().int().positive().max(5 * 1024 * 1024),
            contentType: z.string().min(1).max(160),
            fileName: z.string().min(1).max(255),
            id: z.string().uuid(),
            objectKey: z.string().min(1).max(600),
          })
          .strict(),
      )
      .max(3)
      .optional(),
    burnAfterRead: z.boolean().default(false),
    clientMessageId: z.string().uuid().optional(),
    content: z.string().max(4_000).default(''),
  })
  .strict();
const listConversationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
const listMessagesQuery = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

function chatRateLimit(max: number) {
  return rateLimit({
    legacyHeaders: false,
    limit: max,
    standardHeaders: 'draft-8',
    windowMs: 60 * 1_000,
  });
}

export function createChatRouter(authService: AuthService, chatService: ChatService): Router {
  const router = Router();

  router.use(
    asyncRoute(async (request, _response, next) => {
      request.authenticatedPublicId = (
        await authService.getUser(bearerToken(request))
      ).publicId;
      next();
    }),
  );

  router.get(
    '/conversations',
    asyncRoute(async (request, response) => {
      const { limit } = listConversationsQuery.parse(request.query);
      response.status(200).json({
        conversations: await chatService.listConversations(
          request.authenticatedPublicId,
          limit,
        ),
      });
    }),
  );

  router.post(
    '/conversations',
    chatRateLimit(30),
    asyncRoute(async (request, response) => {
      const body = createConversationBody.parse(request.body);
      response.status(200).json({
        conversation: await chatService.startConversation(
          request.authenticatedPublicId,
          body.participantPublicId,
        ),
      });
    }),
  );

  router.get(
    '/conversations/:conversationId/messages',
    asyncRoute(async (request, response) => {
      const id = conversationId.parse(request.params.conversationId);
      const { cursor, limit } = listMessagesQuery.parse(request.query);
      response.status(200).json(
        await chatService.listMessages(request.authenticatedPublicId, id, limit, cursor),
      );
    }),
  );

  router.post(
    '/conversations/:conversationId/messages',
    chatRateLimit(60),
    asyncRoute(async (request, response) => {
      const id = conversationId.parse(request.params.conversationId);
      const body = createMessageBody.parse(request.body);
      response.status(201).json({
        message: await chatService.sendMessage(request.authenticatedPublicId, id, body),
      });
    }),
  );

  router.get(
    '/conversations/:conversationId/messages/:messageId/attachments/:attachmentId',
    asyncRoute(async (request, response) => {
      const id = conversationId.parse(request.params.conversationId);
      const parsedMessageId = messageId.parse(request.params.messageId);
      const attachmentId = messageId.parse(request.params.attachmentId);
      response.status(200).json({
        attachment: await chatService.getAttachmentDownload(
          request.authenticatedPublicId,
          id,
          parsedMessageId,
          attachmentId,
        ),
      });
    }),
  );

  router.post(
    '/conversations/:conversationId/messages/:messageId/open',
    chatRateLimit(120),
    asyncRoute(async (request, response) => {
      const id = conversationId.parse(request.params.conversationId);
      const parsedMessageId = messageId.parse(request.params.messageId);
      response.status(200).json({
        message: await chatService.openBurnMessage(
          request.authenticatedPublicId,
          id,
          parsedMessageId,
        ),
      });
    }),
  );

  router.post(
    '/conversations/:conversationId/read',
    chatRateLimit(120),
    asyncRoute(async (request, response) => {
      const id = conversationId.parse(request.params.conversationId);
      response.status(200).json({
        readState: await chatService.markRead(request.authenticatedPublicId, id),
      });
    }),
  );

  return router;
}

declare global {
  namespace Express {
    interface Request {
      authenticatedPublicId: string;
    }
  }
}
