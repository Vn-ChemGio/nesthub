import { readFile } from 'node:fs/promises';
import type {
  SendNotificationInput,
  TelegramChannelConfig,
  Attachment,
} from '../interfaces';
import type {
  NotificationChannel,
  SendChannelResult,
} from './channel.interface';

export class TelegramChannel implements NotificationChannel {
  readonly channelType = 'telegram';
  private apiBase: string;

  constructor(private config: TelegramChannelConfig) {
    this.apiBase =
      config.apiBaseUrl ?? `https://api.telegram.org/bot${config.botToken}`;
  }

  async send(input: SendNotificationInput): Promise<SendChannelResult> {
    if (!input.content && !input.attachments?.length) {
      return { success: false, error: 'Message content is empty' };
    }

    try {
      const to = Array.isArray(input.to) ? input.to : [input.to];
      const results = await Promise.all(
        to.map((chatId) => this.sendToChat(chatId, input)),
      );

      const success = results.some((r) => r.success);
      const firstSuccess = results.find((r) => r.success);
      const errors = results.filter((r) => !r.success).map((r) => r.error);

      return {
        success,
        messageId: firstSuccess?.messageId,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  private async sendToChat(
    chatId: string,
    input: SendNotificationInput,
  ): Promise<SendChannelResult> {
    const attachments = input.attachments ?? [];

    if (attachments.length > 0) {
      if (attachments.length === 1) {
        return this.sendDocument(chatId, input.content ?? '', attachments[0]);
      }
      return this.sendMediaGroup(chatId, input.content ?? '', attachments);
    }

    return this.sendMessage(chatId, input);
  }

  private async sendMessage(
    chatId: string,
    input: SendNotificationInput,
  ): Promise<SendChannelResult> {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: input.content,
      parse_mode: 'HTML',
    };

    if (input.sender) payload.username = input.sender;

    const response = await fetch(`${this.apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Telegram API ${response.status}: ${body}`,
      };
    }

    const data = (await response.json()) as {
      ok: boolean;
      result?: { message_id: number };
    };
    if (!data.ok) {
      return { success: false, error: 'Telegram API returned not ok' };
    }

    return { success: true, messageId: String(data.result?.message_id) };
  }

  private async sendDocument(
    chatId: string,
    caption: string,
    attachment: Attachment,
  ): Promise<SendChannelResult> {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }

    let content: Blob;
    if (attachment.content) {
      content = new Blob([attachment.content as BlobPart], {
        type: attachment.contentType ?? 'application/octet-stream',
      });
    } else if (attachment.path) {
      const buf = await readFile(attachment.path);
      content = new Blob([buf], {
        type: attachment.contentType ?? 'application/octet-stream',
      });
    } else {
      return { success: false, error: 'Attachment has no content or path' };
    }

    formData.append('document', content, attachment.filename);

    const response = await fetch(`${this.apiBase}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Telegram API ${response.status}: ${body}`,
      };
    }

    const data = (await response.json()) as {
      ok: boolean;
      result?: { message_id: number };
    };
    if (!data.ok) {
      return { success: false, error: 'Telegram API returned not ok' };
    }

    return { success: true, messageId: String(data.result?.message_id) };
  }

  private async sendMediaGroup(
    chatId: string,
    caption: string,
    attachments: Attachment[],
  ): Promise<SendChannelResult> {
    const formData = new FormData();
    formData.append('chat_id', chatId);

    const media: Record<string, unknown>[] = [];
    for (let i = 0; i < attachments.length; i++) {
      const a = attachments[i];
      const fileKey = `file${i}`;
      const item: Record<string, unknown> = {
        type: 'document',
        media: `attach://${fileKey}`,
      };

      if (i === attachments.length - 1 && caption) {
        item.caption = caption;
        item.parse_mode = 'HTML';
      }

      media.push(item);

      let content: Blob;
      if (a.content) {
        content = new Blob([a.content as BlobPart], {
          type: a.contentType ?? 'application/octet-stream',
        });
      } else if (a.path) {
        const buf = await readFile(a.path);
        content = new Blob([buf], {
          type: a.contentType ?? 'application/octet-stream',
        });
      } else {
        return { success: false, error: 'Attachment has no content or path' };
      }

      formData.append(fileKey, content, a.filename);
    }

    formData.append('media', JSON.stringify(media));

    const response = await fetch(`${this.apiBase}/sendMediaGroup`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Telegram API ${response.status}: ${body}`,
      };
    }

    const data = (await response.json()) as {
      ok: boolean;
      result?: { message_id: number }[];
    };
    if (!data.ok) {
      return { success: false, error: 'Telegram API returned not ok' };
    }

    return {
      success: true,
      messageId: String(data.result?.[0]?.message_id ?? ''),
    };
  }
}
