import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PasskeyService } from '../services/passkey.service';
import { AuthGuard } from '../guards/auth.guard';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { LoginResult } from '../interfaces';
import type { PasskeyRegistration, PasskeyAuthentication } from '../interfaces';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  PasskeyRegistrationInitResponse,
  PasskeyAuthInitResponse,
  PasskeyItemResponse,
  LoginSuccessResponse,
} from '../responses';

@ApiTags('Passkey (WebAuthn)')
@Controller('auth/passkeys')
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}

  @UseGuards(AuthGuard)
  @Post('register/initiate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate passkey registration' })
  @ApiOkResponse({ type: PasskeyRegistrationInitResponse })
  async initiateRegistration(@CurrentUser('id') userId: string) {
    return this.passkeyService.initiateRegistration(userId);
  }

  @UseGuards(AuthGuard)
  @Post('register/complete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete passkey registration' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'rawId', 'response', 'type'],
      properties: {
        id: { type: 'string', example: 'abc-credential-id-123' },
        rawId: { type: 'string', example: 'YWJjLWNyZWRlbnRpYWwtaWQtMTIz' },
        response: {
          type: 'object',
          properties: {
            clientDataJSON: {
              type: 'string',
              example:
                'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiYUhSMGNITTZMeTkz',
            },
            attestationObject: {
              type: 'string',
              example:
                'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVjkSZYN5YgOjGh0NBcPZHZgW4',
            },
          },
        },
        type: { type: 'string', example: 'public-key' },
      },
    },
  })
  async completeRegistration(
    @CurrentUser('id') userId: string,
    @Body() registration: PasskeyRegistration,
  ) {
    return this.passkeyService.completeRegistration(userId, registration);
  }

  @Public()
  @Post('authenticate/initiate')
  @ApiOperation({ summary: 'Initiate passkey authentication' })
  @ApiOkResponse({ type: PasskeyAuthInitResponse })
  initiateAuthentication() {
    return this.passkeyService.initiateAuthentication();
  }

  @Public()
  @Post('authenticate/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete passkey authentication and login' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'rawId', 'response', 'type'],
      properties: {
        id: { type: 'string', example: 'abc-credential-id-123' },
        rawId: { type: 'string', example: 'YWJjLWNyZWRlbnRpYWwtaWQtMTIz' },
        response: {
          type: 'object',
          required: ['clientDataJSON', 'authenticatorData', 'signature'],
          properties: {
            clientDataJSON: {
              type: 'string',
              example:
                'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiYUhSMGNITTZMeTkz',
            },
            authenticatorData: {
              type: 'string',
              example: 'SZYN5YgOjGh0NBcPZHZgW4',
            },
            signature: {
              type: 'string',
              example: 'MEQCIH6KsZ8U1LkqJZ7xL3mKfY5nDg8RzvWxPq0b2c4e6Y8=',
            },
            userHandle: {
              type: 'string',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
          },
        },
        type: { type: 'string', example: 'public-key' },
      },
    },
  })
  @ApiOkResponse({ type: LoginSuccessResponse })
  async completeAuthentication(
    @Body() authentication: PasskeyAuthentication,
  ): Promise<LoginResult> {
    return this.passkeyService.completeAuthentication(authentication);
  }

  @UseGuards(AuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List registered passkeys' })
  @ApiOkResponse({ type: [PasskeyItemResponse] })
  async listPasskeys(@CurrentUser('id') userId: string) {
    return this.passkeyService.getUserPasskeys(userId);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a passkey' })
  async deletePasskey(
    @CurrentUser('id') userId: string,
    @Param('id') passkeyId: string,
  ): Promise<void> {
    return this.passkeyService.deletePasskey(userId, passkeyId);
  }
}
