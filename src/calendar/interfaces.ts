export interface CalendarModuleOptions {
  auth: {
    type: 'service-account' | 'oauth2';
    credentials: {
      clientEmail?: string;
      privateKey?: string;
      clientId?: string;
      clientSecret?: string;
      refreshToken?: string;
    };
    scopes?: string[];
  };
  defaultCalendarId?: string;
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: { email: string; displayName?: string }[];
  recurrence?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: { method: 'email' | 'popup'; minutes: number }[];
  };
  status?: 'confirmed' | 'tentative' | 'cancelled';
  transparency?: 'opaque' | 'transparent';
  visibility?: 'default' | 'public' | 'private';
}

export interface FreeBusyRequest {
  timeMin: string;
  timeMax: string;
  calendarIds?: string[];
}

export interface FreeBusyResult {
  calendars: Record<string, { busy: { start: string; end: string }[] }>;
}

export interface ListEventsOptions {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  orderBy?: 'startTime' | 'updated';
}

export interface CalendarWatchOptions {
  id: string;
  type: 'web_hook';
  address: string;
  token?: string;
  expiration?: string;
  params?: Record<string, string>;
  calendarId?: string;
}

export interface CalendarWatchResponse {
  kind: string;
  id: string;
  resourceId: string;
  resourceUri: string;
  expiration: string;
}

export interface CalendarWebhookPayload {
  messageNumber?: number;
  resourceState: 'sync' | 'exists';
  resourceId: string;
  resourceUri: string;
  channelId: string;
  channelExpiration?: string;
  channelToken?: string;
}

export interface CalendarWatchChannel {
  id: string;
  resourceId: string;
  expiration: number;
  calendarId: string;
}

export type CalendarWebhookHandler = (
  payload: CalendarWebhookPayload,
  events: CalendarEvent[],
) => void | Promise<void>;
