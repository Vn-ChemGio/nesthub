import { SmsChannel } from './sms.channel';

const mockTwilioMessagesCreate = jest.fn();
const mockTwilio = jest.fn(() => ({
  messages: { create: mockTwilioMessagesCreate },
}));

jest.mock('twilio', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: { create: jest.fn() },
  })),
}));

const mockSnsSend = jest.fn();
jest.mock('@aws-sdk/client-sns', () => ({
  __esModule: true,
  SNSClient: jest.fn(() => ({ send: mockSnsSend })),
  PublishCommand: jest.fn(),
}));

beforeEach(() => {
  const twilio = jest.requireMock('twilio');
  twilio.default = mockTwilio;

  const sns = jest.requireMock('@aws-sdk/client-sns');
  sns.SNSClient = jest.fn(() => ({ send: mockSnsSend }));
  sns.PublishCommand = jest.fn();

  mockTwilioMessagesCreate.mockReset();
  mockTwilio.mockClear();
  mockSnsSend.mockReset();
});

describe('SmsChannel', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockReset();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('twilio provider', () => {
    let channel: SmsChannel;

    beforeEach(() => {
      channel = new SmsChannel({
        provider: 'twilio',
        credentials: { accountSid: 'ACxxx', authToken: 'token123' },
        from: '+15551234567',
      });
    });

    it('should send via twilio with correct params', async () => {
      mockTwilioMessagesCreate.mockResolvedValue({ sid: 'SM123' });

      const result = await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hello!',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM123');
      expect(mockTwilio).toHaveBeenCalledWith('ACxxx', 'token123');
      expect(mockTwilioMessagesCreate).toHaveBeenCalledWith({
        body: 'Hello!',
        to: '+15559876543',
        from: '+15551234567',
      });
    });

    it('should use sender as from when provided', async () => {
      mockTwilioMessagesCreate.mockResolvedValue({ sid: 'SM123' });

      await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hi',
        sender: '+15557654321',
      });

      expect(mockTwilioMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ from: '+15557654321' }),
      );
    });

    it('should return error on twilio failure', async () => {
      mockTwilioMessagesCreate.mockRejectedValue(
        new Error('Account not found'),
      );

      const result = await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hi',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Account not found');
    });

    it('should take first recipient when to is array', async () => {
      mockTwilioMessagesCreate.mockResolvedValue({ sid: 'SM1' });

      await channel.send({
        channel: 'sms',
        to: ['+15551111111', '+15552222222'],
        content: 'Broadcast',
      });

      expect(mockTwilioMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '+15551111111' }),
      );
    });
  });

  describe('aws-sns provider', () => {
    let channel: SmsChannel;

    beforeEach(() => {
      channel = new SmsChannel({
        provider: 'aws-sns',
        credentials: {
          region: 'us-east-1',
          accessKeyId: 'AKID',
          secretAccessKey: 'secret',
        },
        from: 'MyApp',
      });
    });

    it('should send via SNS with correct params', async () => {
      mockSnsSend.mockResolvedValue({ MessageId: 'SNS123' });

      const result = await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hello from AWS',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SNS123');
      expect(mockSnsSend).toHaveBeenCalled();
    });

    it('should include SenderID attribute when from is set', async () => {
      mockSnsSend.mockResolvedValue({ MessageId: 'SNS123' });

      const { PublishCommand } = jest.requireMock('@aws-sdk/client-sns');

      await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hi',
      });

      const callArgs = (PublishCommand as jest.Mock).mock.calls[0][0];
      expect(callArgs.MessageAttributes).toBeDefined();
    });

    it('should omit SenderID when from is not set', async () => {
      const { PublishCommand } = jest.requireMock('@aws-sdk/client-sns');
      mockSnsSend.mockResolvedValue({ MessageId: 'SNS123' });

      channel = new SmsChannel({
        provider: 'aws-sns',
        credentials: {
          region: 'us-east-1',
          accessKeyId: 'AKID',
          secretAccessKey: 'secret',
        },
      });

      await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hi',
      });

      const callArgs = (PublishCommand as jest.Mock).mock.calls[0][0];
      expect(callArgs.MessageAttributes).toBeUndefined();
    });

    it('should return error on SNS failure', async () => {
      mockSnsSend.mockRejectedValue(new Error('AccessDenied'));

      const result = await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hi',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('AccessDenied');
    });
  });

  describe('http provider', () => {
    let channel: SmsChannel;

    beforeEach(() => {
      channel = new SmsChannel({
        provider: 'http',
        credentials: {
          url: 'https://sms-gateway.example.com/send',
          apiKey: 'key123',
        },
        from: 'MyApp',
      });
    });

    it('should POST to configured URL', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'http_msg_1' }),
      });

      const result = await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Via HTTP',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('http_msg_1');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://sms-gateway.example.com/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer key123',
          }),
        }),
      );
    });

    it('should include sender and metadata in body', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messageId: 'm1' }),
      });

      await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hi',
        sender: '+15550001111',
        metadata: { ref: 'order-42' },
      });

      const body = JSON.parse(
        (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body).toMatchObject({
        to: '+15559876543',
        content: 'Hi',
        from: '+15550001111',
        ref: 'order-42',
      });
    });

    it('should return error when HTTP URL is not configured', async () => {
      channel = new SmsChannel({
        provider: 'http',
        credentials: {},
      });

      const result = await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hi',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP URL not configured');
    });

    it('should return error on HTTP failure', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const result = await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hi',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('should include attachments in body', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'msg_a' }),
      });

      await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'With file',
        attachments: [{ filename: 'report.pdf', content: 'base64data' }],
      });

      const body = JSON.parse(
        (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.attachments).toHaveLength(1);
      expect(body.attachments[0]).toMatchObject({
        filename: 'report.pdf',
        content: 'base64data',
      });
    });
  });

  describe('unsupported provider', () => {
    it('should return error', async () => {
      const channel = new SmsChannel({
        provider: 'unknown' as any,
        credentials: {},
      });

      const result = await channel.send({
        channel: 'sms',
        to: '+15559876543',
        content: 'Hi',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported SMS provider');
    });
  });
});
