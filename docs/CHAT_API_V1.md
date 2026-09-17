# g000st Private Chat API — v1

All endpoints are under `/api/v1/chat` and require
`Authorization: Bearer <accessToken>`. A conversation always has exactly two participants. The
server verifies membership for every message read, write, and read-marker update.

## List conversations

`GET /conversations?limit=30`

`limit` is optional (`1..50`). Successful response (`200`):

```json
{
  "conversations": [
    {
      "conversationId": "64-character-conversation-id",
      "participantPublicId": "50-character-public-id",
      "lastMessagePreview": "Hello",
      "lastMessageSenderId": "50-character-public-id",
      "unreadCount": 1,
      "updatedAtMs": 1789478400000
    }
  ]
}
```

## Start a private conversation

`POST /conversations`

```json
{ "participantPublicId": "50-character-public-id" }
```

Returns (`200`) `{ "conversation": ChatConversation }`. Repeating the request for the same two
accounts returns the existing private conversation. Starting a conversation with the same account
is rejected.

## List messages

`GET /conversations/:conversationId/messages?limit=50&before=1789478400000`

`limit` is optional (`1..100`) and `before` is an optional Unix timestamp in milliseconds.
Messages are returned in chronological order. Successful response (`200`):

```json
{
  "messages": [
    {
      "id": "client-generated-uuid",
      "clientMessageId": "client-generated-uuid",
      "conversationId": "64-character-conversation-id",
      "senderPublicId": "50-character-public-id",
      "type": "text",
      "content": "Hello",
      "createdAtMs": 1789478400000
    }
  ],
  "nextBefore": 1789478400000
}
```

`nextBefore` is omitted when there is no next page.

## Send a text message

`POST /conversations/:conversationId/messages`

```json
{
  "clientMessageId": "018f6f5d-58e4-7a30-8df8-5f237c0666bb",
  "content": "Hello"
}
```

`content` is trimmed and must contain `1..4000` characters. The UUID makes retries idempotent.
Returns (`201`) `{ "message": ChatMessage }`.

## Mark a conversation as read

`POST /conversations/:conversationId/read`

Returns (`204`). Admin endpoints must never return private-message contents.
