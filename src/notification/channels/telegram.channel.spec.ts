import { TelegramChannel } from './telegram.channel';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('file from disk')),
}));

const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
const config = { botToken };
const okJson = (result: unknown) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: true, result }),
  } as Response);

const failJson = (status: number, body: string) =>
  Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  } as Response);

const notOkJson = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: false }),
  } as Response);

describe('TelegramChannel', () => {
  let channel: TelegramChannel;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    channel = new TelegramChannel(config);
    fetchSpy = jest.spyOn(global, 'fetch').mockReset();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('send', () => {
    it('should return error when content and attachments are empty', async () => {
      const result = await channel.send({
        channel: 'telegram',
        to: '123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message content is empty');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should send text message via /sendMessage', async () => {
      fetchSpy.mockResolvedValue(okJson({ message_id: 42 }));

      const result = await channel.send({
        channel: 'telegram',
        to: '123',
        content: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('42');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('/sendMessage');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body).toMatchObject({
        chat_id: '123',
        text: 'Hello',
        parse_mode: 'HTML',
      });
    });

    it('should send to multiple recipients', async () => {
      fetchSpy.mockResolvedValue(okJson({ message_id: 1 }));

      const result = await channel.send({
        channel: 'telegram',
        to: ['123', '456'],
        content: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should include sender as username when provided', async () => {
      fetchSpy.mockResolvedValue(okJson({ message_id: 1 }));

      await channel.send({
        channel: 'telegram',
        to: '123',
        content: 'Hello',
        sender: '@mybot',
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.username).toBe('@mybot');
    });

    it('should fail when /sendMessage returns error status', async () => {
      fetchSpy.mockResolvedValue(failJson(400, 'Bad Request: chat not found'));

      const result = await channel.send({
        channel: 'telegram',
        to: '123',
        content: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
    });

    it('should fail when /sendMessage returns ok=false', async () => {
      fetchSpy.mockResolvedValue(notOkJson());

      const result = await channel.send({
        channel: 'telegram',
        to: '123',
        content: 'Hello',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('send with single attachment', () => {
    it('should send file via /sendDocument', async () => {
      fetchSpy.mockResolvedValue(okJson({ message_id: 10 }));

      const result = await channel.send({
        channel: 'telegram',
        to: '123',
        attachments: [{ filename: 'test.txt', content: 'file content' }],
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('10');

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('/sendDocument');
    });

    it('should use content as caption in /sendDocument', async () => {
      fetchSpy.mockResolvedValue(okJson({ message_id: 10 }));

      await channel.send({
        channel: 'telegram',
        to: '123',
        content: 'See attached',
        attachments: [{ filename: 'test.txt', content: 'file content' }],
      });

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('/sendDocument');

      const body = fetchSpy.mock.calls[0][1].body as FormData;
      expect(body.get('caption')).toBe('See attached');
      expect(body.get('parse_mode')).toBe('HTML');
    });

    it('should return error when attachment has no content or path', async () => {
      const result = await channel.send({
        channel: 'telegram',
        to: '123',
        attachments: [{ filename: 'empty.txt' }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('no content or path');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should read file from path for /sendDocument', async () => {
      fetchSpy.mockResolvedValue(okJson({ message_id: 10 }));

      const result = await channel.send({
        channel: 'telegram',
        to: '123',
        attachments: [{ filename: 'doc.xlsx', path: '/tmp/doc.xlsx' }],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('send with multiple attachments', () => {
    it('should send files via /sendMediaGroup', async () => {
      fetchSpy.mockResolvedValue(
        okJson([{ message_id: 20 }, { message_id: 21 }]),
      );

      const result = await channel.send({
        channel: 'telegram',
        to: '123',
        attachments: [
          { filename: 'a.txt', content: 'aaa' },
          { filename: 'b.txt', content: 'bbb' },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('20');

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('/sendMediaGroup');
    });

    it('should set caption only on last item in media group', async () => {
      fetchSpy.mockResolvedValue(
        okJson([{ message_id: 20 }, { message_id: 21 }]),
      );

      await channel.send({
        channel: 'telegram',
        to: '123',
        content: 'Group caption',
        attachments: [
          { filename: 'a.txt', content: 'aaa' },
          { filename: 'b.txt', content: 'bbb' },
        ],
      });

      const body = fetchSpy.mock.calls[0][1].body as FormData;
      const mediaRaw = body.get('media') as string;
      const media = JSON.parse(mediaRaw);

      expect(media).toHaveLength(2);
      expect(media[0]).not.toHaveProperty('caption');
      expect(media[1]).toMatchObject({
        type: 'document',
        caption: 'Group caption',
        parse_mode: 'HTML',
      });
    });
  });
});
