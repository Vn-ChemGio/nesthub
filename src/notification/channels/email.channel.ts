/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import type { SendNotificationInput, EmailChannelConfig } from '../interfaces';
import type {
  NotificationChannel,
  SendChannelResult,
} from './channel.interface';

function smtpToTransport(
  smtp: NonNullable<EmailChannelConfig['smtp']>,
): Record<string, unknown> {
  const transport: Record<string, unknown> = {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure ?? smtp.port === 465,
  };
  if (smtp.user) transport.auth = { user: smtp.user, pass: smtp.pass ?? '' };
  return transport;
}

export class EmailChannel implements NotificationChannel {
  readonly channelType = 'email';
  private transporter: any;
  private initPromise: Promise<void> | null = null;

  constructor(private config: EmailChannelConfig) {}

  private async ensureTransporter(): Promise<void> {
    if (this.transporter) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const nodemailer = await import('nodemailer');
      const transportOpts = this.config.smtp
        ? smtpToTransport(this.config.smtp)
        : (this.config.transport ?? {});
      this.transporter = nodemailer.default.createTransport(
        transportOpts,
        this.config.defaults,
      );
    })();

    return this.initPromise;
  }

  async send(input: SendNotificationInput): Promise<SendChannelResult> {
    try {
      await this.ensureTransporter();

      const mailOptions: Record<string, unknown> = {
        to: Array.isArray(input.to) ? input.to.join(', ') : input.to,
        subject: input.subject,
      };

      if (input.content) mailOptions.html = input.content;
      if (input.sender) mailOptions.from = input.sender;
      if (input.attachments?.length)
        mailOptions.attachments = input.attachments;

      const info = await this.transporter.sendMail(mailOptions);

      return { success: true, messageId: info.messageId };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
