import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service.js';
import { CalendarWebhookService } from './calendar-webhook.service.js';
import {
  CALENDAR_MODULE_OPTIONS,
  GOOGLE_CALENDAR_CLIENT,
} from './calendar.constants.js';

describe('CalendarModule', () => {
  let service: CalendarService;
  let webhookService: CalendarWebhookService;
  let mockEvents: Record<string, jest.Mock>;
  let mockChannels: Record<string, jest.Mock>;
  let mockFreebusy: Record<string, jest.Mock>;

  const defaultOptions = {
    auth: { type: 'service-account' as const, credentials: {} },
    defaultCalendarId: 'primary',
  };

  beforeEach(async () => {
    mockEvents = {
      list: jest.fn().mockResolvedValue({ data: { items: [] } }),
      get: jest.fn().mockResolvedValue({ data: { id: '1', summary: 'Test' } }),
      insert: jest.fn().mockResolvedValue({ data: { id: '2', summary: 'New' } }),
      update: jest.fn().mockResolvedValue({ data: { id: '1', summary: 'Updated' } }),
      delete: jest.fn().mockResolvedValue({}),
      watch: jest.fn().mockResolvedValue({
        data: {
          kind: 'api#channel',
          id: 'channel-abc',
          resourceId: 'resource-xyz',
          resourceUri:
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          expiration: '2025-06-01T00:00:00Z',
        },
      }),
    };

    mockChannels = {
      stop: jest.fn().mockResolvedValue({}),
    };

    mockFreebusy = {
      query: jest.fn().mockResolvedValue({ data: { calendars: {} } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: GOOGLE_CALENDAR_CLIENT,
          useValue: {
            calendar: {
              events: mockEvents,
              freebusy: mockFreebusy,
              channels: mockChannels,
            },
          },
        },
        { provide: CALENDAR_MODULE_OPTIONS, useValue: defaultOptions },
        CalendarService,
        CalendarWebhookService,
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
    webhookService = module.get<CalendarWebhookService>(CalendarWebhookService);
  });

  it('should provide CalendarService', () => {
    expect(service).toBeDefined();
  });

  it('should provide CalendarWebhookService', () => {
    expect(webhookService).toBeDefined();
  });

  describe('listEvents', () => {
    it('should return an empty array when no events exist', async () => {
      const events = await service.listEvents();
      expect(events).toEqual([]);
    });

    it('should pass options to the API', async () => {
      await service.listEvents('custom', {
        timeMin: '2025-01-01T00:00:00Z',
        maxResults: 5,
        orderBy: 'updated',
      });

      expect(mockEvents.list).toHaveBeenCalledWith({
        calendarId: 'custom',
        timeMin: '2025-01-01T00:00:00Z',
        timeMax: undefined,
        maxResults: 5,
        orderBy: 'updated',
        singleEvents: true,
      });
    });
  });

  describe('getEvent', () => {
    it('should return a normalized event', async () => {
      const event = await service.getEvent('1');
      expect(event).toBeDefined();
      expect(event?.summary).toBe('Test');
    });

    it('should return null on 404', async () => {
      const err = new Error('Not found') as Error & { code: number };
      err.code = 404;
      mockEvents.get.mockRejectedValue(err);
      const event = await service.getEvent('nonexistent');
      expect(event).toBeNull();
    });

    it('should throw on non-404 errors', async () => {
      mockEvents.get.mockRejectedValue(new Error('API error'));
      await expect(service.getEvent('1')).rejects.toThrow('API error');
    });
  });

  describe('createEvent', () => {
    it('should create and return a normalized event', async () => {
      const input = {
        summary: 'Meeting',
        start: { dateTime: '2025-01-01T10:00:00Z' },
        end: { dateTime: '2025-01-01T11:00:00Z' },
      };
      const result = await service.createEvent(input, 'custom');
      expect(result.summary).toBe('New');
      expect(mockEvents.insert).toHaveBeenCalledWith({
        calendarId: 'custom',
        requestBody: input,
      });
    });
  });

  describe('updateEvent', () => {
    it('should update and return a normalized event', async () => {
      const result = await service.updateEvent('1', {
        summary: 'Updated',
      });
      expect(result.summary).toBe('Updated');
      expect(mockEvents.update).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: '1',
        requestBody: { summary: 'Updated' },
      });
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event', async () => {
      await service.deleteEvent('1', 'custom');
      expect(mockEvents.delete).toHaveBeenCalledWith({
        calendarId: 'custom',
        eventId: '1',
      });
    });
  });

  describe('checkAvailability', () => {
    it('should return free/busy result', async () => {
      const result = await service.checkAvailability({
        timeMin: '2025-01-01T00:00:00Z',
        timeMax: '2025-01-01T23:59:59Z',
      });
      expect(result).toEqual({ calendars: {} });
    });

    it('should use default calendarId when none provided', async () => {
      await service.checkAvailability({
        timeMin: '2025-01-01T00:00:00Z',
        timeMax: '2025-01-01T23:59:59Z',
      });
      expect(mockFreebusy.query).toHaveBeenCalledWith({
        requestBody: {
          timeMin: '2025-01-01T00:00:00Z',
          timeMax: '2025-01-01T23:59:59Z',
          items: [{ id: 'primary' }],
        },
      });
    });
  });

  describe('watchCalendar', () => {
    const baseWatchOptions = {
      id: 'unique-channel-id',
      type: 'web_hook' as const,
      address: 'https://example.com/webhook',
    };

    it('should create a watch channel with all options', async () => {
      const watchOptions = {
        ...baseWatchOptions,
        token: 'my-verification-token',
        expiration: '2025-12-31T23:59:59Z',
        params: { ttl: '3600' },
      };

      const result = await service.watchCalendar(watchOptions, 'custom-calendar');

      expect(mockEvents.watch).toHaveBeenCalledWith({
        calendarId: 'custom-calendar',
        requestBody: {
          id: 'unique-channel-id',
          type: 'web_hook',
          address: 'https://example.com/webhook',
          token: 'my-verification-token',
          expiration: '2025-12-31T23:59:59Z',
          params: { ttl: '3600' },
        },
      });

      expect(result).toEqual({
        kind: 'api#channel',
        id: 'channel-abc',
        resourceId: 'resource-xyz',
        resourceUri:
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        expiration: '2025-06-01T00:00:00Z',
      });
    });

    it('should use defaultCalendarId when calendarId is not provided', async () => {
      await service.watchCalendar(baseWatchOptions);

      expect(mockEvents.watch).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: {
          id: 'unique-channel-id',
          type: 'web_hook',
          address: 'https://example.com/webhook',
          token: undefined,
          expiration: undefined,
          params: undefined,
        },
      });
    });

    it('should allow minimal CalendarWatchOptions (id, type, address only)', async () => {
      const result = await service.watchCalendar(baseWatchOptions);
      expect(result).toBeDefined();
      expect(result.id).toBe('channel-abc');
      expect(result.resourceId).toBe('resource-xyz');
    });

    it('should accept calendarId via CalendarWatchOptions.calendarId field', async () => {
      const watchOptions = {
        ...baseWatchOptions,
        calendarId: 'options-calendar',
      };

      await service.watchCalendar(watchOptions);

      expect(mockEvents.watch).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'options-calendar',
        }),
      );
    });
  });

  describe('stopWatch', () => {
    it('should stop a watch channel with channelId and resourceId', async () => {
      await service.stopWatch('channel-123', 'resource-456');

      expect(mockChannels.stop).toHaveBeenCalledWith({
        requestBody: {
          id: 'channel-123',
          resourceId: 'resource-456',
        },
      });
    });
  });

  describe('findFreeSlots', () => {
    it('should return free slots for a day with no events', async () => {
      const slots = await service.findFreeSlots('2025-01-01', 30);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toEqual({
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-01T23:59:59Z',
      });
    });

    it('should return empty array when no free slot matches duration', async () => {
      mockFreebusy.query.mockResolvedValue({
        data: {
          calendars: {
            primary: {
              busy: [
                {
                  start: '2025-01-01T00:00:00Z',
                  end: '2025-01-01T23:59:59Z',
                },
              ],
            },
          },
        },
      });

      const slots = await service.findFreeSlots('2025-01-01', 30);
      expect(slots).toHaveLength(0);
    });
  });

  describe('CalendarWebhookService', () => {
    it('should emit events$ on processNotification', (done) => {
      webhookService.events$.subscribe((event) => {
        expect(event.payload.resourceId).toBe('resource-xyz');
        expect(event.events).toHaveLength(1);
        done();
      });

      webhookService.processNotification({
        resourceState: 'exists',
        resourceId: 'resource-xyz',
        resourceUri:
          'https://www.googleapis.com/calendar/v3/calendars/primary/events/1',
        channelId: 'channel-abc',
      });
    });

    it('should skip sync notifications', async () => {
      const spy = jest.spyOn(webhookService as any, 'fetchChangedEvents');
      await webhookService.processNotification({
        resourceState: 'sync',
        resourceId: 'resource-xyz',
        resourceUri:
          'https://www.googleapis.com/calendar/v3/calendars/primary/events/1',
        channelId: 'channel-abc',
      });
      expect(spy).not.toHaveBeenCalled();
    });

    it('should call registered handlers', async () => {
      const handler = jest.fn();
      webhookService.onCalendarEvent(handler);

      await webhookService.processNotification({
        resourceState: 'exists',
        resourceId: 'resource-xyz',
        resourceUri:
          'https://www.googleapis.com/calendar/v3/calendars/primary/events/1',
        channelId: 'channel-abc',
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should reject notifications with mismatched token', async () => {
      mockEvents.get.mockRejectedValue(new Error('should not be called'));
      await webhookService.processNotification(
        {
          resourceState: 'exists',
          resourceId: 'resource-xyz',
          resourceUri:
            'https://www.googleapis.com/calendar/v3/calendars/primary/events/1',
          channelId: 'channel-abc',
          channelToken: 'wrong-token',
        },
        'expected-token',
      );
      expect(mockEvents.get).not.toHaveBeenCalled();
    });
  });
});
