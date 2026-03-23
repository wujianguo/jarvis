import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { FeishuBitableService } from '../src/integrations/feishu/bitable/feishu-bitable.service';
import { FeishuTaskService } from '../src/integrations/feishu/task/feishu-task.service';
import { FeishuEventDispatcher } from '../src/integrations/feishu/webhook/feishu-event.dispatcher';
import { AppConfigService } from '../src/config/app-config.service';
import { ExpressPickupStatus } from '../src/domains/express/express-pickup-status.enum';

// ISO 8601 with +08:00 timezone offset
const ISO8601_BEIJING_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+08:00$/;

const FIXED_MS = 1710000000000; // 2024-03-09T20:00:00.000+08:00 (used in test mocks)

describe('ExpressPickups (e2e)', () => {
  let app: INestApplication<App>;

  const mockTableAccessor = {
    listRecords: jest.fn(),
    getRecord: jest.fn(),
    createRecord: jest.fn(),
    updateRecord: jest.fn(),
    deleteRecord: jest.fn(),
    batchCreateRecords: jest.fn(),
  };

  const mockBitableDb = {
    table: jest.fn().mockReturnValue(mockTableAccessor),
  };

  const mockBitableService = {
    db: jest.fn().mockReturnValue(mockBitableDb),
    dbByToken: jest.fn(),
  };

  const mockTaskService = {
    createTask: jest.fn(),
    updateTask: jest.fn(),
  };

  const mockConfigService = {
    port: 9000,
    kv: { baseUrl: 'http://kv', apiToken: 'token' },
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FeishuBitableService)
      .useValue(mockBitableService)
      .overrideProvider(FeishuTaskService)
      .useValue(mockTaskService)
      .overrideProvider(AppConfigService)
      .useValue(mockConfigService)
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

  describe('POST /express/pickups', () => {
    it('should return 400 when rawInfo is missing', () => {
      return request(app.getHttpServer())
        .post('/express/pickups')
        .send({ address: '驿站A', pickupCode: '12345' })
        .expect(400);
    });

    it('should return 400 when address is missing', () => {
      return request(app.getHttpServer())
        .post('/express/pickups')
        .send({ rawInfo: '您有一个快递', pickupCode: '12345' })
        .expect(400);
    });

    it('should return 400 when pickupCode is missing', () => {
      return request(app.getHttpServer())
        .post('/express/pickups')
        .send({ rawInfo: '您有一个快递', address: '驿站A' })
        .expect(400);
    });

    it('should return 400 when body is empty', () => {
      return request(app.getHttpServer())
        .post('/express/pickups')
        .send({})
        .expect(400);
    });

    it('should create a pickup and return dto', async () => {
      const createdRecord = {
        record_id: 'rec_001',
        fields: {
          原始信息: '您有一个快递',
          取件地址: '驿站A',
          取件码: '12345',
          状态: ExpressPickupStatus.Pending,
          创建时间: FIXED_MS,
          更新时间: FIXED_MS,
        },
      };

      mockTableAccessor.createRecord.mockResolvedValueOnce(createdRecord);
      mockTableAccessor.listRecords.mockResolvedValueOnce({
        items: [],
        has_more: false,
        total: 0,
      });
      mockTaskService.createTask.mockResolvedValueOnce('task_guid_001');
      mockTableAccessor.updateRecord.mockResolvedValueOnce({
        ...createdRecord,
        fields: { ...createdRecord.fields, 任务ID: 'task_guid_001' },
      });

      const response = await request(app.getHttpServer())
        .post('/express/pickups')
        .send({
          rawInfo: '您有一个快递',
          address: '驿站A',
          pickupCode: '12345',
        })
        .expect(201);

      const body = response.body as {
        id: string;
        rawInfo: string;
        address: string;
        pickupCode: string;
        status: string;
        taskId?: string;
        createdAt: string;
        updatedAt: string;
      };
      expect(body.id).toBe('rec_001');
      expect(body.rawInfo).toBe('您有一个快递');
      expect(body.address).toBe('驿站A');
      expect(body.pickupCode).toBe('12345');
      expect(body.status).toBe(ExpressPickupStatus.Pending);
      expect(body.taskId).toBe('task_guid_001');
      expect(body.createdAt).toMatch(ISO8601_BEIJING_RE);
      expect(body.updatedAt).toMatch(ISO8601_BEIJING_RE);
    });

    it('should pass members with role assignee to createTask', async () => {
      const createdRecord = {
        record_id: 'rec_002',
        fields: {
          原始信息: '您有一个快递',
          取件地址: '驿站A',
          取件码: '99999',
          状态: ExpressPickupStatus.Pending,
          创建时间: FIXED_MS,
          更新时间: FIXED_MS,
        },
      };

      mockTableAccessor.createRecord.mockResolvedValueOnce(createdRecord);
      mockTableAccessor.listRecords.mockResolvedValueOnce({
        items: [{ record_id: 'a_001', fields: { user_id: 'ou_abc123' } }],
        has_more: false,
        total: 1,
      });
      mockTaskService.createTask.mockResolvedValueOnce('task_guid_002');
      mockTableAccessor.updateRecord.mockResolvedValueOnce({
        ...createdRecord,
        fields: { ...createdRecord.fields, 任务ID: 'task_guid_002' },
      });

      await request(app.getHttpServer())
        .post('/express/pickups')
        .send({
          rawInfo: '您有一个快递',
          address: '驿站A',
          pickupCode: '99999',
        })
        .expect(201);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          members: [{ id: 'ou_abc123', type: 'user', role: 'assignee' }],
        }),
      );
    });
  });

  describe('PATCH /express/pickups/:id', () => {
    it('should update a pickup record', async () => {
      const existingRecord = {
        record_id: 'rec_001',
        fields: {
          原始信息: '您有一个快递',
          取件地址: '驿站A',
          取件码: '12345',
          任务ID: 'task_guid_001',
          状态: ExpressPickupStatus.Pending,
          创建时间: FIXED_MS,
          更新时间: FIXED_MS,
        },
      };
      const updatedRecord = {
        ...existingRecord,
        fields: { ...existingRecord.fields, 取件地址: '驿站B' },
      };

      mockTableAccessor.getRecord.mockResolvedValueOnce(existingRecord);
      mockTableAccessor.updateRecord.mockResolvedValueOnce(updatedRecord);
      mockTableAccessor.listRecords.mockResolvedValueOnce({
        items: [],
        has_more: false,
        total: 0,
      });
      mockTaskService.updateTask.mockResolvedValueOnce(undefined);

      const response = await request(app.getHttpServer())
        .patch('/express/pickups/rec_001')
        .send({ address: '驿站B' })
        .expect(200);

      const body = response.body as {
        id: string;
        address: string;
        createdAt: string;
        updatedAt: string;
      };
      expect(body.id).toBe('rec_001');
      expect(body.address).toBe('驿站B');
      expect(body.createdAt).toMatch(ISO8601_BEIJING_RE);
      expect(body.updatedAt).toMatch(ISO8601_BEIJING_RE);
    });
  });

  describe('GET /express/pickups', () => {
    it('should filter by 未取件 by default', async () => {
      mockTableAccessor.listRecords.mockResolvedValueOnce({
        items: [
          {
            record_id: 'rec_001',
            fields: {
              原始信息: '快递1',
              取件地址: '驿站A',
              取件码: '111',
              状态: ExpressPickupStatus.Pending,
              创建时间: FIXED_MS,
              更新时间: FIXED_MS,
            },
          },
        ],
        has_more: false,
        total: 1,
      });

      const response = await request(app.getHttpServer())
        .get('/express/pickups')
        .expect(200);

      expect(mockTableAccessor.listRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.stringContaining(
            ExpressPickupStatus.Pending,
          ) as unknown,
        }),
      );

      const body = response.body as Array<{
        status: string;
        createdAt: string;
        updatedAt: string;
      }>;
      expect(body).toHaveLength(1);
      expect(body[0].status).toBe(ExpressPickupStatus.Pending);
      expect(body[0].createdAt).toMatch(ISO8601_BEIJING_RE);
      expect(body[0].updatedAt).toMatch(ISO8601_BEIJING_RE);
    });

    it('should filter by 已取件 when status=已取件', async () => {
      mockTableAccessor.listRecords.mockResolvedValueOnce({
        items: [
          {
            record_id: 'rec_002',
            fields: {
              原始信息: '快递2',
              取件地址: '驿站B',
              取件码: '222',
              状态: ExpressPickupStatus.Done,
              创建时间: FIXED_MS,
              更新时间: FIXED_MS,
            },
          },
        ],
        has_more: false,
        total: 1,
      });

      const response = await request(app.getHttpServer())
        .get(
          `/express/pickups?status=${encodeURIComponent(ExpressPickupStatus.Done)}`,
        )
        .expect(200);

      expect(mockTableAccessor.listRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.stringContaining(ExpressPickupStatus.Done) as unknown,
        }),
      );

      const body = response.body as Array<{ status: string }>;
      expect(body).toHaveLength(1);
      expect(body[0].status).toBe(ExpressPickupStatus.Done);
    });
  });
});

