import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { FeishuHttpService } from '../http/feishu-http.service';

export interface TaskMember {
  id: string;
  type: 'user';
  role: 'assignee' | 'follower';
}

export interface CreateTaskPayload {
  summary: string;
  description?: string;
  members?: TaskMember[];
}

export interface UpdateTaskPayload {
  summary?: string;
  description?: string;
  members?: TaskMember[];
  completed_at?: string;
}

export interface FeishuTask {
  guid: string;
  completed_at?: string;
  [key: string]: unknown;
}

interface CreateTaskResponse {
  task: {
    guid: string;
    [key: string]: unknown;
  };
}

interface UpdateTaskResponse {
  task: {
    guid: string;
    [key: string]: unknown;
  };
}

interface GetTaskResponse {
  task: FeishuTask;
}

@Injectable()
export class FeishuTaskService {
  constructor(private readonly http: FeishuHttpService) {}

  async createTask(payload: CreateTaskPayload): Promise<string> {
    const body: Record<string, unknown> = {
      summary: payload.summary,
    };
    if (payload.description !== undefined) {
      body.description = payload.description;
    }
    if (payload.members && payload.members.length > 0) {
      body.members = payload.members;
    }
    const response = await this.http.post<CreateTaskResponse>(
      '/open-apis/task/v2/tasks',
      body,
      { params: { user_id_type: 'user_id' } },
    );
    const taskGuid = response.data.data?.task?.guid;
    if (!taskGuid) {
      throw new InternalServerErrorException(
        'Feishu Task API did not return a task guid',
      );
    }
    return taskGuid;
  }

  async getTask(taskGuid: string): Promise<FeishuTask> {
    const response = await this.http.get<GetTaskResponse>(
      `/open-apis/task/v2/tasks/${taskGuid}`,
      { params: { user_id_type: 'user_id' } },
    );
    const task = response.data.data?.task;
    if (!task?.guid) {
      throw new InternalServerErrorException(
        'Feishu Task API did not return a task guid',
      );
    }
    return task;
  }

  async updateTask(
    taskGuid: string,
    payload: UpdateTaskPayload,
  ): Promise<void> {
    const task: Record<string, unknown> = {};
    if (payload.summary !== undefined) task.summary = payload.summary;
    if (payload.description !== undefined)
      task.description = payload.description;
    if (payload.members !== undefined) task.members = payload.members;
    if (payload.completed_at !== undefined)
      task.completed_at = payload.completed_at;

    const updateFields = Object.keys(task);
    if (updateFields.length === 0) return;

    await this.http.patch<UpdateTaskResponse>(
      `/open-apis/task/v2/tasks/${taskGuid}`,
      { task, update_fields: updateFields },
      { params: { user_id_type: 'user_id' } },
    );
  }
}
