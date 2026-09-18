# g000st Private Chat API — v1

All chat endpoints are under `/api/v1/chat` and require
`Authorization: Bearer <accessToken>`. A conversation always has exactly two participants. The
server verifies membership for every message read, write, burn-open, and read-state update.

Private-message content is never exposed through admin endpoints. Conversation previews are
generic (`Message` or `Burn message`) rather than message plaintext.

## List conversations

`GET /conversations?limit=30`

`limit` is optional (`1..50`). Successful response (`200`):

```json
{
  "conversations": [
    {
      "conversationId": "64-character-conversation-id",
      "participantPublicId": "50-character-public-id",
      "participantStatus": "active",
      "lastMessagePreview": "Message",
      "lastMessageId": "message-uuid",
      "lastMessageCreatedAtMs": 1789478400000,
      "lastMessageSenderId": "50-character-public-id",
      "firstUnreadMessageId": "message-uuid",
      "firstUnreadCreatedAtMs": 1789478400000,
      "firstUnreadExpiresAtMs": 1789485600000,
      "unreadCount": 1,
      "updatedAtMs": 1789478400000
    }
  ]
}
```

`participantStatus` is `deleted` when the other account is no longer active. Retained messages
remain readable, but sending to that conversation returns `410 PARTICIPANT_UNAVAILABLE`.

## Start a private conversation

`POST /conversations`

```json
{ "participantPublicId": "50-character-public-id" }
```

Returns (`200`) `{ "conversation": ChatConversation }`. Repeating the request for the same two
accounts returns the existing private conversation. Starting a conversation with the same account
or an inactive account is rejected.

## List messages

`GET /conversations/:conversationId/messages?limit=50&cursor=<opaque-cursor>`

`limit` is optional (`1..100`). `cursor` is the opaque `nextCursor` returned by the previous
response; clients must not construct it. The cursor contains both message time and ID, so messages
with equal timestamps are paginated without duplication or loss. Messages are returned in
chronological order.

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
      "createdAtMs": 1789478400000,
      "expiresAtMs": 1789485600000,
      "readAtMs": 1789478410000,
      "locked": false
    }
  ],
  "nextCursor": "opaque-value"
}
```

`nextCursor` is omitted when no older retained page exists. Messages older than two hours are never
returned and are physically purged by the server worker.

For messages sent by the current user, `readAtMs` is present once the other participant has marked
the message range as read. It is omitted for unread and incoming messages.

## Send a text message

`POST /conversations/:conversationId/messages`

```json
{
  "clientMessageId": "018f6f5d-58e4-7a30-8df8-5f237c0666bb",
  "content": "Hello",
  "burnAfterRead": false
}
```

`content` is trimmed and must contain `1..4000` characters. The UUID makes retries idempotent and
also prevents duplicate push notifications. `burnAfterRead` defaults to `false`. Returns (`201`)
`{ "message": ChatMessage }`.

## Burn after read

For a burn message, the recipient initially receives `locked: true` and an empty `content` field.
The sender still sees their own content.

`POST /conversations/:conversationId/messages/:messageId/open`

Only the recipient can open it. The response contains the plaintext message and starts its fixed
five-second lifetime. After that deadline it is excluded immediately and physically removed by the
expiration worker.

## Mark a conversation as read

`POST /conversations/:conversationId/read`

Returns (`200`) with the committed read state. The member record and incoming-message transaction
use the same Firestore document, so a message committed after the read transaction remains unread.

```json
{
  "readState": {
    "lastReadAtMs": 1789478400000,
    "lastReadMessageId": "message-uuid",
    "unreadCount": 0
  }
}
```

The conversation summary exposes `firstUnreadMessageId`; mobile and web load older pages as needed,
scroll to that message, show an `Unread` divider, and then mark the conversation as read. If older
unread messages expire first, the server repairs both the unread count and anchor to the first
retained unread message.

## Push devices

These authenticated endpoints are under `/api/v1/notifications`.

`PUT /devices`

```json
{
  "deviceId": "device-uuid",
  "expoPushToken": "ExpoPushToken[...]",
  "platform": "android"
}
```

`DELETE /devices`

```json
{ "deviceId": "device-uuid" }
```

New messages trigger Expo Push Service for every active device of the recipient. Notifications use
the generic body `You received a new private message.` and carry only navigation metadata, never
message content. Invalid `DeviceNotRegistered` tokens are disabled. Tapping a notification opens
the matching conversation and its first unread message.