describe('ExpressPickups Webhook (e2e)', () => {
  let app: INestApplication<App>;
  let dispatcher: FeishuEventDispatcher;

  const mockTableAccessor = {
    listRecords: jest.fn(),
    getRecord: jest.fn(),
    createRecord: jest.fn(),
    updateRecord: jest.fn(),
    deleteRecord: jest.fn(),
    batchCreateRecords: jest.fn(),
  };

  const mockBitableDb = {
    table: jest.fn().mockReturnValue(mockTableAccessor),
  };

  const mockBitableService = {
    db: jest.fn().mockReturnValue(mockBitableDb),
    dbByToken: jest.fn(),
  };

  const mockTaskService = {
    createTask: jest.fn(),
    getTask: jest.fn(),
    updateTask: jest.fn(),
  };

  const mockConfigService = {
    port: 9000,
    kv: { baseUrl: 'http://kv', apiToken: 'token' },
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FeishuBitableService)
      .useValue(mockBitableService)
      .overrideProvider(FeishuTaskService)
      .useValue(mockTaskService)
      .overrideProvider(AppConfigService)
      .useValue(mockConfigService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    dispatcher = moduleFixture.get(FeishuEventDispatcher);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should update Bitable record to 已取件 when task.task.update_tenant_v1 received with completed_at', async () => {
    const taskGuid = 'task_guid_001';
    const recordId = 'rec_001';

    mockTaskService.getTask.mockResolvedValueOnce({
      guid: taskGuid,
      completed_at: '1234567890000',
    });
    mockTableAccessor.listRecords.mockResolvedValueOnce({
      items: [
        {
          record_id: recordId,
          fields: { 任务ID: taskGuid, 状态: ExpressPickupStatus.Pending },
        },
      ],
      has_more: false,
      total: 1,
    });
    mockTableAccessor.updateRecord.mockResolvedValueOnce({
      record_id: recordId,
      fields: { 任务ID: taskGuid, 状态: ExpressPickupStatus.Done },
    });

    await dispatcher.dispatch('task.task.update_tenant_v1', {
      task_id: taskGuid,
    });

    expect(mockTaskService.getTask).toHaveBeenCalledWith(taskGuid);
    expect(mockTableAccessor.listRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.stringContaining(taskGuid) as unknown,
      }),
    );
    expect(mockTableAccessor.updateRecord).toHaveBeenCalledWith(
      recordId,
      expect.objectContaining({ 状态: ExpressPickupStatus.Done }),
    );
  });

  it('should NOT update Bitable record when task.task.update_tenant_v1 has no completed_at', async () => {
    mockTaskService.getTask.mockResolvedValueOnce({
      guid: 'task_guid_002',
      completed_at: '',
    });

    await dispatcher.dispatch('task.task.update_tenant_v1', {
      task_id: 'task_guid_002',
    });

    expect(mockTaskService.getTask).toHaveBeenCalledWith('task_guid_002');
    expect(mockTableAccessor.listRecords).not.toHaveBeenCalled();
    expect(mockTableAccessor.updateRecord).not.toHaveBeenCalled();
  });
});

