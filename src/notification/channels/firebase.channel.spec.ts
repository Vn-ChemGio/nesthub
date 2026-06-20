import { FirebaseChannel } from './firebase.channel';

const mockSendEachForMulticast = jest.fn();
const mockCert = jest.fn();
const mockInitializeApp = jest.fn();

jest.mock('firebase-admin', () => {
  const admin = {
    apps: [] as any[],
    credential: { cert: mockCert },
    initializeApp: mockInitializeApp,
    messaging: () => ({
      sendEachForMulticast: mockSendEachForMulticast,
    }),
  };
  return { default: admin, ...admin };
});

describe('FirebaseChannel', () => {
  let channel: FirebaseChannel;

  beforeEach(() => {
    mockSendEachForMulticast.mockReset();
    mockCert.mockReset();
    mockInitializeApp.mockClear();
  });

  describe('service account path config', () => {
    beforeEach(() => {
      channel = new FirebaseChannel({
        serviceAccountPath: '/etc/firebase/service-account.json',
        databaseURL: 'https://myapp.firebaseio.com',
      });
    });

    it('should initialize app with cert from path', async () => {
      mockCert.mockReturnValue('fake-cert');
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, messageId: 'fb_msg_1' }],
      });

      await channel.send({
        channel: 'firebase',
        to: 'device-token-1',
        subject: 'Hello',
        content: 'World',
      });

      expect(mockCert).toHaveBeenCalledWith(
        '/etc/firebase/service-account.json',
      );
      expect(mockInitializeApp).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: 'fake-cert',
          databaseURL: 'https://myapp.firebaseio.com',
        }),
      );
    });

    it('should send notification and return success', async () => {
      mockCert.mockReturnValue('fake-cert');
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [
          { success: true, messageId: 'fb_1' },
          { success: true, messageId: 'fb_2' },
        ],
      });

      const result = await channel.send({
        channel: 'firebase',
        to: ['token-a', 'token-b'],
        subject: 'Alert',
        content: 'Fire!',
        metadata: { severity: 'high' },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('fb_1');
    });
  });

  describe('service account object config', () => {
    beforeEach(() => {
      channel = new FirebaseChannel({
        serviceAccount: { projectId: 'my-project', clientEmail: 'a@b.com' },
      });
    });

    it('should initialize app with cert from object', async () => {
      mockCert.mockReturnValue('cert-from-obj');
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, messageId: 'm1' }],
      });

      await channel.send({
        channel: 'firebase',
        to: 'token-1',
        subject: 'Hi',
        content: 'There',
      });

      expect(mockCert).toHaveBeenCalledWith({
        projectId: 'my-project',
        clientEmail: 'a@b.com',
      });
    });
  });

  describe('without service account', () => {
    beforeEach(() => {
      channel = new FirebaseChannel({});
    });

    it('should initialize app without credential', async () => {
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, messageId: 'm1' }],
      });

      await channel.send({
        channel: 'firebase',
        to: 'token-1',
        subject: 'Test',
        content: 'Body',
      });

      expect(mockInitializeApp).toHaveBeenCalledWith(
        expect.objectContaining({ credential: undefined }),
      );
    });
  });

  describe('send results', () => {
    beforeEach(() => {
      channel = new FirebaseChannel({});
      mockCert.mockReturnValue('cert');
    });

    it('should return error when some tokens fail', async () => {
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 2,
        responses: [
          { success: true, messageId: 'ok' },
          { success: false, error: { message: 'Invalid token' } },
          { success: false, error: { message: 'Not registered' } },
        ],
      });

      const result = await channel.send({
        channel: 'firebase',
        to: ['good-token', 'bad-token', 'dead-token'],
        subject: 'N',
        content: 'C',
      });

      expect(result.success).toBe(true);
      expect(result.error).toContain('2 tokens failed');
    });

    it('should return error when all tokens fail', async () => {
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 0,
        failureCount: 1,
        responses: [{ success: false }],
      });

      const result = await channel.send({
        channel: 'firebase',
        to: 'bad-token',
        subject: 'N',
        content: 'C',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('1 tokens failed');
    });

    it('should return error when no tokens provided', async () => {
      const result = await channel.send({
        channel: 'firebase',
        to: [],
        subject: 'N',
        content: 'C',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No device tokens provided');
    });

    it('should filter out falsy tokens', async () => {
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, messageId: 'm1' }],
      });

      const result = await channel.send({
        channel: 'firebase',
        to: ['good-token', '', null as unknown as string],
        subject: 'N',
        content: 'C',
      });

      expect(result.success).toBe(true);
    });

    it('should return error on firebase sdk failure', async () => {
      mockSendEachForMulticast.mockRejectedValue(
        new Error('Firebase not initialized'),
      );

      const result = await channel.send({
        channel: 'firebase',
        to: 'token-1',
        subject: 'N',
        content: 'C',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Firebase not initialized');
    });

    it('should include attachments in data payload', async () => {
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, messageId: 'm1' }],
      });

      await channel.send({
        channel: 'firebase',
        to: 'token-1',
        subject: 'Doc',
        content: 'Body',
        attachments: [
          {
            filename: 'report.pdf',
            contentType: 'application/pdf',
            content: Buffer.from('pdf'),
          },
        ],
      });

      const message = mockSendEachForMulticast.mock.calls[0][0];
      expect(message.data._attachments).toBeDefined();
      const raw = String(message.data._attachments);
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        filename: 'report.pdf',
        contentType: 'application/pdf',
      });
      expect(parsed[0].content).toBe(Buffer.from('pdf').toString('base64'));
    });
  });
});
