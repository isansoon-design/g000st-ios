import {
  CHAT_EXPIRATION_SWEEP_BATCH_SIZE,
  CHAT_EXPIRATION_SWEEP_INTERVAL_MS,
} from './chat-policy.js';
import type { ChatStore } from './chat-store.js';
import type { MediaService } from '../media/media-service.js';

export class ChatExpirationWorker {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private lastFailureLogAtMs = 0;

  constructor(
    private readonly store: ChatStore,
    private readonly now: () => number = Date.now,
    private readonly mediaService?: MediaService,
  ) {}

  start(): void {
    if (this.timer) return;
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), CHAT_EXPIRATION_SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const expired = await this.store.purgeExpiredMessages(
        this.now(),
        CHAT_EXPIRATION_SWEEP_BATCH_SIZE,
      );
      await Promise.all(
        expired.map((message) => this.mediaService?.deleteAttachments(message.attachments)),
      );
    } catch (error) {
      const failedAtMs = this.now();
      if (failedAtMs - this.lastFailureLogAtMs >= 60_000 || this.lastFailureLogAtMs === 0) {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        console.error(`g000st chat expiration sweep failed: ${reason}`);
        this.lastFailureLogAtMs = failedAtMs;
      }
    } finally {
      this.running = false;
    }
  }
}
