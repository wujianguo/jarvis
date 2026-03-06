import { Test, TestingModule } from '@nestjs/testing';
import { TodoController } from './todo.controller';
import { TodoService } from './todo.service';

const mockTodo = {
  id: '1',
  title: 'Test Todo',
  description: 'Test description',
  completed: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockTodoService = {
  findAll: jest.fn().mockResolvedValue([mockTodo]),
  findOne: jest.fn().mockResolvedValue(mockTodo),
  create: jest.fn().mockResolvedValue(mockTodo),
  update: jest.fn().mockResolvedValue({ ...mockTodo, completed: true }),
  remove: jest.fn().mockResolvedValue(undefined),
};

describe('TodoController', () => {
  let controller: TodoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodoController],
      providers: [{ provide: TodoService, useValue: mockTodoService }],
    }).compile();

    controller = module.get<TodoController>(TodoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of todos', async () => {
      const result = await controller.findAll();
      expect(result).toEqual([mockTodo]);
      expect(mockTodoService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single todo', async () => {
      const result = await controller.findOne('1');
      expect(result).toEqual(mockTodo);
      expect(mockTodoService.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('create', () => {
    it('should create and return a todo', async () => {
      const dto = { title: 'Test Todo', description: 'Test description' };
      const result = await controller.create(dto);
      expect(result).toEqual(mockTodo);
      expect(mockTodoService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should update and return a todo', async () => {
      const dto = { completed: true };
      const result = await controller.update('1', dto);
      expect(result).toEqual({ ...mockTodo, completed: true });
      expect(mockTodoService.update).toHaveBeenCalledWith('1', dto);
    });
  });

  describe('remove', () => {
    it('should remove a todo', async () => {
      const result = await controller.remove('1');
      expect(result).toBeUndefined();
      expect(mockTodoService.remove).toHaveBeenCalledWith('1');
    });
  });
});
