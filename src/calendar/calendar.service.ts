import { Injectable, Inject, Logger } from '@nestjs/common';
import type {
  CalendarEvent,
  ListEventsOptions,
  FreeBusyRequest,
  FreeBusyResult,
  CalendarWatchOptions,
  CalendarWatchResponse,
} from './interfaces.js';
import {
  CALENDAR_MODULE_OPTIONS,
  GOOGLE_CALENDAR_CLIENT,
} from './calendar.constants.js';
import type { CalendarModuleOptions } from './interfaces.js';

interface CalendarEventRaw {
  id?: string;
  summary?: string;
  description?: string | null;
  location?: string | null;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  attendees?: Array<{ email?: string; displayName?: string }>;
  recurrence?: string[];
  status?: string;
  transparency?: string;
  visibility?: string;
}

interface CalendarApiResponse<T> {
  data: T;
}

interface CalendarApiListResponse {
  data: {
    items?: CalendarEventRaw[];
  };
}

interface CalendarClientEvents {
  list(params: unknown): Promise<CalendarApiListResponse>;
  get(params: unknown): Promise<CalendarApiResponse<CalendarEventRaw>>;
  insert(params: unknown): Promise<CalendarApiResponse<CalendarEventRaw>>;
  update(params: unknown): Promise<CalendarApiResponse<CalendarEventRaw>>;
  delete(params: unknown): Promise<void>;
  watch(params: unknown): Promise<
    CalendarApiResponse<{
      kind: string;
      id: string;
      resourceId: string;
      resourceUri: string;
      expiration: string;
    }>
  >;
}

interface CalendarClientChannels {
  stop(params: unknown): Promise<void>;
}

interface CalendarClientFreebusy {
  query(params: unknown): Promise<CalendarApiResponse<FreeBusyResult>>;
}

interface CalendarClient {
  calendar: {
    events: CalendarClientEvents;
    freebusy: CalendarClientFreebusy;
    channels: CalendarClientChannels;
  };
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @Inject(GOOGLE_CALENDAR_CLIENT)
    private readonly client: CalendarClient,
    @Inject(CALENDAR_MODULE_OPTIONS)
    private readonly options: CalendarModuleOptions,
  ) {}

  private get calendar() {
    return this.client.calendar;
  }

  async listEvents(
    calendarId?: string,
    options?: ListEventsOptions,
  ): Promise<CalendarEvent[]> {
    const calId = calendarId ?? this.options.defaultCalendarId ?? 'primary';
    const response = await this.calendar.events.list({
      calendarId: calId,
      timeMin: options?.timeMin,
      timeMax: options?.timeMax,
      maxResults: options?.maxResults ?? 100,
      orderBy: options?.orderBy ?? 'startTime',
      singleEvents: true,
    });
    return (response.data.items ?? []).map((item) => this.normalizeEvent(item));
  }

  async getEvent(
    eventId: string,
    calendarId?: string,
  ): Promise<CalendarEvent | null> {
    const calId = calendarId ?? this.options.defaultCalendarId ?? 'primary';
    try {
      const response = await this.calendar.events.get({
        calendarId: calId,
        eventId,
      });
      return this.normalizeEvent(response.data);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: number }).code === 404
      )
        return null;
      throw error;
    }
  }

  async createEvent(
    event: CalendarEvent,
    calendarId?: string,
  ): Promise<CalendarEvent> {
    const calId = calendarId ?? this.options.defaultCalendarId ?? 'primary';
    const response = await this.calendar.events.insert({
      calendarId: calId,
      requestBody: event,
    });
    return this.normalizeEvent(response.data);
  }

  async updateEvent(
    eventId: string,
    event: Partial<CalendarEvent>,
    calendarId?: string,
  ): Promise<CalendarEvent> {
    const calId = calendarId ?? this.options.defaultCalendarId ?? 'primary';
    const response = await this.calendar.events.update({
      calendarId: calId,
      eventId,
      requestBody: event,
    });
    return this.normalizeEvent(response.data);
  }

  async deleteEvent(eventId: string, calendarId?: string): Promise<void> {
    const calId = calendarId ?? this.options.defaultCalendarId ?? 'primary';
    await this.calendar.events.delete({ calendarId: calId, eventId });
  }

  async checkAvailability(request: FreeBusyRequest): Promise<FreeBusyResult> {
    const response = await this.calendar.freebusy.query({
      requestBody: {
        timeMin: request.timeMin,
        timeMax: request.timeMax,
        items: (
          request.calendarIds ?? [this.options.defaultCalendarId ?? 'primary']
        ).map((id) => ({ id })),
      },
    });
    return response.data;
  }

  async watchCalendar(
    options: CalendarWatchOptions,
    calendarId?: string,
  ): Promise<CalendarWatchResponse> {
    const calId =
      calendarId ??
      options.calendarId ??
      this.options.defaultCalendarId ??
      'primary';
    const response = await this.calendar.events.watch({
      calendarId: calId,
      requestBody: {
        id: options.id,
        type: options.type,
        address: options.address,
        token: options.token,
        expiration: options.expiration,
        params: options.params,
      },
    });
    return {
      kind: response.data.kind,
      id: response.data.id,
      resourceId: response.data.resourceId,
      resourceUri: response.data.resourceUri,
      expiration: response.data.expiration,
    };
  }

  async stopWatch(channelId: string, resourceId: string): Promise<void> {
    await this.calendar.channels.stop({
      requestBody: {
        id: channelId,
        resourceId,
      },
    });
  }

  async findFreeSlots(
    date: string,
    durationMinutes: number,
    calendarId?: string,
  ): Promise<{ start: string; end: string }[]> {
    const dayStart = `${date}T00:00:00Z`;
    const dayEnd = `${date}T23:59:59Z`;

    const busy = await this.checkAvailability({
      timeMin: dayStart,
      timeMax: dayEnd,
      calendarIds: calendarId ? [calendarId] : undefined,
    });

    const busySlots = Object.values(busy.calendars).flatMap((c) => c.busy);
    busySlots.sort((a, b) => a.start.localeCompare(b.start));

    const freeSlots: { start: string; end: string }[] = [];
    let cursor = dayStart;

    for (const slot of busySlots) {
      if (slot.start > cursor) {
        const candidateEnd = new Date(
          new Date(slot.start).getTime() - 60000,
        ).toISOString();
        if (
          new Date(candidateEnd).getTime() - new Date(cursor).getTime() >=
          durationMinutes * 60000
        ) {
          freeSlots.push({ start: cursor, end: candidateEnd });
        }
      }
      if (slot.end > cursor) cursor = slot.end;
    }

    if (
      new Date(dayEnd).getTime() - new Date(cursor).getTime() >=
      durationMinutes * 60000
    ) {
      freeSlots.push({ start: cursor, end: dayEnd });
    }

    return freeSlots;
  }

  private normalizeEvent(data: CalendarEventRaw): CalendarEvent {
    return {
      id: data.id,
      summary: data.summary ?? '',
      description: data.description ?? undefined,
      location: data.location ?? undefined,
      start: {
        dateTime: data.start?.dateTime ?? '',
        timeZone: data.start?.timeZone,
      },
      end: { dateTime: data.end?.dateTime ?? '', timeZone: data.end?.timeZone },
      attendees: data.attendees?.map((a) => ({
        email: a.email ?? '',
        displayName: a.displayName,
      })),
      recurrence: data.recurrence,
      status: data.status as CalendarEvent['status'],
      transparency: data.transparency as CalendarEvent['transparency'],
      visibility: data.visibility as CalendarEvent['visibility'],
    };
  }
}
