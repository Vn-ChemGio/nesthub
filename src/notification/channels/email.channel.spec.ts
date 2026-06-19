import { EmailChannel } from './email.channel';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn(() => ({ sendMail: jest.fn() })) },
}));

beforeEach(() => {
  const nodemailer = jest.requireMock('nodemailer');
  nodemailer.default.createTransport = mockCreateTransport;
});

describe('EmailChannel', () => {
  let channel: EmailChannel;

  beforeEach(() => {
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
  });

  describe('SMTP config', () => {
    beforeEach(() => {
      channel = new EmailChannel({
        smtp: { host: 'smtp.example.com', port: 587, user: 'u', pass: 'p' },
        defaults: { from: 'noreply@example.com' },
      });
    });

    it('should create transporter with smtp options', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg1' });

      await channel.send({
        channel: 'email',
        to: 'a@b.com',
        subject: 'Test',
        content: '<p>hi</p>',
      });

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          auth: { user: 'u', pass: 'p' },
        }),
        { from: 'noreply@example.com' },
      );
    });

    it('should send mail with correct options', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg1' });

      const result = await channel.send({
        channel: 'email',
        to: 'a@b.com',
        subject: 'Welcome',
        content: '<h1>Hello</h1>',
        sender: 'admin@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg1');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@b.com',
          subject: 'Welcome',
          html: '<h1>Hello</h1>',
          from: 'admin@example.com',
        }),
      );
    });

    it('should join multiple recipients with comma', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg1' });

      await channel.send({
        channel: 'email',
        to: ['a@b.com', 'c@d.com'],
        subject: 'Hi',
        content: 'Hello',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@b.com, c@d.com' }),
      );
    });

    it('should include attachments when provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg1' });

      const attachment = { filename: 'doc.pdf', content: Buffer.from('pdf') };
      await channel.send({
        channel: 'email',
        to: 'a@b.com',
        subject: 'Doc',
        content: 'See attached',
        attachments: [attachment],
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ attachments: [attachment] }),
      );
    });

    it('should set secure=true when port is 465', async () => {
      channel = new EmailChannel({
        smtp: { host: 'smtp.example.com', port: 465, user: 'u', pass: 'p' },
      });
      mockSendMail.mockResolvedValue({ messageId: 'msg1' });

      await channel.send({
        channel: 'email',
        to: 'a@b.com',
        subject: 'Test',
        content: 'Hi',
      });

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true }),
        undefined,
      );
    });

    it('should return error on send failure', async () => {
      mockSendMail.mockRejectedValue(new Error('Connection refused'));

      const result = await channel.send({
        channel: 'email',
        to: 'a@b.com',
        subject: 'Fail',
        content: 'Oops',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });

  describe('transport string config', () => {
    it('should pass transport string directly to createTransport', async () => {
      channel = new EmailChannel({
        transport: 'smtp://u:p@smtp.example.com:587',
      });
      mockSendMail.mockResolvedValue({ messageId: 'msg1' });

      await channel.send({
        channel: 'email',
        to: 'a@b.com',
        subject: 'Test',
        content: 'Hi',
      });

      expect(mockCreateTransport).toHaveBeenCalledWith(
        'smtp://u:p@smtp.example.com:587',
        undefined,
      );
    });
  });

  describe('transporter caching', () => {
    it('should reuse transporter on subsequent sends', async () => {
      channel = new EmailChannel({
        smtp: { host: 'smtp.example.com', port: 587 },
      });
      mockSendMail.mockResolvedValue({ messageId: 'msg1' });

      await channel.send({
        channel: 'email',
        to: 'a@b.com',
        subject: 'A',
        content: '1',
      });
      await channel.send({
        channel: 'email',
        to: 'a@b.com',
        subject: 'B',
        content: '2',
      });

      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe('attachments', () => {
    beforeEach(() => {
      channel = new EmailChannel({
        smtp: { host: 'smtp.example.com', port: 587 },
      });
      mockSendMail.mockResolvedValue({ messageId: 'msg1' });
    });

    it('should send with attachments and no content', async () => {
      const result = await channel.send({
        channel: 'email',
        to: 'a@b.com',
        subject: 'File',
        attachments: [{ filename: 'doc.pdf', content: Buffer.from('pdf') }],
      });

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [{ filename: 'doc.pdf', content: expect.any(Buffer) }],
        }),
      );
      expect(mockSendMail.mock.calls[0][0]).not.toHaveProperty('html');
    });

    it('should include both content and attachments', async () => {
      await channel.send({
        channel: 'email',
        to: 'a@b.com',
        subject: 'Report',
        content: '<h1>Report</h1>',
        attachments: [{ filename: 'data.xlsx', content: Buffer.from('xls') }],
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<h1>Report</h1>',
          attachments: [{ filename: 'data.xlsx', content: expect.any(Buffer) }],
        }),
      );
    });
  });
});
