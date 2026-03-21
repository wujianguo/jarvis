import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/app-config.service';
import { KvService } from '../src/integrations/kv/kv.service';
import { SmsAiService } from '../src/domains/sms/sms-ai.service';
import { ExpressPickupsService } from '../src/domains/express/express-pickups.service';
import { SmsClassificationResult } from '../src/domains/sms/interfaces/sms-handler.interface';

/**
 * Wait for background tasks (scheduled with setImmediate) to complete.
 * Awaits several event-loop ticks to ensure async processing finishes.
 */
const flushBackgroundTasks = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
};

describe('SMS Ingest (e2e)', () => {
  let app: INestApplication<App>;

  const mockKvStore = new Map<string, unknown>();

  const mockKvService = {
    get: jest.fn((key: string) =>
      Promise.resolve(mockKvStore.get(key) ?? null),
    ),
    set: jest.fn((key: string, value: unknown) => {
      mockKvStore.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn((key: string) => {
      mockKvStore.delete(key);
      return Promise.resolve();
    }),
  };

  const mockAiService = {
    classifySms: jest.fn<Promise<SmsClassificationResult>, [string]>(),
  };

  const mockExpressPickupsService = {
    create: jest
      .fn()
      .mockResolvedValue({ id: 'rec_test', pickupCode: '12345' }),
  };

  const mockConfigService = {
    port: 9000,
    kv: { baseUrl: 'http://kv', apiToken: 'token' },
    ai: { apiKey: 'test-key', model: 'gpt-4o-mini', baseURL: undefined },
    sms: { dedupTtlSeconds: 120 },
    feishu: {
      baseUrl: 'https://open.feishu.cn',
      appId: 'app_id',
      appSecret: 'secret',
      webhookPath: '/api/feishu/webhook',
      verificationToken: 'test-token',
      bitable: {
        databases: {
          home: {
            appToken: 'bascn_test',
            tables: {
              express_pickups: { tableId: 'tbl_pickups' },
              express_assignees: { tableId: 'tbl_assignees' },
            },
          },
        },
      },
      sheets: {},
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockKvStore.clear();

    // Default: AI returns 'other' to avoid triggering pickup creation
    mockAiService.classifySms.mockResolvedValue({
      kind: 'other',
      confidence: 0.9,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppConfigService)
      .useValue(mockConfigService)
      .overrideProvider(KvService)
      .useValue(mockKvService)
      .overrideProvider(SmsAiService)
      .useValue(mockAiService)
      .overrideProvider(ExpressPickupsService)
      .useValue(mockExpressPickupsService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /sms/ingest', () => {
    it('should return 400 when content is missing', () => {
      return request(app.getHttpServer())
        .post('/sms/ingest')
        .send({})
        .expect(400);
    });

    it('should return 400 when content is empty string', () => {
      return request(app.getHttpServer())
        .post('/sms/ingest')
        .send({ content: '' })
        .expect(400);
    });

    it('should return 400 when extra unknown fields are provided', () => {
      return request(app.getHttpServer())
        .post('/sms/ingest')
        .send({ content: '测试短信', unknownField: 'oops' })
        .expect(400);
    });

    it('should accept a valid SMS and return accepted=true', async () => {
      const res = await request(app.getHttpServer())
        .post('/sms/ingest')
        .send({ content: '您有一个快递，取件码：12345' })
        .expect(202);

      const body = res.body as {
        accepted: boolean;
        deduped: boolean;
        fingerprint: string;
        message?: string;
      };
      expect(body.accepted).toBe(true);
      expect(body.deduped).toBe(false);
      expect(typeof body.fingerprint).toBe('string');
      expect(body.fingerprint.length).toBe(64); // SHA-256 hex
    });

    it('should return deduped=true on second identical request within TTL', async () => {
      const payload = {
        content: '您有一个快递，取件码：66666',
        receivedAt: '2024-03-09T12:00:00.000+08:00',
      };

      type IngestBody = {
        accepted: boolean;
        deduped: boolean;
        fingerprint: string;
      };

      // First request: accepted
      const res1 = await request(app.getHttpServer())
        .post('/sms/ingest')
        .send(payload)
        .expect(202);

      const body1 = res1.body as IngestBody;
      expect(body1.accepted).toBe(true);
      expect(body1.deduped).toBe(false);

      // Second request: same content + receivedAt → same fingerprint → deduped
      const res2 = await request(app.getHttpServer())
        .post('/sms/ingest')
        .send(payload)
        .expect(202);

      const body2 = res2.body as IngestBody;
      expect(body2.accepted).toBe(false);
      expect(body2.deduped).toBe(true);
      expect(body2.fingerprint).toBe(body1.fingerprint);
    });

    it('should NOT deduplicate requests with different content', async () => {
      const receivedAt = '2024-03-09T12:00:00.000+08:00';

      type IngestBody = { accepted: boolean; fingerprint: string };

      const res1 = await request(app.getHttpServer())
        .post('/sms/ingest')
        .send({ content: '取件码：11111', receivedAt })
        .expect(202);
      const body1 = res1.body as IngestBody;
      expect(body1.accepted).toBe(true);

      const res2 = await request(app.getHttpServer())
        .post('/sms/ingest')
        .send({ content: '取件码：22222', receivedAt })
        .expect(202);
      const body2 = res2.body as IngestBody;
      expect(body2.accepted).toBe(true);
      expect(body2.fingerprint).not.toBe(body1.fingerprint);
    });

    it('should call ExpressPickupsService.create when AI returns express_pickup with pickupCode', async () => {
      mockAiService.classifySms.mockResolvedValue({
        kind: 'express_pickup',
        pickupCode: '99887',
        address: '菜鸟驿站A栋',
        confidence: 0.95,
      });

      await request(app.getHttpServer())
        .post('/sms/ingest')
        .send({
          content:
            '【菜鸟驿站】您的包裹已到达，取件码：99887，地址：菜鸟驿站A栋',
          receivedAt: '2024-03-09T12:00:00.000+08:00',
        })
        .expect(202);

      // Wait for background processing to complete
      await flushBackgroundTasks();

      expect(mockExpressPickupsService.create).toHaveBeenCalledTimes(1);
      expect(mockExpressPickupsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pickupCode: '99887',
          address: '菜鸟驿站A栋',
        }),
      );
    });

    it('should NOT call ExpressPickupsService.create when AI returns express_pickup without pickupCode', async () => {
      mockAiService.classifySms.mockResolvedValue({
        kind: 'express_pickup',
        // pickupCode intentionally omitted
        confidence: 0.7,
      });

      await request(app.getHttpServer())
        .post('/sms/ingest')
        .send({
          content: '您有快递，请到驿站取件',
          receivedAt: '2024-03-09T12:00:00.000+08:00',
        })
        .expect(202);

      await flushBackgroundTasks();

      expect(mockExpressPickupsService.create).not.toHaveBeenCalled();
    });

    it('should NOT call ExpressPickupsService.create when AI returns other', async () => {
      mockAiService.classifySms.mockResolvedValue({
        kind: 'other',
        confidence: 0.99,
      });

      await request(app.getHttpServer())
        .post('/sms/ingest')
        .send({
          content: '您的验证码是 123456，5分钟内有效',
          receivedAt: '2024-03-09T12:00:00.000+08:00',
        })
        .expect(202);

      await flushBackgroundTasks();

      expect(mockExpressPickupsService.create).not.toHaveBeenCalled();
    });

    it('should NOT call ExpressPickupsService.create when AI returns unknown', async () => {
      mockAiService.classifySms.mockResolvedValue({
        kind: 'unknown',
        confidence: 0.3,
      });

      await request(app.getHttpServer())
        .post('/sms/ingest')
        .send({
          content: '这是一条无法判断类型的短信',
          receivedAt: '2024-03-09T12:00:00.000+08:00',
        })
        .expect(202);

      await flushBackgroundTasks();

      expect(mockExpressPickupsService.create).not.toHaveBeenCalled();
    });

    it('should accept optional fields (sender, receivedAt, device)', async () => {
      const res = await request(app.getHttpServer())
        .post('/sms/ingest')
        .send({
          content: '取件码 54321',
          sender: '+8613800138000',
          receivedAt: '2024-03-09T12:00:00.000+08:00',
          device: 'iPhone 15',
        })
        .expect(202);

      const body = res.body as { accepted: boolean };
      expect(body.accepted).toBe(true);
    });

    it('should store dedup key in KV on first request', async () => {
      await request(app.getHttpServer())
        .post('/sms/ingest')
        .send({
          content: '取件码：777',
          receivedAt: '2024-03-09T12:00:00.000+08:00',
        })
        .expect(202);

      expect(mockKvService.set).toHaveBeenCalledTimes(1);
      const [key, value, ttl] = mockKvService.set.mock.calls[0] as [
        string,
        { seenAt: number },
        number,
      ];
      expect(key).toMatch(/^sms:ingest:dedup:/);
      expect(typeof value.seenAt).toBe('number');
      expect(ttl).toBe(120);
    });

    it('should NOT call KV set when request is already deduped', async () => {
      const payload = {
        content: '取件码：888',
        receivedAt: '2024-03-09T12:00:00.000+08:00',
      };

      // First request: sets KV
      await request(app.getHttpServer())
        .post('/sms/ingest')
        .send(payload)
        .expect(202);

      const setCallCount = mockKvService.set.mock.calls.length;

      // Second request: deduped, should not call set again
      await request(app.getHttpServer())
        .post('/sms/ingest')
        .send(payload)
        .expect(202);

      expect(mockKvService.set).toHaveBeenCalledTimes(setCallCount); // no extra calls
    });
  });
});
