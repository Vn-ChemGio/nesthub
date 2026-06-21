import { Global, Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ActivityFeedService } from './activity-feed.service.js';
import { ActivityFeedEntity } from './entities/activity-feed.entity.js';
import { ACTIVITY_FEED_REPOSITORY } from './interfaces.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ActivityFeedEntity])],
  providers: [
    {
      provide: ACTIVITY_FEED_REPOSITORY,
      useExisting: getRepositoryToken(ActivityFeedEntity),
    },
    ActivityFeedService,
  ],
  exports: [ActivityFeedService],
})
export class ActivityFeedModule {}
