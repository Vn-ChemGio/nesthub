/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import type { SendNotificationInput, SmsChannelConfig } from '../interfaces';
import type {
  NotificationChannel,
  SendChannelResult,
} from './channel.interface';

export class SmsChannel implements NotificationChannel {
  readonly channelType = 'sms';

  constructor(private config: SmsChannelConfig) {}

  async send(input: SendNotificationInput): Promise<SendChannelResult> {
    try {
      const to = Array.isArray(input.to) ? input.to[0] : input.to;

      switch (this.config.provider) {
        case 'twilio': {
          const twilio = await import('twilio');
          const client = twilio.default(
            this.config.credentials.accountSid,
            this.config.credentials.authToken,
          );
          const result = await client.messages.create({
            body: input.content,
            to,
            from: input.sender ?? this.config.from,
          });
          return { success: true, messageId: result.sid };
        }

        case 'aws-sns': {
          const { SNSClient, PublishCommand } =
            await import('@aws-sdk/client-sns');
          const client = new SNSClient({
            region: this.config.credentials.region,
            credentials: {
              accessKeyId: this.config.credentials.accessKeyId,
              secretAccessKey: this.config.credentials.secretAccessKey,
            },
          });
          const command = new PublishCommand({
            Message: input.content,
            PhoneNumber: to,
            MessageAttributes: this.config.from
              ? {
                  'AWS.SNS.SMS.SenderID': {
                    DataType: 'String',
                    StringValue: this.config.from,
                  },
                }
              : undefined,
          });
          const result = await client.send(command);
          return { success: true, messageId: result.MessageId };
        }

        case 'http': {
          const url = this.config.credentials.url;
          if (!url) return { success: false, error: 'HTTP URL not configured' };
          const body: Record<string, unknown> = {
            to,
            content: input.content,
            from: input.sender ?? this.config.from,
            ...input.metadata,
          };
          if (input.attachments?.length) body.attachments = input.attachments;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: this.config.credentials.apiKey
                ? `Bearer ${this.config.credentials.apiKey}`
                : '',
            },
            body: JSON.stringify(body),
          });
          if (!response.ok) {
            return {
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`,
            };
          }
          const data: any = await response.json();
          return { success: true, messageId: data.id ?? data.messageId };
        }

        default:
          return {
            success: false,
            error: 'Unsupported SMS provider',
          };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
