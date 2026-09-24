import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ChatAttachmentKind } from '../src/chat/chat-types.js';
import { ApiError } from '../src/http/api-error.js';
import { MediaService } from '../src/media/media-service.js';

type FileValidator = Readonly<{
  validateFile(input: Readonly<{
    byteSize: number;
    contentType: string;
    durationMs?: number;
    fileName: string;
  }>): ChatAttachmentKind;
}>;

function validator(): FileValidator {
  return new MediaService({
    accessKeyId: 'test',
    bucket: 'test',
    endpoint: 'http://127.0.0.1:9000',
    region: 'test',
    secretAccessKey: 'test',
  }) as unknown as FileValidator;
}

function isApiError(code: string) {
  return (error: unknown): boolean => error instanceof ApiError && error.code === code;
}

describe('MediaService voice message policy', () => {
  it('accepts supported audio with a duration and classifies it as audio', () => {
    assert.equal(
      validator().validateFile({
        byteSize: 192_000,
        contentType: 'audio/mp4',
        durationMs: 24_000,
        fileName: 'voice.m4a',
      }),
      'audio',
    );
  });

  it('requires a duration no longer than five minutes for audio', () => {
    assert.throws(
      () => validator().validateFile({ byteSize: 100, contentType: 'audio/webm', fileName: 'voice.webm' }),
      isApiError('INVALID_AUDIO_DURATION'),
    );
    assert.throws(
      () => validator().validateFile({ byteSize: 100, contentType: 'audio/mp4', durationMs: 300_001, fileName: 'voice.m4a' }),
      isApiError('INVALID_AUDIO_DURATION'),
    );
  });

  it('rejects voice-only duration metadata on another attachment kind', () => {
    assert.throws(
      () => validator().validateFile({ byteSize: 100, contentType: 'image/png', durationMs: 1_000, fileName: 'photo.png' }),
      isApiError('INVALID_AUDIO_DURATION'),
    );
  });
});
