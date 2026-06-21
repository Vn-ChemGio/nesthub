import { Test, TestingModule } from '@nestjs/testing';
import { StorageModule } from './storage.module.js';
import { StorageService } from './storage.service.js';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('StorageModule', () => {
  let service: StorageService;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'nesthub-storage-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        StorageModule.forRoot({
          default: { driver: 'local', baseDir: tmpDir, publicUrl: '/storage' },
        }),
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should put and get a file', async () => {
    const result = await service.put(Buffer.from('hello world'), undefined, {
      filename: 'test.txt',
    });
    expect(result.path).toBe('test.txt');
    expect(result.url).toBe('/storage/test.txt');

    const data = await service.get('test.txt');
    expect(data.toString()).toBe('hello world');
  });

  it('should check if file exists', async () => {
    await service.put(Buffer.from('hello'), undefined, {
      filename: 'exists.txt',
    });
    expect(await service.exists('exists.txt')).toBe(true);
    expect(await service.exists('nope.txt')).toBe(false);
  });

  it('should delete a file', async () => {
    await service.put(Buffer.from('delete me'), undefined, {
      filename: 'delete.txt',
    });
    await service.delete('delete.txt');
    expect(await service.exists('delete.txt')).toBe(false);
  });

  it('should list files', async () => {
    await service.put(Buffer.from('a'), undefined, { filename: 'list-a.txt' });
    await service.put(Buffer.from('b'), undefined, { filename: 'list-b.txt' });
    const result = await service.list();
    const names = result.files
      .map((f) => f.key)
      .filter((k) => k.startsWith('list-'));
    expect(names).toContain('list-a.txt');
    expect(names).toContain('list-b.txt');
  });

  it('should support subDir option', async () => {
    const result = await service.put(Buffer.from('subdir test'), undefined, {
      filename: 'nested.txt',
      subDir: 'sub/dir',
    });
    expect(result.path).toBe('sub/dir/nested.txt');

    const data = await service.get('sub/dir/nested.txt');
    expect(data.toString()).toBe('subdir test');
  });
});
