import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { FeishuBitableService } from '../src/integrations/feishu/bitable/feishu-bitable.service';
import { FeishuTaskService } from '../src/integrations/feishu/task/feishu-task.service';
import { FeishuEventDispatcher } from '../src/integrations/feishu/webhook/feishu-event.dispatcher';
import { AppConfigService } from '../src/config/app-config.service';

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
          raw_info: '您有一个快递',
          address: '驿站A',
          pickup_code: '12345',
          status: 'pending',
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
        fields: { ...createdRecord.fields, task_id: 'task_guid_001' },
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
      };
      expect(body.id).toBe('rec_001');
      expect(body.rawInfo).toBe('您有一个快递');
      expect(body.address).toBe('驿站A');
      expect(body.pickupCode).toBe('12345');
      expect(body.status).toBe('pending');
      expect(body.taskId).toBe('task_guid_001');
    });
  });

  describe('PATCH /express/pickups/:id', () => {
    it('should update a pickup record', async () => {
      const existingRecord = {
        record_id: 'rec_001',
        fields: {
          raw_info: '您有一个快递',
          address: '驿站A',
          pickup_code: '12345',
          task_id: 'task_guid_001',
          status: 'pending',
        },
      };
      const updatedRecord = {
        ...existingRecord,
        fields: { ...existingRecord.fields, address: '驿站B' },
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

      const body = response.body as { id: string; address: string };
      expect(body.id).toBe('rec_001');
      expect(body.address).toBe('驿站B');
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

  it('should update Bitable record to done when task.task.update_tenant_v1 received with completed_at', async () => {
    const taskGuid = 'task_guid_001';
    const recordId = 'rec_001';

    mockTableAccessor.listRecords.mockResolvedValueOnce({
      items: [
        {
          record_id: recordId,
          fields: { task_id: taskGuid, status: 'pending' },
        },
      ],
      has_more: false,
      total: 1,
    });
    mockTableAccessor.updateRecord.mockResolvedValueOnce({
      record_id: recordId,
      fields: { task_id: taskGuid, status: 'done' },
    });

    await dispatcher.dispatch('task.task.update_tenant_v1', {
      task: {
        guid: taskGuid,
        completed_at: '1234567890000',
      },
    });

    expect(mockTableAccessor.listRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.stringContaining(taskGuid) as unknown,
      }),
    );
    expect(mockTableAccessor.updateRecord).toHaveBeenCalledWith(
      recordId,
      expect.objectContaining({ status: 'done' }),
    );
  });

  it('should NOT update Bitable record when task.task.update_tenant_v1 has no completed_at', async () => {
    await dispatcher.dispatch('task.task.update_tenant_v1', {
      task: {
        guid: 'task_guid_002',
        completed_at: '',
      },
    });

    expect(mockTableAccessor.listRecords).not.toHaveBeenCalled();
    expect(mockTableAccessor.updateRecord).not.toHaveBeenCalled();
  });
});
