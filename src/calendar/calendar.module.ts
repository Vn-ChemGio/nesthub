import { Global, Module, DynamicModule } from '@nestjs/common';
import { CalendarService } from './calendar.service.js';
import { CalendarWebhookService } from './calendar-webhook.service.js';
import {
  CALENDAR_MODULE_OPTIONS,
  GOOGLE_CALENDAR_CLIENT,
} from './calendar.constants.js';
import type { CalendarModuleOptions } from './interfaces.js';

function buildGoogleCalendarProvider(options: CalendarModuleOptions) {
  return {
    provide: GOOGLE_CALENDAR_CLIENT,
    useFactory: async () => {
      const { google } = await import('googleapis');
      const auth = options.auth;

      if (auth.type === 'service-account') {
        const authClient = new google.auth.JWT({
          email: auth.credentials.clientEmail,
          key: auth.credentials.privateKey,
          scopes: auth.scopes ?? ['https://www.googleapis.com/auth/calendar'],
        });
        return {
          calendar: google.calendar({ version: 'v3', auth: authClient }),
        };
      }
      const authClient = new google.auth.OAuth2({
        clientId: auth.credentials.clientId,
        clientSecret: auth.credentials.clientSecret,
      });
      authClient.setCredentials({
        refresh_token: auth.credentials.refreshToken,
      });
      return {
        calendar: google.calendar({ version: 'v3', auth: authClient }),
      };
    },
  };
}

@Global()
@Module({})
export class CalendarModule {
  static forRoot(options: CalendarModuleOptions): DynamicModule {
    return {
      module: CalendarModule,
      providers: [
        buildGoogleCalendarProvider(options),
        {
          provide: CALENDAR_MODULE_OPTIONS,
          useValue: options,
        },
        CalendarService,
        CalendarWebhookService,
      ],
      exports: [CalendarService, CalendarWebhookService],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => CalendarModuleOptions | Promise<CalendarModuleOptions>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    return {
      module: CalendarModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: CALENDAR_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        {
          provide: GOOGLE_CALENDAR_CLIENT,
          inject: [CALENDAR_MODULE_OPTIONS],
          useFactory: async (opts: CalendarModuleOptions) => {
            const { google } = await import('googleapis');
            const auth = opts.auth;

            if (auth.type === 'service-account') {
              const authClient = new google.auth.JWT({
                email: auth.credentials.clientEmail,
                key: auth.credentials.privateKey,
                scopes: auth.scopes ?? [
                  'https://www.googleapis.com/auth/calendar',
                ],
              });
              return {
                calendar: google.calendar({
                  version: 'v3',
                  auth: authClient,
                }),
              };
            }

            const authClient = new google.auth.OAuth2({
              clientId: auth.credentials.clientId,
              clientSecret: auth.credentials.clientSecret,
            });
            authClient.setCredentials({
              refresh_token: auth.credentials.refreshToken,
            });
            return {
              calendar: google.calendar({
                version: 'v3',
                auth: authClient,
              }),
            };
          },
        },
        CalendarService,
        CalendarWebhookService,
      ],
      exports: [CalendarService, CalendarWebhookService],
    };
  }
}
