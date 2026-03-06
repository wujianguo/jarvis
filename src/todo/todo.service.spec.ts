import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TodoService } from './todo.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockTodo = {
  id: '1',
  title: 'Test Todo',
  description: 'Test description',
  completed: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

const mockSupabaseService = {
  getClient: jest.fn().mockReturnValue(mockSupabaseClient),
};

describe('TodoService', () => {
  let service: TodoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
    mockSupabaseClient.insert.mockReturnThis();
    mockSupabaseClient.update.mockReturnThis();
    mockSupabaseClient.delete.mockReturnThis();
    mockSupabaseClient.order.mockReturnThis();
    mockSupabaseClient.eq.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodoService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<TodoService>(TodoService);
  });

  describe('findAll', () => {
    it('should return an array of todos', async () => {
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [mockTodo],
        error: null,
      });
      const result = await service.findAll();
      expect(result).toEqual([mockTodo]);
    });

    it('should throw an error when supabase returns an error', async () => {
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });
      await expect(service.findAll()).rejects.toThrow(
        'Failed to retrieve todos: DB error',
      );
    });
  });

  describe('findOne', () => {
    it('should return a single todo', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockTodo,
        error: null,
      });
      const result = await service.findOne('1');
      expect(result).toEqual(mockTodo);
    });

    it('should throw NotFoundException when todo is not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return a todo', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockTodo,
        error: null,
      });
      const result = await service.create({
        title: 'Test Todo',
        description: 'Test description',
      });
      expect(result).toEqual(mockTodo);
    });

    it('should throw an error when supabase returns an error', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert error' },
      });
      await expect(service.create({ title: 'Test Todo' })).rejects.toThrow(
        'Failed to create todo: Insert error',
      );
    });
  });

  describe('update', () => {
    it('should update and return a todo', async () => {
      const updatedTodo = { ...mockTodo, completed: true };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: updatedTodo,
        error: null,
      });
      const result = await service.update('1', { completed: true });
      expect(result).toEqual(updatedTodo);
    });

    it('should throw NotFoundException when todo is not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });
      await expect(service.update('999', { completed: true })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a todo', async () => {
      mockSupabaseClient.select.mockResolvedValueOnce({
        data: [mockTodo],
        error: null,
      });
      await expect(service.remove('1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when todo is not found', async () => {
      mockSupabaseClient.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });
      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });

    it('should throw an error when supabase returns an error on delete', async () => {
      mockSupabaseClient.select.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });
      await expect(service.remove('1')).rejects.toThrow(
        'Failed to delete todo: DB error',
      );
    });
  });
});
