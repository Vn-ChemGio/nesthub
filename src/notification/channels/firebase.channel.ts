/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {
  SendNotificationInput,
  FirebaseChannelConfig,
  Attachment,
} from '../interfaces';
import type {
  NotificationChannel,
  SendChannelResult,
} from './channel.interface';

function serializeAttachments(attachments: Attachment[]): string {
  return JSON.stringify(
    attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content:
        a.content instanceof Buffer
          ? a.content.toString('base64')
          : (a.content ?? null),
    })),
  );
}

export class FirebaseChannel implements NotificationChannel {
  readonly channelType = 'firebase';
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(private config: FirebaseChannelConfig) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const admin = await import('firebase-admin');

      if (admin.apps.length === 0) {
        const credential = this.config.serviceAccountPath
          ? admin.credential.cert(this.config.serviceAccountPath)
          : this.config.serviceAccount
            ? admin.credential.cert(this.config.serviceAccount)
            : undefined;

        admin.initializeApp({
          credential,
          databaseURL: this.config.databaseURL,
        });
      }

      this.initialized = true;
    })();

    return this.initPromise;
  }

  async send(input: SendNotificationInput): Promise<SendChannelResult> {
    try {
      await this.ensureInitialized();
      const admin = await import('firebase-admin');

      const to = Array.isArray(input.to) ? input.to : [input.to];
      const tokens = to.filter(Boolean);

      if (tokens.length === 0) {
        return { success: false, error: 'No device tokens provided' };
      }

      const message: Record<string, unknown> = {
        tokens,
        notification: {
          title: input.subject,
          body: input.content,
        },
        data: input.metadata,
      };

      if (input.attachments?.length) {
        message.data = {
          ...(message.data as Record<string, string>),
          _attachments: serializeAttachments(input.attachments),
        };
      }

      const response = await (admin as any)
        .messaging()
        .sendEachForMulticast(message as any);
      const successCount = response.successCount;
      const failureCount = response.failureCount;

      return {
        success: successCount > 0,
        messageId: response.responses.find((r: any) => r.success)?.messageId,
        error: failureCount > 0 ? `${failureCount} tokens failed` : undefined,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
