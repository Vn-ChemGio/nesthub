import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { CalendarService } from './calendar.service.js';
import type {
  CalendarWebhookPayload,
  CalendarEvent,
  CalendarWebhookHandler,
} from './interfaces.js';

export interface CalendarWebhookEvent {
  payload: CalendarWebhookPayload;
  events: CalendarEvent[];
}

@Injectable()
export class CalendarWebhookService {
  private readonly logger = new Logger(CalendarWebhookService.name);
  private readonly eventsSubject = new Subject<CalendarWebhookEvent>();
  private handlers: CalendarWebhookHandler[] = [];

  constructor(private readonly calendarService: CalendarService) {}

  onCalendarEvent(handler: CalendarWebhookHandler): void {
    this.handlers.push(handler);
  }

  get events$(): Observable<CalendarWebhookEvent> {
    return this.eventsSubject.asObservable();
  }

  async processNotification(
    payload: CalendarWebhookPayload,
    verifyToken?: string,
  ): Promise<void> {
    if (verifyToken && payload.channelToken !== verifyToken) {
      this.logger.warn('Invalid channel token, ignoring notification');
      return;
    }

    if (payload.resourceState === 'sync') {
      this.logger.log('Received sync notification');
      return;
    }

    this.logger.log(
      `Processing change notification for resource: ${payload.resourceId}`,
    );

    try {
      const events = await this.fetchChangedEvents(payload);

      this.eventsSubject.next({ payload, events });

      for (const handler of this.handlers) {
        await handler(payload, events);
      }
    } catch (error) {
      this.logger.error('Failed to process webhook notification', error);
    }
  }

  private async fetchChangedEvents(
    payload: CalendarWebhookPayload,
  ): Promise<CalendarEvent[]> {
    const eventId = this.extractEventId(payload.resourceUri);
    if (eventId) {
      const event = await this.calendarService.getEvent(eventId);
      return event ? [event] : [];
    }

    const calendarId = this.extractCalendarId(payload.resourceUri);
    if (calendarId) {
      return this.calendarService.listEvents(calendarId, {
        maxResults: 10,
        orderBy: 'updated',
      });
    }

    return [];
  }

  private extractEventId(resourceUri: string): string | null {
    const match = resourceUri.match(/events\/([^?]+)/);
    return match?.[1] ?? null;
  }

  private extractCalendarId(resourceUri: string): string | null {
    const match = resourceUri.match(/calendars\/([^/]+)/);
    return match?.[1] ?? null;
  }
}
