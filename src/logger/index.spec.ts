import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from './logger.module.js';
import { LoggerService } from './logger.service.js';

describe('LoggerModule', () => {
  it('should provide LoggerService', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ level: 'silent' })],
    }).compile();

    const service = module.get<LoggerService>(LoggerService);
    expect(service).toBeDefined();
  });

  it('should allow forRootAsync', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        LoggerModule.forRootAsync({
          useFactory: () => ({ level: 'info' }),
        }),
      ],
    }).compile();

    const service = module.get<LoggerService>(LoggerService);
    expect(service).toBeDefined();
    expect(() => service.info('test')).not.toThrow();
  });
});