describe('ExpressPickups MarkDone (e2e)', () => {
  let app: INestApplication<App>;

  const mockTableAccessor = {
    listRecords: jest.fn(),
    getRecord: jest.fn(),
    createRecord: jest.fn(),
    updateRecord: jest.fn(),
    deleteRecord: jest.fn(),
    batchCreateRecords: jest.fn(),
  };

  const mockBitableDb = {
    table: jest.fn().mockReturnValue(mockTableAccessor),
  };

  const mockBitableService = {
    db: jest.fn().mockReturnValue(mockBitableDb),
    dbByToken: jest.fn(),
  };

  const mockTaskService = {
    createTask: jest.fn(),
    updateTask: jest.fn(),
  };

  const mockConfigService = {
    port: 9000,
    kv: { baseUrl: 'http://kv', apiToken: 'token' },
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FeishuBitableService)
      .useValue(mockBitableService)
      .overrideProvider(FeishuTaskService)
      .useValue(mockTaskService)
      .overrideProvider(AppConfigService)
      .useValue(mockConfigService)
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

  describe('POST /express/pickups/:id/done', () => {
    it('should update Bitable record status to 已取件 and call updateTask with completed_at', async () => {
      const existingRecord = {
        record_id: 'rec_001',
        fields: {
          原始信息: '您有一个快递',
          取件地址: '驿站A',
          取件码: '12345',
          任务ID: 'task_guid_001',
          状态: ExpressPickupStatus.Pending,
          创建时间: FIXED_MS,
          更新时间: FIXED_MS,
        },
      };
      const updatedRecord = {
        ...existingRecord,
        fields: {
          ...existingRecord.fields,
          状态: ExpressPickupStatus.Done,
          更新时间: FIXED_MS + 1000,
        },
      };

      mockTableAccessor.getRecord.mockResolvedValueOnce(existingRecord);
      mockTableAccessor.updateRecord.mockResolvedValueOnce(updatedRecord);
      mockTaskService.updateTask.mockResolvedValueOnce(undefined);

      const response = await request(app.getHttpServer())
        .post('/express/pickups/rec_001/done')
        .expect(201);

      const body = response.body as { id: string; status: string };
      expect(body.id).toBe('rec_001');
      expect(body.status).toBe(ExpressPickupStatus.Done);

      expect(mockTableAccessor.updateRecord).toHaveBeenCalledWith(
        'rec_001',
        expect.objectContaining({ 状态: ExpressPickupStatus.Done }),
      );
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        'task_guid_001',
        expect.objectContaining({
          completed_at: expect.any(String) as unknown,
        }),
      );
    });

    it('should still succeed and not throw when record is already Done (idempotent)', async () => {
      const alreadyDoneRecord = {
        record_id: 'rec_002',
        fields: {
          原始信息: '您有一个快递',
          取件地址: '驿站A',
          取件码: '99999',
          任务ID: 'task_guid_002',
          状态: ExpressPickupStatus.Done,
          创建时间: FIXED_MS,
          更新时间: FIXED_MS,
        },
      };

      mockTableAccessor.getRecord.mockResolvedValueOnce(alreadyDoneRecord);
      mockTableAccessor.updateRecord.mockResolvedValueOnce(alreadyDoneRecord);
      mockTaskService.updateTask.mockResolvedValueOnce(undefined);

      const response = await request(app.getHttpServer())
        .post('/express/pickups/rec_002/done')
        .expect(201);

      const body = response.body as { id: string; status: string };
      expect(body.id).toBe('rec_002');
      expect(body.status).toBe(ExpressPickupStatus.Done);
    });

    it('should not call updateTask when record has no taskId', async () => {
      const existingRecord = {
        record_id: 'rec_003',
        fields: {
          原始信息: '您有一个快递',
          取件地址: '驿站A',
          取件码: '55555',
          状态: ExpressPickupStatus.Pending,
          创建时间: FIXED_MS,
          更新时间: FIXED_MS,
        },
      };
      const updatedRecord = {
        ...existingRecord,
        fields: { ...existingRecord.fields, 状态: ExpressPickupStatus.Done },
      };

      mockTableAccessor.getRecord.mockResolvedValueOnce(existingRecord);
      mockTableAccessor.updateRecord.mockResolvedValueOnce(updatedRecord);

      await request(app.getHttpServer())
        .post('/express/pickups/rec_003/done')
        .expect(201);

      expect(mockTaskService.updateTask).not.toHaveBeenCalled();
    });
  });

  describe('POST /express/pickups/done-by-code', () => {
    it('should return 400 when pickupCode is missing', () => {
      return request(app.getHttpServer())
        .post('/express/pickups/done-by-code')
        .send({})
        .expect(400);
    });

    it('should return 400 when pickupCode is empty string', () => {
      return request(app.getHttpServer())
        .post('/express/pickups/done-by-code')
        .send({ pickupCode: '' })
        .expect(400);
    });

    it('should return 404 when no pending record matches the pickupCode', async () => {
      mockTableAccessor.listRecords.mockResolvedValueOnce({
        items: [],
        has_more: false,
        total: 0,
      });

      await request(app.getHttpServer())
        .post('/express/pickups/done-by-code')
        .send({ pickupCode: 'NONEXISTENT' })
        .expect(404);
    });

    it('should mark the single matching pending record as done', async () => {
      const pendingRecord = {
        record_id: 'rec_010',
        fields: {
          原始信息: '您有一个快递',
          取件地址: '驿站A',
          取件码: 'CODE001',
          任务ID: 'task_guid_010',
          状态: ExpressPickupStatus.Pending,
          创建时间: FIXED_MS,
          更新时间: FIXED_MS,
        },
      };
      const updatedRecord = {
        ...pendingRecord,
        fields: { ...pendingRecord.fields, 状态: ExpressPickupStatus.Done },
      };

      // listRecords call for done-by-code search
      mockTableAccessor.listRecords.mockResolvedValueOnce({
        items: [pendingRecord],
        has_more: false,
        total: 1,
      });
      // getRecord call inside markDone
      mockTableAccessor.getRecord.mockResolvedValueOnce(pendingRecord);
      // updateRecord call inside markDone
      mockTableAccessor.updateRecord.mockResolvedValueOnce(updatedRecord);
      mockTaskService.updateTask.mockResolvedValueOnce(undefined);

      const response = await request(app.getHttpServer())
        .post('/express/pickups/done-by-code')
        .send({ pickupCode: 'CODE001' })
        .expect(201);

      const body = response.body as { id: string; status: string };
      expect(body.id).toBe('rec_010');
      expect(body.status).toBe(ExpressPickupStatus.Done);
    });

    it('should pick the record with the greatest 更新时间 when multiple pending records match', async () => {
      const olderRecord = {
        record_id: 'rec_020',
        fields: {
          原始信息: '快递A',
          取件地址: '驿站A',
          取件码: 'MULTI',
          状态: ExpressPickupStatus.Pending,
          创建时间: FIXED_MS,
          更新时间: FIXED_MS, // older
        },
      };
      const newerRecord = {
        record_id: 'rec_021',
        fields: {
          原始信息: '快递B',
          取件地址: '驿站B',
          取件码: 'MULTI',
          状态: ExpressPickupStatus.Pending,
          创建时间: FIXED_MS,
          更新时间: FIXED_MS + 5000, // newer
        },
      };
      const updatedRecord = {
        ...newerRecord,
        fields: { ...newerRecord.fields, 状态: ExpressPickupStatus.Done },
      };

      // listRecords returns both records; order shouldn't matter for the selection logic
      mockTableAccessor.listRecords.mockResolvedValueOnce({
        items: [olderRecord, newerRecord],
        has_more: false,
        total: 2,
      });
      // getRecord is called with the id of the newest record
      mockTableAccessor.getRecord.mockResolvedValueOnce(newerRecord);
      mockTableAccessor.updateRecord.mockResolvedValueOnce(updatedRecord);
      mockTaskService.updateTask.mockResolvedValueOnce(undefined);

      const response = await request(app.getHttpServer())
        .post('/express/pickups/done-by-code')
        .send({ pickupCode: 'MULTI' })
        .expect(201);

      const body = response.body as { id: string; status: string };
      // The newer record (rec_021) should be marked done
      expect(body.id).toBe('rec_021');
      expect(body.status).toBe(ExpressPickupStatus.Done);
      // updateRecord should have been called with the newer record's id
      expect(mockTableAccessor.updateRecord).toHaveBeenCalledWith(
        'rec_021',
        expect.objectContaining({ 状态: ExpressPickupStatus.Done }),
      );
    });
  });
});
