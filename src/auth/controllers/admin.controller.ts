import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AnonymousService } from '../services/anonymous.service';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminStatsResponse, AdminCleanupResponse } from '../responses';

@ApiTags('Admin')
@Controller('auth/admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly anonymousService: AnonymousService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get auth statistics (admin only)' })
  @ApiOkResponse({ type: AdminStatsResponse })
  async getStats() {
    const anonymousCount = await this.anonymousService.getAnonymousUserCount();
    return {
      anonymousUsers: anonymousCount,
    };
  }

  @Post('cleanup-anonymous')
  @ApiOperation({ summary: 'Cleanup expired anonymous users (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        maxAgeDays: { type: 'number', example: 30 },
      },
    },
  })
  @ApiOkResponse({ type: AdminCleanupResponse })
  async cleanupAnonymous(
    @Body() input: { maxAgeDays?: number },
  ): Promise<{ deleted: number }> {
    const deleted = await this.anonymousService.cleanupExpiredAnonymousUsers(
      input.maxAgeDays,
    );
    return { deleted };
  }
}
