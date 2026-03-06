import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { Todo } from './interfaces/todo.interface';

@Injectable()
export class TodoService {
  private readonly TABLE = 'todos';

  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(): Promise<Todo[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to retrieve todos: ${error.message}`);
    }
    return data as Todo[];
  }

  async findOne(id: string): Promise<Todo> {
    const result = await this.supabaseService
      .getClient()
      .from(this.TABLE)
      .select('*')
      .eq('id', id)
      .single();
    if (result.error) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }
    return result.data as Todo;
  }

  async create(createTodoDto: CreateTodoDto): Promise<Todo> {
    const result = await this.supabaseService
      .getClient()
      .from(this.TABLE)
      .insert({ ...createTodoDto, completed: false })
      .select()
      .single();
    if (result.error) {
      throw new Error(`Failed to create todo: ${result.error.message}`);
    }
    return result.data as Todo;
  }

  async update(id: string, updateTodoDto: UpdateTodoDto): Promise<Todo> {
    const result = await this.supabaseService
      .getClient()
      .from(this.TABLE)
      .update({ ...updateTodoDto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (result.error) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }
    return result.data as Todo;
  }

  async remove(id: string): Promise<void> {
    const result = await this.supabaseService
      .getClient()
      .from(this.TABLE)
      .delete()
      .eq('id', id)
      .select();
    if (result.error) {
      throw new Error(`Failed to delete todo: ${result.error.message}`);
    }
    if (!result.data || result.data.length === 0) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }
  }
}
